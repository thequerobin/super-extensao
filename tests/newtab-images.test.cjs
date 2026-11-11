const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'vendor/tabliss-source/src');
const React = require('../vendor/tabliss-source/node_modules/react');
const { act, Simulate } = require('../vendor/tabliss-source/node_modules/react-dom/test-utils');
const { createRoot } = require('../vendor/tabliss-source/node_modules/react-dom/client');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  const storage = { 'superNewtab:imageProviders': { ...(options.keys || {}) } }, calls = [], listeners = new Set(), cache = new Map();
  const browser = { storage: { local: {
    async get(key) { return { [key]: storage[key] }; },
    async set(values) { Object.assign(storage, values); for (const listener of listeners) listener(Object.fromEntries(Object.keys(values).map(key => [key, { newValue: values[key] }])), 'local'); },
  }, sync: { set() { throw Error('Keys must not sync'); } }, onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } } };
  const globals = { console, Headers, Request, Response, Blob, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, BUILD_TARGET: 'chromium', UNSPLASH_API_KEY: undefined, GIPHY_API_KEY: undefined, browser,
    fetch: async (...args) => { calls.push(args); return options.fetch ? options.fetch(...args) : Promise.reject(Error('Unexpected request')); }, ...(options.globals || {}) };
  function load(relative) {
    const filename = path.resolve(source, relative);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(compiled, { ...globals, exports, require(name) {
      if (options.mocks && name in options.mocks) return options.mocks[name];
      if (/\.(sass|css)$/.test(name)) return {};
      if (name.endsWith('.png')) return { __esModule: true, default: name };
      if (name === 'react') return React;
      if (name.endsWith('/locales/ui')) return { t: text => text };
      if (name === './useTime') return { useTime: () => new Date(options.now || 1000) };
      if (name.startsWith('.')) {
        let target = path.resolve(path.dirname(filename), name);
        if (!path.extname(target)) target += fs.existsSync(target + '.ts') ? '.ts' : '.tsx';
        return load(target);
      }
      throw Error(name);
    } }, { filename });
    return exports;
  }
  return { load, storage, calls, listeners };
}
const photo = { urls: { raw: 'https://images.unsplash.com/photo-test' }, links: { html: 'https://unsplash.com/photos/test' }, user: { name: 'Photographer', links: { html: 'https://unsplash.com/@test' } }, location: { title: 'Place' } };
const photoConfig = { by: 'search', collections: '', topics: '', featured: false, search: 'nature' };
test('missing provider keys stop before network requests instead of sending undefined credentials', async () => {
  const f = fixture(), api = f.load('plugins/backgrounds/unsplash/api.ts'), gif = f.load('plugins/backgrounds/giphy/api.ts');
  await assert.rejects(() => api.fetchImages(photoConfig), error => error.code === 'key');
  await assert.rejects(() => gif.getGif({ tag: '', nsfw: false }, { push() {}, pop() {} }), error => error.code === 'key');
  assert.equal(f.calls.length, 0);
});
test('image keys persist only locally, preserve the other provider and notify subscribed views', async () => {
  const f = fixture({ keys: { giphy: 'giphy-local' } }), provider = f.load('plugins/backgrounds/shared/provider.ts');
  let changes = 0; const stop = provider.watchProviderKeys(() => changes++);
  await provider.saveProviderKey('unsplash', '  access-local  ');
  assert.equal(await provider.readProviderKey('unsplash'), 'access-local');
  assert.equal(await provider.readProviderKey('giphy'), 'giphy-local');
  assert.equal(changes, 1); stop(); assert.equal(f.listeners.size, 0);
});
test('Unsplash validates the response and preserves photo attribution', async () => {
  const f = fixture({ keys: { unsplash: 'access-local' }, fetch: async () => new Response(JSON.stringify([photo])) });
  const images = await f.load('plugins/backgrounds/unsplash/api.ts').fetchImages(photoConfig);
  assert.equal(images[0].src, photo.urls.raw); assert.equal(images[0].credit.userName, 'Photographer');
  assert.equal(f.calls[0][1].headers.get('Authorization'), 'Client-ID access-local');
  assert.equal(f.calls[0][1].redirect, 'error'); assert.equal(f.calls[0][1].credentials, 'omit');
  assert.equal(new URL(f.calls[0][0]).searchParams.get('query'), 'nature');
});
test('authorization/rate errors and malformed provider bodies remain typed and never expose credentials', async () => {
  for (const status of [401, 403, 429, 503]) {
    const f = fixture({ keys: { unsplash: 'private-access' }, fetch: async () => new Response('private-access', { status }) });
    await assert.rejects(() => f.load('plugins/backgrounds/unsplash/api.ts').fetchImages(photoConfig), error => error.code === 'http' && error.status === status && !error.message.includes('private'));
  }
  for (const body of [{ errors: ['Rejected'] }, [{ urls: null }], 'not json']) {
    const f = fixture({ keys: { unsplash: 'key' }, fetch: async () => new Response(typeof body === 'string' ? body : JSON.stringify(body)) });
    await assert.rejects(() => f.load('plugins/backgrounds/unsplash/api.ts').fetchImages(photoConfig), error => error.code === 'response');
  }
});
test('GIPHY validates missing original data and always releases its loading state after failure', async () => {
  for (const body of [{ data: [] }, { data: { images: {} } }, { meta: { status: 429 } }]) {
    let pending = 0;
    const f = fixture({ keys: { giphy: 'key' }, fetch: async () => new Response(JSON.stringify(body)) });
    await assert.rejects(() => f.load('plugins/backgrounds/giphy/api.ts').getGif({ tag: 'nature', nsfw: false }, { push() { pending++; }, pop() { pending--; } }));
    assert.equal(pending, 0); assert.equal(f.calls.length, 1);
  }
});
test('GIPHY loads valid image bytes, keeps attribution and does not pass API credentials to the image host', async () => {
  let pending = 0;
  const f = fixture({ keys: { giphy: 'giphy-local' }, fetch: async (url) => typeof url === 'string'
    ? new Response(new Blob(['image'], { type: 'image/webp' }))
    : new Response(JSON.stringify({ data: { url: 'https://giphy.com/gifs/test', images: { original: { webp: 'https://media.giphy.com/test.webp' } } } })) });
  const gif = await f.load('plugins/backgrounds/giphy/api.ts').getGif({ tag: 'nature', nsfw: false }, { push() { pending++; }, pop() { pending--; } });
  assert.equal(pending, 0); assert.equal(gif.data.type, 'image/webp'); assert.equal(gif.link, 'https://giphy.com/gifs/test');
  assert.equal(new URL(f.calls[0][0].url).searchParams.get('api_key'), 'giphy-local');
  assert.equal(f.calls[1][1].headers, undefined);
});
function dom() {
  const d = new JSDOM('<div id="root"></div>', { url: 'https://extension.test/newtab/' });
  const previous = { window: global.window, document: global.document, act: global.IS_REACT_ACT_ENVIRONMENT };
  global.window = d.window; global.document = d.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(d.window.document.querySelector('#root'));
  return { root, d, async close() { await act(async () => root.unmount()); d.window.close(); global.window = previous.window; global.document = previous.document; global.IS_REACT_ACT_ENVIRONMENT = previous.act; } };
}
test('failed refresh keeps the last cached image, surfaces the error and does not retry on every render', async () => {
  const ui = dom(), f = fixture(); let requests = 0, text;
  const { useRotatingCache } = f.load('hooks/useCache.ts');
  function View() {
    const [cache, setCache] = React.useState({ items: ['last-image'], cursor: 0, rotated: 1000, deps: [] });
    const [error, setError] = React.useState(null);
    const item = useRotatingCache(async () => { requests++; throw Error('offline'); }, { cache, setCache }, 100000, [], setError);
    text = [item, error?.message]; return React.createElement('p', null, item);
  }
  try { await act(async () => { ui.root.render(React.createElement(View)); await tick(); });
    assert.deepEqual(text, ['last-image', 'offline']); assert.equal(requests, 1);
    await act(async () => { ui.root.render(React.createElement(View)); await tick(); }); assert.equal(requests, 1);
  } finally { await ui.close(); }
});
test('small image batches keep a valid cursor and stale configuration responses are discarded', async () => {
  const ui = dom(), f = fixture(), { useRotatingCache } = f.load('hooks/useCache.ts');
  let resolveOld, latest, config = 'a';
  const old = new Promise(resolve => { resolveOld = resolve; });
  function View() {
    const [cache, setCache] = React.useState(undefined);
    latest = cache;
    const item = useRotatingCache(() => config === 'a' ? old : Promise.resolve(['new']), { cache, setCache }, 100000, [config]);
    return React.createElement('p', null, item);
  }
  try {
    await act(async () => { ui.root.render(React.createElement(View)); await tick(); });
    config = 'b'; await act(async () => { ui.root.render(React.createElement(View)); await tick(); });
    await act(async () => { resolveOld(['old']); await tick(); });
    assert.equal(latest.cursor, 0); assert.deepEqual(latest.items, ['new']); assert.equal(ui.d.window.document.body.textContent, 'new');
  } finally { await ui.close(); }
});
test('provider access settings save through the local key store and trigger a new revision', async () => {
  const ui = dom(), f = fixture(), { ProviderAccess, useProviderRevision } = f.load('plugins/backgrounds/shared/ProviderAccess.tsx');
  let revision;
  function View() { revision = useProviderRevision(); return React.createElement(ProviderAccess, { provider: 'unsplash' }); }
  try {
    await act(async () => { ui.root.render(React.createElement(View)); await tick(); });
    const input = ui.d.window.document.querySelector('input');
    await act(async () => { Simulate.change(input, { target: { value: 'local-access' } }); });
    await act(async () => { ui.d.window.document.querySelector('button').click(); await tick(); });
    assert.equal(f.storage['superNewtab:imageProviders'].unsplash, 'local-access'); assert.equal(revision, 1);
    assert.match(ui.d.window.document.body.textContent, /retry automatically/);
  } finally { await ui.close(); }
  assert.equal(f.listeners.size, 0);
});
test('image loading failures keep the last loaded image and release the loading counter on teardown', async () => {
  const ui = dom(), images = []; let pending = 0, ready, error, src = 'https://images.unsplash.com/one';
  const f = fixture({ globals: { Image: class { constructor() { images.push(this); } } } });
  const { useProviderImage } = f.load('plugins/backgrounds/shared/useProviderImage.ts');
  const loader = { push() { pending++; }, pop() { pending--; } };
  function View() { ready = useProviderImage(src, loader, value => { error = value; }); return null; }
  try {
    await act(async () => ui.root.render(React.createElement(View)));
    await act(async () => images[0].onload()); assert.equal(ready, src); assert.equal(pending, 0);
    src = 'https://images.unsplash.com/two'; await act(async () => ui.root.render(React.createElement(View)));
    await act(async () => images[1].onerror()); assert.equal(ready, 'https://images.unsplash.com/one'); assert.equal(error.code, 'image'); assert.equal(pending, 0);
    src = 'https://images.unsplash.com/three'; await act(async () => ui.root.render(React.createElement(View))); assert.equal(pending, 1);
  } finally { await ui.close(); }
  assert.equal(pending, 0);
});

