const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
function load(file, mocks = {}, globals = {}, cache = new Map()) {
  let filename = path.join(root, "vpn/source", file);
  if (!fs.existsSync(filename) && filename.endsWith(".js")) filename=filename.slice(0,-3)+".ts";
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      exports,
      setTimeout, clearTimeout,
      URL,
      ...globals,
      require(spec) {
        if (spec in mocks) return mocks[spec];
        if (spec.endsWith(".js") && path.resolve(path.dirname(filename), spec).startsWith(path.join(root, "ui"))) return require(path.resolve(path.dirname(filename), spec));
        if (spec === "../../ui/domain-list.js") return require(path.join(root, "ui/domain-list.js"));
        if (spec === "../../ui/bookmark-preview.js") return require(path.join(root, "ui/bookmark-preview.js"));
        if (spec === "../../rules.js") return require(path.join(root, "rules.js"));
        if (spec.endsWith('.cjs')) return require(path.resolve(path.dirname(filename), spec));
        if (spec.startsWith("."))
          return load(
            path.relative(
              path.join(root, "vpn/source"),
              path.resolve(path.dirname(filename), spec),
            ) + ".js",
            mocks,
            globals,
            cache,
          );
        throw new Error("Unexpected dependency " + spec);
      },
    },
    { filename },
  );
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const servers = [
  {
    id: "free",
    name: "JP#1",
    country: "JP",
    city: "Tokyo",
    tier: 0,
    available: true,
    allowed: true,
    load: 22,
  },
  {
    id: "paid",
    name: "BR#1",
    country: "BR",
    city: "São Paulo",
    tier: 2,
    available: true,
    allowed: false,
    load: 10,
  },
  {
    id: "down",
    name: "JP#2",
    country: "JP",
    tier: 0,
    available: false,
    allowed: true,
  },
  {
    id: "core",
    name: "CH-US#1",
    country: "US",
    tier: 2,
    secureCore: true,
    available: true,
    allowed: false,
  },
];
const snapshot = () => ({
  signedIn: true,
  account: { name: "Conta de teste", plan: "Free", tier: 0 },
  servers,
  features: Object.fromEntries(
    [
      "secureCore",
      "autoConnect",
      "notification",
      "preventWebrtcLeak",
      "recents",
    ].map((name) => [
      name,
      { enabled: false, available: true, controllable: name !== "secureCore" },
    ]),
  ),
  split: {
    enabled: true,
    mode: "exclude",
    value: [{ domain: "old.example", withSubDomains: false, mode: "include" }],
  },
  splitControllable: true,
  state: { state: "disconnected" },
  recents: [],
});
async function boot(initial = snapshot(), options = {}) {
  const dom = new JSDOM(
    (options.hostNavigation ? '<div id="vpnSubmenu"></div>' : "") +
      '<div id="vpnPanel"></div>',
    {
      url: "https://extension.test/popup.html",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window,
    calls = [];
  if (options.renders) {
    const panel = w.document.getElementById("vpnPanel");
    const property = Object.getOwnPropertyDescriptor(w.Element.prototype, "innerHTML");
    Object.defineProperty(panel, "innerHTML", {
      get() {return property.get.call(this);},
      set(value) {options.renders.push(value);property.set.call(this, value);},
    });
  }
  let broadcast, localeWatcher;
  const preferences = {
    locale: {
      get: async () => "pt-BR",
      watch(fn) {
        localeWatcher = fn;
        return () => {};
      },
      async set(locale) {
        localeWatcher(locale);
      },
    },
    watchTheme(fn) {
      fn(options.theme || "dark", options.theme || "dark");
      return () => {};
    },
    bindTheme(element, callback = () => {}) {
      return this.watchTheme((selected, resolved) => {
        element.dataset.superTheme = resolved;
        callback(selected, resolved);
      });
    },
  };
  const engine = {
    load: options.load || (async () => initial),
    ...(options.readConnection ? {readConnection: options.readConnection} : {}),
    readView: async () => options.savedView,
    saveView: async (value) => calls.push(["view", value]),
    subscribe(fn) {
      broadcast = fn;
      return () => {};
    },
    signIn: async () => calls.push(["login"]),
    connect: async (...args) => calls.push(["connect", ...args]),
    connectRecent: async (choice) => calls.push(["recent", choice]),
    disconnect: async () => calls.push(["disconnect"]),
    signOut: async () => calls.push(["signout"]),
    checkConnection: async () => calls.push(["check"]),
    retryConnection: async () => calls.push(["retry-connection"]),
    setToggle: async (name, value) => {
      calls.push(["toggle", name, value]);
      return {
        ...initial.features,
        [name]: { ...initial.features[name], enabled: value },
      };
    },
    saveSplit: async (config) => calls.push(["split", plain(config)]),
  };
  const globals = {
    window: w,
    document: w.document,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  const { mountVpn } = load("app.js", {}, globals);
  const app = await mountVpn(
    w.document.getElementById("vpnPanel"),
    engine,
    preferences,
    options.browser,
  );
  await tick();
  const click = (action) => {
    const node = w.document.querySelector(`[data-action="${action}"]`);
    assert.ok(node, action);
    node.click();
    return tick();
  };
  return {
    dom,
    w,
    calls,
    engine,
    app,
    preferences,
    broadcast: (type, data) => broadcast(type, data),
    click,
    async close() {
      app.dispose();
      w.close();
      await tick();
    },
  };
}
async function openCountry(ui, key) {
  const details = [
    ...ui.w.document.querySelectorAll("[data-country-group]"),
  ].find((node) => node.dataset.countryGroup === key);
  assert.ok(details, key);
  details.open = true;
  await tick();
}
test("shared automation precedes the cleanup-only actions; VPN shares header gutters", () => {
  const html = fs.readFileSync(path.join(root, "popup.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "popup.css"), "utf8");
  const dom = new JSDOM(html, { url: "https://extension.test/popup.html" });
  const document = dom.window.document;
  assert.ok(document.querySelector("main > footer > .automation"));
  assert.equal(document.querySelectorAll("#enabled").length, 1);
  assert.equal(document.querySelector("#pauseRow").nextElementSibling.id, "cleanupActions");
  assert.ok(document.querySelector("#cleanupActions > .report"));
  assert.ok(document.querySelector("#cleanupActions > #clearNow"));
  assert.ok(!document.querySelector("main > .automation"));
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  const header = document.querySelector("body > header");
  const values = ["cleanup", "autoplay", "tabs", "sync", "vpn"].map((tab) => {
    document.body.dataset.activeTab = tab;
    const computed = dom.window.getComputedStyle(header);
    return [
      computed.paddingTop,
      computed.paddingRight,
      computed.paddingBottom,
      computed.paddingLeft,
    ];
  });
  for (const item of values) assert.deepEqual(item, values[0]);
  assert.ok(
    !fs
      .readFileSync(path.join(root, "popup-panels.js"), "utf8")
      .includes("vpn/js/popup.js"),
  );
  dom.window.close();
});
test("guest login uses the adapter and never exposes the legacy panel", async () => {
  const ui = await boot({ signedIn: false });
  try {
    assert.match(ui.w.document.body.textContent, /Entre com sua conta Proton/);
    await ui.click("login");
    assert.ok(ui.calls.some((call) => call[0] === "login"));
    assert.equal(ui.w.document.querySelector(".main-modal"), null);
  } finally {
    await ui.close();
  }
});
test("server picker keeps Free, paid and maintenance states, search and connection confirmation", async () => {
  const ui = await boot();
  try {
    assert.match(ui.w.document.body.textContent, /Servidores gratuitos/);
    await ui.app.navigate("servers");
    assert.equal(ui.w.document.querySelector('[data-server="paid"]'), null);
    const select = ui.w.document.querySelector('[data-field="server-filter"]');
    select.value = "all";
    select.dispatchEvent(new ui.w.Event("change", { bubbles: true }));
    await openCountry(ui, "servers:BR");
    await openCountry(ui, "servers:JP");
    assert.equal(
      ui.w.document.querySelector('[data-server="paid"]').disabled,
      true,
    );
    assert.equal(
      ui.w.document.querySelector('[data-server="down"]').disabled,
      true,
    );
    const search = ui.w.document.querySelector('[data-field="search"]');
    search.value = "japão";
    search.dispatchEvent(new ui.w.Event("input", { bubbles: true }));
    assert.equal(ui.w.document.querySelector('[data-server="paid"]'), null);
    ui.w.document.querySelector('[data-server="free"]').click();
    await tick();
    assert.ok(
      ui.calls.some((call) => call[0] === "connect" && call[1] === "free"),
    );
    await ui.app.navigate("connection");
    assert.match(
      ui.w.document.querySelector(".vpn-status").textContent,
      /Conectando/,
    );
    ui.broadcast("changeState", {
      state: "connected",
      server: { name: "JP#1", exitCountry: "JP", exitIp: "192.0.2.7" },
    });
    assert.equal(
      ui.w.document.querySelector(".vpn-status").textContent,
      "Conectado",
    );
    await ui.click("disconnect");
    assert.ok(ui.calls.some((call) => call[0] === "disconnect"));
    ui.broadcast("changeState", { state: "disconnected" });
    assert.equal(
      ui.w.document.querySelector(".vpn-status").textContent,
      "Desconectado",
    );
  } finally {
    await ui.close();
  }
});
test("split tunneling preserves modes and saves only after explicit action", async () => {
  const ui = await boot();
  try {
    await ui.app.navigate("features");
    assert.equal(
      ui.w.document.querySelector('[data-feature="secureCore"]').disabled,
      true,
    );
    const field = ui.w.document.querySelector('[data-field="domain"]');
    field.value = "https://EXAMPLE.com/";
    field.dispatchEvent(new ui.w.Event("input", { bubbles: true }));
    await ui.click("add-domain");
    assert.equal(ui.calls.filter((call) => call[0] === "split").length, 0);
    ui.w.document
      .querySelector("[data-split]")
      .dispatchEvent(
        new ui.w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await tick();
    const config = ui.calls.find((call) => call[0] === "split")[1];
    assert.equal(config.value.length, 2);
    assert.equal(config.value[0].mode, "include");
    assert.equal(config.value[1].domain, "example.com");
    assert.equal(config.value[1].withSubDomains, true);
    assert.match(ui.w.document.body.textContent, /Regras salvas/);
    const toggle = ui.w.document.querySelector(
      '[data-feature="preventWebrtcLeak"]',
    );
    toggle.checked = true;
    toggle.dispatchEvent(new ui.w.Event("change", { bubbles: true }));
    await tick();
    assert.ok(
      ui.calls.some(
        (call) =>
          call[0] === "toggle" &&
          call[1] === "preventWebrtcLeak" &&
          call[2] === true,
      ),
    );
  } finally {
    await ui.close();
  }
});
test("sign-out requires confirmation; preferences and remembered page remain integrated", async () => {
  const ui = await boot(snapshot(), { savedView: { page: "settings" } });
  try {
    assert.ok(ui.w.document.querySelector('[data-field="locale"]'));
    await ui.click("confirm-signout");
    assert.equal(
      ui.calls.some((call) => call[0] === "signout"),
      false,
    );
    await ui.click("cancel-signout");
    await ui.preferences.locale.set("en");
    assert.match(ui.w.document.body.textContent, /Manage Proton account/);
    await ui.click("confirm-signout");
    await ui.click("signout");
    assert.ok(ui.calls.some((call) => call[0] === "signout"));
    assert.match(
      ui.w.document.body.textContent,
      /Sign in with your Proton account/,
    );
  } finally {
    await ui.close();
  }
});
test("server text and errors are rendered as text and invalid domains are rejected", async () => {
  const data = snapshot();
  data.servers = [{ ...servers[0], name: "<img src=x onerror=alert(1)>" }];
  const ui = await boot(data);
  try {
    await ui.app.navigate("servers");
    await openCountry(ui, "servers:JP");
    assert.equal(ui.w.document.querySelector("img:not(.vpn-flag)"), null);
    assert.equal(
      ui.w.document.querySelector(".vpn-flag").getAttribute("src"),
      "/vpn/img/flags/jp.svg",
    );
    const model = load("model.js");
    for (const value of [
      "javascript:alert(1)",
      "example.com/path",
      "*.example.com",
      "example.com:8080",
    ])
      assert.throws(() => model.normalizeDomain(value));
    assert.equal(model.normalizeDomain("https://EXAMPLE.com/"), "example.com");
    ui.broadcast("changeState", {
      state: "disconnected",
      error: { message: "<script>evil()</script>" },
    });
    assert.equal(ui.w.document.querySelector("script"), null);
    assert.match(
      ui.w.document.querySelector('[role="alert"]').textContent,
      /<script>/,
    );
  } finally {
    await ui.close();
  }
});

test("adapter retains Proton sign-in, tier checks, namespaced messages and active split tunneling", async () => {
  const calls = [],
    items = new Map(),
    listeners = new Set();
  let tier = 0;
  const rawServers = [
    {
      ID: "free",
      Name: "JP#1",
      ExitCountry: "JP",
      Features: 0,
      Tier: 0,
      Load: 22,
      Servers: [{ Status: 1, Domain: "proxy.test", ExitIP: "192.0.2.7" }],
    },
    {
      ID: "paid",
      Name: "BR#1",
      ExitCountry: "BR",
      Features: 0,
      Tier: 2,
      Servers: [{ Status: 1 }],
    },
  ];
  const wrappers = Object.fromEntries(
    [
      "secureCore",
      "autoConnect",
      "notification",
      "preventWebrtcLeak",
      "recents",
      "splitTunneling",
    ].map((name) => [
      name,
      {
        config:
          name === "splitTunneling"
            ? { enabled: true, mode: "exclude", value: [] }
            : { value: false },
        feature: {
          isAvailable: () => true,
          isControllable: () => true,
          getControlMessage: () => "",
          getCacheItem: () => ({
            async set(value) {
              items.set(name, plain(value));
            },
          }),
        },
      },
    ]),
  );
  const runtime = {
    id: "extension",
    onMessage: {
      addListener(fn) {
        listeners.add(fn);
      },
      removeListener(fn) {
        listeners.delete(fn);
      },
    },
  };
  const emit = (message, sender = { id: "extension" }) =>
    listeners.forEach((fn) => fn(message, sender));
  const getTier = (user) => user?.VPN?.MaxTier || 0;
  const actualAccess = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        path.join(
          root,
          "vendor/proton-source/source/js/vpn/assertServerAccess.ts",
        ),
        "utf8",
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      exports: actualAccess,
      require(id) {
        assert.equal(id, '../../../../../vpn/engine/account');
        return require('./helpers/load-ts.cjs')(path.join(root, 'vpn/engine/account.ts'));
      },
    },
  );
  const mocks = {
    "@vpn-engine/account/readSession": {
      readSession: async () => ({ uid: "private", refreshToken: "private" }),
    },
    "@vpn-engine/account/openForkTab": {
      openForkTab: async () => calls.push(["fork"]),
    },
    "@vpn-engine/tools/sendMessageToBackground": {
      sendMessageToBackground: async (type, data) => {
        calls.push([type, plain(data ?? null)]);
        if (type === "user")
          return {
            VPN: { Name: "name", MaxTier: tier, Password: "never-render-this" },
          };
        if (type === "connectionState")
          return { signedIn: true, state: {state: "connected", server: {name:"JP#1", exitCountry:"JP"}} };
      },
    },
    "@vpn-engine/vpn/getLogicals": {
      getSortedLogicals: async () => rawServers,
      isLogicalUp: () => true,
    },
    "@vpn-engine/account/user/getUserContext": {
      getUserContext: async () => ({ country: "BR", tier }),
    },
    "@vpn-engine/account/user/getUserMaxTier": { getUserMaxTier: getTier },
    "@vpn-engine/vpn/getLogical": {
      requireBestLogical: (servers) =>
        servers.find((server) => server.Tier <= tier),
      requireRandomLogical: (servers) =>
        servers.find((server) => server.Tier <= tier),
    },
    "@vpn-engine/vpn/pickServerInLogical": {
      pickServerInLogical: (logical) => logical.Servers[0],
    },
    "@vpn-engine/vpn/isServerUp": {
      isServerUp: (server) => server?.Status === 1,
    },
    "@vpn-engine/vpn/assertServerAccess": actualAccess,
    "@vpn-engine/vpn/getSecureCorePredicate": {
      getSecureCorePredicate: () => (logical) => !(logical.Features & 1),
    },
    "@vpn-engine/vpn/getSplitTunnelingConfig": {
      getSplitTunnelingConfig: (_tier, config) => ({
        mode: config.mode,
        filteredDomains: config.value.map((item) => item.domain),
      }),
    },
    "@vpn-engine/vpn/features/loadAllFeatures": {
      loadAllFeatures: async () => wrappers,
    },
    "@vpn-engine/vpn/lastChoice": {
      getLastChoices: async () => [],
      setLastChoice: (value) => calls.push(["choice", value]),
      forgetLastChoices() {},
      getLogicalsFilteredByChoice: (servers) => servers,
    },
    "@vpn-engine/webrtc/preventLeak": {
      preventLeak: async (value) => calls.push(["webrtc", value]),
    },
    "@vpn-engine/webrtc/setWebRTCState": {
      setWebRTCState: async (value) => calls.push(["webrtc-state", value]),
    },
    "@vpn-engine/webrtc/state": { WebRTCState: { CLEAR: "clear" } },
    "@vpn-engine/tools/storage": {
      storage: {
        getItem: async (key) => items.get(key),
        setItem: async (key, value) => items.set(key, value),
      },
    },
    "@vpn-engine/tools/getRuntime": { getRuntime: () => runtime },
    "@vpn-engine/tools/activity": { updateLastActivityTime: async () => {} },
  };
  const { createEngine } = load("bridge.ts", mocks, {
    browser: { permissions: { request: async () => true } },
  });
  const engine = createEngine();
  let events = 0;
  const unsubscribe = engine.subscribe(() => events++);
  const progress = [];
  const state = await engine.load((partial) => progress.push(plain(partial)));
  assert.equal(progress.length, 3);
  assert.equal(progress[0].signedIn, true);
  assert.equal(progress[0].state.state, "connected");
  assert.equal(progress[0].features, undefined);
  assert.equal(progress[0].featuresReady, false);
  assert.ok(progress[1].features);
  assert.equal(progress[1].featuresReady, false);
  assert.equal(progress[1].account, undefined);
  assert.equal(progress[1].servers, undefined);
  assert.ok(progress[2].account);
  assert.equal(progress[2].featuresReady, true);
  assert.equal(progress[2].servers, undefined);
  assert.ok(!JSON.stringify(state).includes("never-expose"));
  assert.ok(!JSON.stringify(state).includes("never-render-this"));
  await engine.signIn();
  assert.ok(calls.some((call) => call[0] === "proxy"));
  assert.ok(calls.some((call) => call[0] === "fork"));
  await assert.rejects(() => engine.connect("paid"), /not available/);
  await engine.connect("free");
  const request = calls.find((call) => call[0] === "connect");
  assert.equal(request[1].logical.ID, "free");
  assert.equal(request[1].server.Domain, "proxy.test");
  await engine.connectRecent({connected: true, logicalId: "free"});
  const recentChoice = calls.filter(call => call[0] === "choice").at(-1)[1];
  assert.equal(recentChoice.logicalId, "free");
  assert.equal(recentChoice.pick, undefined);
  emit({
    channel: "super-sync",
    respondTo: "none",
    type: "changeState",
    data: { state: "connected" },
  });
  assert.equal(events, 0);
  emit(
    {
      channel: "super-vpn",
      respondTo: "none",
      type: "changeState",
      data: { state: "connected" },
    },
    { id: "another" },
  );
  assert.equal(events, 0);
  emit({
    channel: "super-vpn",
    respondTo: "none",
    type: "changeState",
    data: { state: "connected" },
  });
  assert.equal(events, 1);
  await engine.saveSplit({
    enabled: true,
    mode: "include",
    value: [{ domain: "example.com", withSubDomains: true }],
  });
  assert.ok(
    calls.some(
      (call) => call[0] === "bypassList" && call[1].mode === "include",
    ),
  );
  assert.equal(items.get("splitTunneling").value[0].domain, "example.com");
  await engine.setToggle("preventWebrtcLeak", true);
  assert.ok(calls.some((call) => call[0] === "webrtc" && call[1] === true));
  await assert.rejects(
    () => engine.setToggle("secureCore", true),
    /cannot be changed/,
  );
  tier = 2;
  await engine.load();
  await engine.connect("paid");
  assert.ok(
    calls.some(
      (call) => call[0] === "connect" && call[1].logical.ID === "paid",
    ),
  );
  unsubscribe();
  assert.equal(listeners.size, 0);
});

test("production bundle mounts on a fresh profile without the original Proton markup", async () => {
  const { VirtualConsole } = require("jsdom");
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error.message));
  console.on("error", (error) => errors.push(String(error)));
  const dom = new JSDOM('<div id="vpnPanel"></div>', {
    url: "https://extension.test/vpn/interface.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: console,
  });
  const w = dom.window;
  const listeners = new Set();
  const event = {
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
  };
  const area = {
    get(_keys, callback) {
      callback?.({});
      return Promise.resolve({});
    },
    set(_value, callback) {
      callback?.();
      return Promise.resolve();
    },
    remove(_keys, callback) {
      callback?.();
      return Promise.resolve();
    },
  };
  w.chrome = {
    runtime: {
      id: "extension",
      onMessage: event,
      getURL: (path) => "https://extension.test/" + path,
      sendMessage: async () => ({ received: true, result: {signedIn:false,state:{state:"logged-out"}} }),
    },
    storage: {
      local: area,
      session: area,
      sync: area,
      managed: area,
      onChanged: event,
    },
    tabs: { onRemoved: event },
    permissions: { request: async () => true },
  };
  w.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  });
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.eval(fs.readFileSync(path.join(root, "preferences.js"), "utf8"));
  try {
    w.eval(fs.readFileSync(path.join(root, "vpn/interface.js"), "utf8"));
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.ok(w.document.querySelector('[data-action="login"]'));
    assert.match(w.document.body.textContent, /Entre com sua conta Proton/);
    assert.deepEqual(errors, []);
  } finally {
    w.dispatchEvent(new w.Event("unload"));
    w.close();
  }
});

