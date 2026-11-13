/* Shared by the popup, worker and isolated tests. No browser calls here. */
(function (root) {
  "use strict";
  function normalizeDomain(value) {
    if (typeof value !== "string") throw new Error("Informe um domínio ou uma URL HTTP/HTTPS.");
    const input = value.trim();
    if (!input || /[\s*]/u.test(input)) throw new Error("Domínio inválido. Não use espaços nem curingas (*).");
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname) {
      throw new Error("Use somente domínios ou URLs HTTP/HTTPS sem usuário e senha.");
    }
    const hostname = url.hostname.replace(/\.+$/u, "").toLowerCase();
    if (!hostname || hostname.startsWith(".") || hostname.includes("..")) throw new Error("Domínio inválido.");
    // Keep non-default ports for exact cache/localStorage origins.
    return hostname + (url.port ? `:${url.port}` : "");
  }
  function normalizeList(values) {
    if (!Array.isArray(values)) throw new Error("Lista de exceções inválida; limpeza cancelada.");
    return [...new Set(values.map(normalizeDomain))].sort();
  }
  function removalOptions(values) {
    const hosts = normalizeList(values);
    const origins = [...new Set(hosts.flatMap(host => [new URL(`http://${host}`).origin, new URL(`https://${host}`).origin]))];
    return origins.length ? {since: 0, excludeOrigins: origins} : {since: 0};
  }
  function removalPlan(settings) {
    // Validate every exception list before deleting any data.
    const cookieOptions = removalOptions(settings.excludedSites === undefined ? [] : settings.excludedSites);
    const scoped = [
      {key:"clearCache", type:"cache", options:removalOptions(settings.excludedCacheSites === undefined ? [] : settings.excludedCacheSites)},
      {key:"clearLocalStorage", type:"localStorage", options:removalOptions(settings.excludedLocalStorageSites === undefined ? [] : settings.excludedLocalStorageSites)}
    ];
    const globalData = {};
    for (const [key, type] of [["clearHistory", "history"], ["clearDownloads", "downloads"], ["clearFormData", "formData"]]) {
      if (settings[key] === true) globalData[type] = true;
    }
    for (const item of scoped) if (settings[item.key] === true && !item.options.excludeOrigins) globalData[item.type] = true;
    const plan = Object.keys(globalData).length ? [{method:"remove", options:{since:0}, data:globalData}] : [];
    for (const item of scoped) if (settings[item.key] === true && item.options.excludeOrigins)
      plan.push({method:"remove", options:item.options, data:{[item.type]:true}});
    // Cookies run last, preserving the original worker's dedicated cookie API.
    if (settings.clearCookies === true) plan.push({method: "removeCookies", options: cookieOptions});
    return plan;
  }
  function bookmarkDomains(folder, recursive = true, normalize = normalizeDomain) {
    const domains = new Set();
    let skipped = 0;
    function visit(node, top) {
      if (node.url) {
        try {
          // Bookmarks must be URLs, never treat javascript:/file: as a hostname.
          const url = new URL(node.url);
          if (!["https:", "http:"].includes(url.protocol)) throw new Error();
          domains.add(normalize(url.href));
        } catch { skipped++; }
      } else if (top || recursive) {
        for (const child of node.children || []) visit(child, false);
      }
    }
    visit(folder, true);
    return {domains: [...domains].sort(), skipped};
  }
  function bookmarkFolders(tree, includeNodes = false) {
    const folders = [];
    function visit(node, path) {
      if (node.url) return;
      const next = node.title ? [...path, node.title] : path;
      if (node.id !== "0") folders.push({id: node.id, label: next.join(" / ") || "Favoritos", ...(includeNodes ? {node} : {})});
      for (const child of node.children || []) visit(child, next);
    }
    tree.forEach(node => visit(node, []));
    return folders;
  }
  const rules = {normalizeDomain, normalizeList, removalOptions, removalPlan, bookmarkDomains, bookmarkFolders};
  if (typeof module !== "undefined" && module.exports) module.exports = rules;
  else root.ClearRules = rules;
})(globalThis);
