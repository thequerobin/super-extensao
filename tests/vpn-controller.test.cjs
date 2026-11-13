const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(name, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, '../vpn/engine', name + '.ts');
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports, Promise, setTimeout, clearTimeout, ...globals, require: id => mocks[id] || load(id.replace('./', ''))}, {filename});
  return exports;
}
const {ProxyController} = load('controller');
const {ConnectionLifecycle} = load('lifecycle');
const config = host => ({mode: 'fixed_servers', rules: {singleProxy: {scheme: 'https', host, port: 443}, bypassList: ['localhost']}});
const deferred = () => {let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject};};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const events = [];
  let details = {levelOfControl: 'controllable_by_this_extension', value: {mode: 'system'}};
  const ports = {
    read: async () => details,
    write: async value => {events.push('write:' + (value.rules?.singleProxy.host || 'pac')); details = {levelOfControl:'controlled_by_this_extension',value};},
    clear: async () => {events.push('clear'); details = {levelOfControl:'controllable_by_this_extension',value:{mode:'system'}};},
    prepare: () => events.push('prepare'), attachAuth: () => events.push('auth+'), detachAuth: () => events.push('auth-'),
    protect: async () => events.push('protect'), restore: async () => events.push('restore'), flush: async () => events.push('flush'),
  };
  return {ports, events, controller: new ProxyController(ports), setDetails: value => {details = value;}};
}
test('controller confirms ownership/configuration and clears before restoring WebRTC/auth', async () => {
  const f = fixture();
  assert.equal(await f.controller.apply(config('a.test')), true);
  assert.equal(await f.controller.isApplied(), true);
  assert.equal(await f.controller.disconnect(), true);
  assert.equal(await f.controller.isApplied(), false);
  assert.ok(f.events.indexOf('protect') < f.events.indexOf('write:a.test'));
  assert.deepEqual(f.events.slice(-4), ['clear','auth-','restore','flush']);
});
test('another extension or policy cannot be mistaken for this VPN', async () => {
  for (const levelOfControl of ['controlled_by_other_extensions','not_controllable',undefined]) {
    const f=fixture();f.setDetails({levelOfControl,value:config('other.test')});
    await assert.rejects(f.controller.apply(config('a.test')), /VpnProxyControlledElsewhere/);
    assert.deepEqual(f.events, []);
    assert.equal(await f.controller.isApplied(), false);
  }
});
test('invalid fixed endpoints are rejected before browser side effects', () => {
  for (const patch of [{host:''},{host:'bad;DIRECT'},{host:'a.test\n'},{port:0},{port:65536},{port:1.5},{port:'443'},{scheme:'socks5'}]) {
    const f=fixture(), value=config('a.test');Object.assign(value.rules.singleProxy,patch);
    assert.throws(() => f.controller.apply(value), /VpnInvalidProxyEndpoint/);
    assert.deepEqual(f.events, []);
  }
});
test('connection delayed by credentials cannot apply after disconnect', async () => {
  const f=fixture(), lifecycle=new ConnectionLifecycle(), credentials=deferred();
  const current=lifecycle.guard();
  const connect=(async () => {await credentials.promise;return f.controller.apply(config('a.test'),current);})();
  lifecycle.advance();await f.controller.disconnect();credentials.resolve();
  assert.equal(await connect,false);assert.ok(!f.events.includes('write:a.test'));
});
test('disconnect waits for an in-flight write, removes it and prevents late success', async () => {
  const f=fixture(), write=deferred(), original=f.ports.write;
  f.ports.write=async value => {await write.promise;await original(value);};
  const a=f.controller.apply(config('a.test'));await tick();
  const off=f.controller.disconnect();write.resolve();
  assert.equal(await a,false);assert.equal(await off,true);assert.equal(await f.controller.isApplied(),false);
  assert.ok(f.events.lastIndexOf('clear') > f.events.indexOf('write:a.test'));
});
test('server switches are ordered even when an older set callback is slow', async () => {
  const f=fixture(), write=deferred(), original=f.ports.write;
  f.ports.write=async value => {if(value.rules.singleProxy.host==='a.test') await write.promise;await original(value);};
  const a=f.controller.apply(config('a.test'));await tick();const b=f.controller.apply(config('b.test'));write.resolve();
  assert.equal(await a,false);assert.equal(await b,true);assert.equal(await f.controller.isApplied(),true);
  assert.ok(f.events.indexOf('write:b.test') > f.events.indexOf('clear'));
});
test('queued mutable rules are captured and PAC readback is checked', async () => {
  const f=fixture(), value=config('a.test');const result=f.controller.apply(value);value.rules.bypassList.push('other.test');
  assert.equal(await result,true);
  const pac={mode:'pac_script',pacScript:{data:'function FindProxyForURL(){return "DIRECT";}'}};
  assert.equal(await f.controller.apply(pac),true);
  f.setDetails({levelOfControl:'controlled_by_this_extension',value:{...pac,pacScript:{data:'different'}}});
  assert.equal(await f.controller.isApplied(),false);
});
test('silent API no-op and WebRTC/cache failures roll back and leave queue usable', async () => {
  for (const failure of ['no-op','protect','flush']) {
    const f=fixture();
    if(failure==='no-op') f.ports.write=async()=>{};
    else {let first=true;const original=f.ports[failure];f.ports[failure]=async()=>{if(first){first=false;throw Error('injected');}return original();};}
    await assert.rejects(f.controller.apply(config('a.test')));
    assert.ok(f.events.includes('clear'));assert.equal(await f.controller.isApplied(),false);
    await f.controller.disconnect();
  }
});
test('a failed clear does not release protections; next disconnect can retry', async () => {
  const f=fixture();await f.controller.apply(config('a.test'));
  const original=f.ports.clear;f.ports.clear=async()=>{throw Error('clear failed');};
  await assert.rejects(f.controller.disconnect(), /clear failed/);
  assert.ok(!f.events.includes('auth-'));assert.ok(!f.events.includes('restore'));
  f.ports.clear=original;assert.equal(await f.controller.disconnect(),true);
});
test('control lost after write rolls back and never reports success', async () => {
  const f=fixture();f.ports.write=async()=>f.setDetails({levelOfControl:'controlled_by_other_extensions',value:config('other.test')});
  await assert.rejects(f.controller.apply(config('a.test')),/VpnProxyNotApplied/);
  assert.equal(await f.controller.isApplied(),false);
});
test('Chromium adapter handles runtime.lastError inside set/get/clear callbacks', async () => {
  const runtime={}, calls=[];
  const chrome={runtime,proxy:{settings:{
    get(options,done){calls.push(options);done({levelOfControl:'controllable_by_this_extension'});},
    set(options,done){calls.push(options);done();},clear(options,done){calls.push(options);done();}
  }}};
  const adapter=load('chromium').chromiumProxy(chrome);
  await adapter.write(config('a.test'));await adapter.clear();await adapter.read();
  assert.equal(calls[0].scope,'regular');assert.equal(calls[1].scope,'regular');
  for(const method of ['get','set','clear']) {
    chrome.proxy.settings[method]=(_,done)=>{runtime.lastError={message:'private browser detail'};done();delete runtime.lastError;};
    await assert.rejects(method==='get'?adapter.read():method==='set'?adapter.write(config('a.test')):adapter.clear(),/VpnProxyApiError/);
  }
});
test('recovery listeners register synchronously, coalesce wakeups and retry failures', async () => {
  const {RecoveryLoop}=load('recovery');let wake, listeners=0, calls=0;const operation=deferred(), errors=[];
  const loop=new RecoveryLoop({listen(fn){listeners++;wake=fn;},arm:async()=>{},recover:async()=>{calls++;await operation.promise;},failed:e=>errors.push(e)});
  loop.start();loop.start();assert.equal(listeners,1);wake();wake();await tick();assert.equal(calls,1);
  operation.reject(Error('network'));await tick();assert.equal(errors.length,2);
  await assert.rejects(loop.wake(),/network/);assert.equal(calls,2);
});