test('prefetching a single-image batch does not jump the cache cursor beyond its contents', async () => {
  const ui = dom(), f = fixture(), { useRotatingCache } = f.load('hooks/useCache.ts');
  let latest;
  function View() {
    const [cache, setCache] = React.useState({ items: ['first'], cursor: 0, rotated: 1000, deps: [] }); latest = cache;
    const item = useRotatingCache(() => Promise.resolve(['second']), { cache, setCache }, 100000, []);
    return React.createElement('p', null, item);
  }
  try { await act(async () => { ui.root.render(React.createElement(View)); await tick(); });
    assert.equal(latest.cursor, 0); assert.deepEqual([...latest.items], ['first', 'second']);
    assert.equal(ui.d.window.document.body.textContent, 'first');
  } finally { await ui.close(); }
});
test('GIPHY handles a rejected image result in the component without losing the cached background', async () => {
  const ui = dom(), f = fixture({ keys: { giphy: 'key' }, fetch: async () => new Response(JSON.stringify({ data: [] })), mocks: {
    '../../../hooks': { useObjectUrl: blob => blob ? 'blob:cached' : null },
    '../../../views/shared/Backdrop': { __esModule: true, default: props => React.createElement('div', { 'data-background': props.style.backgroundImage }) },
  } });
  const { default: Giphy } = f.load('plugins/backgrounds/giphy/Giphy.tsx');
  let pending = 0, saved = false;
  try {
    await act(async () => { ui.root.render(React.createElement(Giphy, {
      cache: { data: new Blob(['image']), link: 'https://giphy.com/gifs/cached' },
      data: { tag: 'nature', nsfw: false, expand: false }, setCache: () => { saved = true; },
      loader: { push() { pending++; }, pop() { pending--; } },
    })); await tick(); });
    assert.equal(f.calls.length, 1); assert.equal(pending, 0); assert.equal(saved, false);
    assert.match(ui.d.window.document.querySelector('[role="status"]').textContent, /No images found/);
    assert.match(ui.d.window.document.querySelector('[data-background]').dataset.background, /blob:cached/);
  } finally { await ui.close(); }
});
