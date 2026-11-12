export class VpnIOError extends Error {
  constructor(
    public readonly code: string,
    public readonly uncertain = false,
  ) {
    super(code);
    this.name = "VpnIOError";
  }
}
export const isVpnIOError = (value: unknown): value is VpnIOError =>
  !!value &&
  typeof value === "object" &&
  (value as { name?: string }).name === "VpnIOError";
export interface IOClock {
  set(run: () => void, ms: number): unknown;
  clear(timer: unknown): void;
}
const clock: IOClock = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};
/** Bounds the observer, never claims to cancel the underlying native operation. */
export function observe<T>(
  operation: Promise<T>,
  ms: number,
  error: VpnIOError,
  timing = clock,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = timing.set(() => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    }, ms);
    operation.then(
      (value) => {
        if (!settled) {
          settled = true;
          timing.clear(timer);
          resolve(value);
        }
      },
      (reason) => {
        if (!settled) {
          settled = true;
          timing.clear(timer);
          reject(reason);
        }
      },
    );
  });
}
/** Mutation timeout rejects its caller but keeps the native lane until actual settlement. */
export class StorageLane {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly timing = clock) {}
  read<T>(run: () => Promise<T>, ms: number): Promise<T> {
    let expired = false;
    const work = this.tail.then(() => {
      if (expired) throw new VpnIOError("VpnStorageReadTimedOut");
      return run();
    });
    return observe(
      work,
      ms,
      new VpnIOError("VpnStorageReadTimedOut"),
      this.timing,
    ).then(
      (value) => {
        expired = true;
        return value;
      },
      (error) => {
        expired = true;
        throw error;
      },
    );
  }
  mutate(run: () => Promise<void>, ms: number): Promise<void> {
    // Keep queued mutations (especially logout/removal) even after observer timeout.
    const work = this.tail.then(run);
    this.tail = work.catch(() => {});
    return observe(
      work,
      ms,
      new VpnIOError("VpnStorageWriteTimedOut", true),
      this.timing,
    );
  }
}
export const readRequests = new Set([
  "connectionState",
  "protectionStatus",
  "state",
  "user",
  "pmUser",
  "locale",
]);
export class RequestChannel {
  private reads = new Set<(reason: VpnIOError) => void>();
  private mutations = new Map<string, Promise<unknown>>();
  constructor(private readonly timing = clock) {}
  cancelReads(): void {
    for (const cancel of [...this.reads])
      cancel(new VpnIOError("VpnOperationCancelled"));
  }
  send<T>(type: string, run: () => Promise<T>, ms: number): Promise<T> {
    const read = readRequests.has(type);
    if (!read && this.mutations.has(type))
      return Promise.reject(new VpnIOError("VpnOperationPending", true));
    if (!read) this.cancelReads();
    let task: Promise<T>;
    try {
      task = Promise.resolve(run());
    } catch {
      task = Promise.reject(new VpnIOError("VpnWorkerUnavailable", !read));
    }
    const actual = task.catch((error) => {
      if (isVpnIOError(error)) throw error;
      throw new VpnIOError("VpnWorkerUnavailable", !read);
    });
    if (!read) {
      this.mutations.set(type, actual);
      void actual.then(
        () => {
          if (this.mutations.get(type) === actual) this.mutations.delete(type);
        },
        () => {
          if (this.mutations.get(type) === actual) this.mutations.delete(type);
        },
      );
      return observe(
        actual,
        ms,
        new VpnIOError("VpnOperationPending", true),
        this.timing,
      );
    }
    let cancel!: (reason: VpnIOError) => void;
    const cancelled = new Promise<T>((_, reject) => {
      cancel = reject;
    });
    this.reads.add(cancel);
    return observe(
      Promise.race([actual, cancelled]),
      ms,
      new VpnIOError("VpnWorkerTimedOut"),
      this.timing,
    ).then(
      (value) => {
        this.reads.delete(cancel);
        return value;
      },
      (error) => {
        this.reads.delete(cancel);
        throw error;
      },
    );
  }
}
