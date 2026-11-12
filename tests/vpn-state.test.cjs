const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(name) {
  const filename = path.resolve(__dirname, '../vpn/engine', name + '.ts'), exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports, Promise, require: id => load(id.replace('./', ''))}, {filename});
  return exports;
}
const {ConnectionMachine} = load('state');
const deferred = () => {let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject};};
const tick = () => new Promise(resolve => setImmediate(resolve));
const server = name => ({name, proxyHost: name + '.test', proxyPort: 443});
const pair = {Username: 'private-user', Password: 'private-password'};
function fixture(saved) {
  let persisted = saved, now = 1000, applied = false;
  const events = [], errors = [];
  const ports = {
    now: () => now,
    readServer: async () => persisted,
    saveServer: async value => {persisted = value; events.push(['persist', value?.name]);},
    signedIn: async () => true, autoConnect: async () => events.push(['auto-connect']),
    invalidate() {}, cancelCredentials() {},
    loadCredentials: async () => pair, getCredentials: async () => pair,
    credentialsValid: async () => true, mayReplace: () => true,
    apply: async (value, current) => {if (!current()) return false; events.push(['apply', value.name]); applied=true; return true;},
    hasProxy: async () => applied,
    clearProxy: async () => {applied=false; events.push(['clear']);},
    probe: async () => events.push(['probe']), probeInterval: () => 60000,
    activity: async () => events.push(['activity']), activityInterval: () => 20000,
    isNetworkError: error => error?.name === 'NetworkError',
    networkWarning: () => ({name: 'NetworkError', Warning: true}),
    error: code => Error(code), changed: state => events.push(['state', state.name]),
    present: (phase, state) => events.push(['view', phase, state.data.server?.name]),
    connected: (value, notify) => events.push(['connected', value.name, notify]),
    disconnected: () => events.push(['disconnected']), failed: error => errors.push(error),
  };
  const machine = new ConnectionMachine(ports);
  return {machine, ports, events, errors, get saved() {return persisted;}, advance(ms) {now+=ms;}, loseProxy() {applied=false;}};
}
async function connect(f, name='a') {await f.machine.connect({server: server(name)}); await f.machine.refresh();}
function phases(f) {return f.events.filter(([kind]) => kind === 'view').map(([,phase]) => phase);}
test('own state restores once, confirms proxy and does not repeat connection notifications', async () => {
  const f=fixture(server('saved'));
  await Promise.all([f.machine.ready(),f.machine.ready()]);
  await f.machine.refresh();
  assert.equal(f.machine.peek().proxyEnabled,true);
  assert.equal(f.events.filter(([kind])=>kind==='apply').length,1);
  assert.deepEqual(f.events.find(([kind])=>kind==='connected'),['connected','saved',false]);
  await f.machine.refresh();
  assert.equal(f.events.filter(([kind])=>kind==='apply').length,1);
  assert.ok(f.events.findIndex(([kind])=>kind==='apply') < f.events.findIndex(([kind,phase])=>kind==='view'&&phase==='connected'));
});
test('disconnect and logout invalidate a delayed startup read and settle readiness', async () => {
  for(const command of ['disconnect','logOut']) {
    const f=fixture(server('stale')), read=deferred();f.ports.readServer=()=>read.promise;
    const ready=f.machine.ready();f.machine[command]();read.resolve(server('stale'));
    await ready;await tick();
    assert.equal(f.machine.peek().name,command==='logOut'?'loggedout':'off');
    assert.ok(!f.events.some(([kind])=>kind==='apply'));assert.equal(f.saved,undefined);
  }
});
test('a boot failure settles readiness and a later explicit connection still works', async () => {
  const f=fixture();f.ports.readServer=async()=>{throw Error('storage offline');};
  await f.machine.ready();assert.equal(f.machine.peek().name,'off');assert.equal(f.errors.length,1);
  f.ports.readServer=async()=>undefined;await connect(f);
  assert.equal(f.machine.peek().proxyEnabled,true);
});
test('pending credentials cannot reconnect after disconnect or logout', async () => {
  for(const command of ['disconnect','logOut']) {
    const f=fixture(), credentials=deferred();f.ports.getCredentials=()=>credentials.promise;
    await f.machine.connect({server:server('a')});await tick();
    assert.ok(!phases(f).includes('connected'));
    f.machine[command]();credentials.resolve(pair);await tick();await tick();
    assert.ok(!f.events.some(([kind])=>kind==='apply'));assert.equal(f.machine.peek().proxyEnabled,false);
  }
});
test('latest server and rules win over delayed older recoveries', async () => {
  const f=fixture(), first=deferred();let calls=0;
  f.ports.getCredentials=async()=>++calls===1?first.promise:pair;
  await f.machine.connect({server:server('a')});await tick();
  await connect(f,'b');first.resolve(pair);await tick();
  assert.deepEqual(f.events.filter(([kind])=>kind==='apply'),[['apply','b']]);
  const old=f.machine.peek();
  await f.machine.reconfigure(value=>({...value,splitTunneling:{filteredDomains:['example.test']}}));
  await tick();assert.notEqual(f.machine.peek(),old);
  assert.deepEqual(f.machine.peek().data.server.splitTunneling.filteredDomains,['example.test']);
  assert.deepEqual(f.saved.splitTunneling.filteredDomains,['example.test']);
  assert.equal(f.machine.peek().proxyEnabled,true);
});
test('network failures retain intent and recover on a later wake without user action', async () => {
  const f=fixture();let offline=true;
  f.ports.loadCredentials=async()=>{if(offline)throw Object.assign(Error('offline'),{name:'NetworkError'});return pair;};
  await connect(f);assert.equal(f.machine.peek().name,'on');assert.equal(f.machine.peek().proxyEnabled,false);
  assert.equal(f.machine.peek().data.error.Warning,true);
  f.advance(60000);f.machine.checkConnectingState();assert.equal(f.machine.peek().name,'on');
  offline=false;await f.machine.refresh();
  assert.equal(f.machine.peek().proxyEnabled,true);assert.equal(f.machine.peek().data.error,undefined);
  assert.equal(f.saved.name,'a');
});
test('a network failure during proxy application does not discard the retry intent', async () => {
  const f=fixture(), apply=f.ports.apply;let once=true;
  f.ports.apply=async(...args)=>{if(once){once=false;throw Object.assign(Error('offline'),{name:'NetworkError'});}return apply(...args);};
  await connect(f);assert.equal(f.machine.peek().name,'on');assert.equal(f.machine.peek().data.error.Warning,true);
  await f.machine.refresh();assert.equal(f.machine.peek().proxyEnabled,true);
});
test('permission failures and absent credentials never announce connection', async () => {
  for(const failure of ['permission','credentials','expired','no-op']) {
    const f=fixture();
    if(failure==='permission')f.ports.apply=async()=>{throw Error('permission denied');};
    if(failure==='credentials')f.ports.getCredentials=async()=>undefined;
    if(failure==='expired')f.ports.credentialsValid=async()=>false;
    if(failure==='no-op')f.ports.apply=async()=>false;
    await connect(f);await tick();
    assert.equal(f.machine.peek().name,'off',failure);assert.equal(f.machine.peek().proxyEnabled,false);
    assert.ok(!phases(f).includes('connected'));assert.equal(f.saved,undefined);
  }
});
test('concurrent alarm wakeups share a recovery; proxy loss is re-applied and activity is throttled', async () => {
  const f=fixture();await connect(f);const hasProxy=deferred();f.ports.hasProxy=()=>hasProxy.promise;
  const a=f.machine.refresh(), b=f.machine.refresh();assert.equal(a,b);hasProxy.resolve(false);await a;
  assert.equal(f.events.filter(([kind])=>kind==='apply').length,2);
  assert.equal(f.events.filter(([kind])=>kind==='activity').length,1);
  f.ports.hasProxy=async()=>true;f.advance(30000);await f.machine.refresh();
  assert.equal(f.events.filter(([kind])=>kind==='activity').length,2);
  assert.equal(f.events.filter(([kind])=>kind==='probe').length,0);
  f.advance(30000);await f.machine.refresh();
  assert.equal(f.events.filter(([kind])=>kind==='probe').length,1);
});
test('a delayed health probe cannot act after a server change or disconnect', async () => {
  const f=fixture(), result=deferred();let staleGuard;
  f.ports.probe=async(value,current)=>{staleGuard=current;await result.promise;if(current())f.events.push(['rotate',value.name]);};
  await f.machine.connect({server:server('a')});await tick();
  f.advance(60000);void f.machine.refresh();await tick();
  f.machine.disconnect();result.resolve();await tick();
  assert.equal(staleGuard(),false);assert.ok(!f.events.some(([kind])=>kind==='rotate'));
});
test('retry intents are rate limited and the next alarm continues a deferred retry', async () => {
  const f=fixture();await connect(f);await f.machine.retryConnection();await f.machine.retryConnection();
  assert.equal(f.events.filter(([kind])=>kind==='apply').length,2);
  f.advance(30000);await f.machine.refresh();
  assert.equal(f.events.filter(([kind])=>kind==='apply').length,3);
  f.machine.disconnect();await f.machine.retryConnection();
  assert.equal(f.events.filter(([kind])=>kind==='apply').length,3);
});
test('health metadata failures do not disconnect an installed proxy', async () => {
  const f=fixture();f.ports.probe=async()=>{throw Error('server list unavailable');};
  await connect(f);f.advance(60000);await f.machine.refresh();
  assert.equal(f.machine.peek().name,'on');assert.equal(f.machine.peek().proxyEnabled,true);
  assert.equal(f.errors.length,1);
});
test('queued server persistence finishes with the latest disconnect and survives a failed write', async () => {
  const f=fixture(), write=deferred(), saved=f.ports.saveServer;let once=true;
  f.ports.saveServer=async value=>{if(once){once=false;await write.promise;throw Error('disk');}return saved(value);};
  await connect(f);f.machine.disconnect();write.resolve();await tick();await tick();
  assert.equal(f.saved,undefined);assert.equal(f.machine.peek().name,'off');
});
test('signed-out startup skips auto-connect and a network warning clears only after successful credentials', async () => {
  const out=fixture();out.ports.signedIn=async()=>false;await out.machine.ready();
  assert.equal(out.machine.peek().name,'loggedout');assert.ok(!out.events.some(([kind])=>kind==='auto-connect'));
  const f=fixture();await connect(f);f.machine.networkFailed(Object.assign(Error('offline'),{name:'NetworkError'}));
  f.ports.getCredentials=async()=>undefined;await f.machine.refresh();
  assert.equal(f.machine.peek().data.error.Warning,true);
  f.ports.getCredentials=async()=>pair;await f.machine.refresh();assert.equal(f.machine.peek().data.error,undefined);
});