const {SessionStore}=load('session');
function sessionFixture() {
  let session={uid:'u',accessToken:'old',refreshToken:'r'};const events=[];
  return {events,store:new SessionStore({read:async()=>({...session}),write:async s=>{session={...s};events.push('write');},remove:async()=>{session={};events.push('remove');},changed:async()=>events.push('changed')})};
}
test('session refresh is grouped and preserves fork/persistence metadata', async () => {
  const f=sessionFixture();await f.store.save({uid:'u',accessToken:'old',refreshToken:'r',persistent:true,selector:'pending'});
  const response=deferred();let calls=0;
  const request=async session=>{calls++;await response.promise;return {...session,accessToken:'new',refreshToken:'r2'};};
  const a=f.store.refresh(request),b=f.store.refresh(request);response.resolve();
  assert.equal((await a).accessToken,'new');assert.equal((await b).refreshToken,'r2');assert.equal(calls,1);
  const saved=await f.store.read();assert.equal(saved.selector,'pending');assert.equal(saved.persistent,true);
});
test('refresh completion after logout cannot restore tokens', async () => {
  const f=sessionFixture(),response=deferred();const result=f.store.refresh(async s=>{await response.promise;return {...s,accessToken:'new',refreshToken:'r2'};});
  await tick();await f.store.clear();response.resolve();
  assert.deepEqual(JSON.parse(JSON.stringify(await result)),{});assert.deepEqual(JSON.parse(JSON.stringify(await f.store.read())),{});
});
test('account switch keeps the new session even if previous refresh rejects', async () => {
  const f=sessionFixture(),response=deferred();const result=f.store.refresh(async()=>response.promise);await tick();
  await f.store.clear();await f.store.save({uid:'new-user',accessToken:'other',refreshToken:'other-r'});response.reject(Error('expired'));
  assert.equal((await result).uid,'new-user');assert.equal((await f.store.read()).accessToken,'other');
});
test('session save/remove ordering and failed writes do not poison future work', async () => {
  const f=sessionFixture();const off=f.store.clear(),save=f.store.save({uid:'next',accessToken:'a',refreshToken:'r'});
  await Promise.all([off,save]);assert.equal((await f.store.read()).uid,'next');assert.deepEqual(f.events,['remove','changed','write','changed']);
  await assert.rejects(f.store.refresh(async s=>({...s,uid:'wrong',accessToken:'a2'})),/VpnInvalidSessionResponse/);
  assert.equal((await f.store.read()).uid,'next');
});

