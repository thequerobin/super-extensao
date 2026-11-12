const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');const load=require('./helpers/load-ts.cjs');const {IDBFactory}=require('../vendor/floccus-source/node_modules/fake-indexeddb');
const root=path.resolve(__dirname,'..'),cache=new Map();const core=name=>load(path.join(root,'newtab/engine',name+'.ts'),{structuredClone,crypto:require('node:crypto').webcrypto}, {},cache);
const DB=core('database'),{defaults}=core('model'),{settings,widgets}=core('settings'),{decode}=core('formats'),{connect}=core('persistence'),{extensionPort,indexeddb,indexedDBPort}=core('browser-storage'),Events=core('events'),{migrateLegacy}=core('migration');
const plain=v=>JSON.parse(JSON.stringify(v));const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function setup(){const db=DB.init(defaults('pt-BR')),cache=DB.init();let next=0;return{db,cache,actions:settings(db,cache,()=> 'own-'+(++next))};}
function dump(){return{...defaults('en'),'widget/default-time':null,'widget/default-greeting':null,'widget/note':{id:'note',key:'widget/notes',order:0,display:{position:'topLeft'}},'data/note':{notes:[{contents:'Preserve this'}]},version:3};}
test('own database defaults reset without mutation and snapshots emit only after the whole commit',()=>{
 const f=setup(),seen=[];DB.listen(f.db,()=>seen.push([DB.get(f.db,'focus'),DB.get(f.db,'locale')]));DB.atomic(f.db,draft=>{DB.put(draft,'focus',true);DB.put(draft,'locale','en');});assert.deepEqual(plain(seen),[[true,'en'],[true,'en']]);DB.del(f.db,'locale');assert.equal(DB.get(f.db,'locale'),'pt-BR');
 assert.throws(()=>DB.atomic(f.db,draft=>{DB.put(draft,'locale','bad');throw Error('cancel');}));assert.equal(DB.get(f.db,'locale'),'pt-BR');
});
test('deleting in a transaction hides a default, while explicit reset restores all defaults',()=>{
 const f=setup();DB.atomic(f.db,draft=>DB.del(draft,'background'));assert.equal(DB.get(f.db,'background'),undefined);f.actions.resetStore();assert.equal(DB.get(f.db,'background').id,'default-gradient');assert.equal(widgets(f.db).length,2);
});
test('own widget/background actions preserve ordering and clean only their associated data/cache',()=>{
 const f=setup();f.actions.addWidget('widget/notes');DB.put(f.db,'data/own-1',{notes:[{contents:'note'}]});DB.put(f.cache,'own-1','image');DB.put(f.cache,'other','keep');f.actions.setWidgetDisplay('own-1',{position:'bottomRight',fontSize:20});f.actions.reorderWidget(2,0);assert.equal(widgets(f.db)[0].id,'own-1');assert.equal(widgets(f.db)[0].display.fontSize,20);f.actions.removeWidget('own-1');assert.equal(DB.get(f.db,'data/own-1'),undefined);assert.equal(DB.get(f.cache,'own-1'),undefined);assert.equal(DB.get(f.cache,'other'),'keep');assert.throws(()=>f.actions.reorderWidget(-1,0));
 const id=DB.get(f.db,'background').id;DB.put(f.cache,id,'old');f.actions.setBackground('background/colour');assert.equal(DB.get(f.db,'background').id,'own-2');assert.equal(DB.get(f.cache,id),undefined);
});
test('v3 roundtrip preserves IDs, notes, layout, unknown plugin data and source input',()=>{
 const f=setup(),input=dump(),original=JSON.stringify(input);f.actions.importStore(input);assert.equal(JSON.stringify(input),original);assert.deepEqual(plain(DB.get(f.db,'data/note')),input['data/note']);assert.equal(widgets(f.db).length,1);assert.equal(widgets(f.db)[0].id,'note');assert.deepEqual(JSON.parse(f.actions.exportStore())['data/note'],input['data/note']);
});
test('invalid or future imports leave existing settings and cached images untouched',()=>{
 const f=setup();DB.put(f.cache,'photo',new Blob(['image']));const original=f.actions.exportStore();for(const input of [null,[],{version:4}, {...dump(),'widget/note':{id:'other',key:'widget/notes',order:0,display:{position:'wrong'}}},JSON.parse('{"version":3,"__proto__":{"bad":true}}')]){assert.throws(()=>f.actions.importStore(input));assert.equal(f.actions.exportStore(),original);assert.equal(DB.get(f.cache,'photo').size,5);}
});
test('v2 conversion retains active background, widget IDs and data without re-adding default widgets',()=>{
 const f=setup();f.actions.importStore({backgrounds:[{id:'photo',key:'background/image',active:true,display:{blur:0}}],widgets:[{id:'old',key:'widget/message',active:true,display:{position:'middleCentre'}}],data:{old:{messages:['hello']}},locale:'en'});assert.equal(DB.get(f.db,'background').id,'photo');assert.deepEqual(plain(widgets(f.db).map(x=>x.id)),['old']);assert.deepEqual(plain(DB.get(f.db,'data/old')),{messages:['hello']});assert.equal(DB.get(f.db,'timeZone'),null);
});
test('storage hydration does not overwrite an edit made while the native read was pending',async()=>{
 const db=DB.init(),read=deferred(),writes=[];const opening=connect(db,{read:()=>read.promise,write:async batch=>writes.push(batch)});DB.put(db,'title','new');read.resolve([['title','old'],['keep',1]]);const session=await opening;await session.flush();assert.equal(DB.get(db,'title'),'new');assert.equal(DB.get(db,'keep'),1);assert.equal(writes.length,1);session.dispose();
});
test('pending writes are ordered and coalesced per key, with immutable captured payloads',async()=>{
 const db=DB.init(),gate=deferred(),writes=[];const session=await connect(db,{read:async()=>[],write:async batch=>{writes.push(plain(batch));if(writes.length===1)await gate.promise;}});
 const value={contents:'first'};DB.put(db,'data',value);const first=session.flush();value.contents='mutated';await tick();DB.put(db,'data',{contents:'second'});DB.put(db,'gone',1);DB.del(db,'gone');const second=session.flush();await tick();assert.equal(writes.length,1);gate.resolve();await Promise.all([first,second]);assert.deepEqual(writes[0],[['data',{contents:'first'}]]);assert.deepEqual(writes[1],[['data',{contents:'second'}],['gone',null]]);session.dispose();
});
test('a failed older batch cannot overwrite a newer queued value during retry',async()=>{
 const db=DB.init(),gate=deferred(),writes=[];const session=await connect(db,{read:async()=>[],write:async batch=>{writes.push(plain(batch));if(writes.length===1){await gate.promise;throw Error('native');}}});DB.put(db,'name','old');const first=session.flush(),failed=assert.rejects(first,/Cannot save/);await tick();DB.put(db,'name','new');const second=session.flush();gate.resolve();await failed;await second;await session.flush();assert.deepEqual(writes,[[['name','old']],[['name','new']]]);assert.equal(DB.get(db,'name'),'new');session.dispose();
});
test('storage failures publish errors, remain retryable and never become successful empty reads',async()=>{
 await assert.rejects(connect(DB.init(),{read:async()=>{throw Error('native');},write:async()=>{}}),/Cannot open/);
 const db=DB.init(),errors=[];let fail=true;const session=await connect(db,{read:async()=>[],write:async()=>{if(fail)throw Error('quota');}});Events.subscribe(session,error=>errors.push(error.name));DB.put(db,'keep',1);await assert.rejects(session.flush());assert.deepEqual(errors,['StorageError']);fail=false;await session.flush();assert.equal(DB.get(db,'keep'),1);session.dispose();
});
function chromeArea(){const data={'other:setting':'untouched','tabliss/configOther':'not ours'},listeners=new Set(),calls=[];const events={addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)};const notify=changes=>{for(const listener of listeners)listener(changes,'sync');};const area={get:async()=>({...data}),set:async values=>{calls.push(['set',plain(values)]);Object.assign(data,values);notify(Object.fromEntries(Object.entries(values).map(([key,newValue])=>[key,{newValue}])));},remove:async keys=>{calls.push(['remove',keys]);for(const key of keys)delete data[key];notify(Object.fromEntries(keys.map(key=>[key,{}])));}};return{area,events,data,calls,notify,listeners};}
test('native extension adapter isolates exact namespace and propagates other-tab changes without echo writes',async()=>{
 const f=chromeArea(),a=DB.init(),b=DB.init(),sa=await connect(a,extensionPort(f.area,f.events,'tabliss/config','sync')),sb=await connect(b,extensionPort(f.area,f.events,'tabliss/config','sync'));assert.equal(DB.get(a,'ther'),undefined);DB.put(a,'focus',true);await sa.flush();assert.equal(DB.get(b,'focus'),true);await sb.flush();assert.equal(f.calls.length,1);assert.equal(f.data['other:setting'],'untouched');DB.del(a,'focus');await sa.flush();assert.equal(DB.get(b,'focus'),undefined);assert.equal(f.data['tabliss/configOther'],'not ours');sa.dispose();sb.dispose();assert.equal(f.listeners.size,0);
});
test('an old native echo cannot replace a newer local value queued in another batch',async()=>{
 const f=chromeArea(),db=DB.init(),gate=deferred(),save=f.area.set;let first=true;f.area.set=async value=>{if(first){first=false;await gate.promise;}await save(value);};const session=await connect(db,extensionPort(f.area,f.events,'tabliss/config','sync'));DB.put(db,'focus',false);const old=session.flush();await tick();DB.put(db,'focus',true);const current=session.flush();gate.resolve();await Promise.all([old,current]);assert.equal(DB.get(db,'focus'),true);assert.equal(f.data['tabliss/config/focus'],true);session.dispose();
});
test('IndexedDB adapter opens the existing changes store and preserves binary cache after reopening',async()=>{
 const factory=new IDBFactory(),db=DB.init();let session=await indexeddb(db,'tabliss/cache',factory);DB.put(db,'photo',[new Blob(['original image'],{type:'image/png'})]);await session.flush();session.dispose();await tick();const reopened=DB.init();session=await indexeddb(reopened,'tabliss/cache',factory);const image=DB.get(reopened,'photo')[0];assert.equal(await image.text(),'original image');assert.equal(image.type,'image/png');DB.del(reopened,'photo');await session.flush();session.dispose();await tick();const final=DB.init(),last=await indexeddb(final,'tabliss/cache',factory);assert.equal(DB.get(final,'photo'),undefined);last.dispose();
});
test('IndexedDB write abort rejects the flush and can retry without pretending request success was commit',async()=>{
 const factory=new IDBFactory(),port=indexedDBPort(factory,'cache');await port.read();const original=port.write;let fail=true;port.write=changes=>original(changes.map(([key,value])=>[key,fail?()=>{}:value]));const db=DB.init(),session=await connect(db,{read:async()=>[],write:port.write,close:port.close});DB.put(db,'image','bytes');await assert.rejects(session.flush());fail=false;await session.flush();session.dispose();
});
test('legacy migration waits for confirmed config/cache writes before removing the original source',async()=>{
 const f=setup(),gate=deferred(),events=[];const session={subscribers:new Set(),flush:async()=>{events.push('config');await gate.promise;},dispose(){}};const cached={...session,flush:async()=>events.push('cache')};const migrating=migrateLegacy(f.db,f.cache,f.actions.importStore,session,cached,{read:async()=>dump(),readCache:async()=>({note:'cached',unused:'orphan'}),remove:async()=>events.push('remove')});await tick();assert.deepEqual(events,['config']);gate.resolve();await migrating;assert.deepEqual(events,['config','cache','remove']);assert.equal(DB.get(f.cache,'note'),'cached');assert.equal(DB.get(f.cache,'unused'),undefined);
});
test('failed migration keeps the old source, and existing config is never overwritten by a legacy record',async()=>{
 const f=setup();let removed=false;const fail={subscribers:new Set(),flush:async()=>{throw Error('quota');},dispose(){}};await assert.rejects(migrateLegacy(f.db,f.cache,f.actions.importStore,fail,fail,{read:async()=>dump(),remove:async()=>{removed=true;}}));assert.equal(removed,false);
 const current=setup();current.actions.setBackground('background/colour');const before=current.actions.exportStore(),ok={...fail,flush:async()=>{}};await migrateLegacy(current.db,current.cache,current.actions.importStore,ok,ok,{read:async()=>dump(),remove:async()=>{removed=true;}});assert.equal(current.actions.exportStore(),before);assert.equal(removed,false);
});
test('shared locale alone does not suppress a necessary legacy layout migration',async()=>{
 const f=setup();DB.put(f.db,'locale','en');let removed=false;const session={subscribers:new Set(),flush:async()=>{},dispose(){}};await migrateLegacy(f.db,f.cache,f.actions.importStore,session,session,{read:async()=>dump(),remove:async()=>{removed=true;}});assert.equal(removed,true);assert.equal(widgets(f.db)[0].id,'note');
});
test('legacy cache unavailability is tolerated without migration but cannot erase old cached images',async()=>{
 const f=setup();let removed=false;const session={subscribers:new Set(),flush:async()=>{},dispose(){}};await migrateLegacy(f.db,f.cache,f.actions.importStore,session,undefined,{read:async()=>undefined,remove:async()=>{removed=true;}});assert.equal(removed,false);
 await assert.rejects(migrateLegacy(f.db,f.cache,f.actions.importStore,session,undefined,{read:async()=>dump(),readCache:async()=>({note:'image'}),remove:async()=>{removed=true;}}),/Cannot migrate cached images/);assert.equal(removed,false);
});
test('public Tabliss compatibility modules invoke the own store and accept its exported format',()=>{
 const fixture=setup();const facade=load(path.join(root,'vendor/tabliss-source/src/db/action.ts'),{structuredClone,crypto:require('node:crypto').webcrypto},{'./state':{db:fixture.db,cache:fixture.cache}});facade.importStore(dump());assert.equal(JSON.parse(facade.exportStore())['data/note'].notes[0].contents,'Preserve this');facade.toggleFocus();assert.equal(DB.get(fixture.db,'focus'),true);
});
test('concurrent initializers share one legacy migration and a new layout wins over a delayed cache read',async()=>{
 const f=setup(),gate=deferred();let reads=0,loads=0,removed=0;const session={subscribers:new Set(),flush:async()=>{},dispose(){}};
 const ports={read:async()=>{reads++;return dump();},readCache:()=>gate.promise,remove:async()=>{removed++;}};
 const one=migrateLegacy(f.db,f.cache,value=>{loads++;f.actions.importStore(value);},session,session,ports),two=migrateLegacy(f.db,f.cache,f.actions.importStore,session,session,ports);assert.equal(one,two);await tick();f.actions.setBackground('background/colour');gate.resolve({});await one;assert.equal(reads,1);assert.equal(loads,0);assert.equal(removed,0);assert.equal(DB.get(f.db,'background').key,'background/colour');
});
test('the production dashboard reads the old configuration and updates shared language through the own storage adapter',async()=>{
 const {JSDOM,VirtualConsole}=require('jsdom'),errors=[];const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://extension.test/newtab/index.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console}),w=dom.window;
 const listeners=new Set(),values={};for(const[key,value]of Object.entries({...dump(),background:{id:'colour',key:'background/colour',display:{blur:0,luminosity:0}},'widget/note':null}))if(key!=='version')values['tabliss/config/'+key]=value;
 const area={get:async key=>typeof key==='string'?{[key]:values[key]}:{...values},set:async updates=>{Object.assign(values,updates);for(const fn of listeners)fn(Object.fromEntries(Object.entries(updates).map(([key,newValue])=>[key,{newValue}])),'sync');},remove:async keys=>{for(const key of keys)delete values[key];}};
 w.browser={storage:{sync:area,local:{get:async()=>({}),set:async()=>{},remove:async()=>{}},onChanged:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}},i18n:{getUILanguage:()=> 'en'}};
 w.browser=Object.assign(w.eval('({})'),w.browser);w.browser.runtime={id:'test'};w.chrome=w.browser;
 w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});w.fetch=async()=>{throw Error('Unexpected network request');};
 let localeWatch;
 w.SuperPreferences={locale:{normalize:value=>value==='en'?'en':'pt-BR',watch(fn){localeWatch=fn;fn('en');return()=>{};},set:async value=>area.set({'tabliss/config/locale':value})}};
 try{
  w.eval(fs.readFileSync(path.join(root,'newtab/main.js'),'utf8'));for(let i=0;i<20&&!w.document.querySelector('.Dashboard');i++)await new Promise(resolve=>setTimeout(resolve,15));
  assert.ok(w.document.querySelector('.Dashboard'));assert.equal(w.document.querySelector('.StoreError'),null);
  localeWatch('pt-BR');await new Promise(resolve=>setTimeout(resolve,25));assert.equal(values['tabliss/config/locale'],'pt-BR');assert.deepEqual(errors,[]);
  w.dispatchEvent(new w.Event('beforeunload'));w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:false}));
 }finally{w.close();}
});
