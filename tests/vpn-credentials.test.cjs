const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(name){const exports={},filename=path.resolve(__dirname,'../vpn/engine',name+'.ts');const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,{exports,Promise,Date,AbortController,atob,setTimeout,clearTimeout,require:id=>load(id.replace('./',''))},{filename});return exports;}
const {CredentialManager}=load('credentials');
const {credentialData,credentialMayReplace}=load('credential-data');
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const token=(name='opaque',ttl=100)=>({Code:1000,Expire:ttl,Username:name,Password:'private-'+name});
const jwt=claims=>'header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(initial){let now=1000000,session={uid:'A',generation:0},disk=clone(initial);const events=[],failures=[];
 const ports={now:()=>now,session:async()=>session&&({...session}),current:s=>!!session&&s.uid===session.uid&&s.generation===session.generation,
 read:async()=>clone(disk)||{},write:async value=>{disk=clone(value);events.push(['write']);},remove:async()=>{disk=undefined;events.push(['remove']);},
 authorize:async()=>events.push(['authorize']),refreshSession:async()=>events.push(['refresh']),
 request:async(attempt,signal)=>{events.push(['request',attempt,signal.aborted]);return token();},
 classify:error=>error.kind||'fatal',updated:async(value,current)=>{if(current())events.push(['updated',value.Username]);},failed:(error,kind)=>failures.push([error,kind])};
 const manager=new CredentialManager(ports);return {ports,manager,events,failures,get now(){return now;},advance:ms=>{now+=ms;},get disk(){return disk;},session:value=>{session=value;}};
}
test('concurrent callers share one request, persist before delivery and keep the legacy cache format',async()=>{
 const f=fixture(),response=deferred();f.ports.request=async n=>{f.events.push(['request',n]);return response.promise;};
 const results=Array.from({length:20},()=>f.manager.get(true));await tick();assert.equal(f.events.filter(e=>e[0]==='request').length,1);
 response.resolve(token());const values=await Promise.all(results);assert.ok(values.every(v=>v.Username==='opaque'));
 assert.equal(f.disk.sessionUid,'A');assert.equal(f.disk.time,f.now+100000);assert.equal(f.disk.renewAt,f.now+90000);
 assert.deepEqual(f.events.slice(-2).map(e=>e[0]),['write','updated']);
 values[0].Password='modified';assert.equal(f.manager.synchronous().Password,'private-opaque');
});
test('worker restart reads valid legacy cache without requesting a new credential',async()=>{
 const f=fixture({sessionUid:'A',time:1100000,credentials:token()});assert.equal((await f.manager.get()).Username,'opaque');
 assert.equal(f.events.filter(e=>e[0]==='request').length,0);assert.equal(f.manager.synchronous().Username,'opaque');
 f.advance(91000);await f.manager.wake();assert.equal(f.events.filter(e=>e[0]==='request').length,1);
});
test('legacy caches without ownership and caches from another UID are never supplied',async()=>{
 for(const sessionUid of [undefined,'B']){const f=fixture({sessionUid,time:1100000,credentials:token('old')});assert.equal(f.manager.synchronous(),undefined);assert.equal((await f.manager.get()).Username,'opaque');assert.equal(f.disk.sessionUid,'A');}
});
test('renewal uses the new JWT expiry instead of capping it to the previous token',async()=>{
 const old=token(jwt({exp:1100,sid:'session',grp:'vpn-paid'}));
 const f=fixture({sessionUid:'A',time:1100000,renewAt:1090000,credentials:old});await f.manager.get();f.advance(91000);
 const next=token(jwt({exp:1200,sid:'session',grp:'vpn-paid'}));f.ports.request=async()=>next;
 await f.manager.wake();assert.equal(f.disk.time,1191000);assert.ok(f.disk.time>1100000);
 assert.equal(f.manager.synchronous().Username,next.Username);
});
test('response TTL and its own JWT expiry are both respected',async()=>{
 const f=fixture();f.ports.request=async()=>token(jwt({exp:1050}),100);await f.manager.get();assert.equal(f.disk.time,1050000);
 f.advance(50001);assert.equal(f.manager.synchronous(),undefined);
});
test('malformed and already-expired responses are rejected before writing or delivering secrets',async()=>{
 for(const value of [undefined,{},token('bad',0),token('bad',Infinity),{...token(),Code:0},{...token(),Password:''},token(jwt({exp:999}))]){
 const f=fixture();f.ports.request=async()=>value;await assert.rejects(f.manager.get(),/VpnInvalidCredentials|VpnExpiredCredentials/);
 assert.equal(f.disk,undefined);assert.equal(f.events.some(e=>e[0]==='updated'),false);assert.equal(f.manager.synchronous(),undefined);
 assert.ok(!f.failures[0][0].message.includes('private'));
 }
});
test('disconnect cancels in-flight acquisition but preserves a valid persisted cache for reconnection',async()=>{
 const f=fixture(),response=deferred();let signal;f.ports.request=async(_,s)=>{signal=s;return response.promise;};
 const pending=f.manager.get();await tick();f.manager.cancel();assert.equal(signal.aborted,true);response.resolve(token());
 assert.equal(await pending,undefined);assert.equal(f.disk,undefined);
 const saved=fixture({sessionUid:'A',time:1100000,credentials:token('saved')});await saved.manager.get();saved.manager.cancel();
 assert.equal(saved.manager.synchronous(),undefined);assert.equal((await saved.manager.get()).Username,'saved');
});
test('logout and same-UID login cannot revive a response from a previous session epoch',async()=>{
 const f=fixture(),response=deferred();f.ports.request=async()=>response.promise;const pending=f.manager.get();await tick();
 f.session({uid:'A',generation:1});await f.manager.clear();response.resolve(token('stale'));assert.equal(await pending,undefined);assert.equal(f.disk,undefined);assert.equal(f.manager.synchronous(),undefined);
});
test('late errors from a previous account cannot affect the next account or its waiter group',async()=>{
 const f=fixture(),old=deferred();let n=0;f.ports.request=async()=>++n===1?old.promise:token('B');
 const first=f.manager.get();await tick();f.session({uid:'B',generation:1});await f.manager.clear();
 const next=await f.manager.get();assert.equal(next.Username,'B');old.reject({kind:'logout'});assert.equal(await first,undefined);
 assert.equal(f.disk.sessionUid,'B');assert.equal(f.failures.length,0);
});
test('logout during a delayed storage write serializes removal and never exposes the old credential',async()=>{
 const f=fixture(),write=deferred(),save=f.ports.write;f.ports.write=async cache=>{await write.promise;return save(cache);};
 const pending=f.manager.get();await tick();f.session(undefined);const clear=f.manager.clear();write.resolve();
 await Promise.all([pending,clear]);assert.equal(f.disk,undefined);assert.equal(f.manager.synchronous(),undefined);
 assert.deepEqual(f.events.map(e=>e[0]).filter(e=>['write','remove','updated'].includes(e)),['write','remove']);
});
test('failed removal remains fail-closed for a later same-UID session',async()=>{
 const f=fixture({sessionUid:'A',time:1100000,credentials:token('old')});await f.manager.get();
 f.ports.remove=async()=>{throw Error('storage');};await assert.rejects(f.manager.clear(),/storage/);
 f.ports.request=async()=>token('new');assert.equal((await f.manager.get()).Username,'new');
});
test('account changes during authorization prevent an unnecessary credential request',async()=>{
 const f=fixture(),auth=deferred();f.ports.authorize=()=>auth.promise;const pending=f.manager.get();await tick();
 f.session(undefined);f.manager.cancel();auth.resolve();assert.equal(await pending,undefined);assert.equal(f.events.some(e=>e[0]==='request'),false);
});
test('transient network and rate-limit errors back off without repeatedly hitting the service',async()=>{
 for(const kind of ['network','retryable']){const f=fixture();let count=0;f.ports.request=async()=>{count++;throw {kind};};
 assert.equal(await f.manager.get(),undefined);for(let i=0;i<10;i++)await f.manager.get();assert.equal(count,1);assert.equal(f.failures.length,1);
 f.advance(1000);await f.manager.wake();assert.equal(count,2);f.advance(1999);await f.manager.get();assert.equal(count,2);
 f.advance(1);f.ports.request=async()=>{count++;return token();};assert.equal((await f.manager.get()).Username,'opaque');assert.equal(count,3);
 }
});
test('failed proactive renewal retains a still-valid credential, but never returns it after expiry',async()=>{
 const f=fixture();await f.manager.get();f.advance(90000);f.ports.request=async()=>{throw {kind:'network'};};
 await f.manager.wake();assert.equal(f.manager.synchronous().Username,'opaque');f.advance(10001);assert.equal(f.manager.synchronous(),undefined);assert.equal(await f.manager.get(),undefined);
});
test('wakeups after suspension renew overdue credentials without an in-memory timeout',async()=>{
 const f=fixture({sessionUid:'A',time:1000500,credentials:token('old')});f.advance(30000);await f.manager.wake();assert.equal(f.disk.credentials.Username,'opaque');assert.equal(f.manager.synchronous().Username,'opaque');
});
test('invalid access token refreshes once and concurrent callers share that retry',async()=>{
 const f=fixture();let requests=0;f.ports.request=async()=>{if(++requests===1)throw {kind:'invalid-token'};return token();};
 await Promise.all([f.manager.get(),f.manager.get(true)]);assert.equal(requests,2);assert.equal(f.events.filter(e=>e[0]==='refresh').length,1);
 const repeated=fixture();let calls=0;repeated.ports.request=async()=>{calls++;throw {kind:'invalid-token'};};
 await assert.rejects(repeated.manager.get());assert.equal(calls,2);assert.equal(repeated.events.filter(e=>e[0]==='refresh').length,1);
});
test('session refresh completing after logout does not start the retried credential request',async()=>{
 const f=fixture(),refresh=deferred();let calls=0;f.ports.request=async()=>{calls++;throw {kind:'unauthorized'};};f.ports.refreshSession=()=>refresh.promise;
 const pending=f.manager.get(true);await tick();f.session(undefined);await f.manager.clear();refresh.resolve();assert.equal(await pending,undefined);assert.equal(calls,1);
});
test('renewal and cached getters do not bypass a failed persistent write',async()=>{
 const f=fixture();f.ports.write=async()=>{throw Error('storage failed');};await assert.rejects(f.manager.get(),/storage failed/);
 assert.equal(f.manager.synchronous(),undefined);assert.equal(f.events.some(e=>e[0]==='updated'),false);
});
test('an invalid refreshed response never poisons the existing valid cache',async()=>{
 const f=fixture();await f.manager.get();f.advance(90000);f.ports.request=async()=>({...token('bad'),Code:500});
 await assert.rejects(f.manager.wake(),/VpnInvalidCredentials/);assert.equal(f.disk.credentials.Username,'opaque');
});
test('claim hints handle base64url, malformed payloads, groups and opaque rotation safely',()=>{
 const data=credentialData(token(jwt({exp:1234,grp:'vpn-paid,test',sid:'s'})));assert.equal(data.expiration,1234);assert.deepEqual([...data.groups],['vpn-paid','test']);
 for(const value of [null,[],{exp:'999999',grp:4,sid:{}},{}]){const result=credentialData(token(jwt(value)));assert.equal(result.expiration,0);assert.deepEqual([...result.groups],[]);assert.equal(result.sessionId,null);}
 assert.equal(credentialMayReplace(token('old'),token('new')),true);
 assert.equal(credentialMayReplace(token(jwt({exp:200,sid:'s'})),token(jwt({exp:100,sid:'s'}))),false);
});


