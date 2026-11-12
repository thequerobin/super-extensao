/* SPDX-License-Identifier: GPL-3.0-only */
import * as DB from "./database";
import { State } from "./model";
import { Session } from "./persistence";
export function usedIds(db: DB.Database<State>): Set<string> {
  return new Set([
    DB.get(db, "background").id,
    ...Array.from(DB.prefix(db, "widget/"))
      .map(([, value]) => value?.id)
      .filter((id): id is string => !!id),
  ]);
}
export function clearDangling(
  db: DB.Database<State>,
  cache: DB.Database,
): void {
  const used = usedIds(db);
  for (const [key] of DB.prefix(db, "data/"))
    if (!used.has(key.slice(5))) DB.del(db, key);
  for (const [key] of cache) if (!used.has(key)) DB.del(cache, key);
}
export interface LegacyPorts {
  read(): Promise<unknown>;
  remove(): Promise<void>;
  readCache?(): Promise<Record<string, unknown> | undefined>;
}
/** Never remove the legacy source before configuration and cache writes are confirmed. */
async function performMigration(
  db: DB.Database<State>,
  cache: DB.Database,
  load: (value: unknown) => void,
  configSession: Session,
  cacheSession: Session | undefined,
  ports: LegacyPorts,
): Promise<void> {
  const previous = await ports.read();
  if (!previous) return;
  if (
    [...db.cache.keys()].some(
      (key) =>
        key === "background" ||
        key.startsWith("widget/") ||
        key.startsWith("data/"),
    )
  ) {
    await configSession.flush();
    return;
  }
  const oldCache = await ports.readCache?.();
  // A user edit or another initializer may have populated the layout while the cache was read.
  if (
    [...db.cache.keys()].some(
      (key) =>
        key === "background" ||
        key.startsWith("widget/") ||
        key.startsWith("data/"),
    )
  )
    return;
  load(previous);
  if (oldCache)
    for (const id of usedIds(db))
      if (Object.prototype.hasOwnProperty.call(oldCache, id))
        DB.put(cache, id, oldCache[id]);
  clearDangling(db, cache);
  await configSession.flush();
  if (cacheSession) await cacheSession.flush();
  else if (
    oldCache &&
    [...usedIds(db)].some((id) =>
      Object.prototype.hasOwnProperty.call(oldCache, id),
    )
  )
    throw Error("Cannot migrate cached images");
  await ports.remove();
}

const migrations = new WeakMap<DB.Database<State>, Promise<void>>();
export function migrateLegacy(
  ...args: Parameters<typeof performMigration>
): Promise<void> {
  const db = args[0],
    existing = migrations.get(db);
  if (existing) return existing;
  const task = performMigration(...args);
  migrations.set(db, task);
  void task.then(
    () => {
      if (migrations.get(db) === task) migrations.delete(db);
    },
    () => {
      if (migrations.get(db) === task) migrations.delete(db);
    },
  );
  return task;
}
