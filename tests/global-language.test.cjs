const { test } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.resolve(__dirname, "..");
const tick = () => new Promise((resolve) => setTimeout(resolve, 40));
function setup(html, initialLocale = "en") {
  const errors = [],
    vc = new VirtualConsole();
  vc.on("jsdomError", (error) => errors.push(error.message));
  vc.on("error", (error) => errors.push(String(error)));
  const dom = new JSDOM(html, {
    url: "https://extension.test/popup.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window,
    listeners = new Set();
  const local = {
    enabled: true,
    clearHistory: true,
    excludedSites: ["saved.example"],
    autoplay: {
      enabled: true,
      globalBehavior: "block",
      siteSettings: { "video.example": "allow" },
    },
    tabGuard: {
      enabled: true,
      scope: "last",
      singleNewTab: false,
      newTabLast: false,
    },
  };
  const sync = { "tabliss/config/locale": initialLocale };
  const onChanged = {
    addListener(fn) {
      listeners.add(fn);
    },
    removeListener(fn) {
      listeners.delete(fn);
    },
  };
  const event = { addListener() {}, removeListener() {} };
  const area = (state, name) => ({
    get(keys, cb) {
      const result =
        keys == null
          ? { ...state }
          : typeof keys === "string"
            ? { [keys]: state[keys] }
            : Array.isArray(keys)
              ? Object.fromEntries(
                  keys
                    .filter((key) => key in state)
                    .map((key) => [key, state[key]]),
                )
              : {
                  ...keys,
                  ...Object.fromEntries(
                    Object.keys(keys)
                      .filter((key) => key in state)
                      .map((key) => [key, state[key]]),
                  ),
                };
      cb?.(result);
      return Promise.resolve(result);
    },
    set(value, cb) {
      const changes = {};
      for (const [key, next] of Object.entries(value)) {
        changes[key] = { oldValue: state[key], newValue: next };
        state[key] = next;
      }
      for (const listener of listeners) listener(changes, name);
      cb?.();
      return Promise.resolve();
    },
    remove(keys, cb) {
      [].concat(keys).forEach((key) => delete state[key]);
      cb?.();
      return Promise.resolve();
    },
  });
  w.chrome = {
    storage: {
      local: area(local, "local"),
      sync: area(sync, "sync"),
      session: area({}, "session"),
      managed: area({}, "managed"),
      onChanged,
    },
    runtime: {
      id: "extension",
      getURL: (value) => "https://extension.test/" + value,
      onMessage: event,
      sendMessage(message, cb) {
        const result =
          message.channel === "super-sync"
            ? {
                channel: "super-sync",
                type: message.type + "Response",
                params: [true],
              }
            : { ok: true };
        cb?.(result);
        return Promise.resolve(result);
      },
    },
    tabs: {
      query: async () => [{ url: "https://video.example" }],
      onRemoved: event,
    },
    permissions: { request: async () => true },
    bookmarks: { getTree: async () => [] },
    i18n: { getUILanguage: () => "pt-BR" },
  };
  w.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  w.confirm = () => true;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  return {
    w,
    dom,
    local,
    sync,
    errors,
    close() {
      w.superSyncApp?.$destroy();
      w.dispatchEvent(new w.Event("unload"));
      w.close();
    },
  };
}
function scripts(w, files) {
  w.eval(
    files
      .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
      .join("\n;\n"),
  );
}
test("global header locale updates all local tabs, dynamic messages and both embedded modules without losing settings", async () => {
  const ui = setup(fs.readFileSync(path.join(root, "popup.html"), "utf8"));
  try {
    scripts(ui.w, [
      "preferences.js",
      "i18n.js",
      "rules.js",
      "navigation-rules.js",
      "popup.js",
      "tools-popup.js",
    ]);
    await tick();
    const doc = ui.w.document;
    assert.equal(doc.querySelector("#language").value, "en");
    assert.equal(doc.documentElement.lang, "en");
    assert.equal(doc.querySelector("#section-cleanup").textContent, "Cleanup");
    assert.equal(doc.querySelector("#tab-tabs").textContent, "Tabs");
    assert.equal(
      doc.querySelector("#reportTitle").textContent,
      "No cleanup recorded",
    );
    assert.match(
      doc.querySelector("#currentAutoplayEffective").textContent,
      /Allowing autoplay/,
    );
    assert.equal(doc.querySelector("#listCount").textContent, "1 domain");
    assert.equal(
      doc.querySelector("#language").parentElement.parentElement,
      doc.querySelector("#theme").parentElement.parentElement,
    );
    const style = doc.createElement("style");
    style.textContent = fs
      .readFileSync(path.join(root, "popup.css"), "utf8")
      .replace(/@import[^;]+;/g, "");
    doc.head.append(style);
    for (const id of ["tab-autoplay", "tab-tabs"]) {
      doc.querySelector("#" + id).click();
      assert.equal(
        ui.w.getComputedStyle(doc.querySelector("main > footer")).display,
        "none",
      );
    }
    doc.querySelector("#section-cleanup").click();
    assert.notEqual(
      ui.w.getComputedStyle(doc.querySelector("main > footer")).display,
      "none",
    );
    assert.equal(
      doc.querySelector("#popupStatus").parentElement,
      doc.querySelector("main"),
    );
    doc.querySelector("#domainInput").value = "unsaved.example";
    scripts(ui.w, ["sync/js/options.js", "vpn/interface.js"]);
    await tick();
    assert.equal(doc.querySelector("#syncPanel .sync-language"), null);
    assert.match(doc.querySelector("#syncPanel").textContent, /Your bookmarks/);
    doc.querySelector("#language").value = "pt-BR";
    doc
      .querySelector("#language")
      .dispatchEvent(new ui.w.Event("change", { bubbles: true }));
    await tick();
    assert.equal(ui.sync["tabliss/config/locale"], "pt-BR");
    assert.equal(doc.querySelector("#section-cleanup").textContent, "Limpeza");
    assert.equal(doc.querySelector("#tab-tabs").textContent, "Abas");
    assert.equal(doc.querySelector("#listCount").textContent, "1 domínio");
    assert.match(
      doc.querySelector("#currentAutoplayEffective").textContent,
      /Permitindo autoplay/,
    );
    assert.match(doc.querySelector("#syncPanel").textContent, /Seus favoritos/);
    assert.match(
      doc.querySelector("#vpnPanel").textContent,
      /VPN no navegador/,
    );
    assert.equal(doc.querySelector("#domainInput").value, "unsaved.example");
    assert.deepEqual(ui.local.excludedSites, ["saved.example"]);
    assert.equal(doc.querySelector("#enabled").checked, true);
    await ui.w.SuperPreferences.locale.set("en");
    await tick();
    assert.match(doc.querySelector("#vpnPanel").textContent, /Browser VPN/);
    assert.deepEqual(ui.errors, []);
  } finally {
    ui.close();
  }
});
test("shared catalogs preserve notification placeholders, and the spare tab follows the chosen language", async () => {
  const ui = setup(fs.readFileSync(path.join(root, "spare-tab.html"), "utf8"));
  try {
    scripts(ui.w, ["preferences.js", "i18n.js"]);
    await tick();
    assert.match(ui.w.document.body.textContent, /Your window stays open/);
    const message = ui.w.SuperI18n.t("desktopNotifContext", ["history, cache"]);
    assert.equal(message, "Deleted: history, cache");
    await ui.w.SuperPreferences.locale.set("pt-BR");
    await tick();
    assert.match(ui.w.document.body.textContent, /Sua janela continua aberta/);
    assert.deepEqual(ui.errors, []);
  } finally {
    ui.close();
  }
});
test("both runtime catalogs have matching keys and all static translation markers resolve", () => {
  const en = JSON.parse(
      fs.readFileSync(path.join(root, "_locales/en/messages.json")),
    ),
    pt = JSON.parse(
      fs.readFileSync(path.join(root, "_locales/pt_BR/messages.json")),
    );
  assert.deepEqual(Object.keys(en).sort(), Object.keys(pt).sort());
  for (const [key, entry] of Object.entries(en)) {
    assert.ok(pt[key].message.trim(), key);
    assert.deepEqual(
      (entry.message.match(/\{\w+\}/g) || []).sort(),
      (pt[key].message.match(/\{\w+\}/g) || []).sort(),
      key,
    );
  }
  for (const file of ["popup.html", "spare-tab.html"]) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, file), "utf8"));
    for (const el of dom.window.document.querySelectorAll("*"))
      for (const attr of el.attributes)
        if (attr.name === "data-i18n" || attr.name.startsWith("data-i18n-"))
          assert.ok(en[attr.value], file + ": " + attr.value);
    dom.window.close();
  }
});