test('a stalled request times out and cannot block later wakeups or persist a late response',async()=>{
 const f=fixture(),late=deferred();f.ports.requestTimeoutMs=5;f.ports.request=()=>late.promise;
 assert.equal(await f.manager.get(),undefined);assert.equal(f.failures[0][1],'network');
 assert.equal(f.failures[0][0].message,'VpnCredentialRequestTimedOut');
 f.advance(1000);f.ports.request=async()=>token('recovered');assert.equal((await f.manager.get()).Username,'recovered');
 late.resolve(token('late'));await tick();assert.equal(f.disk.credentials.Username,'recovered');
});
test('cancel releases every pending caller even if transport ignores the abort signal',async()=>{
 const f=fixture();f.ports.request=()=>new Promise(()=>{});const requests=[f.manager.get(),f.manager.get()];await tick();
 f.manager.cancel();const results=await Promise.all(requests);assert.ok(results.every(value=>value===undefined));
});

test('session logout and credential storage writes finish without a circular wait',async()=>{
 const {SessionStore}=load('session');let session={uid:'A',accessToken:'a',refreshToken:'r'};
 const f=fixture(),write=deferred(),save=f.ports.write;
 const store=new SessionStore({read:async()=>({...session}),write:async value=>{session=value;},remove:async()=>{session={};},changed:()=>f.manager.clear()});
 f.ports.session=async()=>{const generation=store.capture(),value=await store.read();return value.uid?{uid:value.uid,generation}:undefined;};
 f.ports.current=value=>value.generation===store.capture();
 f.ports.write=async value=>{await write.promise;await save(value);};
 const credential=f.manager.get();await tick();const logout=store.clear(),during=f.manager.get();write.resolve();
 await Promise.all([logout,credential,during]);assert.equal(f.disk,undefined);assert.equal(f.manager.synchronous(),undefined);assert.equal((await store.read()).uid,undefined);
});

