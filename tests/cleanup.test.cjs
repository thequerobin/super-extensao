const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const {test} = require('node:test');
const base = path.resolve(__dirname, '..');
const rulesContext = vm.createContext({URL});
vm.runInContext(fs.readFileSync(path.join(base, 'rules.js'), 'utf8'), rulesContext);
const R = rulesContext.ClearRules;
const plain = value => JSON.parse(JSON.stringify(value));
const defaults = {enabled:true, clearHistory:true, clearCache:false, clearCookies:false, clearDownloads:false, clearFormData:false, clearLocalStorage:false, excludedSites:[]};
function worker(initial = {}) {
  const state = {...defaults, ...initial};
  const calls = [];
  const listeners = {};
  const event = name => ({addListener(fn) { listeners[name] = fn; }});
  const chrome = {
    storage: {local: {
      async get(keys) {
        if (keys === null) return {...state};
        if (Array.isArray(keys)) return Object.fromEntries(keys.filter(k => k in state).map(k => [k, state[k]]));
        return {...keys, ...state};
      },
      async set(values) { Object.assign(state, values); }
    }},
    browsingData: {
      async remove(options, data) { calls.push({method:'remove', options, data}); if (state.fail) throw new Error('simulated API failure'); },
      async removeCookies(options) { calls.push({method:'removeCookies', options}); if (state.failCookies) throw new Error('simulated cookie failure'); }
    },
    windows: {async getAll() { return state.windows || []; }, async create() { return {id:50}; }, onCreated:event('created'), onRemoved:event('removed')},
    runtime: {onStartup:event('startup'), onInstalled:event('installed'), onMessage:event('message'), getURL: x => x},
    action: {async setBadgeText() {}, async setBadgeBackgroundColor() {}},
    alarms: {async clear() {}, create() {}, onAlarm:event('alarm')},
    notifications: {async create() {}, async clear() {}, onClicked:event('notification'), onButtonClicked:event('notificationButton')},
    i18n: {getMessage: key => key}
  };
  const context = vm.createContext({chrome, URL, console, setTimeout:() => 0, crypto:require('node:crypto').webcrypto});
  // This suite isolates the existing cleanup worker; tab protection is covered
  // by its dedicated integration suite.
  context.importScripts = (...files) => { for (const file of files) if (file !== 'tab-guard.js' && !file.startsWith('sync/') && (!file.startsWith('vpn/') || file === 'vpn/engine/routing.js')) vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), context); };
  vm.runInContext(fs.readFileSync(path.join(base, 'background.js'), 'utf8'), context);
  return {state, calls, listeners, context};
}
test('normaliza URLs, internacionalização e duplicados; rejeita esquemas e curingas', () => {
  assert.equal(R.normalizeDomain(' HTTPS://ExAmPle.com/path?q=1 '), 'example.com');
  assert.equal(R.normalizeDomain('https://ação.com'), 'xn--ao-siap.com');
  assert.deepEqual(plain(R.normalizeList(['example.com', 'https://EXAMPLE.com/x'])), ['example.com']);
  for (const bad of ['*.example.com', 'chrome://settings', 'file:///a', 'https://u:p@example.com', 'a b', '.example.com', 'https://']) assert.throws(() => R.normalizeDomain(bad));
});
test('lista legada de cookies não altera cache e localStorage sem exceções próprias', () => {
  const plan = plain(R.removalPlan({...defaults, clearCookies:true, clearCache:true, clearLocalStorage:true, excludedSites:['example.com']}));
  assert.deepEqual(plan, [
    {method:'remove', options:{since:0}, data:{history:true, cache:true, localStorage:true}},
    {method:'removeCookies', options:{since:0, excludeOrigins:['http://example.com', 'https://example.com']}}
  ]);
});
test('favoritos incluem subpastas opcionalmente e ignoram URLs incompatíveis', () => {
  const folder = {id:'1', title:'Sites', children:[{url:'https://example.com/a'}, {url:'http://example.com/b'}, {url:'javascript:alert(1)'}, {id:'2',title:'Subpasta',children:[{url:'https://www.example.org/x'}]}]};
  assert.deepEqual(plain(R.bookmarkDomains(folder, false)), {domains:['example.com'], skipped:1});
  assert.deepEqual(plain(R.bookmarkDomains(folder, true)), {domains:['example.com', 'www.example.org'], skipped:1});
  assert.deepEqual(plain(R.bookmarkFolders([{id:'0', children:[folder]}])), [{id:'1',label:'Sites'}, {id:'2', label:'Sites / Subpasta'}]);
});
test('lista inválida cancela a operação antes de qualquer exclusão', async () => {
  for (const excludedSites of [null, 'example.com', ['*.example.com']]) {
    const w = worker({excludedSites, clearCookies:true});
    await assert.rejects(vm.runInContext('requestClear("exit")', w.context));
    assert.equal(w.calls.length, 0);
    assert.ok(w.state.lastClearErrorAt);
    assert.equal(w.state.lastClearTime, undefined);
  }
});
test('automação desativada, pausada ou com janela reaberta não exclui dados', async () => {
  for (const settings of [{enabled:false}, {paused:true}, {paused:true,pauseUntil:new Date(Date.now()+60000).toISOString()}, {windows:[{id:1}]}]) {
    const w = worker(settings);
    const result = await vm.runInContext('requestClear("exit")', w.context);
    assert.equal(result.cleared, false); assert.equal(w.calls.length, 0);
  }
});
test('limpeza manual funciona durante pausa e usa as exceções confirmadas', async () => {
  const w = worker({paused:true, enabled:false});
  const response = await new Promise(resolve => w.listeners.message({action:'clearNow', settings:{...defaults, clearCookies:true, excludedSites:['keep.example']}}, {}, resolve));
  assert.equal(response.ok, true); assert.equal(response.cleared, true);
  assert.deepEqual(plain(w.calls[1].options.excludeOrigins), ['http://keep.example','https://keep.example']);
  assert.equal(w.state.lastClearReason, 'manual'); assert.ok(w.state.lastClearTime);
});
test('falha parcial preserva sessão pendente e não registra sucesso; próxima abertura tenta de novo', async () => {
  const w = worker({clearCookies:true, pendingSession:{id:'old',markedAt:1}, failCookies:true});
  await assert.rejects(vm.runInContext('clearPendingSession("exit", {id:"old", markedAt:1})', w.context));
  assert.equal(w.state.pendingSession.id, 'old'); assert.equal(w.state.lastClearTime, undefined);
  w.state.failCookies = false;
  await vm.runInContext('handleStartup()', w.context);
  assert.equal(w.state.lastClearReason, 'startup'); assert.ok(w.state.lastClearTime);
  assert.notEqual(w.state.pendingSession.id, 'old');
});
test('snapshot manual inválido retorna erro ao popup', async () => {
  const w = worker();
  const response = await new Promise(resolve => w.listeners.message({action:'clearNow', settings:{excludedSites:['*.example.com']}}, {}, resolve));
  assert.equal(response.ok, false); assert.equal(w.calls.length, 0);
});
test('manifest usa identidade nova e permissões da sincronização', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3); assert.equal(manifest.key, undefined); assert.equal(manifest.update_url, undefined);
  assert.deepEqual(manifest.optional_permissions, ['history']);
  for(const permission of ['bookmarks','identity','unlimitedStorage','tabGroups']) assert.ok(manifest.permissions.includes(permission));
  assert.deepEqual(manifest.host_permissions, ['http://*/*','https://*/*']);
  for (const file of ['background.js','popup.html','rules.js','popup.js','popup.css', ...Object.values(manifest.icons)]) assert.ok(fs.existsSync(path.join(base,file)), file);
});
test('regras de autoplay priorizam subdomínios específicos e respeitam desligamento', () => {
  const ctx=vm.createContext({URL});
  vm.runInContext(fs.readFileSync(path.join(base,'navigation-rules.js'),'utf8'),ctx);
  const S=ctx.SuperTools;
  const settings={enabled:true,globalBehavior:'block',siteSettings:{'example.com':'allow','video.example.com':'block'}};
  assert.equal(S.autoplayPolicy('www.example.com',settings).block,false);
  assert.equal(S.autoplayPolicy('video.example.com',settings).block,true);
  assert.equal(S.autoplayPolicy('notexample.com',settings).block,true);
  assert.equal(S.autoplayPolicy('video.example.com',{...settings,enabled:false}).block,false);
  assert.equal(S.normalizeHostname('https://EXAMPLE.com:8443/path'),'example.com');
  const guard=S.tabSettings({enabled:true,scope:'first'});
  assert.equal(S.protectsWindow(guard,2,1,2),false);
  assert.equal(S.protectsWindow(guard,1,1,2),true);
  assert.equal(S.protectsWindow(guard,2,1,1),true);
  assert.equal(S.isNewTab({url:'https://example.com/newtab/'}),false);
  assert.equal(S.isNewTab({url:'chrome://newtab/'}),true);
});
test('Nova guia personalizada é reconhecida sem confundir reservas ou páginas de outra extensão', () => {
  const ctx=vm.createContext({URL});
  vm.runInContext(fs.readFileSync(path.join(base,'navigation-rules.js'),'utf8'),ctx);
  const S=ctx.SuperTools;
  const dashboard='chrome-extension://super/newtab/index.html';
  assert.equal(S.isNewTab({url:dashboard},dashboard),true);
  assert.equal(S.isNewTab({url:dashboard+'?custom=1#settings'},dashboard),true);
  assert.equal(S.isNewTab({url:'chrome-extension://super/spare-tab.html'},dashboard),false);
  assert.equal(S.isNewTab({url:'chrome-extension://other/newtab/index.html'},dashboard),false);
  assert.equal(S.isNewTab({url:'https://example.com/newtab/index.html'},dashboard),false);
  assert.equal(S.isNewTab({url:dashboard,pendingUrl:'https://example.com'},dashboard),false);
});