function vendorLoad(file, mocks = {}, globals = {}) {
  const filename=path.resolve(__dirname,'../vendor/proton-source/source/js',file+'.ts'),exports={};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{exports,Promise,fetch,setTimeout,clearTimeout,setInterval:()=>{},...globals,require:id=>mocks[id]||{}},{filename});return exports;
}
function stateFixture() {
  const events=[],errors=[],credentials=deferred();let saved;
  const c={Username:'u',Password:'private',Expire:3600};
  const noop=()=>{};
  const state=vendorLoad('state',{
    '../../../../vpn/engine/state':load('state'),
    '../../../../vpn/engine/diagnostics':load('diagnostics'),
    './vpn/ConnectionState':{asConnectionStateSwitch:x=>x},
    './log/log':{bind:()=>noop},
    './intervals':{getActivityCheckInterval:()=>10000,getLogicalCheckUpRefreshInterval:()=>60000},
    './tools/triggerPromise':{triggerPromise:p=>{if(p?.catch)p.catch(e=>errors.push(e));}},
    './vpn/networkGuard':{networkGuard:{block:async()=>{},open:async valid=>valid(),disarm:async()=>{},status:async()=>({armed:false,blocked:false})}},
    '../../../../vpn/engine/tunnel-probe':{verifyTunnel:async()=>true},
    '../../../../vpn/engine/routing':{usesVpn:()=>true},
    './notifications/privacyWarning':{emitPrivacyWarning:noop},
    './tools/sentry':{handleError:e=>errors.push(e)},
    './tools/proxy':{getFixedServerConfig:()=>({rules:{}}),invalidateProxyOperations:noop,hasProxy:async()=>events.some(([kind])=>kind==='apply'),clearProxy:async()=>true,proxyToServer:async(server,split,guard)=>{if(guard())events.push(['apply',server.name]);return guard();}},
    './account/credentials/getConnectionCredentials':{cancelNextCredentialFetch:noop,loadCredentials:async()=>c,getCredentials:()=>credentials.promise,loadCachedCredentials:async()=>({time:Date.now()+60000})},
    './vpn/connectedServer':{connectedServer:{get:async()=>({value:saved}),setValue:async value=>{saved=value;}}},
    './tools/notifyStateChange':{notifyStateChange:(name)=>events.push(['status',name])},
    './tools/browserAction':{setButton:noop},
    './tools/delay':{delay:async()=>{}},
    './vpn/checkNetwork':{checkNetwork:e=>errors.push(e)},
    './tools/translate':{c:()=>({t:(parts,...values)=>parts.reduce((text,p,i)=>text+p+(values[i]||''),'')})},
    './notifications/emitNotification':{emitNotification:(_,text)=>events.push(['notification',text])},
    './account/credentials/mayReplaceCredentials':{mayReplaceCredentials:()=>true},
    './vpn/reviewInfo':{setReviewInfoStateLastSeenConnected:noop,setReviewInfoStateOnFailedConnection:noop},
    './vpn/transmitCredentialsToProxy':{transmitCredentialsToProxy:noop},
    './tools/activity':{updateLastActivityTime:async()=>{}},
    './account/getLocation':{getCountryAndCoordinates:async()=>({country:'BR',coordinates:[]})},
    './vpn/getLogicals':{shouldStayOnLogical:async()=>true},
    './messaging/MessageType':{SettingChange:{BYPASS_LIST:'rules'}},
    './tools/getErrorMessage':{getErrorAsString:e=>e.message},
  });
  state.logIn();
  return {state,credentials,events,errors,c};
}
const server=name=>({id:name,name,proxyHost:name+'.test',proxyPort:443});
test('real state adapter cannot reconnect when credentials complete after disconnect', async () => {
  const f=stateFixture();await f.state.connect({server:server('a')});await tick();
  assert.equal(f.state.isCurrentStateConnected(),false);
  assert.ok(!f.events.some(([type,text])=>type==='notification'&&text.startsWith('Connected')));
  f.state.disconnect();f.credentials.resolve(f.c);await tick();await tick();
  assert.equal(f.state.isCurrentStateConnected(),false);assert.ok(!f.events.some(([type])=>type==='apply'));
  assert.deepEqual(f.errors,[]);
});
test('real state adapter applies only the latest server and confirms before connected notification', async () => {
  const f=stateFixture();await f.state.connect({server:server('a')});await tick();
  await f.state.connect({server:server('b')});await tick();f.credentials.resolve(f.c);await tick();await tick();
  assert.deepEqual(f.events.filter(([type])=>type==='apply'),[['apply','b']]);
  assert.equal(f.state.isCurrentStateConnected(),true);
  assert.ok(f.events.findIndex(([type])=>type==='apply') < f.events.findIndex(([type,text])=>type==='notification'&&text.startsWith('Connected')));
  assert.deepEqual(f.errors,[]);
});
test('real auth adapter never supplies VPN secrets to sites, previous hosts or wrong ports', async () => {
  const credentials=deferred();let state={name:'on',data:{server:{proxyHost:'a.test',proxyPort:443}}},calls=0;
  const {authHandler}=vendorLoad('vpn/authHandler',{
    '../state':{getCurrentStateIfDefined:()=>state,isProxyKnownHost:host=>host===state?.data.server.proxyHost,getAuthCredentials:()=>{calls++;return {authCredentials:{username:'u',password:'secret'}};}},
    '../tools/proxyAuth':{isPending:()=>false},'../tools/milliSeconds':{milliSeconds:{fromSeconds:x=>x*1000}},'../config':{requestMaxAge:20},
    '../account/credentials/getConnectionCredentials':{getCredentials:()=>credentials.promise},
  });
  const challenge={isProxy:true,challenger:{host:'a.test',port:443}};
  for(const request of [{...challenge,isProxy:false},{...challenge,challenger:{host:'old.test',port:443}},{...challenge,challenger:{host:'a.test',port:8443}}]) {
    const result=await new Promise(resolve=>authHandler(request,resolve));assert.deepEqual(JSON.parse(JSON.stringify(result)),{});
  }
  let result;authHandler(challenge,value=>{result=value;});state={name:'off',data:{}};credentials.resolve({});await tick();
  assert.equal(result.cancel,true);assert.equal(calls,0);
});
test('a consumed sign-in fork cannot save its session after logout', async () => {
  const f=sessionFixture();const generation=f.store.capture();await f.store.clear();
  assert.equal(await f.store.saveIfCurrent({uid:'old',accessToken:'a',refreshToken:'r'},generation),false);
  assert.deepEqual(JSON.parse(JSON.stringify(await f.store.read())),{});
});