test('storage adapter preserves the legacy key and fails explicitly on native API errors',async()=>{
 const key='superVpn:credentials',local={[key]:{sessionUid:'A',time:1100000,credentials:token()}},session={},events=[];
 const runtime={};
 const area=(name,values)=>({get(k,done){events.push([name,'get',k]);done({[k]:values[k]});},set(value,done){Object.assign(values,value);events.push([name,'set',Object.keys(value)]);done();},remove(k,done){delete values[k];events.push([name,'remove',k]);done();}});
 const chrome={runtime,storage:{local:area('local',local),session:area('session',session)}},exports={};
 const file=path.resolve(__dirname,'../vendor/proton-source/source/js/account/credentials/storedCredentials.ts');
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,chrome,Promise});
 const port=exports.storedCredentials;assert.equal((await port.load()).sessionUid,'A');
 await port.set({sessionUid:'A',time:1200000,credentials:token('new')});assert.equal(local[key].credentials.Username,'new');
 await port.remove();assert.equal(local[key],undefined);assert.equal(session[key],undefined);
 chrome.storage.local.get=(_,done)=>{runtime.lastError={message:'private native detail'};done({});delete runtime.lastError;};
 await assert.rejects(port.load(),/VpnCredentialStorageFailed/);
 assert.ok(events.every(event=>event[2]===key||Array.isArray(event[2])&&event[2][0]===key));
});

