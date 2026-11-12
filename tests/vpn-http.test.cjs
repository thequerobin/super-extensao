const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(name){const exports={},file=path.resolve(__dirname,'../vpn/engine',name+'.ts');vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Promise,Date,URL,Headers,Response,AbortController,Uint8Array,setTimeout,clearTimeout,require:id=>load(id.replace('./',''))},{filename:file});return exports;}
const {HttpTransport,HttpError,retryAfter}=load('http');
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(shared=new Map()){
 let now=1000000,session={uid:'A',accessToken:'private-old',refreshToken:'r',generation:0};const calls=[],refreshes=[];
 const ports={baseUrl:'https://api.test/api/',now:()=>now,session:async()=>({...session}),current:s=>s.uid===session.uid&&s.generation===session.generation,
 refresh:async original=>{refreshes.push(original);session={...session,accessToken:'private-new'};return {...session};},headers:async()=>({'x-pm-appversion':'test','x-pm-locale':'pt-BR'}),authorization:s=>s.uid&&s.accessToken?{'x-pm-uid':s.uid,Authorization:'Bearer '+s.accessToken}:{},
 routes:['vpn/v1/logicals/lookup/{name}','auth/sessions/forks/{selector}'],cooldown:{get:async key=>shared.get(key),set:async(key,v)=>shared.set(key,{...v})},
 fetch:async(url,init)=>{calls.push({url,init});return json({Code:1000,ok:true});}};
 const client=new HttpTransport(ports);return {client,ports,calls,refreshes,shared,advance:ms=>{now+=ms;},get now(){return now;},setSession:s=>{session=s;},session:()=>({...session})};
}
test('request headers are copied, authorization is attached and response builders retain readable bodies',async()=>{
 const f=fixture(),headers={'x-extra':'value'};const result=await f.client.json('vpn/v2',{headers},undefined,(response,data)=>({data,clone:response.clone(),url:response.url}));
 assert.equal(result.data.ok,true);assert.equal((await result.clone.json()).ok,true);assert.equal(result.url,'https://api.test/api/vpn/v2');
 assert.deepEqual(headers,{'x-extra':'value'});assert.equal(f.calls[0].init.headers.get('authorization'),'Bearer private-old');assert.equal(f.calls[0].init.headers.get('x-extra'),'value');
 assert.equal(f.calls[0].init.redirect,'error');assert.equal(f.calls[0].init.credentials,'include');
});
test('binary responses with content-type parameters, 204 and conditional 304 stay compatible',async()=>{
 const f=fixture();f.ports.fetch=async()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'application/octet-stream; charset=binary'}});
 assert.deepEqual([...new Uint8Array(await f.client.json('binary'))],[1,2,3]);
 f.ports.fetch=async()=>new Response(null,{status:204});assert.equal(await f.client.json('empty'),undefined);
 f.ports.fetch=async()=>new Response(null,{status:304,headers:{ETag:'v1'}});assert.equal((await f.client.raw('cached')).status,304);
 await assert.rejects(f.client.json('cached'),error=>error.httpStatus===304&&error.response.status===304);
});
test('errors retain HTTP status, service code and action details without returning arbitrary plain text',async()=>{
 const f=fixture();f.ports.fetch=async()=>json({Code:2028,Error:'Signed out',Details:{Type:'DeviceLimit'}},403);
 await assert.rejects(f.client.json('vpn/v2'),error=>error.httpStatus===403&&error.Code===2028&&error.Details.Type==='DeviceLimit');
 f.ports.fetch=async()=>new Response('private raw server output',{status:502});
 await assert.rejects(f.client.json('vpn/v2'),error=>error.httpStatus===502&&!error.message.includes('private'));
});
test('malformed JSON and HTML blockers are classified without logging response contents',async()=>{
 const f=fixture();f.ports.fetch=async()=>new Response('not-json',{headers:{'Content-Type':'application/json'}});
 await assert.rejects(f.client.json('vpn/v2'),error=>error.code==='VpnHttpInvalidResponse'&&error.Code===503);
 let html;f.ports.blocked=text=>{html=text;return Error('blocked');};f.ports.fetch=async()=>new Response('<html>test-blocker</html>');
 await assert.rejects(f.client.json('vpn/v2'),/blocked/);assert.ok(html.includes('test-blocker'));
});
test('safe invalid-token retry uses the new Authorization header and never mutates the caller headers',async()=>{
 const f=fixture(),headers={'x-extra':'value'};
 f.ports.fetch=async(url,init)=>{f.calls.push({url,init});return f.calls.length===1?json({Code:401,Error:'Expired'},401):json({ok:true});};
 assert.equal((await f.client.json('vpn/v2',{headers})).ok,true);assert.equal(f.refreshes.length,1);assert.equal(f.calls.length,2);
 assert.equal(f.calls[0].init.headers.get('authorization'),'Bearer private-old');assert.equal(f.calls[1].init.headers.get('authorization'),'Bearer private-new');assert.equal(headers.Authorization,undefined);
});
test('auth retry occurs once and reports the final service error, including force-upgrade details',async()=>{
 const f=fixture();f.ports.fetch=async(url,init)=>{f.calls.push({url,init});return f.calls.length===1?json({Code:401,Error:'Old'},401):json({Code:5003,Error:'Upgrade'},403);};
 await assert.rejects(f.client.json('vpn/v2'),error=>error.Code===5003&&error.authRetried===true);assert.equal(f.refreshes.length,1);assert.equal(f.calls.length,2);
});
test('unchanged refreshed credentials do not repeat requests and mark the consumed auth budget',async()=>{
 const f=fixture();f.ports.refresh=async()=>{f.refreshes.push(1);return f.session();};f.ports.fetch=async()=>{f.calls.push(1);return json({Code:401,Error:'Expired'},401);};
 await assert.rejects(f.client.json('vpn/v2'),error=>error.authRetried===true);assert.equal(f.calls.length,1);assert.equal(f.refreshes.length,1);
});
test('POST, auth routes, explicit authorization and raw calls are never automatically replayed',async()=>{
 for(const [url,init,raw] of [['vpn/v2',{method:'POST',body:'{}'}],['auth/refresh',{method:'POST',body:'{}'}],['auth/sessions/forks/selector',{}],['vpn/v2',{headers:{Authorization:'Bearer custom'}}],['vpn/v2',{},true]]){
 const f=fixture();f.ports.fetch=async()=>{f.calls.push(1);return json({Code:401,Error:'Expired'},401);};
 if(raw)assert.equal((await f.client.raw(url,init)).status,401);else await assert.rejects(f.client.json(url,init));
 assert.equal(f.calls.length,1);assert.equal(f.refreshes.length,0);
 }
});
test('network failures are sanitized and do not trigger a retry even for a mutation',async()=>{
 const f=fixture();f.ports.fetch=async()=>{f.calls.push(1);throw Error('private-old https://api.test/private');};
 await assert.rejects(f.client.json('mutation',{method:'POST',body:'private-body'}),error=>error.name==='NetworkError'&&error.code==='VpnHttpNetworkFailed'&&!error.message.includes('private'));
 assert.equal(f.calls.length,1);assert.equal(f.refreshes.length,0);
});
test('cancel before start performs no request, and cancel during fetch prevents late results',async()=>{
 const f=fixture(),abort=new AbortController();abort.abort();await assert.rejects(f.client.json('vpn/v2',{signal:abort.signal}),error=>error.code==='VpnHttpCancelled');assert.equal(f.calls.length,0);
 const g=fixture(),pending=deferred(),a=new AbortController();g.ports.fetch=async()=>pending.promise;
 const task=g.client.json('vpn/v2',{signal:a.signal});await tick();a.abort();await assert.rejects(task,error=>error.name==='AbortError');pending.resolve(json({private:true}));await tick();
});
test('deadline includes response body consumption and cancels a stalled stream',async()=>{
 const f=fixture();f.ports.timeoutMs=10;let cancelled=false;
 f.ports.fetch=async()=>new Response(new ReadableStream({start(){},cancel(){cancelled=true;}}));
 await assert.rejects(f.client.json('vpn/v2'),error=>error.code==='VpnHttpTimedOut'&&error.name==='NetworkError');await tick();assert.equal(cancelled,true);
});
test('a timeout releases callers even if the underlying fetch ignores abort',async()=>{
 const f=fixture();f.ports.timeoutMs=5;f.ports.fetch=()=>new Promise(()=>{});await assert.rejects(f.client.raw('vpn/v2'),error=>error.code==='VpnHttpTimedOut');
});
test('session changes during metadata loading prevent sending and changes during fetch discard the result',async()=>{
 const f=fixture(),headers=deferred();f.ports.headers=()=>headers.promise;const a=f.client.json('vpn/v2');await tick();f.setSession({uid:'B',accessToken:'new',generation:1});headers.resolve({});await assert.rejects(a,error=>error.code==='VpnHttpSessionChanged');assert.equal(f.calls.length,0);
 const g=fixture(),response=deferred();g.ports.fetch=()=>response.promise;const b=g.client.json('vpn/v2');await tick();g.setSession({uid:'A',accessToken:'same',generation:1});response.resolve(json({old:true}));await assert.rejects(b,error=>error.code==='VpnHttpSessionChanged');
});
test('logout or another account during refresh cannot replay an old request under a new account',async()=>{
 const f=fixture(),refresh=deferred();f.ports.fetch=async()=>{f.calls.push(1);return json({Code:401,Error:'Expired'},401);};f.ports.refresh=()=>refresh.promise;
 const task=f.client.json('vpn/v2');await tick();f.setSession({uid:'B',accessToken:'b',generation:1});refresh.resolve(f.session());await assert.rejects(task,error=>error.code==='VpnHttpSessionChanged');assert.equal(f.calls.length,1);
});
test('explicit old-session logout can still be sent after local logout, without refreshing any session',async()=>{
 const f=fixture();f.setSession({generation:1});await f.client.raw('auth',{method:'DELETE'},undefined,{uid:'A',accessToken:'old',generation:0});
 assert.equal(f.calls[0].init.headers.get('authorization'),'Bearer old');assert.equal(f.refreshes.length,0);
});
test('manual UID headers cannot silently bind a request to a different current account',async()=>{
 const f=fixture();await assert.rejects(f.client.json('auth/refresh',{method:'POST',headers:{'x-pm-uid':'B'}}),error=>error.code==='VpnHttpSessionChanged');assert.equal(f.calls.length,0);
});
test('429 and 503 respect Retry-After across queries and client recreation without persisting payloads',async()=>{
 for(const status of [429,503]){const shared=new Map(),f=fixture(shared);f.ports.fetch=async()=>{f.calls.push(1);return json({Code:status,Error:'private body' },status,{'Retry-After':'60'});};
 await assert.rejects(f.client.json('vpn/v2?one=1'),error=>error.Code===status);await assert.rejects(f.client.json('vpn/v2?two=2'),error=>error.Code===status);assert.equal(f.calls.length,1);
 const next=fixture(shared);await assert.rejects(next.client.json('vpn/v2'),error=>error.Code===status);assert.equal(next.calls.length,0);
 assert.ok(!JSON.stringify([...shared]).includes('private'));next.advance(60001);assert.equal((await next.client.json('vpn/v2')).ok,true);assert.equal(next.calls.length,1);
 }});