test('public connection snapshots use confirmed proxy state and exclude all secrets', () => {
  const {connectionView}=load('presentation');
  const state={name:'on',data:{server:{id:'mx',name:'MX-FREE#4',exitCountry:'MX',exitIp:'192.0.2.8',proxyHost:'private-endpoint',proxyPort:443,splitTunneling:{filteredDomains:['private-site']}},credsData:{Username:'secret-user',Password:'secret-password'}}};
  const connected=connectionView(state,true);
  assert.equal(connected.state.state,'connected');assert.equal(connected.state.server.name,'MX-FREE#4');
  assert.ok(!JSON.stringify(connected).includes('secret'));assert.ok(!JSON.stringify(connected).includes('private'));
  assert.equal(connectionView(state,false).state.state,'connecting');
  assert.equal(connectionView({name:'off',data:state.data},true).state.state,'disconnected');
  const out=connectionView({name:'loggedout',data:state.data},true);
  assert.equal(out.signedIn,false);assert.equal(out.state.state,'logged-out');assert.equal(out.state.server,undefined);
});

test('idle wake uses the current engine state after readiness and never restores a saved server', async () => {
  const ready=deferred(),events=[];let wake;
  const idle=vendorLoad('vpn/initIdleWatcher',{
    '../state':{waitForReadyState:()=>ready.promise,getCurrentState:()=>({refreshState:async()=>events.push('refresh-current')}),connect:()=>{throw Error('must not restore a server');}},
    '../tools/idle':{setCurrentIdleState:value=>events.push(value)},
    '../tools/getGlobalBrowser':{getGlobalBrowser:()=>({idle:{onStateChanged:{addListener:fn=>{wake=fn;}}}})},
    '../tools/triggerPromise':{triggerPromise:p=>p.catch(error=>events.push(error.message))},
  });
  idle.initIdleWatcher();wake('idle');wake('active');
  assert.deepEqual(events,['idle','active']);ready.resolve();await tick();
  assert.deepEqual(events,['idle','active','refresh-current']);
});


