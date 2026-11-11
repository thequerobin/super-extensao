const { test } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.resolve(__dirname, "..");
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
async function boot(initial = {}) {
  const warnings = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => warnings.push(e.message));
  vc.on("error", (e) => warnings.push(String(e)));
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="syncPanel"><div id="syncApp"></div></div></body></html>',
    {
      url: "https://extension.test/popup.html",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole: vc,
    }
  );
  const w = dom.window;
  const events = () => {
    const listeners = new Set();
    return {
      addListener(fn) {
        listeners.add(fn);
      },
      removeListener(fn) {
        listeners.delete(fn);
      },
      emit(...args) {
        listeners.forEach((fn) => fn(...args));
      },
    };
  };
  const changed = events(),
    messages = events();
  const local = { ...initial.local },
    sync = { ...initial.sync };
  const calls = [];
  const area = (state, name) => ({
    get(keys, cb) {
      let r;
      if (keys == null) r = { ...state };
      else if (typeof keys === "string") r = { [keys]: state[keys] };
      else if (Array.isArray(keys))
        r = Object.fromEntries(
          keys.filter((k) => k in state).map((k) => [k, state[k]])
        );
      else
        r = {
          ...keys,
          ...Object.fromEntries(
            Object.keys(keys)
              .filter((k) => k in state)
              .map((k) => [k, state[k]])
          ),
        };
      cb?.(r);
      return Promise.resolve(r);
    },
    set(data, cb) {
      const changes = {};
      for (const [k, v] of Object.entries(data)) {
        changes[k] = { oldValue: state[k], newValue: v };
        state[k] = v;
      }
      changed.emit(changes, name);
      cb?.();
      return Promise.resolve();
    },
    remove(keys, cb) {
      for (const k of [].concat(keys)) delete state[k];
      cb?.();
      return Promise.resolve();
    },
  });
  w.chrome = {
    runtime: {
      id: "test",
      getURL: (p) => "https://extension.test/" + p,
      onMessage: messages,
      sendMessage(data, cb) {
        calls.push(data);
        const response = {
          channel: "super-sync",
          type: data.type + "Response",
          params: [!initial.locked],
        };
        cb?.(response);
        return Promise.resolve(response);
      },
    },
    storage: {
      local: area(local, "local"),
      sync: area(sync, "sync"),
      onChanged: changed,
    },
    identity: { getRedirectURL: () => "https://test.chromiumapp.org/" },
    bookmarks: {
      get(ids, cb) {
        cb(
          []
            .concat(ids)
            .map((id) => ({
              id,
              title: id === "0" ? "" : "Favoritos",
              parentId: id === "0" ? undefined : "0",
              children: [],
            }))
        );
      },
      getTree(cb) {
        cb([
          {
            id: "0",
            title: "",
            children: [
              { id: "1", title: "Favoritos", parentId: "0", children: [] },
            ],
          },
        ]);
      },
    },
    tabs: {},
    i18n: { getUILanguage: () => "pt-BR" },
    permissions: {
      request(_p, cb) {
        cb(true);
      },
    },
  };
  w.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  w.fetch = async () => ({ status: 207, ok: true, text: async () => "" });
  w.alert = (message) => warnings.push("alert: " + message);
  w.confirm = () => true;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.eval(fs.readFileSync(path.join(root, "preferences.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(root, "sync/js/options.js"), "utf8"));

  await tick();
  const app = w.superSyncApp;
  const route = async (path) => {
    await app.$router.push(path);
    await tick();
  };
  const component = (name) => {
    const find = (vm) =>
      vm.$options.name === name ? vm : vm.$children.map(find).find(Boolean);
    return find(app);
  };
  return {
    w,
    local,
    sync,
    calls,
    warnings,
    app,
    route,
    component,
    close() {
      app.$destroy();
      w.close();
    },
  };
}
const profile = {
  type: "webdav",
  label: "Trabalho",
  url: "https://example.test/dav/",
  username: "test",
  password: "private-test",
  localRoot: "1",
  rootPath: "/Favoritos",
  bookmark_file: "bookmarks.xbel",
  bookmark_file_type: "xbel",
  enabled: true,
  failsafe: true,
  strategy: "default",
  syncInterval: 15,
  nestedSync: true,
};
test("sync interface navigates internally, switches language and isolates OAuth settings", async () => {
  const ui = await boot({
    local: { theme: "dark", excludedSites: ["example.com"] },
  });
  try {
    assert.match(ui.w.document.body.textContent, /Leve seus favoritos/);
    assert.equal(
      ui.w.document.querySelectorAll(".sync-navigation a").length,
      4
    );
    assert.equal(
      ui.w.document.querySelectorAll('a[target="_blank"]').length,
      0
    );
    await ui.route("/connections");
    const form = ui.component("Connections");
    form.oauth.googleClientId = "test-client";
    await form.save();
    assert.equal(
      ui.local["superSync:oauthClients"].googleClientId,
      "test-client"
    );
    assert.equal(ui.local.theme, "dark");
    assert.deepEqual(ui.local.excludedSites, ["example.com"]);
    await ui.route("/");
    await ui.route("/connections");
    assert.equal(
      ui.component("Connections").oauth.googleClientId,
      "test-client"
    );
    await ui.w.SuperPreferences.locale.set("en");
    await tick();
    assert.match(
      ui.w.document.body.textContent,
      /Save connection settings/
    );
    await ui.route("/new");
    assert.equal(ui.w.document.querySelectorAll(".sync-service").length, 8);
    const webdav = [...ui.w.document.querySelectorAll(".sync-service")].find(
      (el) => el.textContent.includes("WebDAV")
    );
    webdav.click();
    await tick();
    assert.equal(ui.component("NewAccount").adapter, "webdav");
    assert.equal(webdav.getAttribute("aria-pressed"), "true");
    assert.deepEqual(ui.warnings, []);
  } finally {
    ui.close();
  }
});
test("existing profiles retain data, edits are drafts, backup selects profiles and directional sync confirms", async () => {
  const ui = await boot({
    local: { "superSync:accounts": JSON.stringify({ saved: profile }) },
  });
  try {
    assert.equal(ui.w.document.querySelectorAll(".sync-profile").length, 1);
    assert.match(ui.w.document.body.textContent, /Trabalho/);
    const card = ui.component("AccountCard");
    card.confirmDirection = "up";
    await tick();
    assert.ok(!ui.calls.some((c) => c.type === "syncAccount"));
    await card.runDirection();
    await tick();
    assert.ok(
      ui.calls.some(
        (c) =>
          c.type === "syncAccount" &&
          c.params[0] === "saved" &&
          c.params[1] === "overwrite"
      )
    );
    await ui.route("/options/saved");
    const options = ui.component("AccountOptions");
    options.data.label = "Rascunho";
    await tick();
    assert.equal(ui.app.$store.state.accounts.saved.data.label, "Trabalho");
    await ui.route("/");
    assert.match(ui.w.document.body.textContent, /Trabalho/);
    await ui.route("/options/saved");
    const second = ui.component("AccountOptions");
    second.data.label = "Atualizado";
    await second.onSave();
    assert.equal(
      JSON.parse(ui.local["superSync:accounts"]).saved.label,
      "Atualizado"
    );
    second.data.label = "Outro rascunho";
    await tick();
    assert.equal(ui.app.$store.state.accounts.saved.data.label, "Atualizado");
    await ui.route("/importexport");
    assert.equal(ui.component("ImportExport").selected.saved, true);
    assert.match(ui.w.document.body.textContent, /credenciais/);
    assert.deepEqual(ui.warnings, []);
  } finally {
    ui.close();
  }
});
test("WebDAV wizard tests connection and creates an engine-compatible profile", async () => {
  const ui = await boot();
  try {
    await ui.route("/new");
    const wizard = ui.component("NewAccount");
    Object.assign(wizard, {
      adapter: "webdav",
      label: "Pessoal",
      server: "https://example.test/dav/",
      username: "test",
      password: "test",
      localRoot: "1",
      currentStep: 2,
    });
    await wizard.testWebdavServer();
    assert.equal(wizard.currentStep, 3);
    wizard.currentStep = 4;
    await wizard.onCreate();
    await tick();
    assert.equal(wizard.currentStep, 5);
    const profiles = JSON.parse(ui.local["superSync:accounts"]);
    const data = Object.values(profiles)[0];
    assert.equal(data.type, "webdav");
    assert.equal(data.localRoot, "1");
    assert.equal(data.label, "Pessoal");
    await ui.route("/");
    assert.equal(ui.w.document.querySelectorAll(".sync-profile").length, 1);
    assert.deepEqual(ui.warnings, []);
  } finally {
    ui.close();
  }
});
test("locked engine keeps profile and credential views hidden", async () => {
  const ui = await boot({
    locked: true,
    local: { "superSync:accounts": JSON.stringify({ saved: profile }) },
  });
  try {
    await ui.route("/connections");
    assert.ok(ui.w.document.querySelector(".sync-unlock"));
    assert.equal(ui.w.document.querySelector(".sync-connections"), null);
    assert.equal(ui.w.document.querySelector(".sync-profile"), null);
    assert.deepEqual(ui.warnings, []);
  } finally {
    ui.close();
  }
});
