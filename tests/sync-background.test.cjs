const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { fingerprint } = require('../sync/engine/crypto.cjs');
function boot(config = {}) {
  const calls = [], store = { accountsLocked: null, oauthClients: { googleClientId: 'client' } };
  const account = id => {
    const data = { type: 'google-drive', localRoot: id === 'a' ? '1' : '2', bookmark_file: 'bookmarks.xbel', refreshToken: 'private', strategy: 'default', enabled: true };
    return { id, data, getData: () => data, async setData(change) { Object.assign(data, change); }, storage: { async getAccountData() { return { ...data }; }, async getMappings() { return { getSnapshot: () => ({ LocalToServer: { folder: {}, bookmark: {} } }) }; }, async getCache() { return {}; } } };
  };
  const accounts = { a: account('a'), b: account('b') };
  const get = async keys => typeof keys === 'string' ? { [keys]: store[keys] } : { ...keys, ...Object.fromEntries(Object.keys(keys).filter(key => key in store).map(key => [key, store[key]])) };
  const chrome = { storage: { local: { get, async set(values) { Object.assign(store, values); } } }, bookmarks: { async getSubTree(id) { return [{ id, title: '', children: [] }]; }, async get(id) { return [{ id, title: '', children: [] }]; } } };
  const browser = { storage: { local: { get } }, tabs: { getCurrent: async () => ({}) } };
  class Controller {
    constructor() { this.enabled = true; }
    async syncAccount(id) { calls.push(['legacy', id]); }
    async checkAccount(id) { calls.push(['legacy-check', id]); }
    async cancelSync(id) { calls.push(['legacy-cancel', id]); }
    async getUnlocked() { return !store.accountsLocked; }
    async unlock() { store.accountsLocked = null; }
    _isRequest(data) { return data?.channel === 'super-sync' && data.type === 'syncAccount'; }
    async onLoad() {}
    async updateStatus() {}
    async clearPendingNotification() {}
    async showPendingNotification(account) { calls.push(['notice', account.id]); }
    async onchange() {}
  }
  const dependencies = {
    '@sync-engine/browser/BrowserController': { default: Controller },
    '@sync-engine/Account': { default: { get: async id => accounts[id], getAllAccounts: async () => Object.values(accounts) } },
    '@sync-engine/browser-api': { default: browser },
    '@sync-engine/Logger': { default: { log(value) { calls.push(['log', value]); } } },
    '@sync-engine/native/I18n': { i18n: { setLocales() {}, async load() {} } },
    '../source/messages': { uiMessages: { SyncConflict: { 'pt-BR': 'Conflito seguro' }, SyncGoogleNetworkFailed: { 'pt-BR': 'Falha de conexão' } }, requestStageMessages: { oauth: { 'pt-BR': 'autenticação', en: 'authentication' } } },
    './crypto.cjs': { fingerprint },
    './runner.cjs': { async synchronize(input) { calls.push(['own', input.id, input.profile.strategy, input.dryRun]); await input.validate(); return config.execute ? config.execute(input) : { local: 0, server: 0 }; } },
  };
  for (const value of Object.values(dependencies)) value.__esModule = true;
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../sync/engine/background-entry.js'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => { if (!dependencies[name]) throw Error(name); return dependencies[name]; }, chrome, setInterval, clearInterval, setTimeout, clearTimeout, AbortController, console, SuperPreferences: { locale: { get: async () => 'pt-BR', watch() {} } } });
  return { controller: exports.controller, accounts, store, calls };
}
test('normal Google Drive synchronization uses the own core while other services and tab profiles keep legacy execution', async () => {
  const f = boot();
  await f.controller.syncAccount('a');
  assert.ok(f.calls.some(([type, id]) => type === 'own' && id === 'a'));
  assert.equal(f.accounts.a.data.syncEngine, 'super-drive-v1');
  assert.equal(f.accounts.a.data.syncing, false);
  f.accounts.b.data.type = 'webdav'; await f.controller.syncAccount('b');
  f.accounts.b.data.type = 'google-drive'; f.accounts.b.data.localRoot = 'tabs'; await f.controller.syncAccount('b');
  assert.equal(f.calls.filter(([type]) => type === 'legacy').length, 2);
});
test('locked profiles never execute; directional actions reach the same core and conflicts become localized status', async () => {
  const f = boot({ execute: async () => { throw Object.assign(Error('hidden detail'), { code: 'SyncConflict' }); } });
  f.store.accountsLocked = 'locked'; await f.controller.syncAccount('a'); assert.equal(f.calls.length, 0);
  f.store.accountsLocked = null; await f.controller.syncAccount('a', 'overwrite');
  assert.equal(f.calls.find(([type]) => type === 'own')[2], 'overwrite');
  assert.equal(f.accounts.a.data.error, 'Conflito seguro');
  assert.equal(f.accounts.a.data.syncing, false);
});
test('own runs are serialized, duplicate requests share execution and cancellation reaches the running signal', async () => {
  let began, release;
  const started = new Promise(resolve => { began = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  let input;
  const f = boot({ execute: async args => { if (args.id === 'a') { input = args; began(); await hold; } return { local: 0, server: 0 }; } });
  const first = f.controller.syncAccount('a'); await started;
  const duplicate = f.controller.syncAccount('a'), second = f.controller.syncAccount('b');
  await f.controller.cancelSync('a', true); assert.equal(input.signal.aborted, true);
  await assert.rejects(() => f.controller.resetOwnSync('a'), /SyncProfileBusy/);
  release(); await Promise.all([first, duplicate, second]);
  assert.deepEqual(f.calls.filter(([type]) => type === 'own').map(([, id]) => id), ['a', 'b']);
});
test('a manual sync requested during a notification-only check is queued instead of discarded', async () => {
  let began, release;
  const ready = new Promise(resolve => { began = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const f = boot({ execute: async input => { if (input.dryRun) { began(); await hold; } return { local: 0, server: 0 }; } });
  const check = f.controller.checkAccount('a'); await ready;
  const sync = f.controller.syncAccount('a'); release(); await Promise.all([check, sync]);
  assert.deepEqual(f.calls.filter(([type]) => type === 'own').map(call => call[3]), [true, false]);
});
test('canceling a queued run clears its scheduled flag without running it; resetting preserves backups', async () => {
  let began, release;
  const ready = new Promise(resolve => { began = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const f = boot({ execute: async input => { if (input.id === 'a') { began(); await hold; } return { local: 0, server: 0 }; } });
  const running = f.controller.syncAccount('a'); await ready;
  f.accounts.b.data.scheduled = true;
  const queued = f.controller.syncAccount('b'); await new Promise(resolve => setTimeout(resolve, 0));
  await f.controller.cancelSync('b', true);
  assert.equal(f.accounts.b.data.scheduled, false);
  await assert.rejects(() => f.controller.assertOwnSyncIdle('a'), /SyncProfileBusy/);
  release(); await Promise.all([running, queued]);
  assert.equal(f.calls.filter(([kind, id]) => kind === 'own' && id === 'b').length, 0);
  f.store['superSync:engine[a]'] = { schema: 1, scope: 'scope', leaseOwner: 'owner', tree: {}, journal: {}, backups: ['backup'], migrationBackup: 'first' };
  await f.controller.resetOwnSync('a');
  const state = f.store['superSync:engine[a]'];
  assert.equal(state.leaseOwner, 'owner'); assert.deepEqual(state.backups, ['backup']); assert.equal(state.migrationBackup, 'first');
  assert.equal(state.journal, undefined); assert.equal(state.tree, undefined);
});
test('locking profiles during execution prevents later status writes from restoring plaintext credentials', async () => {
  let f;
  f = boot({ execute: async () => { f.store.accountsLocked = 'encrypted-lock'; throw Object.assign(Error('locked'), { code: 'SyncProfilesLocked' }); } });
  await f.controller.syncAccount('a');
  assert.equal(f.accounts.a.syncing, false);
  assert.equal(f.accounts.a.data.errorCount, undefined);
  assert.equal(f.accounts.a.data.lastSync, undefined);
  await f.controller.unlock();
  assert.equal(f.store.accountsLocked, null);
});

test('network failures show a localized request stage and sanitized diagnostic categories', async () => {
  const f = boot({ execute: async () => { throw Object.assign(new TypeError('private url/token'), { code: 'SyncGoogleNetworkFailed', requestStage: 'oauth', reason: 'TypeError' }); } });
  await f.controller.syncAccount('a');
  assert.equal(f.accounts.a.data.error, 'Falha de conexão (autenticação)');
  assert.equal(f.accounts.a.data.isTransientError, true);
  const log = f.calls.find(([kind]) => kind === 'log')[1];
  assert.match(log, /SyncGoogleNetworkFailed stage=oauth reason=TypeError/);
  assert.doesNotMatch(log, /private|token/);
});
