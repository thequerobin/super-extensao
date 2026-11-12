import { migrateLegacy } from "../../../../newtab/engine/migration";
import { importStore } from "./action";
import { cache, db, cacheStorage, dbStorage } from "./state";
/** Read old cache without deleting the database before writes have committed. */
function readCache(): Promise<Record<string, unknown> | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("tabliss");
    open.onupgradeneeded = () => {
      open.transaction?.abort();
    };
    open.onerror = () => {
      if (open.error?.name === "AbortError") resolve(undefined);
      else reject(open.error);
    };
    open.onblocked = () => reject(Error("Legacy cache blocked"));
    open.onsuccess = () => {
      const connection = open.result;
      if (!connection.objectStoreNames.contains("cache")) {
        connection.close();
        resolve(undefined);
        return;
      }
      try {
        const transaction = connection.transaction("cache", "readonly");
        let data: Record<string, unknown> | undefined;
        transaction.oncomplete = () => {
          connection.close();
          resolve(data);
        };
        transaction.onabort = () => {
          connection.close();
          reject(transaction.error);
        };
        const read = transaction.objectStore("cache").get("persist:cache");
        read.onsuccess = () => {
          data = read.result;
        };
      } catch (error) {
        connection.close();
        reject(error);
      }
    };
  });
}
export const migrate = async (): Promise<void> => {
  const [configSession, cacheSession] = await Promise.all([
    dbStorage,
    cacheStorage.catch(() => undefined),
  ]);
  const web = BUILD_TARGET === "web",
    key = web ? "tabliss/data/persist:data" : "persist:data";
  await migrateLegacy(db, cache, importStore, configSession, cacheSession, {
    async read() {
      if (web) {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : undefined;
      }
      return (await browser.storage.sync.get(key))[key];
    },
    async remove() {
      if (web) localStorage.removeItem(key);
      else await browser.storage.sync.remove(key);
    },
    readCache,
  });
};
