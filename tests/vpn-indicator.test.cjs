const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
function boot() {
  let state = { connected: false }, locale = "pt-BR", controlled = true;
  const calls = [], listeners = {}, tabs = [{ id: 1, url: "https://example.com" }, { id: 2, url: "https://skip.example.com" }];
  const event = (name) => ({ addListener(fn) { listeners[name] = fn; } });
  class Canvas {
    constructor(size) { this.size = size; }
    getContext() {
      const ctx = { drawImage() {}, beginPath() {}, arc() {}, fill() { this.color = this.fillStyle; }, stroke() {}, moveTo() {}, lineTo() {}, getImageData: () => ({ color: ctx.color, width: this.size }) };
      return ctx;
    }
  }
  const chrome = {
    runtime: { getURL: (value) => value },
    tabs: { query: async () => tabs, onActivated: event("activate"), onUpdated: event("update"), onRemoved: event("remove") },
    windows: { onFocusChanged: event("focus") },
    storage: { onChanged: event("storage") },
    proxy: { settings: { get: (_options, done) => done({ levelOfControl: controlled ? "controlled_by_this_extension" : "controlled_by_other_extensions" }), onChange: event("proxy") } },
    action: {
      async setIcon(data) { calls.push(["icon", data]); },
      async setTitle(data) { calls.push(["title", data]); },
      setBadgeText() { throw Error("Pause badge must remain untouched"); },
    },
  };
  const context = vm.createContext({ chrome, URL, console, OffscreenCanvas: Canvas, createImageBitmap: async () => ({ close() {} }), fetch: async () => ({ blob: async () => ({}) }), SuperPreferences: { locale: { get: async () => locale } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../vpn/engine/routing.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../vpn-indicator.js"), "utf8"), context);
  const api = context.SuperVpnIndicator;
  api.attach(() => state);
  return { api, tabs, calls, listeners, setState(value) { state = value; }, setLocale(value) { locale = value; }, loseProxy() { controlled = false; }, async latest() { await api.refresh(); return new Map(calls.filter(([kind]) => kind === "icon").map(([, value]) => [value.tabId, value])); } };
}
test("route colors follow effective exclusions, subdomains, include-only and local bypasses", () => {
  const { api } = boot();
  const exclude = { bypassList: ["skip.example.com", ".skip.example.com", "10.0.0.0/8", "<local>"] };
  assert.equal(api.usesVpn("https://example.com", exclude), true);
  for (const url of ["https://skip.example.com", "https://a.skip.example.com", "http://10.2.3.4", "http://localhost", "http://service", "http://127.0.0.2", "http://169.254.1.2", "http://[::1]", "chrome://settings", "about:blank", "bad url"]) assert.equal(api.usesVpn(url, exclude), false, url);
  assert.equal(api.usesVpn("https://notskip.example.com", exclude), true);
  const include = { bypassList: ["account.proton.me"], includeOnly: ["example.com", ".example.com", ".protonvpn.net"] };
  assert.equal(api.usesVpn("https://example.com", include), true);
  assert.equal(api.usesVpn("https://sub.example.com", include), true);
  assert.equal(api.usesVpn("https://other.com", include), false);
  assert.equal(api.usesVpn("https://account.proton.me", include), false);
  assert.equal(api.usesVpn("https://node.protonvpn.net", include), true);
  assert.equal(api.usesVpn("http://192.0.2.7", { includeOnly: ["192.0.2.7"] }), false);
});
test("confirmed VPN state sets per-tab overlays, updates navigation/rules and preserves pause badges", async () => {
  const ui = boot();
  let icons = await ui.latest();
  assert.ok(icons.get(1).path);
  ui.setState({ connected: true, bypassList: ["skip.example.com"] });
  icons = await ui.latest();
  assert.equal(icons.get(1).imageData[16].color, "#18a568");
  assert.equal(icons.get(2).imageData[16].color, "#287de0");
  assert.match(ui.calls.filter(([type, value]) => type === "title" && value.tabId === 1).at(-1)[1].title, /este site usa a VPN/);
  ui.tabs[0].url = "https://skip.example.com";
  ui.listeners.update(1, { url: ui.tabs[0].url });
  icons = await ui.latest();
  assert.equal(icons.get(1).imageData[32].color, "#287de0");
  ui.setState({ connected: true, bypassList: [] });
  ui.listeners.proxy();
  icons = await ui.latest();
  assert.equal(icons.get(1).imageData[16].color, "#18a568");
  ui.loseProxy();
  icons = await ui.latest();
  assert.equal(icons.get(1).imageData[16].color, "#287de0");
  ui.setLocale("en");
  ui.listeners.storage({ "tabliss/config/locale": {} });
  await ui.latest();
  assert.match(ui.calls.filter(([type]) => type === "title").at(-1)[1].title, /bypasses the VPN/);
  ui.setState({ connected: false });
  icons = await ui.latest();
  assert.ok(icons.get(1).path);
  assert.equal(ui.calls.filter(([type]) => type === "title").at(-1)[1].title, "Super Extensão");
});
