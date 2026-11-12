const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
function boot() {
  let state = { connected: false }, locale = "pt-BR", controlled = true, closedTab, errorsRead = 0;
  const calls = [], listeners = {}, actionState = new Map(), tabs = [{ id: 1, url: "https://example.com" }, { id: 2, url: "https://skip.example.com" }];
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
    tabs: { query: async () => tabs, onActivated: event("activate"), onUpdated: event("update"), onRemoved: event("remove"), onCreated: event("create"), onReplaced: event("replace") },
    windows: { onFocusChanged: event("focus") },
    storage: { onChanged: event("storage") },
    proxy: { settings: { get: (_options, done) => done({ levelOfControl: controlled ? "controlled_by_this_extension" : "controlled_by_other_extensions" }), onChange: event("proxy") } },
    action: {
      setIcon(data, done) {
        if (data.tabId === closedTab) {
          Object.defineProperty(chrome.runtime, "lastError", { configurable: true, get() { errorsRead++; return { message: "No tab with id: " + closedTab }; } });
          done(); delete chrome.runtime.lastError;
        } else { calls.push(["icon", data]); actionState.set(data.tabId, data); done(); }
      },
      setTitle(data, done) { calls.push(["title", data]); done(); },
      setBadgeText() { throw Error("Pause badge must remain untouched"); },
    },
  };
  const context = vm.createContext({ chrome, URL, console, OffscreenCanvas: Canvas, createImageBitmap: async () => ({ close() {} }), fetch: async () => ({ blob: async () => ({}) }), SuperPreferences: { locale: { get: async () => locale } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../vpn/engine/routing.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../vpn-indicator.js"), "utf8"), context);
  const api = context.SuperVpnIndicator;
  api.attach(() => state);
  return { api, tabs, calls, listeners, actionState, resetAction(id) { actionState.delete(id); }, closeTab(id) { closedTab = id; }, get errorsRead() { return errorsRead; }, setState(value) { state = value; }, setLocale(value) { locale = value; }, loseProxy() { controlled = false; }, async latest() { await api.refresh(); return new Map(calls.filter(([kind]) => kind === "icon").map(([, value]) => [value.tabId, value])); } };
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
  assert.ok(icons.get(1).path);
  ui.setLocale("en");
  ui.listeners.storage({ "tabliss/config/locale": {} });
  await ui.latest();
  assert.equal(ui.calls.filter(([type]) => type === "title").at(-1)[1].title, "Super Extensão");
  ui.setState({ connected: false });
  icons = await ui.latest();
  assert.ok(icons.get(1).path);
  assert.equal(ui.calls.filter(([type]) => type === "title").at(-1)[1].title, "Super Extensão");
});

test("closing a tab during an icon update consumes lastError and does not block other tabs", async () => {
  const ui = boot(); await ui.latest();
  ui.closeTab(1); ui.setState({ connected: true, bypassList: [] });
  const before = ui.calls.length;
  await ui.latest();
  assert.ok(ui.errorsRead > 0);
  assert.equal(ui.calls.slice(before).some(([, data]) => data.tabId === 1), false);
  assert.ok(ui.calls.slice(before).some(([, data]) => data.tabId === 2));
});


test("same-color navigation and reload reapply browser-cleared per-tab icons", async () => {
  for (const mode of ["direct", "protected"]) {
    const ui = boot();
    ui.setState({ connected: true, includeOnly: mode === "direct" ? ["vpn-only.test"] : undefined, bypassList: [] });
    await ui.latest();
    const expected = mode === "direct" ? "#287de0" : "#18a568";
    assert.equal(ui.actionState.get(1).imageData[16].color, expected);
    // The browser resets the tab's action on cross-document commit, including reloads.
    ui.resetAction(1);
    ui.tabs[0].url = "https://another.test";
    ui.listeners.update(1, { url: ui.tabs[0].url, status: "loading" });
    await ui.latest();
    // Commit can occur after the loading event, so complete must invalidate again.
    ui.resetAction(1);
    ui.listeners.update(1, { status: "complete" });
    await ui.latest();
    assert.equal(ui.actionState.get(1).imageData[16].color, expected);
    ui.resetAction(1);
    ui.listeners.update(1, { status: "loading" });
    await ui.latest();
    ui.resetAction(1);
    ui.listeners.update(1, { status: "complete" });
    await ui.latest();
    assert.equal(ui.actionState.get(1).imageData[16].color, expected);
  }
});

test("activation and replaced tabs recover lost overlays without a color change", async () => {
  const ui = boot(); ui.setState({ connected: true, includeOnly: ["vpn-only.test"] }); await ui.latest();
  ui.resetAction(1); ui.listeners.activate({tabId: 1}); await ui.latest();
  assert.equal(ui.actionState.get(1).imageData[16].color, "#287de0");
  ui.resetAction(2); ui.listeners.replace(2, 1); await ui.latest();
  assert.equal(ui.actionState.get(2).imageData[16].color, "#287de0");
});

test("bursts of navigation/rule updates converge to the latest policy", async () => {
  const ui = boot(); ui.setState({ connected: true, includeOnly: ["example.com"] }); await ui.latest();
  for (let i = 0; i < 20; i++) {
    ui.tabs[0].url = "https://other-" + i + ".test";
    ui.listeners.update(1, {url: ui.tabs[0].url});
  }
  ui.setState({connected: true, includeOnly: ["other-19.test"]});
  await ui.latest();
  assert.equal(ui.actionState.get(1).imageData[16].color, "#18a568");
  assert.equal(ui.actionState.get(2).imageData[16].color, "#287de0");
});


test("manual server changes reapply same-color overlays when connecting events coalesce", async () => {
  for (const mode of ["direct", "protected"]) {
    const ui = boot();
    const routing = {bypassList: [], includeOnly: mode === "direct" ? ["vpn-only.test"] : undefined};
    ui.setState({connected: true, connectionRevision: 1, ...routing});
    await ui.latest();
    ui.resetAction(1);
    // The intermediate connecting refresh can be superseded by confirmation.
    ui.setState({connected: false, connectionRevision: 2, ...routing});
    const connecting = ui.api.refresh();
    ui.setState({connected: true, connectionRevision: 3, ...routing});
    await ui.api.refresh(); await connecting;
    assert.equal(ui.actionState.get(1).imageData[16].color, mode === "direct" ? "#287de0" : "#18a568");
    ui.resetAction(1);
    ui.setState({connected: true, connectionRevision: 4, ...routing});
    await ui.api.refresh();
    assert.ok(ui.actionState.has(1), "another selection must refresh even if the endpoint/color repeats");
  }
});
test("a proxy settings event invalidates applied icons even without a state or color change", async () => {
  const ui = boot();
  ui.setState({connected: true, connectionRevision: 1, bypassList: []});
  await ui.latest(); ui.resetAction(1);
  ui.listeners.proxy(); await ui.latest();
  assert.equal(ui.actionState.get(1).imageData[16].color, "#18a568");
  ui.resetAction(1); ui.loseProxy(); ui.listeners.proxy(); await ui.latest();
  assert.ok(ui.actionState.get(1).path);
});
