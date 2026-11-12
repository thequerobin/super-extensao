import * as DB from "./db";
import {
  connect,
  Session,
  StorageError,
} from "../../../../../newtab/engine/persistence";
import {
  extensionPort,
  indexeddb as ownIndexedDB,
} from "../../../../../newtab/engine/browser-storage";
export { StorageError };
export const indexeddb = async (
  db: DB.Database,
  name: string,
): Promise<Session> => lifecycle(await ownIndexedDB(db, name));
declare global {
  interface Window {
    SuperPreferences?: {
      locale: {
        normalize(value: unknown): "en" | "pt-BR";
        set(value: unknown): Promise<void>;
        watch(callback: (locale: "en" | "pt-BR") => void): () => void;
      };
    };
  }
}
function lifecycle(session: Session): Session {
  const flush = () => {
    void session.flush().catch(() => {});
  };
  const end = (event: PageTransitionEvent) => {
    if (!event.persisted) session.dispose();
  };
  window.addEventListener("beforeunload", flush);
  window.addEventListener("pagehide", end);
  const dispose = session.dispose;
  session.dispose = () => {
    window.removeEventListener("beforeunload", flush);
    window.removeEventListener("pagehide", end);
    dispose();
  };
  return session;
}
export const extension = async (
  db: DB.Database,
  name: string,
  area: "local" | "sync" | "managed",
): Promise<Session> => {
  const locale =
    name === "tabliss/config" && area === "sync"
      ? window.SuperPreferences?.locale
      : undefined;
  const port = extensionPort(
    browser.storage[area],
    browser.storage.onChanged,
    name,
    area,
    (key, value) =>
      key === "locale" && locale ? locale.normalize(value) : value,
  );
  const session = await connect(db, port);
  const unwatch = locale?.watch((value) => {
    if (DB.get(db, "locale") !== value) DB.put(db, "locale", value);
  });
  const dispose = session.dispose;
  session.dispose = () => {
    unwatch?.();
    dispose();
  };
  return lifecycle(session);
};
