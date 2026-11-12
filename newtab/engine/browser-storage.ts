/* SPDX-License-Identifier: GPL-3.0-only */
import * as DB from "./database";
import { connect, Session, StoragePort } from "./persistence";
interface Area {
  get(): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<unknown>;
  remove(keys: string[]): Promise<unknown>;
}
interface Changes {
  addListener(
    fn: (values: Record<string, { newValue?: unknown }>, area: string) => void,
  ): void;
  removeListener(
    fn: (values: Record<string, { newValue?: unknown }>, area: string) => void,
  ): void;
}
export function extensionPort(
  area: Area,
  events: Changes | undefined,
  name: string,
  areaName: string,
  normalize?: (key: string, value: unknown) => unknown,
): StoragePort {
  const prefix = name + "/";
  return {
    async read() {
      const source = await area.get();
      return Object.entries(source)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => {
          const local = key.slice(prefix.length);
          return [
            local,
            normalize ? normalize(local, value) : value,
          ] as DB.Change;
        });
    },
    async write(changes) {
      const updates: Record<string, unknown> = {},
        deletes: string[] = [];
      for (const [key, value] of changes) {
        if (value === undefined) deletes.push(prefix + key);
        else
          Object.defineProperty(updates, prefix + key, {
            value,
            enumerable: true,
            configurable: true,
          });
      }
      if (Object.keys(updates).length) await area.set(updates);
      if (deletes.length) await area.remove(deletes);
    },
    watch(receive) {
      const listener = (
        values: Record<string, { newValue?: unknown }>,
        changedArea: string,
      ) => {
        if (changedArea !== areaName) return;
        const changes: DB.Change[] = [];
        for (const [key, change] of Object.entries(values)) {
          if (key.startsWith(prefix)) {
            const local = key.slice(prefix.length);
            changes.push([
              local,
              change.newValue === undefined
                ? undefined
                : normalize
                  ? normalize(local, change.newValue)
                  : change.newValue,
            ]);
          }
        }
        if (changes.length) receive(changes);
      };
      events?.addListener(listener);
      return () => events?.removeListener(listener);
    },
  };
}
export function indexedDBPort(factory: IDBFactory, name: string): StoragePort {
  let connection: IDBDatabase | undefined,
    closed = false;
  return {
    read() {
      return new Promise((resolve, reject) => {
        const request = factory.open(name, 1);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(Error("IndexedDB open blocked"));
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("changes"))
            request.result.createObjectStore("changes");
        };
        request.onsuccess = () => {
          connection = request.result;
          if (closed) {
            connection.close();
            return;
          }
          connection.onversionchange = () => connection?.close();
          const values: DB.Change[] = [];
          try {
            const transaction = connection.transaction("changes", "readonly");
            transaction.onabort = () =>
              reject(transaction.error || Error("IndexedDB read aborted"));
            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => resolve(values);
            const cursor = transaction.objectStore("changes").openCursor();
            cursor.onerror = () => reject(cursor.error);
            cursor.onsuccess = () => {
              if (cursor.result) {
                if (typeof cursor.result.key === "string")
                  values.push([cursor.result.key, cursor.result.value]);
                cursor.result.continue();
              }
            };
          } catch (error) {
            reject(error);
          }
        };
      });
    },
    write(changes) {
      return new Promise((resolve, reject) => {
        try {
          if (!connection) throw Error("IndexedDB is not open");
          const transaction = connection.transaction("changes", "readwrite");
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () =>
            reject(transaction.error || Error("IndexedDB write aborted"));
          const store = transaction.objectStore("changes");
          for (const [key, value] of changes) {
            if (value === undefined) store.delete(key);
            else store.put(value, key);
          }
        } catch (error) {
          reject(error);
        }
      });
    },
    close() {
      closed = true;
      connection?.close();
    },
  };
}
/** Preserve the legacy database and Blob values; there is no key rename/copy migration. */
export const indexeddb = (
  db: DB.Database,
  name: string,
  factory: IDBFactory = indexedDB,
): Promise<Session> => connect(db, indexedDBPort(factory, name));
