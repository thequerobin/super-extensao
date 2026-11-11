const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const postcss = require("../vendor/proton-source/node_modules/postcss");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// jsdom does not resolve custom properties. Resolve the selected theme for this
// cascade check; the shipped, scoped motor CSS remains part of the stylesheet.
function stylesheet(theme) {
  const tokens = {};
  for (const file of ["ui-components.css", "ui-theme.css"]) {
    postcss.parse(read(file)).walkRules((rule) => {
      if (rule.selector !== ":root" && !(theme === "light" && rule.selector.includes(':root[data-theme="light"]'))) return;
      rule.walkDecls(/^--/, (decl) => { tokens[decl.prop] = decl.value; });
    });
  }
  return ["ui-components.css", "ui-theme.css", "popup.css", "popup-panels.css"].map((file) => {
    const css = postcss.parse(read(file));
    css.walkAtRules((rule) => {
      if (["import", "-moz-document"].includes(rule.name)) rule.remove();
    });
    let text = css.toString();
    for (let i = 0; i < 5; i++) text = text.replace(/var\((--[\w-]+)(?:,([^()]*))?\)/g, (match, key, fallback) => tokens[key] || fallback || match);
    return text;
  }).join("\n");
}
for (const theme of ["dark", "light"]) {
  test(`shared controls survive the sync engine reset and match VPN and cleanup (${theme})`, () => {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on("jsdomError", (error) => errors.push(error.message));
    const dom = new JSDOM(`<body><main>
      <button class="ui-button" id="local-button">Add</button>
      <input class="ui-control" id="local-field">
      <article class="ui-card" id="local-card"></article>
      <p class="ui-notice ui-notice-error" id="local-error">Failed</p>
      <section id="syncPanel"><div class="v-application sync-workspace">
        <button class="sync-button ui-button" id="sync-button">Sync</button>
        <button class="v-btn" id="engine-button">Save</button>
        <div class="sync-form"><input class="ui-control" id="sync-field"></div>
        <article class="sync-profile ui-card" id="sync-card"></article>
        <p class="ui-notice sync-notice sync-error ui-notice-error" id="sync-error">Failed</p>
      </div></section>
      <section id="vpnPanel"><div class="vpn-app">
        <button class="vpn-button ui-button" id="vpn-button">Refresh</button>
        <label class="vpn-field"><input class="ui-control" id="vpn-field"></label>
        <article class="vpn-card ui-card" id="vpn-card"></article>
        <p class="vpn-error ui-notice ui-notice-error" id="vpn-error">Failed</p>
      </div></section>
      </main></body>`, { virtualConsole: vc });
    try {
      const doc = dom.window.document;
      const style = doc.createElement("style");
      style.textContent = stylesheet(theme);
      doc.head.append(style);
      assert.deepEqual(errors, []);
      const appearance = (id, properties) => {
        const computed = dom.window.getComputedStyle(doc.getElementById(id));
        return Object.fromEntries(properties.map((key) => [key, computed[key]]));
      };
      const controls = ["minHeight", "padding", "borderRadius", "backgroundColor", "color", "fontSize", "lineHeight"];
      for (const id of ["sync-button", "vpn-button", "engine-button"]) assert.deepEqual(appearance(id, controls), appearance("local-button", controls), id);
      for (const id of ["sync-field", "vpn-field"]) assert.deepEqual(appearance(id, controls), appearance("local-field", controls), id);
      for (const id of ["sync-card", "vpn-card"]) assert.deepEqual(appearance(id, ["padding", "borderRadius", "backgroundColor", "borderColor"]), appearance("local-card", ["padding", "borderRadius", "backgroundColor", "borderColor"]), id);
      for (const id of ["sync-error", "vpn-error"]) assert.deepEqual(appearance(id, controls), appearance("local-error", controls), id);
    } finally { dom.window.close(); }
  });
}
test('keyboard focus belongs to the compound field and remains inset on regular controls', () => {
  const dom = new JSDOM('<button class="ui-button">Long action</button><label class="ui-focus-within ui-search"><input class="ui-control"></label>', { pretendToBeVisual: true });
  try {
    const doc = dom.window.document, style = doc.createElement('style');
    style.textContent = stylesheet('light'); doc.head.append(style);
    const button = doc.querySelector('button'); button.focus();
    const buttonStyle = dom.window.getComputedStyle(button);
    assert.match(buttonStyle.outline, /2px solid/);
    assert.equal(buttonStyle.outlineOffset, 'calc(-1 * 2px)');
    doc.querySelector('input').focus();
    assert.equal(dom.window.getComputedStyle(doc.querySelector('input')).outline, 'none');
    assert.match(dom.window.getComputedStyle(doc.querySelector('label')).outline, /2px solid/);
    assert.equal(buttonStyle.overflowWrap, 'anywhere');
    assert.equal(buttonStyle.whiteSpace, 'normal');
  } finally { dom.window.close(); }
});
test('new-tab settings and spare page consume the shared palette rather than a second theme', () => {
  const css = postcss.parse(read('newtab/integration.css'));
  const settings = css.nodes.find(rule => rule.selector === '.Settings');
  const declarations = Object.fromEntries(settings.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
  for (const token of ['bg', 'surface', 'raised', 'text', 'muted', 'line', 'accent', 'accent-bg'])
    assert.equal(declarations['--se-' + token], `var(--${token})`);
  assert.match(read('newtab/integration.css'), /@import url\("\.\.\/ui-theme\.css"\)/);
  assert.match(read('spare-tab.css'), /@import url\("ui-theme\.css"\)/);
  assert.doesNotMatch(read('spare-tab.css'), /prefers-color-scheme|#[0-9a-f]{3,8}\b/i);
});