test("standalone theme follows preferences and late loads cannot undo a sign-out event", async () => {
  const ui = await boot(snapshot(), { theme: "light" });
  try {
    assert.equal(ui.w.document.documentElement.dataset.superTheme, "light");
    let resolve;
    ui.engine.load = () =>
      new Promise((done) => {
        resolve = done;
      });
    const loading = ui.app.refresh();
    await tick();
    ui.broadcast("changeState", { state: "logged-out" });
    resolve(snapshot());
    await loading;
    assert.ok(ui.w.document.querySelector('[data-action="login"]'));
    assert.equal(ui.w.document.querySelector(".vpn-navigation"), null);
  } finally {
    await ui.close();
  }
});

test("country groups start collapsed, use local SVG flags and paginate independently", async () => {
  const data = snapshot();
  data.servers = Array.from({ length: 121 }, (_, index) => ({
    ...servers[0],
    id: "jp" + index,
    name: "JP#" + index,
  })).concat({ ...servers[0], id: "br", country: "BR", name: "BR#0" });
  const ui = await boot(data);
  try {
    await ui.app.navigate("servers");
    assert.equal(load("model.js").flag("UK"), "/vpn/img/flags/gb.svg");
    const groups = [...ui.w.document.querySelectorAll("[data-country-group]")];
    assert.equal(groups.length, 2);
    assert.ok(groups.every((group) => !group.open));
    assert.equal(ui.w.document.querySelectorAll("[data-server]").length, 0);
    for (const image of ui.w.document.querySelectorAll(".vpn-flag"))
      assert.ok(
        fs.existsSync(path.join(root, image.getAttribute("src").slice(1))),
      );
    assert.equal(
      ui.w.document.querySelector(
        '[data-country-group="servers:JP"] .vpn-count',
      ).textContent,
      "121",
    );
    await openCountry(ui, "servers:JP");
    assert.equal(ui.w.document.querySelectorAll("[data-server]").length, 50);
    await ui.click("more");
    assert.equal(ui.w.document.querySelectorAll("[data-server]").length, 100);
    assert.equal(
      ui.w.document.querySelector('[data-country-group="servers:JP"]').open,
      true,
    );
    assert.equal(
      ui.w.document.querySelector('[data-country-group="servers:BR"]').open,
      false,
    );
    ui.w.document.querySelector('[data-country-group="servers:JP"]').open =
      false;
    await tick();
    assert.equal(ui.w.document.querySelectorAll("[data-server]").length, 0);
  } finally {
    await ui.close();
  }
});