test('public snapshot distinguishes a failed guarded attempt from an active attempt',()=>{
 const {connectionView}=load('presentation');
 const state={name:'on',data:{blocked:true,error:{message:'VpnConnectionTimedOut'},server:{name:'CA-FREE#23'}}};
 assert.equal(connectionView(state,false,'VpnConnectionTimedOut').state.state,'blocked');
 assert.equal(connectionView(state,false,'VpnConnectionTimedOut').state.error.message,'VpnConnectionTimedOut');
 delete state.data.error;
 assert.equal(connectionView(state,false).state.state,'connecting');
});


test('startup proxy authentication cancels only an endpoint owned by this extension without requesting credentials', async () => {
  const {ownsAuthEndpoint} = load('proxy-auth');
  const {chromiumProxy} = load('chromium');
  const routing = require('../vpn/engine/routing.js');
  const challenge = {isProxy:true, challenger:{host:'node-us-275.protonvpn.net',port:4443}};
  for (const mode of ['fixed_servers','pac_script']) {
    const fixed = {mode:'fixed_servers',rules:{singleProxy:{scheme:'https',host:challenge.challenger.host,port:4443},bypassList:[]}};
    let details = {levelOfControl:'controlled_by_this_extension',value:mode === 'fixed_servers' ? fixed : routing.createPacScript(fixed)};
    let credentials = 0, faults = 0;
    const {authHandler} = vendorLoad('vpn/authHandler', {
      '../state':{getCurrentStateIfDefined:()=>undefined,isProxyKnownHost:()=>false,privacyFault:()=>faults++},
      '../tools/proxyAuth':{isPending:()=>false},'../tools/milliSeconds':{milliSeconds:{fromSeconds:x=>x*1000}},'../config':{requestMaxAge:20},
      '../account/credentials/getConnectionCredentials':{getCredentials:()=>{credentials++;return Promise.resolve({});}},
      '../../../../../vpn/engine/proxy-auth':{ownsAuthEndpoint},'../../../../../vpn/engine/chromium':{chromiumProxy},
    },{chrome:{runtime:{},proxy:{settings:{get:(_,done)=>done(details)}}}});
    const response = request => new Promise(resolve=>authHandler(request,resolve));
    assert.equal((await response(challenge)).cancel,true);
    assert.equal(credentials,0);assert.equal(faults,1);
    for(const request of [{...challenge,isProxy:false},{...challenge,challenger:{host:'node-us-275.protonvpn.net.attacker.test',port:4443}},{...challenge,challenger:{host:challenge.challenger.host,port:443}}]) {
      assert.deepEqual(JSON.parse(JSON.stringify(await response(request))),{});
    }
    details={...details,levelOfControl:'controlled_by_other_extensions'};
    assert.deepEqual(JSON.parse(JSON.stringify(await response(challenge))),{});
    assert.equal(credentials,0);assert.equal(faults,1);
  }
});

test('startup endpoint recognition requires exact inline PAC tokens and never trusts provider names alone', () => {
  const {ownsAuthEndpoint} = load('proxy-auth');
  const challenger = {host:'node-us-275.protonvpn.net',port:4443};
  for(const value of [{mode:'system'},{mode:'pac_script',pacScript:{data:'return "HTTPS other.test:4443";'}},{mode:'pac_script',pacScript:{url:'https://node-us-275.protonvpn.net/config.pac'}},{mode:'fixed_servers',rules:{singleProxy:{scheme:'https',host:challenger.host,port:443},bypassList:[]}}]) {
    assert.equal(ownsAuthEndpoint({levelOfControl:'controlled_by_this_extension',value},challenger),false);
  }
});
