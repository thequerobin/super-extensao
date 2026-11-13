const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
async function fixture(initial={}) {
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'popup.html'),'utf8'),{url:'https://extension.test/popup.html',runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window,local={excludedSites:['cookie.example'],...initial},sync={'tabliss/config/locale':'pt-BR'},listeners=[];
  const area=(state,name)=>({
    async get(keys) { if(Array.isArray(keys))return Object.fromEntries(keys.filter(k=>k in state).map(k=>[k,state[k]]));return {...keys,...Object.fromEntries(Object.keys(keys||state).filter(k=>k in state).map(k=>[k,state[k]]))}; },
    async set(values) {values=JSON.parse(JSON.stringify(values));const changes={};for(const [k,v] of Object.entries(values)){changes[k]={newValue:v,oldValue:state[k]};state[k]=v;}for(const fn of listeners)fn(changes,name);}
  });
  const requests=[];
  w.chrome={storage:{local:area(local,'local'),sync:area(sync,'sync'),onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}},
    runtime:{sendMessage:async payload=>{requests.push(payload);return {ok:true,cleared:true};}},
    permissions:{request:async()=>true},bookmarks:{getTree:async()=>[{id:'0',title:'',children:[{id:'1',title:'Sites',children:[{url:'https://cookie.example/path'},{url:'https://new.example'}]}]}]}};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.confirm=()=>true;
  for(const file of ['ui.js','preferences.js','i18n.js','rules.js','ui/bookmark-preview.js','ui/domain-list.js','ui/async-state.js','ui/confirmation.js','ui/domain-editor.js','ui/bookmark-importer.js','popup.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  const style=w.document.createElement('style');style.textContent=fs.readFileSync(path.join(root,'popup.css'),'utf8').replace(/@import[^;]+;/g,'');w.document.head.append(style);
  await tick();
  return {w,d:w.document,local,requests,errors,close:()=>w.close()};
}
async function add(f,prefix,value) {f.d.getElementById(prefix+'DomainInput').value=value;f.d.getElementById(prefix+'DomainForm').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();}
test('novas abas salvam e removem exceções isoladamente, com ações de limpeza só na primeira aba',async()=>{
  const f=await fixture();try{
    assert.deepEqual(f.errors,[]);
    for(const [tab,prefix,key] of [['cache','cache','excludedCacheSites'],['local-storage','localStorage','excludedLocalStorageSites']]) {
      f.d.getElementById('tab-'+tab).click();
      assert.equal(f.d.getElementById('panel-'+tab).hidden,false);
      assert.equal(f.d.getElementById('cleanupActions').hidden,true);
      assert.equal(f.w.getComputedStyle(f.d.getElementById('cleanupFooter')).display,'none');
      assert.equal(f.w.getComputedStyle(f.d.getElementById('cleanupActions')).display,'none');
      await add(f,prefix,'https://keep.example/path');assert.deepEqual(f.local[key],['keep.example']);
      assert.deepEqual(f.local.excludedSites,['cookie.example']);
      assert.equal(f.d.getElementById(prefix+'ListCount').textContent,'1 domínio');
    }
    f.d.querySelector('#cacheDomainList button').click();await tick();
    assert.deepEqual(f.local.excludedCacheSites,[]);assert.deepEqual(f.local.excludedLocalStorageSites,['keep.example']);
    f.d.getElementById('tab-cleanup').click();assert.equal(f.d.getElementById('cleanupActions').hidden,false);
    assert.notEqual(f.w.getComputedStyle(f.d.getElementById('cleanupFooter')).display,'none');
    for(const tab of ['exceptions','bookmarks','autoplay','tabs','sync','vpn']){f.d.getElementById('tab-'+tab).click();assert.equal(f.d.getElementById('cleanupActions').hidden,true);
      assert.equal(f.w.getComputedStyle(f.d.getElementById('cleanupFooter')).display,'none');}
    assert.equal(f.d.getElementById('error').hidden,true);
  }finally{f.close();}
});
test('importação de favoritos pré-seleciona o destino da aba e calcula duplicados por lista',async()=>{
  const f=await fixture();try{
    f.d.getElementById('cacheGoImport').click();await tick();assert.equal(f.d.getElementById('importTarget').value,'cache');
    f.d.getElementById('loadFolders').click();await tick();assert.match(f.d.getElementById('previewCount').textContent,/2/);
    f.d.getElementById('importBookmarks').click();await tick();
    assert.deepEqual(f.local.excludedCacheSites,['cookie.example','new.example']);assert.deepEqual(f.local.excludedSites,['cookie.example']);
    f.d.getElementById('importTarget').value='cookies';f.d.getElementById('importTarget').dispatchEvent(new f.w.Event('change'));await tick();
    assert.match(f.d.getElementById('previewCount').textContent,/1/);
    f.d.getElementById('localStorageGoImport').click();await tick();f.d.getElementById('importBookmarks').click();await tick();
    assert.deepEqual(f.local.excludedLocalStorageSites,['cookie.example','new.example']);assert.deepEqual(f.local.excludedSites,['cookie.example']);
    assert.equal(f.d.getElementById('error').hidden,true);
  }finally{f.close();}
});
test('nova aba é restaurada e traduções não descartam rascunhos nem listas',async()=>{
  const f=await fixture({popupView:{tab:'local-storage',lastCleanupTab:'local-storage'}});try{
    assert.equal(f.d.getElementById('panel-local-storage').hidden,false);
    f.d.getElementById('localStorageDomainInput').value='draft.example';
    await f.w.SuperPreferences.locale.set('en');await tick();
    assert.equal(f.d.getElementById('tab-local-storage').textContent,'Local stor.');
    assert.equal(f.d.getElementById('tab-cleanup').textContent,'General');
    assert.equal(f.d.querySelector('#panel-cache h2').textContent,'Keep cache by website');
    assert.equal(f.d.getElementById('localStorageDomainInput').value,'draft.example');
    f.d.getElementById('tab-autoplay').click();f.d.getElementById('section-cleanup').click();
    assert.equal(f.d.getElementById('panel-local-storage').hidden,false);
    assert.deepEqual(f.errors,[]);
  }finally{f.close();}
});
