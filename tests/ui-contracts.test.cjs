const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { JSDOM } = require('jsdom');
const ts = require('typescript');
const { renderUi } = require('../ui/render.cjs');
const { catalog } = require('../ui/render.cjs');
const { createUi } = require('../ui/dom.cjs');
const { buildUi } = require('../scripts/build-ui.cjs');
const root = path.resolve(__dirname, '..');

test('DOM components render untrusted labels as text and preserve native listeners', () => {
  const dom = new JSDOM('<main></main>'); let clicked = 0;
  const button = createUi(dom.window.document, catalog, 'button', { attrs: { 'aria-label': 'Remove domain' }, on: { click: () => clicked++ } }, '<img src=x onerror=alert(1)>');
  dom.window.document.querySelector('main').append(button); button.click();
  assert.equal(clicked, 1); assert.equal(button.type, 'button'); assert.equal(button.querySelector('img'), null);
  assert.equal(button.textContent, '<img src=x onerror=alert(1)>');
  const select = createUi(dom.window.document, catalog, 'control', { as: 'select', attrs: { disabled: true } });
  assert.equal(select.disabled, true); assert.equal(select.getAttribute('type'), null);
  dom.window.close();
});

test('native components keep form semantics, associations, state and escaped content', () => {
  const dom = new JSDOM(renderUi(`<ui-form id="connection"><ui-field for="secret">API key</ui-field>
    <ui-control id="secret" type="password" value="&lt;script&gt;" required />
    <ui-actions><ui-button disabled data-action="retry">Retry</ui-button><ui-button type="submit">Save</ui-button></ui-actions>
    <ui-notice role="alert" hidden>Error</ui-notice><ui-card as="fieldset"><legend>Options</legend></ui-card>
    <ui-control as="select"><option value="pt-BR">Português</option></ui-control></ui-form>`));
  const d = dom.window.document;
  assert.equal(d.querySelector('label').control, d.getElementById('secret'));
  assert.equal(d.getElementById('secret').value, '<script>');
  assert.equal(d.querySelector('[data-action]').type, 'button');
  assert.equal(d.querySelector('[data-action]').disabled, true);
  assert.equal(d.querySelector('[type="submit"]').form.id, 'connection');
  assert.equal(d.querySelector('[role="alert"]').hidden, true);
  assert.ok(d.querySelector('fieldset.ui-card'));
  assert.ok(d.querySelector('select.ui-control'));
  assert.equal(d.querySelector('script'), null);
  dom.window.close();
});

test('component expansion rejects unknown, unbalanced and invalid tag variants', () => {
  assert.throws(() => renderUi('<ui-unknown />'), /Unknown/);
  assert.throws(() => renderUi('<ui-card></ui-field>'), /Unbalanced/);
  assert.throws(() => renderUi('<ui-card>'), /Unclosed/);
  assert.throws(() => renderUi('<ui-button as="script">bad</ui-button>'), /Invalid tag/);
});

test('installed static pages match their templates and contain only native elements', () => {
  buildUi(true);
  for (const file of ['popup.html', 'spare-tab.html', 'newtab/index.html']) {
    const d = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8')).window.document;
    assert.equal([...d.querySelectorAll('*')].filter(el => el.localName.startsWith('ui-')).length, 0);
    const ids = [...d.querySelectorAll('[id]')].map(el => el.id);
    assert.equal(new Set(ids).size, ids.length, 'component expansion must preserve unique identifiers');
    if (file === 'popup.html') {
      for (const id of ['clearNow', 'enabled', 'theme', 'language', 'vpnPanel', 'syncApp', 'domainForm', 'autoplayForm']) assert.ok(d.getElementById(id), id);
      assert.equal(d.getElementById('domainInput').form.id, 'domainForm');
      assert.equal(d.querySelector('#domainForm [data-domain-add]').type, 'button');
      assert.equal(d.querySelector('#cleanupSubmenu button').type, 'button');
    }
    d.defaultView.close();
  }
});

test('Vue native adapter preserves slots, events, refs and v-model input/select values', async () => {
  const dom = new JSDOM('<div id="mount"></div>');
  const original = Object.fromEntries(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(global, key)]));
  for (const key of Object.keys(original)) Object.defineProperty(global, key, { configurable: true, value: key === 'window' ? dom.window : dom.window[key] });
  let app;
  try {
    const Vue = require('../vendor/floccus-source/node_modules/vue');
    Vue.config.productionTip = false;
    const exports = {};
    const filename = path.join(root, 'ui/vue.js');
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText,
      { exports, require: spec => require(path.resolve(path.dirname(filename), spec)) });
    Vue.use(exports.installUi);
    app = new Vue({
      data: () => ({ value: 'initial', locale: 'en', clicks: 0 }),
      render(h) {
        return h('UiForm', { on: { submit: event => event.preventDefault() } }, [
          h('UiField', { attrs: { for: 'draft' } }, ['Draft']),
          h('UiControl', { attrs: { id: 'draft', type: 'text' }, model: { value: this.value, callback: value => { this.value = value; } } }),
          h('UiControl', { attrs: { as: 'select' }, model: { value: this.locale, callback: value => { this.locale = value; } } }, [h('option', { attrs: { value: 'en' } }, ['English']), h('option', { attrs: { value: 'pt-BR' } }, ['Português'])]),
          h('UiButton', { ref: 'action', on: { click: () => this.clicks++ } }, ['Apply']),
        ]);
      },
    }).$mount('#mount');
    const d = dom.window.document, input = d.querySelector('input'), select = d.querySelector('select');
    assert.equal(d.querySelector('label').control, input);
    assert.equal(input.value, 'initial');
    input.value = 'changed'; input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    select.value = 'pt-BR'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    app.$refs.action.click();
    await Vue.nextTick();
    assert.equal(app.value, 'changed'); assert.equal(app.locale, 'pt-BR'); assert.equal(app.clicks, 1);
    assert.equal(app.$refs.action.type, 'button');
  } finally {
    app?.$destroy(); dom.window.close();
    for (const [key, descriptor] of Object.entries(original)) descriptor ? Object.defineProperty(global, key, descriptor) : delete global[key];
  }
});