test('cooldowns are isolated by account and method and normalize lookup/fork parameters',async()=>{
 const f=fixture();f.ports.fetch=async()=>{f.calls.push(1);return json({Code:429,Error:'wait'},429,{'Retry-After':'60'});};
 await f.client.raw('auth/sessions/forks/private-selector');await f.client.raw('auth/sessions/forks/another-selector');assert.equal(f.calls.length,1);assert.ok(!JSON.stringify([...f.shared]).includes('private-selector'));
 await f.client.raw('auth/sessions/forks/name',{method:'POST'});assert.equal(f.calls.length,2);
 f.setSession({uid:'B',accessToken:'b',generation:1});await f.client.raw('auth/sessions/forks/another');assert.equal(f.calls.length,3);
});
test('Retry-After accepts seconds and HTTP dates, clamps excessive values and handles invalid values',()=>{
 const now=Date.UTC(2026,10,12,12);assert.equal(retryAfter(json({},429,{'Retry-After':'30'}),now),now+30000);
 assert.equal(retryAfter(json({},429,{'Retry-After':new Date(now+60000).toUTCString()}),now),now+60000);
 assert.equal(retryAfter(json({},429,{'Retry-After':'bad'}),now),now+10000);
 assert.equal(retryAfter(json({},429,{'Retry-After':'999999999999'}),now),now+7*86400000);
});
test('URL and redirect guards never send tokens to another origin',async()=>{
 for(const url of ['https://evil.test/token','//evil.test/token','http://api.test/api/x','https://user:pass@api.test/api/x']){
 const f=fixture();assert.throws(()=>f.client.json(url),error=>error.code==='VpnHttpInvalidUrl');assert.equal(f.calls.length,0);}
 const f=fixture();f.ports.fetch=async(_,init)=>{assert.equal(init.redirect,'error');const response=json({});Object.defineProperty(response,'url',{value:'https://evil.test/'});return response;};
 await assert.rejects(f.client.json('vpn/v2'),error=>error.code==='VpnHttpInvalidUrl');
});
test('persistent cooldown read failure does not bypass the rate limit store and send a request',async()=>{
 const f=fixture();f.ports.cooldown.get=async()=>{throw new HttpError('VpnHttpCooldownStorageFailed');};await assert.rejects(f.client.raw('vpn/v2'),error=>error.code==='VpnHttpCooldownStorageFailed');assert.equal(f.calls.length,0);
});

