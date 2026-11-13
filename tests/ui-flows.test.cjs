const {test} = require("node:test");
const assert = require("node:assert/strict");
const {JSDOM} = require("jsdom");
const {confirmAction, cancelConfirmation} = require("../ui/confirmation.js");
const {createBookmarkImporter, bookmarkImporterMarkup} = require("../ui/bookmark-importer.js");
const {domainEditorMarkup, bindDomainEditor} = require("../ui/domain-editor.js");
const {asyncStateMarkup} = require("../ui/async-state.js");
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => {let resolve; const promise = new Promise(fn => resolve = fn); return {promise, resolve};};
function importerFixture(overrides = {}) {
  const dom = new JSDOM(bookmarkImporterMarkup());
  const imports = [], calls = [];
  let scope = 'cookies';
  const options = {
    locale: () => 'pt-BR', scope: () => scope,
    normalize: value => new URL(value).hostname,
    browser: {permissions: {request: () => {calls.push('permission'); return Promise.resolve(true);}}, bookmarks: {getTree: async () => [{id:'0', children:[{id:'1', title:'<Sites>', children:[{url:'https://a.example/secret'},{url:'https://b.example'},{id:'2',title:'Sub',children:[{url:'https://nested.example'}]},{url:'javascript:alert(1)'}]}]}]}},
    existing: async () => ['a.example'], import: async (domains, destination) => imports.push([domains, destination]),
    ...overrides,
  };
  const importer = createBookmarkImporter(options);
  importer.attach(dom.window.document.querySelector('[data-bookmark-importer]'));
  return {dom, importer, imports, calls, setScope(value) {scope = value;}, close() {importer.dispose(); dom.window.close();}};
}

test('shared importer requests permission in the click, coalesces loading and imports fresh domains only', async () => {
  const f = importerFixture();
  try {
    const first = f.importer.load(); assert.deepEqual(f.calls, ['permission']);
    assert.equal(f.importer.load(), first); await first;
    assert.equal(f.dom.window.document.querySelector('option').textContent, '<Sites>');
    assert.equal(f.dom.window.document.querySelector('sites'), null);
    assert.deepEqual(f.importer.state.preview.fresh, ['b.example','nested.example']);
    const recursive = f.dom.window.document.querySelector('[data-bookmark-recursive]');
    recursive.checked = false; recursive.dispatchEvent(new f.dom.window.Event('change', {bubbles:true})); await tick();
    await f.importer.apply();
    assert.deepEqual(f.imports, [[['b.example'], 'cookies']]);
    assert.equal(f.importer.state.preview.skipped, 1);
    assert.doesNotMatch(f.dom.window.document.body.textContent, /secret/);
  } finally {f.close();}
});

test('shared importer discards a changed destination and a late response after disposal', async () => {
  const wait = deferred(); let slow = false;
  const f = importerFixture({existing: () => slow ? wait.promise : Promise.resolve([])});
  try {
    await f.importer.load(); slow = true;
    const pending = f.importer.apply(); f.setScope('cache'); wait.resolve([]); await pending;
    assert.deepEqual(f.imports, []);
    const permission = deferred(); let read = false;
    const late = importerFixture({browser: {permissions:{request: () => permission.promise}, bookmarks:{getTree:async()=>{read=true;return [];}}}});
    const request = late.importer.load(); late.close(); permission.resolve(true); await request;
    assert.equal(read, false);
  } finally {f.close();}
});

test('shared importer permission denial is recoverable and never imports old items', async () => {
  let granted = false;
  const f = importerFixture();
  f.importer.dispose();
  const imports = [];
  const importer = createBookmarkImporter({
    locale: () => 'en', scope: () => 'exclude', normalize: value => new URL(value).hostname,
    browser: {permissions:{request:async()=>granted},bookmarks:{getTree:async()=>[]}},
    existing:async()=>[], import: values=>imports.push(values),
  });
  importer.attach(f.dom.window.document.querySelector('[data-bookmark-importer]'));
  try {
    await importer.load(); assert.match(f.dom.window.document.body.textContent, /not granted/);
    await importer.apply(); assert.deepEqual(imports, []);
    granted = true; await importer.load(); assert.equal(importer.state.error, '');
    assert.match(f.dom.window.document.body.textContent, /No bookmarks folders/);
  } finally {importer.dispose();f.close();}
});

test('shared domain editor prevents duplicate writes and preserves input on validation failure', async () => {
  const dom = new JSDOM(domainEditorMarkup({form:true, labels:{domain:'Domain', add:'Add', empty:'Empty'}}));
  const host = dom.window.document.querySelector('form'), input = host.querySelector('input'), wait = deferred(), calls = [], errors = [];
  const dispose = bindDomainEditor(host, {
    normalize: value => {if (!value.includes('.')) throw Error('Invalid');return value.toLowerCase();},
    onAdd: value => {calls.push(value);return wait.promise;}, onError: error => errors.push(error.message),
  });
  try {
    input.value = 'invalid'; host.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})); await tick();
    assert.equal(input.value,'invalid'); assert.deepEqual(errors,['Invalid']);
    input.value = 'A.example'; const button=host.querySelector('button'); button.click();button.click();
    assert.deepEqual(calls,['a.example']); input.value='later.example';wait.resolve();await tick();
    assert.equal(input.value,'later.example'); assert.equal(button.disabled,false);
  } finally {dispose();dom.window.close();}
});

test('shared confirmation requires acceptance, traps keyboard focus and restores the trigger', async () => {
  const dom = new JSDOM('<button id="trigger">Start</button>',{pretendToBeVisual:true});
  const doc=dom.window.document, trigger=doc.querySelector('button');trigger.focus();
  try {
    const pending=confirmAction(doc,'<img src=x>',{locale:'en'});
    assert.equal(doc.querySelector('img'),null);
    assert.equal(await confirmAction(doc,'duplicate'),false);
    const cancel=doc.querySelector('[data-confirm=cancel]'), accept=doc.querySelector('[data-confirm=accept]');
    assert.equal(doc.activeElement,cancel);
    cancel.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
    assert.equal(doc.activeElement,accept);
    accept.click(); assert.equal(await pending,true); assert.equal(doc.activeElement,trigger);
    const dismissed=confirmAction(doc,'Again');doc.querySelector('dialog').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    assert.equal(await dismissed,false);
    const unloading=confirmAction(doc,'Pending');dom.window.dispatchEvent(new dom.window.Event('pagehide'));assert.equal(await unloading,false);
    const disposed=confirmAction(doc,'Unmounted');cancelConfirmation(doc);assert.equal(await disposed,false);
  } finally {dom.window.close();}
});

test('shared loading/error renderer escapes messages and disables retry while busy', () => {
  const dom = new JSDOM(asyncStateMarkup({kind:'error',text:'<script>bad()</script>',retry:'Retry',disabled:true}));
  try {
    assert.equal(dom.window.document.querySelector('script'),null);
    assert.equal(dom.window.document.querySelector('[role=alert]').textContent,'<script>bad()</script>Retry');
    assert.equal(dom.window.document.querySelector('button').disabled,true);
    assert.equal(asyncStateMarkup(), '');
  } finally {dom.window.close();}
});
