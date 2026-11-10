const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = path.resolve(__dirname, '../vendor/proton-source/source/js');

function load(file, mocks = {}, globals = {}) {
  const filename = path.join(source, file + '.ts');
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}
  }).outputText;
  vm.runInNewContext(code, {
    exports, ...globals,
    require(spec) {
      if (spec in mocks) return mocks[spec];
      return load(path.relative(source, path.resolve(path.dirname(filename), spec)), mocks, globals);
    }
  }, {filename});
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));

test('split tunneling works for Free and paid accounts, with separate include/exclude lists', () => {
  const {getSplitTunnelingConfig: config} = load('vpn/getSplitTunnelingConfig');
  const value = [
    {domain: 'example.com', withSubDomains: true, mode: 'exclude'},
    {domain: 'private.example', withSubDomains: false, mode: 'include'}
  ];
  for (const tier of [0, 2]) {
    assert.deepEqual(plain(config(tier, {value})), {
      mode: 'exclude', filteredDomains: ['example.com', '.example.com']
    });
    assert.deepEqual(plain(config(tier, {value, mode: 'include'})), {
      mode: 'include', filteredDomains: ['private.example']
    });
    assert.deepEqual(plain(config(tier, {value, enabled: false})).filteredDomains, []);
  }
});

test('account relay accepts only session forks from exact account origins', () => {
  let listener;
  const sent = [];
  const window = {addEventListener(_, fn) {listener = fn;}};
  load('tools/relayMessagesToExtension').relayMessagesToExtension(window, {
    sendMessage: async value => sent.push(value)
  });
  const data = {type: 'fork', payload: {state: 'pending-state', selector: 'selector'}};
  const event = {source: window, origin: 'https://account.proton.me', data};
  listener({...event, origin: 'https://evil.proton.me'});
  listener({...event, source: {}});
  listener({...event, data: {type: 'connect'}});
  listener({...event, data: {type: 'fork'}});
  assert.equal(sent.length, 0);
  listener(event);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].channel, 'super-vpn');
});

test('VPN background ignores other modules and page requests to connect', async () => {
  let listener;
  const calls = [];
  const runtime = {
    id: 'test', getURL: p => 'chrome-extension://test/' + p,
    onMessage: {addListener: fn => {listener = fn;}},
    onMessageExternal: {addListener() {}}
  };
  load('vpn/initMessaging', {
    '../messaging/messaging': {routeMessage: async m => {calls.push(m); return 'done';}},
    '../account/RefreshTokenError': {RefreshTokenError: class extends Error {}},
    '../state': {logOut() {}}, '../account/createSession': {createSession() {}},
    '../messaging/forkSession': {forkSession() {}},
    '../tools/triggerPromise': {triggerPromise() {}},
    '../tools/executeOnTab': {executeOnTab() {}},
    '../account/partner/partners': {getPartnerById() {}},
    '../tools/delay': {delay() {}},
    '../tools/getRuntime': {getRuntime: () => runtime}
  }).initMessaging();
  const internal = {url: 'chrome-extension://test/vpn/popup.html'};
  assert.equal(listener({type: 'clearNow'}, internal), undefined);
  assert.equal(listener({channel: 'super-sync', type: 'state'}, internal), undefined);
  assert.equal(listener({channel: 'super-vpn', type: 'connect'}, {url: 'https://account.proton.me/'}), undefined);
  assert.equal(listener({channel: 'super-vpn', type: 'fork'}, internal), undefined);
  assert.equal(calls.length, 0);
  const response = await listener({channel: 'super-vpn', type: 'state'}, internal);
  assert.equal(response.success, true);
  assert.equal(calls.length, 1);
});

test('VPN storage cannot overwrite or delete host settings', async () => {
  const data = {theme: 'light', 'superSync:accounts': {id: 1}};
  const local = {
    get: (key, callback) => callback({[key]: data[key]}),
    set: async values => Object.assign(data, values),
    remove: async key => {delete data[key];}
  };
  const {storage} = load('tools/storage', {}, {chrome: {storage: {local}}});
  await storage.setItem('theme', {value: 'dark'});
  assert.equal(data.theme, 'light');
  assert.deepEqual(data['superSync:accounts'], {id: 1});
  assert.equal(data['superVpn:theme'].value, 'dark');
  await storage.removeItem('theme');
  assert.equal(data.theme, 'light');
});


test('Free server selection keeps paid tiers restricted in the worker', () => {
  const {assertServerAccess: check} = load('vpn/assertServerAccess');
  assert.doesNotThrow(() => check({VPN: {MaxTier: 0}}, {Tier: 0}));
  assert.throws(() => check({VPN: {MaxTier: 0}}, {Tier: 2}), /not available/);
  assert.throws(() => check(undefined, {Tier: 0}), /not available/);
  assert.throws(() => check({VPN: {MaxTier: 0}}, {Tier: NaN}), /not available/);
  assert.doesNotThrow(() => check({VPN: {MaxTier: 2}}, {Tier: 2}));
});

test('VPN permission requests match the host manifest', () => {
  const {proxyPermission} = load('vpn/proxyPermission');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(source, '../../../../manifest.json'), 'utf8'));
  for (const name of proxyPermission.permissions) assert.ok(manifest.permissions.includes(name));
  for (const origin of proxyPermission.origins) assert.ok(manifest.host_permissions.includes(origin));
});

test('sign-in handles denied permissions, retries and failures without silently closing', async () => {
  let allowed = false, fail = false, opened = 0, closed = 0;
  const button = {disabled: false, classList: {remove() {}, contains() {return false;}, add() {}}};
  const paragraph = {};
  const view = {style: {}, querySelector: q => q === 'p' ? paragraph : button};
  const {showSigningViewAndWaitForItToBeLoaded: show} = load('components/signIn/showSigningView', {
    '../../vpn/getServersCount': {},
    '../../tools/translate': {c: () => ({t: ([text]) => text})},
    '../../account/openForkTab': {openForkTab: async () => {if (fail) throw Error('offline'); opened++;}},
    '../../tools/triggerPromise': {},
    '../../tools/sendMessageToBackground': {sendMessageToBackground: async () => {}},
    '../../messaging/MessageType': {PermissionGrant: {PROXY: 'proxy'}},
    '../../intervals': {},
    '../../tools/update': {getUpdateError: async () => undefined},
    '../../tools/openTab': {}, '../../tools/getBrowser': {},
    '../../tools/getErrorMessage': {getErrorAsString: e => e.message},
    '../../tools/sentry': {handleError() {}},
    './initializeInlineParagraph': {}
  }, {
    chrome: {proxy: {}}, browser: {permissions: {request: async () => allowed}},
    window: {close() {closed++;}}
  });
  await show(view, {style: {}}, {style: {}}, false);
  await button.onclick();
  assert.equal(opened, 0); assert.equal(closed, 0); assert.equal(button.disabled, false);
  assert.match(paragraph.textContent, /not granted/);
  allowed = true; fail = true;
  await button.onclick();
  assert.equal(closed, 0); assert.match(paragraph.textContent, /offline/);
  fail = false;
  await show(view, {style: {}}, {style: {}}, true);
  await button.onclick();
  assert.equal(opened, 1); assert.equal(closed, 1);
});
