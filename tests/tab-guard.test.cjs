const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
function harness() {
  const events={};
  const event=name=>({addListener(fn){(events[name]||=[]).push(fn);}});
  let nextId=10;
  let windows=[{id:1,type:'normal',tabs:[{id:1,windowId:1,index:0,pinned:false,url:'https://example.com'}]}];
  const local={tabGuard:{enabled:true,scope:'every',singleNewTab:false}};
  const session={};
  let creates=0;
  const clone=x=>structuredClone(x);
  const emit=(name,...args)=>(events[name]||[]).forEach(fn=>fn(...args));
  const chrome={
    storage:{local:{async get(defaults){return {...clone(defaults),...clone(local)};},async set(data){Object.assign(local,data);}},session:{async get(defaults){return {...clone(defaults),...clone(session)};},async set(data){Object.assign(session,clone(data));}},onChanged:event('storage')},
    windows:{async getAll(){return clone(windows);},onCreated:event('windowCreated'),onRemoved:event('windowRemoved')},
    runtime:{getURL:file=>'chrome-extension://test/'+file,onStartup:event('startup'),onInstalled:event('installed')},
    tabs:{onCreated:event('created'),onUpdated:event('updated'),onRemoved:event('removed'),onAttached:event('attached'),onDetached:event('detached'),onMoved:event('moved'),onActivated:event('activated'),
      async create(options){
        creates++;const win=windows.find(w=>w.id===options.windowId);if(!win)throw new Error('missing window');
        const tab={id:nextId++,windowId:win.id,index:options.index??win.tabs.length,pinned:!!options.pinned,url:options.url};
        win.tabs.splice(tab.index,0,tab);win.tabs.forEach((t,i)=>t.index=i);emit('created',clone(tab));return clone(tab);
      },
      async update(id,changes){for(const win of windows){const tab=win.tabs.find(t=>t.id===id);if(tab){Object.assign(tab,changes);emit('updated',id,changes,clone(tab));return clone(tab);}}},
      async remove(id){for(const win of windows){if(win.tabs.some(t=>t.id===id)){win.tabs=win.tabs.filter(t=>t.id!==id);win.tabs.forEach((t,i)=>t.index=i);emit('removed',id,{windowId:win.id,isWindowClosing:false});return;}}},
      async move(){}
    }
  };
  const ctx=vm.createContext({chrome,URL,console});
  vm.runInContext(fs.readFileSync(path.join(base,'navigation-rules.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(base,'tab-guard.js'),'utf8'),ctx);
  const settle=()=>new Promise(resolve=>setImmediate(()=>setImmediate(resolve)));
  return {emit,settle,chrome,local,session,get windows(){return windows;},set windows(value){windows=value;},get creates(){return creates;}};
}
test('fechamento explícito de janela não cria novas abas mesmo com snapshot em transição',async()=>{
  const h=harness();await h.settle();
  assert.equal(h.creates,1);assert.equal(h.windows[0].tabs.length,2);
  const before=h.creates;
  h.emit('removed',1,{windowId:1,isWindowClosing:true});
  h.emit('activated',{tabId:10,windowId:1});
  await h.settle();assert.equal(h.creates,before);
  h.windows=[];h.emit('windowRemoved',1);await h.settle();
  assert.equal(h.creates,before);
});
test('ao desativar remove somente a reserva, preservando a aba do usuário',async()=>{
  const h=harness();await h.settle();
  h.local.tabGuard={enabled:false};h.emit('storage',{tabGuard:{newValue:h.local.tabGuard}},'local');await h.settle();
  assert.deepEqual(h.windows[0].tabs.map(t=>t.id),[1]);
});
test('reserva navegada pelo usuário deixa de ser propriedade da extensão',async()=>{
  const h=harness();await h.settle();
  const spare=h.windows[0].tabs.find(t=>t.id!==1);
  await h.chrome.tabs.update(spare.id,{url:'https://user.example'});await h.settle();
  h.local.tabGuard={enabled:false};h.emit('storage',{tabGuard:{newValue:h.local.tabGuard}},'local');await h.settle();
  assert.ok(h.windows[0].tabs.some(t=>t.id===spare.id));
});
