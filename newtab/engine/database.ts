/* SPDX-License-Identifier: GPL-3.0-only */
/** Own in-memory store. The compatibility API is consumed by the existing React views. */
export type Key<T = any> = keyof T & string;
export type Val = unknown;
export type Change = [key: string, value: unknown];
export type Listener = (change: Change) => void;
export type Unsubscribe = () => void;
export interface Snapshot<T = any> extends Iterable<Change> {
  cache: Map<string, unknown>;
  parent: Snapshot<T> | null;
}
export interface Database<T = any> extends Snapshot<T> {
  listeners: Set<Listener>;
}
function snapshot<T>(
  parent: Snapshot<T> | null,
  entries: Iterable<Change> = [],
): Snapshot<T> {
  const cache = new Map(entries);
  return { cache, parent, [Symbol.iterator]: () => cache.entries() };
}
export function init<T = Record<string, unknown>>(defaults?: T): Database<T> {
  return Object.assign(
    snapshot<T>(defaults ? snapshot<T>(null, Object.entries(defaults)) : null),
    { listeners: new Set<Listener>() },
  );
}
export function get<T, K extends Key<T>>(db: Snapshot<T>, key: K): T[K] {
  for (let layer: Snapshot<T> | null = db; layer; layer = layer.parent) {
    if (layer.cache.has(key)) return layer.cache.get(key) as T[K];
  }
  return undefined as unknown as T[K];
}
type Matching<T, P extends string> = {
  [K in keyof T & string]: K extends `${P}${string}` ? [K, T[K]] : never;
}[keyof T & string];
export function* prefix<T, P extends string>(
  db: Snapshot<T>,
  path: P,
): Generator<Matching<T, P>> {
  const visited = new Set<string>();
  for (let layer: Snapshot<T> | null = db; layer; layer = layer.parent) {
    for (const entry of layer.cache) {
      if (entry[0].startsWith(path) && !visited.has(entry[0])) {
        visited.add(entry[0]);
        yield entry as Matching<T, P>;
      }
    }
  }
}
function emit(db: Database, changes: Change[]): void {
  for (const change of changes)
    for (const listener of [...db.listeners]) listener(change);
}
export function put<T, K extends Key<T>>(
  db: Snapshot<T>,
  key: K,
  value: T[K] | undefined,
): void {
  db.cache.set(key, value);
  if ("listeners" in db) emit(db as Database, [[key, value]]);
}
export function del<T, K extends Key<T>>(db: Snapshot<T>, key: K): void {
  if ("listeners" in db) {
    db.cache.delete(key);
    emit(db as Database, [[key, undefined]]);
  } else db.cache.set(key, undefined);
}
export function listen(db: Database, listener: Listener): Unsubscribe {
  db.listeners.add(listener);
  return () => {
    db.listeners.delete(listener);
  };
}
/** Notifications see the whole committed batch; a thrown callback commits nothing. */
export function atomic<T>(
  db: Database<T>,
  run: (draft: Snapshot<T>) => void,
): void {
  const draft = snapshot(db);
  run(draft);
  const changes = [...draft.cache];
  for (const [key, value] of changes) db.cache.set(key, value);
  emit(db, changes);
}
/** Restore defaults in one operation, optionally overlaying an already validated import. */
export function replace<T>(
  db: Database<T>,
  values: Iterable<Change> = [],
): void {
  const previous = [...db.cache.keys()];
  db.cache.clear();
  const changes = new Map<string, unknown>(
    previous.map((key) => [key, undefined]),
  );
  for (const [key, value] of values) {
    db.cache.set(key, value);
    changes.set(key, value);
  }
  emit(db, [...changes]);
}
