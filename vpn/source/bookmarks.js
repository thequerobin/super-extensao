/* SPDX-License-Identifier: GPL-3.0-only */
import {normalizeDomain} from "./model";
// The shared importer handles folders, duplicate detection and preview rendering.
export function normalizeBookmarkDomain(value) {
  const url = new URL(value);
  if (url.username || url.password) throw new Error("invalidDomain");
  return normalizeDomain(url.hostname);
}