test('concurrent HTTP failures share the own session refresh and one cancelled caller cannot cancel the other',async()=>{
 const {SessionStore}=load('session');let state={uid:'A',accessToken:'private-old',refreshToken:'r'},refreshes=0;const gate=deferred();
 const store=new SessionStore({read:async()=>({...state}),write:async value=>{state=value;},remove:async()=>{state={};},changed:async()=>{}});
 const f=fixture();f.ports.session=async()=>({...await store.read(),generation:store.capture()});f.ports.current=s=>s.generation===store.capture();
 f.ports.refresh=async original=>({...await store.refresh(async value=>{refreshes++;await gate.promise;return {...value,accessToken:'private-new',refreshToken:'r2'};},original),generation:store.capture()});
 f.ports.fetch=async(url,init)=>{f.calls.push({url,init});return init.headers.get('authorization')==='Bearer private-old'?json({Code:401,Error:'Old'},401):json({ok:true});};
 const abort=new AbortController(),first=f.client.json('vpn/v2',{signal:abort.signal}),second=f.client.json('vpn/v2');const failed=assert.rejects(first,error=>error.code==='VpnHttpCancelled');
 await tick();assert.equal(refreshes,1);abort.abort();await failed;gate.resolve();assert.equal((await second).ok,true);assert.equal(refreshes,1);assert.equal(f.calls.length,3);
});
test('deadline also covers session setup and prevents sending after setup finishes late',async()=>{
 const f=fixture(),session=deferred();f.ports.timeoutMs=5;f.ports.session=()=>session.promise;
 await assert.rejects(f.client.raw('vpn/v2'),error=>error.code==='VpnHttpTimedOut');session.resolve(f.session());await tick();assert.equal(f.calls.length,0);
});

