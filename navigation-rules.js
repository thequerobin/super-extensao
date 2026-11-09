(function (root) {
  "use strict";
  const AUTOPLAY_DEFAULTS = {enabled:true, globalBehavior:"block", siteSettings:{}};
  const TAB_DEFAULTS = {enabled:true, scope:"last", singleNewTab:false, newTabLast:false};
  function normalizeHostname(input) {
    if (typeof input !== "string" || !input.trim() || /[\s*]/u.test(input.trim())) throw new Error("Informe um domínio ou URL válido, sem curingas.");
    const text = input.trim();
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    if (!["https:","http:"].includes(url.protocol) || url.username || url.password) throw new Error("Use um domínio ou URL HTTP/HTTPS.");
    const host = url.hostname.toLowerCase().replace(/\.+$/u, "");
    if (!host || host.startsWith(".") || host.includes("..") || ["__proto__","constructor","prototype"].includes(host)) throw new Error("Domínio inválido.");
    return host;
  }
  function autoplaySettings(value = {}) {
    const settings = value && typeof value === "object" ? value : {};
    const rules = {};
    for (const [domain, permission] of Object.entries(settings.siteSettings || {})) {
      if (!["allow","block"].includes(permission)) continue;
      try { rules[normalizeHostname(domain)] = permission; } catch { /* Ignore invalid imported entries. */ }
    }
    return {enabled:settings.enabled !== false, globalBehavior:settings.globalBehavior === "allow" ? "allow" : "block", siteSettings:rules};
  }
  function autoplayPolicy(hostname, value) {
    const settings = autoplaySettings(value);
    let behavior = settings.globalBehavior;
    let matched = "";
    const host = String(hostname || "").toLowerCase().replace(/\.+$/u, "");
    for (const [domain, permission] of Object.entries(settings.siteSettings)) {
      if ((host === domain || host.endsWith("." + domain)) && domain.length > matched.length) {
        matched = domain; behavior = permission;
      }
    }
    return {block:settings.enabled && behavior === "block", behavior, matched};
  }
  function tabSettings(value = {}) {
    return {enabled:value?.enabled !== false, scope:["last","first","every"].includes(value?.scope) ? value.scope : "last", singleNewTab:value?.singleNewTab === true, newTabLast:value?.singleNewTab === true && value?.newTabLast === true};
  }
  function isNewTab(tab, dashboardUrl) {
    const value = tab?.pendingUrl || tab?.url || "";
    if (/^(chrome|edge|helium|brave):\/\/newtab\/?(?:[?#].*)?$/u.test(value)) return true;
    if (dashboardUrl) {
      try {
        const current = new URL(value), dashboard = new URL(dashboardUrl);
        return current.protocol === dashboard.protocol && current.host === dashboard.host && current.pathname === dashboard.pathname;
      } catch {}
    }
    return false;
  }
  function protectsWindow(settings, windowId, firstId, windowCount) {
    return settings.enabled && (settings.scope === "every" || windowCount === 1 || (settings.scope === "first" && windowId === firstId));
  }
  root.SuperTools = {AUTOPLAY_DEFAULTS, TAB_DEFAULTS, normalizeHostname, autoplaySettings, autoplayPolicy, tabSettings, isNewTab, protectsWindow};
})(globalThis);
