const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {let resolve;const promise = new Promise(done=>resolve=done);return {resolve,promise};};
function boot() {
  const dom = new JSDOM('<head></head><body data-active-tab="vpn"><p id="vpnPanelStatus">Loading</p><div id="vpnPanel"></div></body>',{url:'https://extension.test/popup.html'});
  const w=dom.window, reply=deferred(), mounted=deferred(), listeners=[], requests=[], assets=[];
  const original=w.document.head.append.bind(w.document.head);
  w.document.head.append=element=>{
    assets.push(element.href||element.src);original(element);
    if(element.src?.endsWith('vpn/interface.js')) context.SuperVpnReady=mounted.promise;
    queueMicrotask(()=>element.dispatchEvent(new w.Event('load')));
  };
  const context=vm.createContext({
    window:w, document:w.document, Event:w.Event, Promise, console,
    requestAnimationFrame:()=>{}, SuperI18n:{text:s=>s},
    chrome:{
      runtime:{id:'extension', sendMessage:message=>{requests.push(message);return reply.promise;}, onMessage:{addListener:fn=>listeners.push(fn)}},
      storage:{local:{get:async()=>({popupView:{tab:'vpn'}})}},
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../popup-panels.js'),'utf8'),context);
  const emit=data=>listeners.forEach(fn=>fn({channel:'super-vpn',respondTo:'none',type:'changeState',data},{id:'extension'}));
  return {dom,w,context,reply,mounted,requests,assets,emit};
}
test('selected VPN prefetches live state and starts assets without waiting for the first paint', async()=>{
  const ui=boot();
  try{
    ui.w.document.dispatchEvent(new ui.w.CustomEvent('super-extension:panel-selected',{detail:'vpn'}));
    await tick();
    assert.equal(ui.requests.length,1);assert.equal(ui.requests[0].type,'connectionState');
    assert.ok(ui.assets.some(url=>url.endsWith('vpn/interface.js')));
    assert.equal(ui.w.document.getElementById('vpnPanelStatus').hidden,false);
    ui.reply.resolve({received:true,result:{signedIn:true,state:{state:'connected'}}});
    assert.equal((await ui.context.SuperVpnBootstrap()).state.state,'connected');
    ui.mounted.resolve();await tick();
    assert.equal(ui.w.document.getElementById('vpnPanelStatus').hidden,true);
  }finally{ui.mounted.resolve();ui.dom.window.close();}
});
test('bootstrap follows disconnect/logout events before the interface has mounted',async()=>{
  const ui=boot();
  try{
    await tick();
    ui.emit({state:'disconnected'});
    ui.reply.resolve({received:true,result:{signedIn:true,state:{state:'connected',server:{name:'OLD'}}}});
    assert.equal((await ui.context.SuperVpnBootstrap()).state.state,'disconnected');
    ui.emit({state:'logged-out'});
    assert.equal((await ui.context.SuperVpnBootstrap()).signedIn,false);
  }finally{ui.mounted.resolve();ui.dom.window.close();}
});