test('readiness does not wait for remote credentials or health metadata during startup', async () => {
  const f=fixture(server('saved')), credentials=deferred();
  f.ports.loadCredentials=()=>credentials.promise;
  let ready=false;f.machine.ready().then(()=>{ready=true;});await tick();
  assert.equal(ready,true);assert.equal(f.machine.peek().proxyEnabled,false);
  f.machine.disconnect();credentials.resolve(pair);await tick();
  assert.ok(!f.events.some(([kind])=>kind==='apply'));
});

test('credential recovery signaled as a warning with no result keeps the saved server', async () => {
  const f=fixture();f.ports.loadCredentials=async()=>undefined;
  f.ports.getCredentials=async()=>{f.machine.networkFailed({name:'NetworkError'});return undefined;};
  await connect(f);assert.equal(f.machine.peek().name,'on');assert.equal(f.saved.name,'a');
});

test('disconnect during a failed proxy read does not re-create network warnings on an off state', async () => {
  const f=fixture();await connect(f);const read=deferred();f.ports.hasProxy=()=>read.promise;
  const recovery=f.machine.refresh();await tick();f.machine.disconnect();read.reject({name:'NetworkError'});await recovery;
  assert.equal(f.machine.peek().name,'off');assert.equal(f.machine.peek().data.error,undefined);
});

