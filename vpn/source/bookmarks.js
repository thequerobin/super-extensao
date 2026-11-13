/* SPDX-License-Identifier: GPL-3.0-only */
import { bookmarkFolders as folders, bookmarkDomains } from "../../rules.js";
import { normalizeDomain } from "./model";

export function bookmarkFolders(tree) {
  return folders(tree, true).map(({node, label}) => ({...node, label}));
}

export function bookmarkPreview(folder, recursive, existing) {
  const result = folder ? bookmarkDomains(folder, recursive, value => {
    const url = new URL(value);
    if (url.username || url.password) throw new Error("invalidDomain");
    // VPN routes use hostnames, regardless of bookmark path or port.
    return normalizeDomain(url.hostname);
  }) : {domains: [], skipped: 0};
  const known = new Set(existing.map(rule => rule.domain));
  const fresh = result.domains.filter(domain => !known.has(domain));
  return {all: result.domains, fresh, skipped: result.skipped, duplicates: result.domains.length - fresh.length};
}
