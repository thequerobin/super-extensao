const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(relative,mocks={},globals={}){
 const file=path.resolve(__dirname,'..',relative),exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,setTimeout,clearTimeout,URL,URLSearchParams,Uint8Array,Promise,Date,crypto:require('node:crypto').webcrypto,btoa,chrome:globals.chrome,...globals,require:id=>mocks[id] || (id.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),id+'.ts')),mocks,globals):{})},{filename:file});return exports;
}
const {LoginFlow,forkPayload,isAccountUrl}=load('vpn/engine/login.ts');
const {WebRTCProtection,WebRTCState}=load('vpn/engine/webrtc.ts');
const {chromiumPrivacy}=load('vpn/engine/chromium-privacy.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const session={uid:'uid',accessToken:'private-access',refreshToken:'private-refresh'};
function loginFixture(shared={}) {
 let now=10000,generation=0,nonce=0;const writes=[],exchanges=[],saves=[];
 const ports={read:async()=>shared.value,write:async value=>{writes.push(value);shared.value=value;},remove:async()=>{delete shared.value;},nonce:()=>String.fromCharCode(65+nonce++).repeat(43),authorize:(state,options)=>options.host+'/authorize?state='+state,exchange:async selector=>{exchanges.push(selector);return {...session};},capture:()=>generation,save:async(value,expected)=>{if(expected!==generation)return false;saves.push(value);generation++;return true;},now:()=>now};
 const flow=new LoginFlow(ports);
 return {flow,ports,shared,writes,exchanges,saves,begin:opts=>flow.begin({host:'https://account.proton.me',...opts}),complete:(state='A'.repeat(43),extra={})=>flow.complete({state,selector:'selector',...extra}),advance:ms=>{now+=ms;},sessionChanged:()=>{generation++;}};
}
test('owned login uses official HTTPS origins and rejects credentials, paths, lookalikes and invalid options',async()=>{
 const f=loginFixture();for(const host of ['http://account.proton.me','https://account.proton.me.evil.test','https://user@account.proton.me','https://account.proton.me/path','https://account.proton.me/?x=1'])await assert.rejects(f.begin({host}));
 assert.equal(f.writes.length,0);assert.equal(isAccountUrl('https://account.proton.me/authorize'),true);assert.equal(isAccountUrl('https://account.protonvpn.com/'),true);assert.equal(isAccountUrl('https://evil.test/?account.proton.me'),false);
 await assert.rejects(f.begin({action:'invalid'}));await assert.rejects(f.begin({independent:'yes'}));
});
test('begin durably writes only bounded login state and metadata before returning its URL',async()=>{
 const f=loginFixture(),save=deferred();f.ports.write=async value=>{f.writes.push(value);await save.promise;f.shared.value=value;};let done=false;const task=f.begin({partnerId:'partner',independent:true}).then(v=>{done=true;return v;});await tick();assert.equal(done,false);save.resolve();const url=new URL(await task);assert.equal(url.searchParams.get('state'),'A'.repeat(43));assert.equal(f.writes[0].expiresAt-f.writes[0].createdAt,900000);assert.ok(!JSON.stringify(f.writes).includes('private'));assert.equal(f.writes[0].partnerId,'partner');
});
test('login state survives worker suspension and is consumed exactly once across duplicate requests',async()=>{
 const shared={},f=loginFixture(shared);await f.begin();const resumed=loginFixture(shared),gate=deferred();resumed.ports.exchange=async selector=>{resumed.exchanges.push(selector);await gate.promise;return {...session};};const a=resumed.complete(),b=resumed.complete();await assert.rejects(b,/InvalidState/);gate.resolve();await a;assert.equal(resumed.exchanges.length,1);assert.equal(resumed.saves.length,1);assert.equal(shared.value.claimed,true);assert.equal(await resumed.flow.owns('A'.repeat(43)),true);const restarted=loginFixture(shared);await assert.rejects(restarted.complete(),/InvalidState/);assert.equal(restarted.exchanges.length,0);
});
test('expired, future and foreign login states cannot exchange selectors',async()=>{
 const f=loginFixture();await f.begin();await assert.rejects(f.complete('B'.repeat(43)),/InvalidState/);f.advance(900000);assert.equal(await f.flow.owns('A'.repeat(43)),false);await assert.rejects(f.complete(),/InvalidState/);assert.equal(f.exchanges.length,0);
 const g=loginFixture();await g.begin();g.advance(-1);await assert.rejects(g.complete(),/InvalidState/);
});
test('latest login supersedes earlier pages and old exchanges cannot save after a new begin',async()=>{
 const f=loginFixture(),gate=deferred();await f.begin();f.ports.exchange=()=>gate.promise;const task=f.complete();await tick();await f.begin();gate.resolve({...session});await assert.rejects(task,/Superseded/);assert.equal(f.saves.length,0);assert.equal(await f.flow.owns('B'.repeat(43)),true);
});
test('logout invalidates a pending exchange immediately and clears its durable state before restart',async()=>{
 const f=loginFixture(),gate=deferred();await f.begin();f.ports.exchange=()=>gate.promise;const task=f.complete();await tick();const logout=f.flow.invalidate();gate.resolve({...session});await assert.rejects(task,/Superseded/);await logout;assert.equal(f.saves.length,0);assert.equal(f.shared.value,undefined);assert.equal(await loginFixture(f.shared).flow.owns('A'.repeat(43)),false);
});
test('session generation changes and expiration during exchange block the commit',async()=>{
 for(const change of ['session','time']){const f=loginFixture(),gate=deferred();await f.begin();f.ports.exchange=()=>gate.promise;const task=f.complete();await tick();if(change==='session')f.sessionChanged();else f.advance(900000);gate.resolve({...session});await assert.rejects(task,change==='session'?/Superseded/:/Expired/);assert.equal(f.saves.length,0);}
});
test('storage errors prevent token exchange and a malformed session never reaches persistence',async()=>{
 const f=loginFixture();f.ports.write=async()=>{throw Error('storage');};await assert.rejects(f.begin(),/storage/);assert.equal(f.exchanges.length,0);
 const g=loginFixture();await g.begin();g.ports.write=async()=>{throw Error('storage');};await assert.rejects(g.complete(),/storage/);assert.equal(g.exchanges.length,0);
 const h=loginFixture();await h.begin();h.ports.exchange=async()=>({uid:'uid',accessToken:'private-access'});await assert.rejects(h.complete(),/InvalidSession/);assert.equal(h.saves.length,0);
});
test('failed exchanges are sanitized and cannot be replayed while persistence metadata is retained on success',async()=>{
 const f=loginFixture();await f.begin();f.ports.exchange=async()=>{throw Error('private-token-url');};await assert.rejects(f.complete(),e=>e.message==='VpnSignInExchangeFailed');await assert.rejects(f.complete(),/InvalidState/);
 const g=loginFixture();await g.begin({partnerId:'partner',independent:true});await g.complete(undefined,{persistent:true});assert.equal(g.saves[0].persistent,true);assert.equal(g.saves[0].partnerId,'partner');
});
test('fork payload parsing admits only bounded state/selector and strips unrelated account secrets',()=>{
 const state='A'.repeat(43);const parsed=forkPayload({extension:'ours',payload:{state,selector:'x/y?z',persistent:1,keyPassword:'private'}},'ours');assert.equal(parsed.persistent,false);assert.equal(parsed.keyPassword,undefined);assert.equal(forkPayload({extension:'other',payload:{state,selector:'s'}},'ours'),undefined);for(const selector of ['',12,'a\nb','x'.repeat(4097)])assert.equal(forkPayload({payload:{state,selector}},'ours'),undefined);
});
function privacyFixture(){
 let details={value:'default',levelOfControl:'controllable_by_this_extension'};const calls=[];
 const ports={available:()=>true,read:async()=>({...details}),write:async value=>{calls.push(['set',value]);details={value,levelOfControl:'controlled_by_this_extension'};},clear:async()=>{calls.push(['clear']);details={value:'default',levelOfControl:'controllable_by_this_extension'};}};
 return {controller:new WebRTCProtection(ports),ports,calls,setDetails:value=>{details=value;},details:()=>details};
}
test('owned WebRTC policy confirms ownership and value before reporting protection',async()=>{
 const f=privacyFixture();assert.equal(await f.controller.apply(WebRTCState.DISABLED),true);assert.equal(f.details().value,'disable_non_proxied_udp');await f.controller.apply(WebRTCState.CLEAR);assert.equal(f.details().value,'default');assert.equal(f.calls.length,2);
 for(const levelOfControl of ['controlled_by_other_extensions','not_controllable']){const g=privacyFixture();g.setDetails({levelOfControl,value:'default'});await assert.rejects(g.controller.apply(WebRTCState.DISABLED),/Unavailable/);assert.equal(g.calls.length,0);}
});
test('matching default values without extension ownership are not mistaken for applied protection',async()=>{
 const f=privacyFixture();f.ports.write=async()=>{};f.setDetails({value:'disable_non_proxied_udp',levelOfControl:'controllable_by_this_extension'});await assert.rejects(f.controller.apply(WebRTCState.DISABLED),/Unavailable/);
});
test('privacy calls are serialized and restoration waits for an in-flight protection write',async()=>{
 const f=privacyFixture(),gate=deferred(),original=f.ports.write;f.ports.write=async value=>{await gate.promise;await original(value);};const on=f.controller.apply(WebRTCState.DISABLED),off=f.controller.apply(WebRTCState.CLEAR);await tick();assert.equal(f.calls.length,0);gate.resolve();await Promise.all([on,off]);assert.deepEqual(f.calls,[['set','disable_non_proxied_udp'],['clear']]);assert.equal(f.details().value,'default');
});
test('restoration does not overwrite another extension and failures do not poison the queue',async()=>{
 const f=privacyFixture();f.ports.clear=async()=>{};f.setDetails({value:'disable_non_proxied_udp',levelOfControl:'controlled_by_other_extensions'});assert.equal(await f.controller.apply(WebRTCState.CLEAR),true);assert.equal(f.details().levelOfControl,'controlled_by_other_extensions');f.setDetails({value:'disable_non_proxied_udp',levelOfControl:'controlled_by_this_extension'});await assert.rejects(f.controller.apply(WebRTCState.CLEAR),/RestoreFailed/);f.ports.clear=async()=>f.setDetails({levelOfControl:'controllable_by_this_extension',value:'default'});assert.equal(await f.controller.apply(WebRTCState.CLEAR),true);
});
test('missing privacy support and invalid states do not perform writes',async()=>{
 const f=privacyFixture();f.ports.available=()=>false;assert.equal(await f.controller.apply(WebRTCState.DISABLED),false);await assert.rejects(f.controller.apply('invalid'),/InvalidState/);assert.equal(f.calls.length,0);
});
test('Chromium privacy adapter uses regular scope and observes callback errors on get, set and clear',async()=>{
 const calls=[],api={runtime:{},privacy:{network:{webRTCIPHandlingPolicy:{get:(options,done)=>{calls.push(['get',options]);done({levelOfControl:'controlled_by_this_extension',value:'disable_non_proxied_udp'});},set:(options,done)=>{calls.push(['set',options]);done();},clear:(options,done)=>{calls.push(['clear',options]);done();}}}}};
 const adapter=chromiumPrivacy(api);await adapter.read();await adapter.write(WebRTCState.DISABLED);await adapter.clear();assert.equal(calls[0][1].incognito,false);assert.equal(calls[1][1].scope,'regular');assert.equal(calls[2][1].scope,'regular');
 api.runtime.lastError={message:'private-api-details'};for(const call of [()=>adapter.read(),()=>adapter.write(WebRTCState.DISABLED),()=>adapter.clear()])await assert.rejects(call(),e=>e.message==='VpnWebRTCSettingsFailed');
 delete api.runtime.lastError;api.privacy.network.webRTCIPHandlingPolicy.get=()=>{throw Error('native');};await assert.rejects(adapter.read(),/SettingsFailed/);
});
function nativeLoginFixture(){
 const values={},requests=[],saved=[];let generation=0;
 const chrome={runtime:{},storage:{local:{get:(key,done)=>done({[key]:values[key]}),set:(data,done)=>{Object.assign(values,data);done();},remove:(key,done)=>{delete values[key];done();}}}};
 const mocks={
 './sessionStore':{sessionStore:{capture:()=>generation,saveIfCurrent:async(value,expected)=>{if(generation!==expected)return false;saved.push(value);generation++;return true;}}},
 '../api':{fetchJson:async url=>{requests.push(url);return {UID:'uid',AccessToken:'private-access',RefreshToken:'private-refresh'};}},
 '../config':{getFullAppVersion:()=> 'extension-v1'},
 };
 const {loginFlow}=load('vendor/proton-source/source/js/account/loginFlow.ts',mocks,{chrome});
 return {flow:loginFlow,chrome,values,requests,saved};
}
test('real login adapter retains service URL contracts, strong nonce and encoded selector without persisting secrets',async()=>{
 const f=nativeLoginFixture();const url=new URL(await f.flow.begin({host:'https://account.proton.me',action:'signup',partnerId:'partner',independent:true}));
 assert.equal(url.pathname,'/authorize');assert.equal(url.searchParams.get('app'),'proton-vpn-browser-extension');assert.equal(url.searchParams.get('t'),'2');assert.equal(url.searchParams.get('appVersion'),'extension-v1');assert.equal(url.searchParams.get('independent'),'1');const state=url.searchParams.get('state');assert.match(state,/^[A-Za-z0-9_-]{43}$/);
 const next=new URL(await f.flow.begin({host:'https://account.proton.me'})).searchParams.get('state');assert.notEqual(next,state);await f.flow.complete({state:next,selector:'private/selector?x=#',persistent:true});assert.equal(f.requests[0],'auth/sessions/forks/private%2Fselector%3Fx%3D%23');assert.equal(f.saved[0].persistent,true);assert.ok(!JSON.stringify(f.values).includes('private'));assert.ok(!JSON.stringify(f.values).includes('AccessToken'));
});
test('real login adapter fails closed on native storage errors',async()=>{
 const f=nativeLoginFixture();f.chrome.runtime.lastError={message:'native private details'};await assert.rejects(f.flow.begin({host:'https://account.proton.me'}),e=>e.message==='VpnStorageFailed');assert.equal(f.requests.length,0);
});
test('real fork facade commits through the owned flow and returns only the public acknowledgment',async()=>{
 const f=nativeLoginFixture();const state=new URL(await f.flow.begin({host:'https://account.proton.me'})).searchParams.get('state');let refresh=0;
 const mocks={
 '../account/fork/consumeFork':{consumeFork:input=>f.flow.complete(input)},
 '../config':{appId:'ours'},'../tools/triggerPromise':{triggerPromise:p=>p.catch(()=>{})},
 '../account/user/getUser':{getFreshUser:async()=>{refresh++;}},'../log/log':{error:()=>{}},
 '../tools/translate':{c:()=>({t:parts=>parts.join('')})},'../tools/getErrorMessage':{getErrorAsString:e=>e.message},
 };
 const {forkSession}=load('vendor/proton-source/source/js/messaging/forkSession.ts',mocks);
 const message={extension:'ours',token:'correlation',payload:{state,selector:'selector',persistent:true,keyPassword:'private-password'}};
 const response=await forkSession(message);assert.equal(response.type,'success');assert.equal(response.token,'correlation');assert.equal(refresh,1);assert.equal(f.saved.length,1);assert.ok(!JSON.stringify(response).includes('private'));assert.equal((await forkSession(message)).type,'error');assert.equal(f.saved.length,1);assert.equal(refresh,1);
});
test('request-fork facade delegates pending state to worker and openForkTab awaits native opening failures',async()=>{
 let call;const mocks={'../../tools/sendMessageToBackground':{sendMessageToBackground:async(type,data)=>{call={type,data};return 'https://account.proton.me/authorize';}}};
 const {requestFork}=load('vendor/proton-source/source/js/account/fork/requestFork.ts',mocks);assert.equal(await requestFork({host:'https://account.proton.me'}),'https://account.proton.me/authorize');assert.equal(call.type,'beginLogin');
 const {openForkTab}=load('vendor/proton-source/source/js/account/openForkTab.ts',{
 './fork/requestFork':{requestFork:async()=> 'url'},'../config':{baseDomainURL:'https://account.proton.me'},
 '../tools/exponentialBackoff':{isSuspended:async()=>false,suspend:()=>{}},
 '../tools/openTab':{openTab:async()=>{throw Error('tab failed');}},
 '../tools/getTabs':{},'../tools/openTabs':{},'../tools/getGlobalBrowser':{},
 });await assert.rejects(openForkTab(),/tab failed/);
});
test('page WebRTC facade delegates writes to the worker while native worker facade uses the own controller',async()=>{
 const calls=[],mocks={'./state':{WebRTCState},'./privacyController':{privacyController:{apply:async value=>{calls.push(['native',value]);return true;}}},'../tools/sendMessageToBackground':{sendMessageToBackground:async(type,value)=>{calls.push([type,value]);return true;}}};
 const page=load('vendor/proton-source/source/js/webrtc/setWebRTCState.ts',mocks,{document:{}});await page.setWebRTCState(WebRTCState.CLEAR);
 const worker=load('vendor/proton-source/source/js/webrtc/setWebRTCState.ts',mocks);await worker.setWebRTCState(WebRTCState.DISABLED);assert.deepEqual(calls,[['setWebRTC','clear'],['native','disable_non_proxied_udp']]);
});
test('worker privacy route follows current connection and preference, rejecting late UI results after disconnect',async()=>{
 const calls=[];let state='on',enabled=true,current=true,configGate;
 const mocks={
 '../vpn/protectionPage':{},
 '../account/loginFlow':{loginFlow:{begin:async value=>{calls.push(['begin',value]);return 'url';}}},
 '../webrtc/privacyController':{privacyController:{apply:async value=>{calls.push(['privacy',value]);return true;}}},
 '../webrtc/state':{WebRTCState},'../vpn/features/PreventWebrtcLeak':{PreventWebrtcLeak:{create:async()=>({getConfig:async()=>{if(configGate)await configGate.promise;return {value:enabled};}})}},
 '../state':{connectionLifecycle:{guard:()=>()=>current},getCurrentState:()=>({name:state})},
 './MessageType':{BackgroundAction:{BEGIN_LOGIN:'beginLogin',SET_WEBRTC:'setWebRTC'},BackgroundData:{},StateChange:{},PermissionGrant:{},SettingChange:{}},
 };
 // Unused protocol dependencies are IO stubs; only the real new routes execute.
 const file=path.resolve(__dirname,'../vendor/proton-source/source/js/messaging/messaging.ts'),exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Promise,require:id=>mocks[id]||{}},{filename:file});
 await exports.routeMessage({type:'beginLogin',data:{host:'https://account.proton.me'}});assert.equal(calls[0][0],'begin');
 await exports.routeMessage({type:'setWebRTC',data:'clear'});assert.equal(calls.at(-1)[1],WebRTCState.DISABLED);enabled=false;await exports.routeMessage({type:'setWebRTC',data:'disable_non_proxied_udp'});assert.equal(calls.at(-1)[1],WebRTCState.DISABLED);
 state='off';await exports.routeMessage({type:'setWebRTC',data:'disable_non_proxied_udp'});assert.equal(calls.at(-1)[1],'clear');
 await assert.rejects(exports.routeMessage({type:'setWebRTC',data:'invalid'}),/InvalidState/);
 state='on';configGate=deferred();const count=calls.length,task=exports.routeMessage({type:'setWebRTC',data:'clear'});await tick();current=false;state='off';configGate.resolve();assert.equal(await task,false);assert.equal(calls.length,count);
});
