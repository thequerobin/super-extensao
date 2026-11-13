const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(relative,mocks={}) {
 const file=path.resolve(__dirname,'..',relative),exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Promise,Date,Math,Map,Set,JSON,Number,String,Error,Array,Object,encodeURIComponent,chrome:mocks.$chrome,require:id=>mocks[id]|| (id.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),id+'.ts')),mocks):{})},{filename:file});
 return exports;
}
const {ServerCatalog}=load('vpn/engine/catalog.ts');
const selection=load('vpn/engine/selection.ts');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const logical=(id='a',extra={})=>({ID:id,Name:'MX-FREE#1',Features:0,Tier:0,EntryCountry:'MX',ExitCountry:'MX',Score:1,Enabled:true,AutoConnectable:true,Servers:[{Domain:id+'.test',Status:1}],...extra});
function fixture(initial) {
 let now=10000,revision='0',owner='A',saved=initial;
 const writes=[],calls=[];
 const cache=(value=[logical()])=>({value,time:now,lastModified:'Wed, 11 Nov 2026 00:00:00 GMT',statusId:'s',lastLoadUpdate:now,owner});
 const ports={now:()=>now,context:async()=>({owner,revision}),current:c=>c.revision===revision&&c.owner===owner,read:async()=>saved,write:async c=>{writes.push(c);saved=c;},remove:async()=>{saved=undefined;},fetch:async old=>{calls.push(['fetch',old]);return cache();},refresh:async old=>{calls.push(['loads',old]);return {...old,value:[logical('updated')],lastLoadUpdate:now};},notModified:e=>e.httpStatus===304,transient:e=>e.transient===true,freshness:async()=>100,blockingTTL:()=>1000,loadTTL:async()=>50,compatible:async c=>!!c.statusId};
 return {client:new ServerCatalog(ports),ports,calls,writes,cache,advance:ms=>{now+=ms;},setCache:c=>{saved=c;},saved:()=>saved,switchAccount:()=>{owner='B';revision='1';},changeRevision:()=>{revision+='x';}};
}
test('catalog awaits durable writes and coalesces simultaneous initial reads',async()=>{
 const f=fixture(),network=defer(),write=defer();f.ports.fetch=async()=>{f.calls.push(['fetch']);return network.promise;};f.ports.write=async value=>{f.writes.push(value);await write.promise;};
 const a=f.client.get(),b=f.client.get(true);await tick();assert.equal(f.calls.length,1);let done=false;a.then(()=>done=true);network.resolve(f.cache());await tick();assert.equal(done,false);write.resolve();assert.equal((await a)[0].ID,'a');await b;assert.equal(f.writes.length,1);
});
test('fresh persistent cache survives a new catalog instance without refetching or sorting in place',async()=>{
 const f=fixture();const value=[logical('b'),logical('a')];f.setCache(f.cache(value));assert.equal((await f.client.get())[0].ID,'b');const next=new ServerCatalog(f.ports);assert.equal((await next.get())[0].ID,'b');assert.equal(f.calls.length,0);assert.equal(value[0].ID,'b');
});
test('stale displayable catalog returns promptly and refreshes once in background',async()=>{
 const f=fixture(),pending=defer();f.setCache(f.cache());f.advance(101);f.ports.fetch=async()=>{f.calls.push(['fetch']);return pending.promise;};
 assert.equal((await f.client.get())[0].ID,'a');await f.client.get();assert.equal(f.calls.length,1);pending.resolve(f.cache([logical('new')]));await tick();assert.equal((await f.client.get())[0].ID,'new');
});
test('obsolete catalog blocks on update and 304 preserves raw validators and load metadata',async()=>{
 const f=fixture();f.setCache(f.cache());f.advance(1001);f.ports.fetch=async old=>{f.calls.push(old);throw {httpStatus:304};};assert.equal((await f.client.get())[0].ID,'a');assert.equal(f.writes[0].time,11001);assert.equal(f.writes[0].lastModified,'Wed, 11 Nov 2026 00:00:00 GMT');assert.equal(f.writes[0].statusId,'s');assert.equal(f.writes[0].lastLoadUpdate,10000);
});
test('transient failures use bounded stale data without marking it fresh',async()=>{
 const f=fixture();f.setCache(f.cache());f.advance(1001);f.ports.fetch=async()=>{throw {transient:true};};assert.equal((await f.client.get())[0].ID,'a');assert.equal(f.writes.length,0);f.advance(86400000);await assert.rejects(f.client.get());
});
test('authentication and force upgrade failures cannot be hidden by stale fallback',async()=>{
 for(const Code of [401,5003]){const f=fixture();f.setCache(f.cache());f.advance(1001);f.ports.fetch=async()=>{throw {Code};};await assert.rejects(f.client.get(),e=>e.Code===Code);assert.equal(f.writes.length,0);}
});
test('foreign, legacy unscoped, incompatible and future caches trigger a clean fetch',async()=>{
 for(const extra of [{owner:'B'},{owner:undefined},{statusId:undefined},{time:999999}]){const f=fixture();f.setCache({...f.cache(),...extra});await f.client.get();assert.equal(f.calls.length,1);assert.equal(f.calls[0][1],undefined);}
});
test('account switch while the catalog is loading rejects results and performs no write',async()=>{
 const f=fixture(),pending=defer();f.ports.fetch=()=>pending.promise;const task=f.client.get();await tick();f.switchAccount();pending.resolve(f.cache());await assert.rejects(task,/VpnCatalogChanged/);assert.equal(f.writes.length,0);await f.client.get().catch(()=>{});
});
test('catalog invalidation prevents late responses from resurrecting removed data',async()=>{
 const f=fixture(),pending=defer();f.ports.fetch=()=>pending.promise;const task=f.client.get();await tick();await f.client.forget();pending.resolve(f.cache());await assert.rejects(task,/VpnCatalogChanged/);assert.equal(f.saved(),undefined);assert.equal(f.writes.length,0);
});
test('forget is ordered after an already started write and before subsequent writes',async()=>{
 const f=fixture(),blocked=defer(),events=[];f.ports.write=async()=>{events.push('start-write');await blocked.promise;events.push('write');};f.ports.remove=async()=>{events.push('remove');};
 const task=f.client.get();await tick();const removing=f.client.forget();blocked.resolve();await assert.rejects(task,/VpnCatalogChanged/);await removing;assert.deepEqual(events,['start-write','write','remove']);
});
test('load refresh compares timestamp age and persists the returned timestamp',async()=>{
 const f=fixture();f.setCache(f.cache());f.advance(51);await f.client.get(true);await tick();assert.equal(f.calls[0][0],'loads');assert.equal(f.saved().lastLoadUpdate,10051);await f.client.get(true);await tick();assert.equal(f.calls.length,1);
});
test('background failures do not poison later refresh attempts or freshness timestamps',async()=>{
 const f=fixture();f.setCache(f.cache());f.advance(101);f.ports.fetch=async()=>{f.calls.push(1);throw Error('offline');};await f.client.get();await tick();await f.client.get();await tick();assert.equal(f.calls.length,2);assert.equal(f.saved().time,10000);
});
test('failed storage or malformed fetch does not publish a fresh catalog',async()=>{
 const f=fixture();f.ports.write=async()=>{throw Error('storage');};await assert.rejects(f.client.get(),/storage/);
 const g=fixture();g.ports.fetch=async()=>({time:1,value:null});await assert.rejects(g.client.get(),/VpnCatalogInvalidResponse/);
});
test('best selection obeys health, tier, auto-connectability and finite scores with stable ties',()=>{
 const a=logical('a'),b=logical('b');const blocked=[logical('paid',{Tier:2,Score:0}),logical('down',{Enabled:false,Score:0}),logical('manual',{AutoConnectable:false,Score:0}),logical('invalid',{Score:NaN})];
 assert.equal(selection.bestCandidate([b,...blocked,a],0,()=>true).ID,'a');assert.equal(selection.bestCandidate([a,b],0,()=>false),undefined);assert.equal(selection.bestCandidate([b,a],0,()=>true).ID,'a');
});
test('choice filtering requires every requested feature and normalizes numeric IDs including zero',()=>{
 const list=[logical(0,{Features:1}),logical('two',{Features:5}),logical('restricted',{Features:32})];
 assert.deepEqual(selection.filterByChoice(list,{requiredFeatures:5}).map(x=>x.ID),['two']);assert.equal(selection.filterByChoice(list,{logicalId:'0'})[0].ID,0);assert.equal(selection.filterByChoice(list,{excludedFeatures:1}).length,0);
});
test('manual restore preserves a non-auto-connectable server and never substitutes another server',()=>{
 const exact=logical('chosen',{AutoConnectable:false,Score:undefined}),other=logical('other',{Score:0});
 assert.equal(selection.restoreChoice([other,exact],{logicalId:'chosen'},0,()=>true),exact);assert.equal(selection.restoreChoice([other],{logicalId:'chosen'},0,()=>true),undefined);assert.equal(selection.restoreChoice([{...exact,Enabled:false},other],{logicalId:'chosen'},0,()=>true),undefined);assert.equal(selection.restoreChoice([{...exact,Tier:2}],{logicalId:'chosen'},0,()=>true),undefined);
 assert.equal(selection.permitsAutomaticSwitch({logicalId:'chosen'}),false);assert.equal(selection.permitsAutomaticSwitch({logicalId:'chosen',pick:'fastest'}),true);assert.equal(selection.permitsAutomaticSwitch({pick:'random'}),true);
});
test('random selection only considers eligible servers and handles empty pools',()=>{
 const list=[logical('a'),logical('b'),logical('down',{Enabled:false})];assert.equal(selection.randomCandidate(list,0,()=>true,()=>0).ID,'a');assert.equal(selection.randomCandidate(list,0,()=>true,()=>0.99).ID,'b');assert.equal(selection.randomCandidate([],0,()=>true),undefined);
});
test('physical selection prefers healthy endpoints and never falls back to confirmed-down ones',()=>{
 const down={Domain:'down',Status:0},unknown={Domain:'unknown'},up={Domain:'up',Status:1};assert.equal(selection.pickEndpoint([down,unknown,up],()=>0).Domain,'up');assert.equal(selection.pickEndpoint([down]),undefined);assert.equal(selection.pickEndpoint([{Domain:'disabled',Status:1,Enabled:false}]),undefined);assert.equal(selection.pickEndpoint([down,unknown]).Domain,'unknown');assert.equal(selection.pickEndpoint([]),undefined);assert.equal(selection.pickEndpoint([{Domain:'down',Status:1,ServicesDown:3}]),undefined);
});
test('alternative policy relaxes country only after exhausting same-country choices and retains Secure Core and tier',()=>{
 const current=logical('current'),foreign=logical('foreign',{ExitCountry:'US',Score:0}),local=logical('local',{Score:5});const list=[current,logical('paid',{Tier:2,Score:0}),logical('core',{Features:1,Score:0}),foreign,local];assert.equal(selection.alternativeCandidate(list,'current',0,()=>true).ID,'local');assert.equal(selection.alternativeCandidate(list.filter(x=>x.ID!=='local'),'current',0,()=>true).ID,'foreign');assert.equal(selection.alternativeCandidate(list,'missing',0,()=>true),undefined);
});
test('catalog sort is natural, deterministic and does not mutate its input',()=>{
 const list=[logical('10',{Name:'MX-FREE#10'}),logical('2',{Name:'MX-FREE#2'}),logical('search',{SearchScore:9})];assert.deepEqual(Array.from(selection.sortCatalog(list),x=>x.ID),['search','2','10']);assert.equal(list[0].ID,'10');
});
test('owned ranking is repeatable, uses country aliases and rejects non-finite capacity',()=>{
 const point={Latitude:0,Longitude:0};const args=[true,true,0.2,0,0,'UK',point,point,point,'gb'];const value=selection.rankServer(...args);assert.equal(selection.rankServer(...args),value);assert.ok(value<selection.rankServer(...args.slice(0,-1),'US'));assert.equal(selection.rankServer(true,true,NaN,0,0,'GB',point,point,point,'GB'),Infinity);
});
test('remember upserts a lookup once without refreshing catalog age and rejects a stale account lease',async()=>{
 const f=fixture();f.setCache(f.cache());const lease=await f.client.capture();await f.client.remember(logical('a',{Name:'updated'}),x=>String(x.ID),lease);assert.equal(f.saved().value.length,1);assert.equal(f.saved().value[0].Name,'updated');assert.equal(f.saved().time,10000);f.switchAccount();await assert.rejects(f.client.remember(logical('old'),x=>String(x.ID),lease),/VpnCatalogChanged/);assert.equal(f.saved().value.length,1);
});
function adapterFixture(v2=true) {
 let saved,uid='A',tier=0;const listeners=[],calls=[],store=new Map();let fail,gate;
 const vpnData=()=>({MaxTier:tier,Groups:['group']});
 const service=logical('a',{Name:'MX-FREE#4',EntryLocation:{Latitude:0,Longitude:0},ExitLocation:{Latitude:0,Longitude:0},StatusReference:{Index:0,Cost:0,Penalty:0},Status:1});
 const mocks={
  $chrome:{storage:{onChanged:{addListener:fn=>listeners.push(fn)}}},
  '../account/sessionStore':{sessionStore:{capture:()=>0}},
  '../account/readSession':{readSession:async()=>({uid})},
  '../account/user/loadCachedUser':{loadCachedUser:async()=>({user:{VPN:vpnData()}})},
  '../tools/activity':{getElapsedMillisecondsSinceLastActivity:async()=>0},
  '../tools/storage':{storage:{getItem:async key=>store.get(key)}},
  '../api':{isNotModified:e=>e.httpStatus===304,isNetworkError:e=>e.name==='NetworkError'},
  '../intervals':{getLogicalsTTL:()=>600000,getLogicalsBlockingUpdateTTL:()=>4800000},
  './logicalServers':{logicalServers:{get:async()=>saved,set:async c=>{saved=c;},remove:async()=>{saved=undefined;}}},
  './useLogicalsV2':{useLogicalsV2:async()=>v2},
  './getLoadsMaxAge':{getLoadsMaxAge:async()=>60000},
  '../account/getLocation':{getCountryAndCoordinates:async()=>({country:'MX',coordinates:{Latitude:0,Longitude:0}})},
  './getLoads':{getLoads:async()=>({loads:[{Enabled:true,Visible:true,AutoConnectable:true,ServerCapacity:0.2}],time:Date.now()})},
  '../account/fetchWithUserInfo':{fetchWithUserInfo:async(url,init,builder)=>{
   calls.push({url,init});if(gate)await gate.promise;if(fail)throw fail;
   const response={headers:{get:name=>name==='Last-Modified'?'Wed, 11 Nov 2026 00:00:00 GMT':null}};
   const data={LogicalServers:[{...service}],StatusID:'status-1'};
   if(url.endsWith('/loads'))return {LogicalServers:[{ID:'a',Status:0,Load:100}]};
   return builder?builder(response,data):data;
  }},
 };
 const api=load('vendor/proton-source/source/js/vpn/serverCatalog.ts',mocks);
 return {client:api.serverCatalog,calls,store,mocks,saved:()=>saved,setFail:e=>{fail=e;},gate:()=>{gate=defer();return gate;},switchAccount:()=>{const old=uid;uid='B';listeners.forEach(fn=>fn({'superVpn:session':{oldValue:{uid:old},newValue:{uid}}},'local'));},changeTier:()=>{const old=vpnData();tier=2;listeners.forEach(fn=>fn({'superVpn:user':{oldValue:{user:{VPN:old}},newValue:{user:{VPN:vpnData()}}}},'local'));}};
}
test('real v2 adapters preserve conditional date headers, encode include IDs and persist scoped status metadata',async()=>{
 const f=adapterFixture();f.store.set('lookups',{value:{'id&private':Date.now(),'expired':0}});const result=await f.client.get();assert.equal(result[0].ID,'a');assert.match(f.calls[0].url,/IncludeID\[\]=id%26private/);assert.ok(!f.calls[0].url.includes('expired'));assert.equal(f.saved().statusId,'status-1');assert.equal(f.saved().lastModified,'Wed, 11 Nov 2026 00:00:00 GMT');assert.ok(Number.isFinite(f.saved().lastLoadUpdate));assert.match(f.saved().owner,/"A"/);
 f.saved().time-=4800001;f.setFail({httpStatus:304});await f.client.get();assert.equal(f.calls[1].init.headers['If-Modified-Since'],'Wed, 11 Nov 2026 00:00:00 GMT');assert.equal(f.saved().statusId,'status-1');
});
test('real v1 load adapter persists the timestamp and new health without mutating previous cache references',async()=>{
 const f=adapterFixture(false);const previous=(await f.client.get())[0];assert.equal(previous._up,true);f.saved().lastLoadUpdate=Date.now()-60001;const result=await f.client.get(true);assert.equal(result[0]._up,false);assert.equal(previous._up,true);assert.ok(f.saved().lastLoadUpdate>Date.now()-1000);assert.equal(f.calls[1].url,'vpn/v1/loads');
});
test('real catalog adapter rejects an old response after account change in another page',async()=>{
 const f=adapterFixture(),pending=f.gate();const task=f.client.get();await tick();f.switchAccount();pending.resolve();await assert.rejects(task,/VpnCatalogChanged/);assert.equal(f.saved(),undefined);await f.client.get();assert.match(f.saved().owner,/"B"/);
});
test('real catalog adapter fetches a new owner after plan changes instead of using old tier cache',async()=>{
 const f=adapterFixture();await f.client.get();const old=f.saved().owner;f.changeTier();await f.client.get();assert.notEqual(f.saved().owner,old);assert.equal(f.calls.length,2);
});
function stateAdapter(choice) {
 const events=[],ports={};let connected;
 const fakeLifecycle={advance:()=>1,isCurrent:()=>true,guard:()=>()=>true};
 class Machine {constructor(p){Object.assign(ports,p);this.lifecycle=fakeLifecycle;}async connect(data){connected=data;events.push('connect');}}
 const feature={create:async()=>({getConfig:async()=>({value:true})})};
 const mocks={
  '../../../../vpn/engine/state':{ConnectionMachine:Machine},
  '../../../../vpn/engine/diagnostics':load('vpn/engine/diagnostics.ts'),
  '../../../../vpn/engine/selection':selection,
  './log/log':{bind:()=>()=>{}},
  './vpn/lastChoice':{getLastChoice:async()=>choice},
  './vpn/getLogicals':{getSortedLogicals:async()=>[logical('other',{Score:0}),logical('chosen',{AutoConnectable:false})],isLogicalUp:()=>true,shouldStayOnLogical:async()=>false},
  './account/getLocation':{getCountryAndCoordinates:async()=>({country:'MX',coordinates:{}})},
  './account/credentials/getConnectionCredentials':{getCredentials:async()=>{events.push('credentials');return {}; }},
  './account/credentials/guessTierFromCredentials':{guessTierFromCredentials:()=>0},
  './vpn/getAlternatives':{getAlternativeServer:async()=>{events.push('alternative');return {}; }},
  './account/user/getUser':{getUser:async()=>({VPN:{MaxTier:0}})},
  './account/user/getUserMaxTier':{getUserMaxTier:()=>0},
  './account/readSession':{readSession:async()=>({uid:'A'})},
  './vpn/features/AutoConnect':{AutoConnect:feature},
  './vpn/features/SplitTunneling':{SplitTunneling:feature},
  './vpn/features/SecureCore':{SecureCore:feature},
  './vpn/getSecureCorePredicate':{getSecureCorePredicate:()=>()=>true},
  './vpn/getSplitTunnelingConfig':{getSplitTunnelingConfig:()=>({})},
  './vpn/pickServerInLogical':{pickServerInLogical:item=>selection.pickEndpoint(item.Servers)},
  './tools/proxy':{invalidateProxyOperations:()=>{}},
  './vpn/assertServerAccess':{assertServerAccess:()=>{}},
  './vpn/Feature':{Feature:{SECURE_CORE:1}},
  './config':{proxyPort:443},
 };
 const file=path.resolve(__dirname,'../vendor/proton-source/source/js/state.ts'),exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Promise,require:id=>mocks[id]||{}},{filename:file});
 return {api:exports,ports,events,connected:()=>connected};
}
test('real state adapter keeps manual choices during health probes while automatic selections retain failover',async()=>{
 const manual=stateAdapter({logicalId:'chosen',connected:true});await manual.ports.probe({id:'chosen'},()=>true);assert.deepEqual(manual.events,[]);
 const auto=stateAdapter({pick:'fastest',connected:true});await auto.ports.probe({id:'chosen'},()=>true);assert.deepEqual(auto.events,['credentials','alternative']);
});
test('real auto-connect restores the explicit server even when it is not eligible for automatic picks',async()=>{
 const f=stateAdapter({logicalId:'chosen',connected:true});await f.api.checkAutoConnect();assert.equal(f.connected().server.id,'chosen');assert.equal(f.connected().server.proxyHost,'chosen.test');
});