test("embedded VPN uses the fixed shared submenu and keeps navigation and locale updates working", async () => {
  const ui = await boot(snapshot(), { hostNavigation: true });
  try {
    const menu = () => ui.w.document.querySelector("#vpnSubmenu .sub-nav");
    assert.ok(menu());
    assert.equal(menu().querySelectorAll("button.tab").length, 4);
    assert.equal(
      ui.w.document.querySelector("#vpnPanel .vpn-navigation"),
      null,
    );
    menu().querySelector('[data-page="servers"]').click();
    await tick();
    assert.equal(menu().querySelector(".active").dataset.page, "servers");
    assert.ok(ui.w.document.querySelector('#vpnPanel [data-field="search"]'));
    await ui.preferences.locale.set("en");
    await tick();
    assert.equal(menu().querySelector(".active").textContent, "Servers");
    menu().querySelector('[data-page="account"]').click();
    await tick();
    assert.equal(menu().querySelector(".active").dataset.page, "account");
    assert.ok(ui.w.document.querySelector("#vpnPanel .vpn-account-links"));
  } finally {
    await ui.close();
  }
});


test("server loading keeps navigation, settings and disconnect available and scopes failures", async () => {
  const ui = await boot(snapshot());
  let rejectLoad;
  try {
    ui.engine.load = (progress) => {
      const local = snapshot();
      delete local.servers;
      progress(local);
      return new Promise((_resolve, reject) => { rejectLoad = reject; });
    };
    const pending = ui.app.refresh();
    await tick();
    assert.equal(ui.w.document.querySelector(".vpn-heading"), null);
    assert.ok(ui.w.document.querySelector(".vpn-status-card"));
    assert.match(ui.w.document.body.textContent, /Carregando servidores/);
    assert.equal(ui.w.document.querySelector('[data-action="fastest"]').disabled, true);
    ui.broadcast("changeState", { state: "connected", server: { name: "JP#1" } });
    assert.equal(ui.w.document.querySelector('[data-action="disconnect"]').disabled, false);
    ui.w.document.querySelector('[data-page="features"]').click();
    await tick();
    assert.ok(ui.w.document.querySelector('[data-feature="notification"]'));
    assert.equal(ui.w.document.querySelector('[data-feature="notification"]').disabled, false);
    rejectLoad(new Error("Server network failed"));
    await pending;
    assert.ok(ui.w.document.querySelector('[data-feature="notification"]'));
    ui.w.document.querySelector('[data-page="servers"]').click();
    await tick();
    assert.match(ui.w.document.body.textContent, /Server network failed/);
    assert.ok(ui.w.document.querySelector('[data-action="refresh"]'));
  } finally { await ui.close(); }
});


