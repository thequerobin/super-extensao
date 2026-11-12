/* SPDX-License-Identifier: GPL-3.0-only */
import * as DB from "./database";
import * as Events from "./events";
export class StorageError extends Error {
  cause?: Error;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    if (cause instanceof Error) this.cause = cause;
  }
}
export interface StoragePort {
  read(): Promise<DB.Change[]>;
  write(changes: DB.Change[]): Promise<void>;
  watch?(receive: (changes: DB.Change[]) => void): () => void;
  close?(): void;
}
export interface Session extends Events.Stream<StorageError> {
  flush(): Promise<void>;
  dispose(): void;
}
/** Ordered persistence, last mutation per key, and external changes without write echoes. */
export async function connect(
  db: DB.Database,
  port: StoragePort,
): Promise<Session> {
  const errors = Events.init<StorageError>();
  const dirty = new Map<string, unknown>(),
    incoming = new Map<string, unknown>(),
    versions = new Map<string, number>(),
    pending = new Map<string, number>();
  let applying = false,
    ready = false,
    disposed = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    inFlight = false;
  let active: Promise<void> = Promise.resolve();
  const apply = () => {
    if (!ready || inFlight || disposed) return;
    applying = true;
    try {
      for (const [key, value] of incoming) {
        if (dirty.has(key) || pending.has(key)) continue;
        incoming.delete(key);
        const previous = DB.get(db, key);
        if (Object.is(previous, value)) continue;
        if (value === undefined) DB.del(db, key);
        else if (JSON.stringify(previous) !== JSON.stringify(value))
          DB.put(db, key, value);
      }
    } finally {
      applying = false;
    }
  };
  const schedule = () => {
    if (ready && !disposed && timer === undefined)
      timer = setTimeout(() => {
        timer = undefined;
        void flush().catch(() => {});
      }, 0);
  };
  const unlisten = DB.listen(db, ([key, value]) => {
    if (applying || disposed) return;
    versions.set(key, (versions.get(key) || 0) + 1);
    dirty.set(key, value);
    schedule();
  });
  const unwatch =
    port.watch?.((changes) => {
      for (const change of changes) incoming.set(...change);
      apply();
    }) || (() => {});
  function flush(): Promise<void> {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (!dirty.size) return active;
    // Capture values now. A later batch must never overtake an earlier native write.
    const batch = [...dirty].map(
      ([key, value]) =>
        [
          key,
          typeof (globalThis as any).structuredClone === "function"
            ? (globalThis as any).structuredClone(value)
            : value,
        ] as DB.Change,
    );
    const captured = new Map(batch.map(([key]) => [key, versions.get(key)]));
    for (const [key] of batch) pending.set(key, (pending.get(key) || 0) + 1);
    dirty.clear();
    const previous = active.catch(() => {});
    const task = previous.then(async () => {
      inFlight = true;
      try {
        await port.write(batch);
      } catch (error) {
        for (const [key, value] of batch)
          if (versions.get(key) === captured.get(key) && !dirty.has(key))
            dirty.set(key, value);
        const failure = new StorageError("Cannot save new-tab storage", error);
        Events.publish(errors, failure);
        throw failure;
      } finally {
        for (const [key] of batch) {
          const count = pending.get(key)! - 1;
          if (count) pending.set(key, count);
          else pending.delete(key);
        }
        inFlight = false;
        apply();
      }
    });
    active = task;
    return task;
  }
  try {
    const initial = await port.read();
    applying = true;
    try {
      DB.atomic(db, (draft) => {
        for (const [key, value] of initial)
          if (!dirty.has(key)) DB.put(draft, key, value);
      });
    } finally {
      applying = false;
    }
    ready = true;
    apply();
    if (dirty.size) schedule();
  } catch (error) {
    unlisten();
    unwatch();
    port.close?.();
    throw new StorageError("Cannot open new-tab storage", error);
  }
  return Object.assign(errors, {
    flush,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      unlisten();
      unwatch();
      void active.then(
        () => port.close?.(),
        () => port.close?.(),
      );
    },
  });
}
