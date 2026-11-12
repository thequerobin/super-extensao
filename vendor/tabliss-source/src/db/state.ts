import { DB, Storage } from "../lib";
import { defaultLocale } from "../locales";

import { defaults, State } from "../../../../newtab/engine/model";
export * from "../../../../newtab/engine/model";
const initData = defaults(defaultLocale);

// Database storage
export const db = DB.init<State>(initData);

// Cache storage
export const cache = DB.init<Record<string, unknown | undefined>>();

// Persist data
export const dbStorage =
  BUILD_TARGET === "web"
    ? Storage.indexeddb(db, "tabliss/config")
    : Storage.extension(db, "tabliss/config", "sync");

export const cacheStorage =
  BUILD_TARGET === "firefox"
    ? Storage.extension(cache, "tabliss/cache", "local")
    : Storage.indexeddb(cache, "tabliss/cache");