function adapterFixture(){
 let state={uid:'A',accessToken:'private-old',refreshToken:'r'},epoch=0,update,onStorage;const data={},calls=[],events=[];
 const area={get(key,done){done({[key]:data[key]});},set(value,done){Object.assign(data,value);done();}};
 const translate=()=>({t:(parts,...args)=>parts.reduce((s,p,i)=>s+p+(args[i]||''),'')});
 const mocks={
  '../../../../vpn/engine/http':{HttpTransport,HttpError},'./account/sessionStore':{sessionStore:{capture:()=>epoch}},'./account/readSession':{readSession:async()=>({...state})},
  './account/refreshToken':{refreshToken:async()=>{state={...state,accessToken:'private-new'};return {...state};}},'./account/getAuthHeaders':{getAuthHeaders:(uid,token)=>({'x-pm-uid':uid,Authorization:'Bearer '+token})},
  './account/user/getRegisteredLocale':{getRegisteredLocale:async()=> 'pt-BR'},'./tools/locale':{getLocale:()=> 'en'},'./tools/getBrowserSubType':{getBrowserSubType:async()=> 'chromium'},
  './config':{baseAPIURL:'https://api.test/api/',getFullAppVersion:()=> 'test-app',routes:[],incompatibleSoftware:['blocker'],apiDomainsExclusion:['api.test']},'./tools/translate':{c:translate},
 };
 const run=(file,localMocks,globals={})=>{const exports={},filename=path.resolve(__dirname,'../vendor/proton-source/source/js',file+'.ts');vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Promise,URL,Headers,Response,...globals,require:id=>{if(!localMocks[id])return require('./helpers/load-ts.cjs')(path.resolve(path.dirname(filename),id+'.ts'),globals);return localMocks[id];}},{filename});return exports;};
 let request=async()=>json({Code:1000,ok:true});
 const client=run('httpClient',mocks,{chrome:{runtime:{},storage:{local:area,session:area,onChanged:{addListener:fn=>{onStorage=fn;}}}},fetch:async(url,init)=>{calls.push({url,init});return request();}});
 const api=run('api',{'./httpClient':client,'./config':mocks['./config'],'./tools/matchDomainList':{matchDomainList:()=>false},'./tools/broadcastMessage':{broadcastMessage:(...args)=>events.push(args)},'./tools/update':{getUpdateError:async()=>update,setUpdateError:value=>{update=value;}}});
 return {api,calls,data,events,setReply:fn=>{request=fn;},setUpdate:value=>{update=value;},switchAccount:()=>{epoch++;state={uid:'B',accessToken:'b',refreshToken:'rB'};},externalSwitch:()=>{state={uid:'B',accessToken:'b',refreshToken:'rB'};onStorage({'superVpn:session':{oldValue:{uid:'A'},newValue:{uid:'B'}}},'local');}};
}
test('real API facade preserves service headers, builders, native cooldown persistence and 304 errors',async()=>{
 const f=adapterFixture();assert.equal((await f.api.fetchJson('vpn/v2',undefined,undefined,(_response,data)=>data)).ok,true);
 assert.equal(f.calls[0].init.headers.get('x-pm-appversion'),'test-app');assert.equal(f.calls[0].init.headers.get('x-pm-locale'),'pt-BR');
 f.setReply(async()=>json({Code:503,Error:'Wait'},503,{'Retry-After':'60'}));await assert.rejects(f.api.fetchJson('vpn/next'),error=>error.Code===503);await assert.rejects(f.api.fetchJson('vpn/next'),error=>error.Code===503);
 assert.equal(f.calls.length,2);assert.ok(Object.keys(f.data).every(key=>key.startsWith('superVpn:httpCooldown:')));
 assert.ok(!JSON.stringify(f.data).includes('private-old'));
 f.setReply(async()=>new Response(null,{status:304}));await assert.rejects(f.api.fetchJson('other'),error=>f.api.isNotModified(error));
});
test('force-upgrade responses remain gated and never issue another network request',async()=>{
 const f=adapterFixture();f.setReply(async()=>json({Code:5003,Error:'Upgrade required'},403));
 await assert.rejects(f.api.fetchJson('vpn/v2'),error=>error.Code===5003);await assert.rejects(f.api.fetchJson('vpn/v2'),error=>error.Code===5003);assert.equal(f.calls.length,1);assert.equal(f.events.length,2);
});
test('real facade still detects blocking software without exposing its HTML payload',async()=>{
 const f=adapterFixture();f.setReply(async()=>new Response('<html>blocker private payload</html>'));
 await assert.rejects(f.api.fetchJson('vpn/v2'),error=>error.message.includes('blocker')&&!error.message.includes('private payload'));
});