function serviceFixture(request) {
 let uid='A',epoch=0,cache,listener,clear;const events=[],state={proxyEnabled:true,setCredentials:value=>events.push(['credentials',value.Username])};
 const api={isNetworkError:e=>e?.name==='NetworkError',isInvalidTokenError:e=>e?.Code===401&&e?.httpStatus===401,isUnauthorizedError:e=>e?.httpStatus===401,needsLogout:e=>e?.Code===2028,isForbiddenError:e=>e?.httpStatus===403,isRetriableError:e=>e?.Code===429};
 const mocks={
  '../../../../../../vpn/engine/credentials':{CredentialManager},
  './storedCredentials':{storedCredentials:{load:async()=>cache||{},set:async value=>{cache=clone(value);},remove:async()=>{cache=undefined;}}},
  './credentialInvalidation':{attachCredentialInvalidation:fn=>{clear=fn;}},
  '../sessionStore':{sessionStore:{capture:()=>epoch}},'../readSession':{readSession:async()=>({uid})},
  '../getAccessToken':{getAccessToken:async()=>'access'},'../refreshToken':{refreshToken:async()=>events.push(['refresh'])},
  '../fetchWithUserInfo':{fetchWithUserInfo:async(url,init)=>{events.push(['http',url,init.headers['x-pm-try-number'],!!init.signal]);return request();}},
  '../../config':{tokenDuration:3600},'../../api':api,
  '../../state':{getCurrentState:()=>state,disconnect:()=>events.push(['disconnect']),logOut:()=>events.push(['logout']),reportNetworkFailure:()=>events.push(['network']),requestConnectionRecovery:async()=>events.push(['recover'])},
  '../../vpn/initAuthInterceptor':{initAuthInterceptor:()=>events.push(['interceptor'])},'../../tools/getErrorMessage':{getErrorAsString:()=> 'service error'},
  '../../tools/sentry':{handleError:()=>events.push(['error'])},'../../tools/triggerPromise':{triggerPromise:value=>Promise.resolve(value).catch(()=>{})},
 };
 const filename=path.resolve(__dirname,'../vendor/proton-source/source/js/account/credentials/credentialStore.ts'),exports={};
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{exports,Promise,chrome:{storage:{onChanged:{addListener:fn=>{listener=fn;}}},webRequest:{handlerBehaviorChanged:async()=>{}}},require:id=>{if(!mocks[id])throw Error('Unexpected import '+id);return mocks[id];}},{filename});
 return {manager:exports.credentialManager,events,get cache(){return cache;},switchAccount(value){const old=uid;uid=value;listener({'superVpn:session':{oldValue:{uid:old},newValue:{uid}}},'local');},clear:()=>clear(),advanceEpoch:()=>{epoch++;}};
}
test('real service adapter keeps endpoint and account scope, and updates authentication only after valid storage',async()=>{
 const f=serviceFixture(async()=>token());await f.manager.get(true);
 assert.deepEqual(f.events[0],['http','vpn/v1/browser/token?Duration=3600','1',true]);
 assert.equal(f.cache.sessionUid,'A');assert.ok(f.events.some(e=>e[0]==='interceptor'));assert.ok(f.events.some(e=>e[0]==='credentials'));
 await f.clear();assert.equal(f.cache,undefined);assert.equal(f.manager.synchronous(),undefined);
});
test('real service adapter moves expired network failures into recovery instead of retaining connected presentation',async()=>{
 const f=serviceFixture(async()=>{throw {name:'NetworkError'};});assert.equal(await f.manager.get(true),undefined);
 assert.ok(f.events.some(e=>e[0]==='network'));assert.ok(f.events.some(e=>e[0]==='recover'));
 assert.ok(!f.events.some(e=>e[0]==='disconnect'||e[0]==='logout'));
});
test('account storage events from a different extension page invalidate old credential responses',async()=>{
 const first=deferred();let n=0;const f=serviceFixture(()=>++n===1?first.promise:Promise.resolve(token('B')));
 const old=f.manager.get();await tick();f.switchAccount('B');assert.equal((await f.manager.get()).Username,'B');
 first.resolve(token('old'));assert.equal(await old,undefined);assert.equal(f.cache.sessionUid,'B');assert.equal(f.cache.credentials.Username,'B');
});

test('a transport-consumed auth retry is not repeated again by the credential manager',async()=>{
 const f=fixture();f.ports.request=async()=>{throw {kind:'invalid-token',authRetried:true};};
 await assert.rejects(f.manager.get(true));assert.equal(f.events.filter(e=>e[0]==='refresh').length,0);
});