test('failed proxy cleanup is retried by a wake without restoring a disconnected intent', async () => {
  const f=fixture();await connect(f);const clear=f.ports.clearProxy;let once=true;
  f.ports.clearProxy=async()=>{if(once){once=false;throw Error('clear failed');}return clear();};
  f.machine.disconnect();await tick();assert.equal(f.machine.peek().name,'off');
  const applies=f.events.filter(([kind])=>kind==='apply').length;
  await f.machine.refresh();assert.equal(f.machine.peek().name,'off');
  assert.equal(f.events.filter(([kind])=>kind==='apply').length,applies);
  assert.equal(f.events.filter(([kind])=>kind==='clear').length,1);
});


test('automatic server switches do not immediately probe the next server and oscillate', async () => {
  const f=fixture();
  f.ports.probe=async(value,current)=>{
    if(current()) await f.machine.connect({server:server(value.name==='a'?'b':'a')});
  };
  await connect(f,'a');await tick();
  assert.equal(f.machine.peek().data.server.name,'a');
  f.advance(60000);await f.machine.refresh();await tick();
  assert.equal(f.machine.peek().data.server.name,'b');
  await f.machine.refresh();f.advance(30000);await f.machine.refresh();await tick();
  assert.equal(f.machine.peek().data.server.name,'b');
  assert.deepEqual(f.events.filter(([kind])=>kind==='apply'),[['apply','a'],['apply','b']]);
});
test('privacy mode blocks before credentials and verifies release before reporting connected',async()=>{
 const f=fixture(),order=[];f.ports.hold=async()=>order.push('block');const get=f.ports.getCredentials;f.ports.getCredentials=async()=>{order.push('credentials');return get();};f.ports.resume=async current=>{order.push('verify-release');return current();};await connect(f);assert.equal(order[0],'block');assert.ok(order.indexOf('block')<order.indexOf('credentials'));assert.equal(order.at(-1),'verify-release');assert.equal(f.machine.peek().proxyEnabled,true);assert.equal(f.machine.peek().data.blocked,undefined);
});
test('privacy mode retains blocked intent on fatal failures instead of clearing the proxy silently',async()=>{
 const f=fixture();let blocks=0,warnings=0;f.ports.hold=async()=>{blocks++;};f.ports.resume=async()=>true;f.ports.privacyWarning=()=>warnings++;f.ports.apply=async()=>{throw Error('WebRTC lost');};await connect(f);await tick();assert.equal(f.machine.peek().name,'on');assert.equal(f.machine.peek().data.blocked,true);assert.equal(f.machine.peek().proxyEnabled,false);assert.ok(blocks>0);assert.ok(warnings>0);assert.ok(!f.events.some(([type])=>type==='clear'));
});
test('privacy failure cancels in-flight connect and cannot mark blocked traffic as connected',async()=>{
 const f=fixture(),gate=deferred();f.ports.hold=async()=>{};f.ports.resume=async()=>gate.promise;await f.machine.connect({server:server('a')});await tick();f.machine.networkFailed(Error('proxy failed'));gate.resolve(true);await tick();assert.equal(f.machine.peek().proxyEnabled,false);assert.equal(f.machine.peek().data.blocked,true);assert.ok(!f.events.some(([type])=>type==='connected'));
});
test('a still-configured proxy does not bypass blocked recovery and revalidation',async()=>{
 const f=fixture();let releases=0;f.ports.hold=async()=>{};f.ports.resume=async()=>{releases++;return true;};await connect(f);f.machine.networkFailed(Error('transport interrupted'));assert.equal(f.machine.peek().data.blocked,true);await f.machine.refresh();assert.equal(releases,2);assert.equal(f.machine.peek().proxyEnabled,true);
});