test('failed session refresh also marks the auth budget so outer clients cannot refresh again',async()=>{
 const f=fixture();f.ports.fetch=async()=>json({Code:401,Error:'Expired'},401);
 f.ports.refresh=async()=>{f.refreshes.push(1);throw new HttpError('VpnHttpRejected',401,'Refresh rejected',401);};
 await assert.rejects(f.client.json('vpn/v2'),error=>error.authRetried===true&&error.httpStatus===401);assert.equal(f.refreshes.length,1);
});

test('account adapters respect a consumed transport auth retry but keep their legacy fallback for unhandled 401',async()=>{
 for(const name of ['getUser','getPmUser'])for(const consumed of [true,false]){
  let refreshes=0,calls=0;const error={httpStatus:401,Code:401,Error:'expired',authRetried:consumed};const user={ID:'user',VPN:{MaxTier:0}};
  const run=promise=>Promise.resolve(promise).catch(()=>{});
  const mocks={
   '../../api':{fetchJson:async()=>{if(++calls===1)throw error;return user;},isUnauthorizedError:e=>e.httpStatus===401},
   '../readSession':{readSession:async()=>({uid:'A'})},'../refreshToken':{refreshToken:async()=>{refreshes++;}},'../getAccessToken':{getAccessToken:async()=> 'token'},
   '../../tools/getCacheAge':{getCacheAge:()=>1000000},'../../tools/activity':{getElapsedMillisecondsSinceLastActivity:async()=>0},
   '../../tools/getRuntime':{getRuntime:()=>({sendMessage:async()=>{}})},'../../tools/milliSeconds':{milliSeconds:{fromSeconds:n=>n*1000,fromHours:n=>n*3600000}},
   '../../state':{isLoggedIn:()=>true,logIn:()=>{}},'./getPmUser':{fetchPmUser:async()=>{}},'../../tools/triggerPromise':{triggerPromise:run,catchPromise:run},
   '../../vpn/checkNetwork':{checkNetwork:()=>{}},'./storedUser':{storedUser:{setValue:async()=>{}}},'./loadCachedUser':{loadCachedUser:async()=>({})},
   './User':{isUserResult:()=>false},'./PmUser':{isPmUserResult:()=>false},'./storedPmUser':{storedPmUser:{load:async()=>({}),set:async()=>{}}},
   '../../tools/GroupResponder':{GroupResponder:class{handle(fn){return fn();}}},
   '../../intervals':{getIdleThreshold:()=>1e9,getUserBlockingUpdateTTL:()=>0,getUserTTL:()=>100,getPmUserTTL:()=>100},
   '../../messaging/MessageType':{BackgroundData:{USER:'user'}},
  };
  const exports={},filename=path.resolve(__dirname,'../vendor/proton-source/source/js/account/user',name+'.ts');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Promise,Date,require:id=>{if(!mocks[id])return require('./helpers/load-ts.cjs')(path.resolve(path.dirname(filename),id+'.ts'));return mocks[id];}},{filename});
  if(consumed){await assert.rejects(exports[name](true));assert.equal(refreshes,0);assert.equal(calls,1);}
  else{assert.equal((await exports[name](true)).ID,'user');assert.equal(refreshes,1);assert.equal(calls,2);}
 }
});


test('real transport adapter discards results after an account change in another extension page',async()=>{
 const f=adapterFixture(),response=deferred();f.setReply(()=>response.promise);
 const pending=f.api.fetchJson('vpn/v2');await tick();f.externalSwitch();response.resolve(json({oldAccount:true}));
 await assert.rejects(pending,error=>error.code==='VpnHttpSessionChanged');assert.equal(f.calls.length,1);
});
