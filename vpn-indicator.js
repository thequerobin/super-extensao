"use strict";
// Host-owned icon overlay. Reads only confirmed connection state and effective
// routing rules, never session tokens, proxy passwords or browsing traffic.
(() => {
  const COLORS = { direct: "#287de0", protected: "#18a568" };
  const BASE = { 16: "icons/icon16.png", 32: "icons/icon32.png" };
  const rendered = new Map(), applied = new Map();
  let reader = () => ({ connected: false }), revision = 0, queue = Promise.resolve();

  const usesVpn = globalThis.SuperVpnRouting.usesVpn;
  async function icon(mode) {
    if (!rendered.has(mode)) rendered.set(mode, (async () => {
      const result = {};
      for (const [sizeText, path] of Object.entries(BASE)) {
        const size = Number(sizeText);
        const bitmap = await createImageBitmap(await (await fetch(chrome.runtime.getURL(path))).blob());
        const canvas = new OffscreenCanvas(size, size), ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0, size, size);
        bitmap.close();
        const radius = size * .22, x = size - radius - size * .025, y = radius + size * .025;
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[mode]; ctx.fill();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = size * .055; ctx.stroke();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        if (mode === "protected") { ctx.moveTo(x - radius * .45, y); ctx.lineTo(x - radius * .1, y + radius * .3); ctx.lineTo(x + radius * .45, y - radius * .35); }
        else { ctx.moveTo(x - radius * .35, y); ctx.lineTo(x + radius * .35, y); }
        ctx.stroke();
        result[size] = ctx.getImageData(0, 0, size, size);
      }
      return result;
    })().catch((error) => { rendered.delete(mode); throw error; }));
    return rendered.get(mode);
  }
  function refresh() {
    ++revision;
    queue = queue.then(() => update(revision));
    return queue;
  }
  function controlsProxy(incognito) {
    return new Promise((resolve) => {
      if (!chrome.proxy?.settings?.get) return resolve(false);
      chrome.proxy.settings.get({ incognito }, (details) => {
        if (chrome.runtime.lastError) return resolve(false);
        const proxy = details?.value?.rules?.singleProxy;
        resolve(details?.levelOfControl === "controlled_by_this_extension" && !(proxy?.host === "localhost" && proxy?.port === 9));
      });
    });
  }
  function setTabAction(method, details) {
    return new Promise((resolve, reject) => {
      chrome.action[method](details, () => {
        // Reading lastError in the callback consumes the error if the tab closed
        // between tabs.query() and this per-tab action (also in callback-only hosts).
        const message = chrome.runtime.lastError?.message;
        if (message) reject(new Error(message));
        else resolve();
      });
    });
  }
  async function update(ticket) {
    try {
      const snapshot = reader() || {};
      const [tabs, locale] = await Promise.all([chrome.tabs.query({}), SuperPreferences.locale.get()]);
      if (ticket !== revision) return;
      const regularProxy = snapshot.connected && await controlsProxy(false);
      const privateProxy = snapshot.connected && tabs.some((tab) => tab.incognito) && await controlsProxy(true);
      if (ticket !== revision) return;
      for (const tab of tabs) {
        if (!Number.isInteger(tab.id)) continue;
        const mode = !snapshot.connected ? "off" : (tab.incognito ? privateProxy : regularProxy) && usesVpn(tab.url, snapshot) ? "protected" : "direct";
        const key = `${mode}:${locale}`;
        if (applied.get(tab.id) === key) continue;
        const title = mode === "off" ? "Super Extensão" : locale === "pt-BR"
          ? `Super Extensão · VPN ativa: ${mode === "protected" ? "este site usa a VPN" : "este site não usa a VPN"}`
          : `Super Extensão · VPN connected: ${mode === "protected" ? "this site uses the VPN" : "this site bypasses the VPN"}`;
        const payload = mode === "off" ? { path: BASE } : { imageData: await icon(mode) };
        if (ticket !== revision) return;
        try {
          await setTabAction("setIcon", { tabId: tab.id, ...payload });
          await setTabAction("setTitle", { tabId: tab.id, title });
          if (ticket === revision) applied.set(tab.id, key);
        } catch { /* The tab may have closed while its icon was being prepared. */ }
      }
    } catch (error) { console.warn("VPN indicator:", error); }
  }
  globalThis.SuperVpnIndicator = {
    attach(getSnapshot) { reader = getSnapshot; void refresh(); },
    refresh,
    usesVpn,
  };
  chrome.tabs?.onActivated?.addListener(() => { void refresh(); });
  chrome.tabs?.onUpdated?.addListener((_id, change) => { if (change.url || change.status === "complete") void refresh(); });
  chrome.tabs?.onRemoved?.addListener((id) => { applied.delete(id); });
  chrome.windows?.onFocusChanged?.addListener(() => { void refresh(); });
  chrome.proxy?.settings?.onChange?.addListener(() => { void refresh(); });
  chrome.storage?.onChanged?.addListener((changes) => {
    if ("tabliss/config/locale" in changes) void refresh();
  });
})();