test('cache e armazenamento local recebem listas independentes sem restringir histórico ou cookies', () => {
  const plan = plain(R.removalPlan({...defaults, clearCookies:true, clearCache:true, clearLocalStorage:true,
    excludedSites:['cookie.example'], excludedCacheSites:['assets.example:8443'], excludedLocalStorageSites:['app.example']}));
  assert.deepEqual(plan, [
    {method:'remove', options:{since:0}, data:{history:true}},
    {method:'remove', options:{since:0,excludeOrigins:['http://assets.example:8443','https://assets.example:8443']}, data:{cache:true}},
    {method:'remove', options:{since:0,excludeOrigins:['http://app.example','https://app.example']}, data:{localStorage:true}},
    {method:'removeCookies', options:{since:0,excludeOrigins:['http://cookie.example','https://cookie.example']}}
  ]);
});
test('novas listas inválidas cancelam toda a limpeza antes da primeira remoção', async () => {
  for (const key of ['excludedCacheSites','excludedLocalStorageSites']) for (const value of [null,'example.com',['*.example.com']]) {
    const w=worker({[key]:value, clearCache:true,clearLocalStorage:true});
    await assert.rejects(vm.runInContext('requestClear("exit")',w.context));assert.equal(w.calls.length,0);
  }
});
test('snapshot manual aplica as novas exceções e preserva listas armazenadas quando omitidas', async () => {
  for(const includeLists of [false,true]) {
    const w=worker({excludedCacheSites:['stored-cache.example'],excludedLocalStorageSites:['stored-local.example']});
    const settings={...defaults,clearCache:true,clearLocalStorage:true};
    if(includeLists) Object.assign(settings,{excludedCacheSites:['manual-cache.example'],excludedLocalStorageSites:['manual-local.example']});
    const response=await new Promise(resolve=>w.listeners.message({action:'clearNow',settings},{},resolve));
    assert.equal(response.ok,true);
    assert.deepEqual(plain(w.calls.find(call=>call.data.cache).options.excludeOrigins),[`http://${includeLists?'manual':'stored'}-cache.example`,`https://${includeLists?'manual':'stored'}-cache.example`]);
    assert.deepEqual(plain(w.calls.find(call=>call.data.localStorage).options.excludeOrigins),[`http://${includeLists?'manual':'stored'}-local.example`,`https://${includeLists?'manual':'stored'}-local.example`]);
  }
});