test("opening an already connected VPN paints connected before account/server requests finish", async () => {
  const initial = snapshot();
  initial.state = {state:"connected", server:{name:"MX-FREE#4", exitCountry:"MX", exitCity:"Mexico City", exitIp:"192.0.2.8"}, error:{message:"Aviso atual da VPN"}};
  let finishLoad;
  const renders = [];
  const ui = await boot(initial, {
    renders,
    readConnection: async () => ({signedIn:true, state:initial.state}),
    load: () => new Promise(resolve => {finishLoad = resolve;}),
  });
  try {
    assert.ok(renders.length > 0);
    assert.ok(renders.every(html => html.includes('data-status="connected"')));
    assert.ok(renders.every(html => !html.includes("Conectando") && !html.includes("Carregando")));
    assert.match(ui.w.document.body.textContent, /MX-FREE#4/);
    assert.ok(renders.every(html => html.includes("Aviso atual da VPN")));
    assert.equal(ui.w.document.querySelector('[data-action="disconnect"]').disabled, false);
    assert.equal(ui.calls.some(call => call[0] === "connect" || call[0] === "check"), false);
    const pending = ui.app.refresh();
    ui.broadcast("changeState", {state:"disconnected"});
    finishLoad(initial);
    await pending;
    assert.equal(ui.w.document.querySelector(".vpn-status-card").dataset.status, "disconnected");
  } finally {await ui.close();}
});

test("bootstrap cannot turn a real connecting/disconnected state into a cached connected screen", async () => {
  for (const state of ["connecting", "disconnected"]) {
    const initial = snapshot();
    initial.state = {state, ...(state === "connecting" ? {server:{name:"MX-FREE#4"}} : {})};
    let finish;
    const ui = await boot(initial, {
      readConnection: async () => ({signedIn:true,state:initial.state}),
      load: () => new Promise(resolve => {finish=resolve;}),
    });
    try {
      assert.equal(ui.w.document.querySelector(".vpn-status-card").dataset.status, state);
      const pending=ui.app.refresh();finish(initial);await pending;
    }finally{await ui.close();}
  }
});

test("logout during a delayed bootstrap wins over its older connected snapshot", async () => {
  const w = new JSDOM('<div id="vpnPanel"></div>',{url:'https://extension.test/popup.html'}).window;
  let emit,resolveConnection;
  const {mountVpn} = load("app.js",{}, {window:w,document:w.document,setTimeout,clearTimeout,setInterval,clearInterval});
  const preferences={locale:{get:async()=>"pt-BR",watch:()=>()=>{}},bindTheme:()=>()=>{}};
  let loads=0;
  const engine={
    subscribe(fn){emit=fn;return()=>{};},readView:async()=>undefined,
    readConnection:()=>new Promise(resolve=>{resolveConnection=resolve;}),
    load:async()=>{loads++;return {signedIn:false};},
    checkConnection:async()=>{},saveView:async()=>{},
  };
  const pending=mountVpn(w.document.getElementById('vpnPanel'),engine,preferences);
  await tick();
  emit('changeState',{state:'logged-out'});
  resolveConnection({signedIn:true,state:{state:'connected',server:{name:'OLD'}}});
  const app=await pending;await tick();
  try{
    assert.equal(w.document.querySelector('.vpn-status-card'),null);
    assert.match(w.document.body.textContent,/Entre com sua conta Proton/);
    assert.ok(!w.document.body.textContent.includes('OLD'));
    assert.equal(loads,1);
  }finally{app.dispose();w.close();}
});
test('blocked networking remains visible after logout and release requires explicit confirmation before clearing the alert',async()=>{
 const initial={...snapshot(),signedIn:false,state:{state:'logged-out',error:{message:'VpnTrafficBlocked'}}};const ui=await boot(initial);
 assert.match(ui.w.document.body.textContent,/rede dos sites bloqueada/);assert.ok(ui.w.document.querySelector('[data-action="disconnect"]'));await ui.click('disconnect');ui.w.document.querySelector('[data-confirm=cancel]').click();await tick();assert.ok(!ui.calls.some(call=>call[0]==='disconnect'));assert.match(ui.w.document.body.textContent,/rede dos sites bloqueada/);
 await ui.click('disconnect');ui.w.document.querySelector('[data-confirm=accept]').click();await tick();assert.equal(ui.calls.filter(call=>call[0]==='disconnect').length,1);assert.ok(!ui.w.document.querySelector('[data-action="disconnect"]'));await ui.close();
});

test('an IO timeout removes the connected claim, offers state retry and recovers only after a new reply',async()=>{
 const initial=snapshot();initial.state={state:'connected',server:{name:'MX#4',exitIp:'192.0.2.8'}};
 const ui=await boot(initial);
 try{
  assert.equal(ui.w.document.querySelector('.vpn-status-card').dataset.status,'connected');
  ui.engine.load=async()=>{throw new Error('VpnWorkerTimedOut');};await ui.app.refresh();
  assert.equal(ui.w.document.querySelector('.vpn-status-card').dataset.status,'unconfirmed');
  assert.equal(ui.w.document.querySelector('.vpn-ip'),null);
  const retry=ui.w.document.querySelector('.vpn-status-card [data-action="refresh"]');assert.ok(retry);
  ui.engine.load=async()=>initial;retry.click();await tick();
  assert.equal(ui.w.document.querySelector('.vpn-status-card').dataset.status,'connected');
 }finally{await ui.close();}
});


test('a failed connection shows the timeout, retries on request and never releases networking implicitly', async () => {
 const ui = await boot(snapshot());
 try {
  ui.broadcast('changeState', {state:'connecting', server:{name:'CA-FREE#23'}});
  ui.broadcast('changeState', {state:'blocked', server:{name:'CA-FREE#23'}, error:{message:'VpnConnectionTimedOut'}});
  assert.equal(ui.w.document.querySelector('.vpn-status-card').dataset.status,'blocked');
  assert.match(ui.w.document.body.textContent,/30 segundos/);
  assert.match(ui.w.document.body.textContent,/CA-FREE#23/);
  await ui.click('retry-connection');
  assert.equal(ui.calls.filter(call=>call[0]==='retry-connection').length,1);
  assert.ok(!ui.calls.some(call=>call[0]==='disconnect'));
  assert.equal(ui.w.document.querySelector('.vpn-status-card').dataset.status,'blocked');
  ui.broadcast('changeState',{state:'connected',server:{name:'CA-FREE#23'}});
  assert.equal(ui.w.document.querySelector('.vpn-status-card').dataset.status,'connected');
  assert.equal(ui.w.document.querySelector('[data-action="retry-connection"]'),null);
 } finally {await ui.close();}
});

test('opening a failed connection restores the blocked state and requires confirmation to release',async()=>{
 const initial=snapshot();initial.state={state:'blocked',server:{name:'CA-FREE#23'},error:{message:'VpnConnectionTimedOut'}};
 const ui=await boot(initial,{readConnection:async()=>({signedIn:true,state:initial.state})});
 try{
  assert.equal(ui.w.document.querySelector('.vpn-status-card').dataset.status,'blocked');
  await ui.click('disconnect');ui.w.document.querySelector('[data-confirm=cancel]').click();await tick();
  assert.ok(!ui.calls.some(call=>call[0]==='disconnect'));
  assert.ok(ui.w.document.querySelector('[data-action="retry-connection"]'));
 }finally{await ui.close();}
});

const bookmarkTree = [{id: "0", children: [{id: "1", title: "Sites", children: [
  {url: "https://new.example:8443/path?q=private"}, {url: "https://new.example/other"},
  {url: "javascript:alert(1)"}, {url: "https://user:pass@secret.example"},
  {id: "2", title: "Subpasta", children: [{url: "https://nested.example"}]},
]}]}];

test("VPN imports bookmark domains into the draft and selected mode only, then saves explicitly", async () => {
  const requests = [];
  const ui = await boot(snapshot(), {browser: {
    permissions: {request: async value => { requests.push(value); return true; }},
    bookmarks: {getTree: async () => bookmarkTree},
  }});
  try {
    await ui.app.navigate("features");
    await ui.click("load-bookmarks");
    assert.deepEqual(plain(requests), [{permissions: ["bookmarks"]}]);
    assert.match(ui.w.document.body.textContent, /2 novos domínios/);
    assert.doesNotMatch(ui.w.document.body.textContent, /private|secret.example/);
    const recursive = ui.w.document.querySelector('[data-field="bookmark-recursive"]');
    recursive.checked = false; recursive.dispatchEvent(new ui.w.Event("change", {bubbles: true}));
    await tick();
    assert.match(ui.w.document.body.textContent, /1 novo domínio/);
    const subdomains = ui.w.document.querySelector('[data-field="subdomains"]');
    subdomains.checked = false; subdomains.dispatchEvent(new ui.w.Event("change", {bubbles: true}));
    await ui.click("import-bookmarks");
    assert.equal(ui.calls.filter(call => call[0] === "split").length, 0);
    assert.equal(ui.w.document.querySelector('[data-action="import-bookmarks"]').disabled, true);
    const preview = ui.w.document.querySelector('[data-bookmark-preview]');
    assert.match(preview.textContent, /0 novos domínios/);
    assert.match(preview.textContent, /1 únicos nesta pasta · 1 já na lista · 2 links incompatíveis ignorados/);
    assert.equal(preview.querySelector('li').textContent, "new.example (já na lista)");
    assert.equal(preview.classList.contains("ui-bookmark-preview"), true);
    const mode = ui.w.document.querySelector('[data-field="split-mode"]');
    mode.value = "include"; mode.dispatchEvent(new ui.w.Event("change", {bubbles: true}));
    await tick();
    await ui.click("import-bookmarks");
    ui.w.document.querySelector('[data-split]').dispatchEvent(new ui.w.Event("submit", {bubbles: true, cancelable: true}));
    await tick();
    const config = ui.calls.find(call => call[0] === "split")[1];
    assert.deepEqual(config.value, [
      {domain: "old.example", withSubDomains: false, mode: "include"},
      {domain: "new.example", withSubDomains: false, mode: "exclude"},
      {domain: "new.example", withSubDomains: false, mode: "include"},
    ]);
  } finally { await ui.close(); }
});

test("VPN bookmark permission denial and read failures keep the draft untouched", async () => {
  for (const denied of [true, false]) {
    const ui = await boot(snapshot(), {browser: {
      permissions: {request: async () => !denied},
      bookmarks: {getTree: async () => {throw new Error("Read failed");}},
    }});
    try {
      await ui.app.navigate("features"); await ui.click("load-bookmarks");
      assert.match(ui.w.document.querySelector('[data-bookmark-status] [role="alert"]').textContent, denied ? /não concedido/ : /Não foi possível acessar/);
      assert.equal(ui.w.document.querySelector('[data-action="import-bookmarks"]').disabled, true);
      assert.equal(ui.calls.some(call => call[0] === "split"), false);
    } finally { await ui.close(); }
  }
});

test("VPN bookmark preview reuses cleanup traversal with hostname routing semantics", () => {
  const shared = require(path.join(root, "rules.js"));
  const {normalizeBookmarkDomain} = load("bookmarks.js");
  const folders = shared.bookmarkFolders(bookmarkTree, true);
  assert.equal(folders[1].label, "Sites / Subpasta");
  assert.deepEqual(plain(shared.bookmarkDomains(bookmarkTree[0].children[0], false)), {domains: ["new.example", "new.example:8443"], skipped: 2});
  assert.deepEqual(plain(shared.bookmarkDomains(folders[0].node, true, normalizeBookmarkDomain)), {domains: ["nested.example", "new.example"], skipped: 2});
});

test("managed VPN split rules cannot request bookmark access", async () => {
  let requested = false;
  const initial = snapshot(); initial.splitControllable = false;
  const ui = await boot(initial, {browser: {permissions: {request: async () => {requested = true; return true;}}}});
  try {
    await ui.app.navigate("features"); await ui.click("load-bookmarks");
    assert.equal(requested, false);
  } finally { await ui.close(); }
});


test("pending account data is not a device policy; failed loading offers retry and recovers settings", async () => {
  let rejectLoad, attempts = 0;
  const ready = snapshot(); ready.featuresReady = true;
  const partial = snapshot(); partial.featuresReady = false; partial.splitControllable = false;
  for (const feature of Object.values(partial.features)) feature.controllable = false;
  const ui = await boot(ready, {load: async progress => {
    if (++attempts > 1) return ready;
    progress(partial);
    return new Promise((resolve, reject) => {rejectLoad = reject;});
  }});
  try {
    await ui.app.navigate("features");
    assert.match(ui.w.document.body.textContent, /Aguardando carregar/);
    assert.doesNotMatch(ui.w.document.body.textContent, /Controlado pela configuração/);
    assert.equal(ui.w.document.querySelector('[data-feature="autoConnect"]').disabled, true);
    rejectLoad(new Error("Account request failed")); await tick();
    assert.match(ui.w.document.body.textContent, /Não foi possível concluir o carregamento/);
    assert.match(ui.w.document.body.textContent, /Account request failed/);
    assert.doesNotMatch(ui.w.document.body.textContent, /Controlado pela configuração/);
    await ui.click("refresh");
    assert.equal(ui.w.document.querySelector('[data-feature="autoConnect"]').disabled, false);
    assert.equal(ui.w.document.querySelector('[data-split] fieldset').disabled, false);
    assert.doesNotMatch(ui.w.document.body.textContent, /Aguardando carregar|Account request failed/);
  } finally { await ui.close(); }
});

test("confirmed device restrictions remain disabled and labeled after account loading", async () => {
  const initial = snapshot(); initial.featuresReady = true; initial.splitControllable = false;
  for (const feature of Object.values(initial.features)) feature.controllable = false;
  const ui = await boot(initial);
  try {
    await ui.app.navigate("features");
    assert.match(ui.w.document.body.textContent, /Controlado pela configuração deste dispositivo/);
    assert.doesNotMatch(ui.w.document.body.textContent, /Aguardando carregar/);
    assert.equal(ui.w.document.querySelector('[data-feature="autoConnect"]').disabled, true);
    assert.equal(ui.w.document.querySelector('[data-split] fieldset').disabled, true);
  } finally { await ui.close(); }
});


test("VPN shared domain list removes only the selected mode and keeps saving explicit", async () => {
  const initial = snapshot();
  initial.split.value.push({domain: "old.example", mode: "exclude", withSubDomains: true});
  const ui = await boot(initial);
  try {
    await ui.app.navigate("features");
    const list = ui.w.document.querySelector('[data-domain-list]');
    assert.ok(list.classList.contains('ui-domain-list'));
    assert.equal(list.querySelector('small').textContent, 'Incluir subdomínios');
    assert.equal(list.querySelector('button').textContent, '×');
    await ui.click('remove-domain');
    assert.equal(ui.calls.filter(call => call[0] === 'split').length, 0);
    assert.equal(ui.w.document.querySelector('[data-domain-list]').children.length, 0);
    ui.w.document.querySelector('[data-split]').dispatchEvent(new ui.w.Event('submit', {bubbles: true, cancelable: true}));
    await tick();
    assert.deepEqual(ui.calls.find(call => call[0] === 'split')[1].value, [{domain: "old.example", withSubDomains: false, mode: "include"}]);
  } finally {await ui.close();}
});


test('VPN cannot release networking after the connection changes during confirmation', async () => {
  const initial = snapshot(); initial.state = {state:'blocked', error:{message:'VpnTrafficBlocked'}};
  const ui = await boot(initial);
  try {
    await ui.click('disconnect');
    assert.ok(ui.w.document.querySelector('dialog'));
    ui.broadcast('changeState', {state:'connected', server:{name:'JP#1'}});
    ui.w.document.querySelector('[data-confirm=accept]').click(); await tick();
    assert.equal(ui.calls.some(call => call[0] === 'disconnect'), false);
    assert.equal(ui.w.document.querySelector('.vpn-status-card').dataset.status, 'connected');
  } finally {await ui.close();}
});
