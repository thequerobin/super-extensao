const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function isolated(){
 const local={theme:'dark',excludedSites:['example.com'],'superSync:accounts':{test:1}},sync={'tabliss/config/locale':'pt-BR','superSync:test':2};
 const area=state=>({async get(keys){if(keys==null)return {...state};if(typeof keys==='string')keys=[keys];if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>k in state).map(k=>[k,state[k]]));return {...keys,...Object.fromEntries(Object.keys(keys).filter(k=>k in state).map(k=>[k,state[k]]))}},async set(data){Object.assign(state,data)},async remove(keys){keys.forEach(k=>delete state[k])}});
 let callback;const b={storage:{local:area(local),sync:area(sync),onChanged:{addListener(fn){callback=fn},removeListener(){callback=null}}}};
 const ctx=vm.createContext({b,i18n:{getMessage:()=>'',getLocale:()=> 'pt-BR'}});
 const source=fs.readFileSync(path.join(root,'vendor/floccus-source/src/lib/browser-api.js'),'utf8');
 vm.runInContext(source.slice(source.indexOf('const originalLocal =')).replace('export default b',''),ctx);
 return {local,sync,b,emit:(changes,area)=>callback(changes,area)};
}
const plain=x=>JSON.parse(JSON.stringify(x));
test('sincronização isola leitura, gravação e limpeza das preferências principais',async()=>{
 const {b,local,sync}=isolated();
 assert.deepEqual(plain(await b.storage.local.get(null)),{accounts:{test:1}});
 assert.deepEqual(plain(await b.storage.local.get({accounts:{},missing:3})),{accounts:{test:1},missing:3});
 await b.storage.local.set({accounts:{test:2}});assert.deepEqual(local['superSync:accounts'],{test:2});
 await b.storage.local.clear();assert.equal(local.theme,'dark');assert.deepEqual(local.excludedSites,['example.com']);assert.equal(local['superSync:accounts'],undefined);
 await b.storage.sync.clear();assert.equal(sync['tabliss/config/locale'],'pt-BR');assert.equal(sync['superSync:test'],undefined);
});
test('eventos de armazenamento do módulo ignoram chaves externas',()=>{
 const {b,emit}=isolated();const events=[];b.storage.onChanged.addListener((...args)=>events.push(plain(args)));
 emit({theme:{newValue:'light'}},'local');assert.equal(events.length,0);
 emit({'superSync:accounts':{newValue:'test'},theme:{newValue:'dark'}},'local');assert.deepEqual(events,[[{accounts:{newValue:'test'}},'local']]);
});
test('catálogos do módulo cobrem PT-BR e inglês com os mesmos parâmetros',()=>{
 const dir=path.join(root,'vendor/floccus-source/_locales');assert.deepEqual(fs.readdirSync(dir).sort(),['en','pt_BR']);
 const en=JSON.parse(fs.readFileSync(path.join(dir,'en/messages.json'))),pt=JSON.parse(fs.readFileSync(path.join(dir,'pt_BR/messages.json')));
 assert.deepEqual(Object.keys(en).sort(),Object.keys(pt).sort());assert.ok(Object.keys(pt).length>360);
 for(const key of Object.keys(en)){assert.ok(pt[key].message.trim(),key);assert.deepEqual([...new Set(en[key].message.match(/\{\d+\}/g)||[])].sort(),[...new Set(pt[key].message.match(/\{\d+\}/g)||[])].sort(),key)}
});
