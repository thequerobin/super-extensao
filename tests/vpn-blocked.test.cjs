const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {JSDOM}=require('jsdom');const load=require('./helpers/load-ts.cjs');
const root=path.resolve(__dirname,'..');const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const blocked={status:'blocked',retryAvailable:true,signedIn:true,reason:'VpnTrafficBlocked'};
function fixture(){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'vpn-blocked.html'),'utf8'),{url:'https://extension.test/vpn-blocked.html'}),w=dom.window;
 const exports={};const file=path.join(root,'vpn/source/blocked.js');
 const messages={VpnTrafficBlocked:{'pt-BR':'Rede pausada',en:'Network paused'}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p}},require:id=>({messages})});
 let reply=async()=>blocked,locale,theme,disposed=0,poll;const calls=[];
 const request=async type=>{calls.push(type);return reply(type);};
 const app=exports.mountProtection(w.document.querySelector('main'),request,{locale:{watch(fn){locale=fn;fn('pt-BR');return ()=>disposed++;}},bindTheme(node){theme=node;return ()=>disposed++;}},{setInterval(fn){poll=fn;return 1;},clearInterval(){disposed++;}});
 const $=id=>w.document.getElementById(id);
 return {w,app,$,calls,setReply:fn=>{reply=fn;},locale:value=>locale(value),poll:()=>poll(),dispose:()=>{app.dispose();w.close();},get disposed(){return disposed;},get theme(){return theme;}};
}
test('local blocking page reads live state without reconnecting or releasing on load',async()=>{
 const f=fixture();try{await tick();assert.deepEqual(f.calls,['protectionStatus']);assert.equal(f.$('protection').dataset.status,'blocked');assert.equal(f.$('retry').hidden,false);assert.match(f.$('help').textContent,/excluídos/);assert.equal(f.$('confirmation').hidden,true);}finally{f.dispose();}
});
test('reconnect keeps blocking when recovery is still waiting and only a confirmed snapshot reports success',async()=>{
 const f=fixture();try{await tick();f.$('retry').click();await tick();assert.ok(f.calls.includes('retryProtection'));assert.equal(f.$('protection').dataset.status,'blocked');assert.match(f.$('notice').textContent,/bloqueio permanece/);
 f.setReply(async()=>({...blocked,status:'connected',retryAvailable:false}));f.poll();await tick();assert.equal(f.$('protection').dataset.status,'connected');assert.equal(f.$('release').hidden,true);assert.equal(f.calls.includes('disconnect'),false);}finally{f.dispose();}
});
test('releasing requires a separate confirmation and waits for guard readback',async()=>{
 const f=fixture();try{await tick();f.$('release').click();assert.equal(f.$('confirmation').hidden,false);assert.equal(f.calls.includes('disconnect'),false);f.$('cancel').click();assert.equal(f.calls.includes('disconnect'),false);
 const gate=deferred();f.setReply(type=>type==='disconnect'?gate.promise:Promise.resolve({...blocked,status:'released',retryAvailable:false}));f.$('release').click();f.$('confirm').click();await tick();assert.equal(f.calls.filter(x=>x==='disconnect').length,1);assert.notEqual(f.$('protection').dataset.status,'released');assert.equal(f.$('confirm').disabled,true);gate.resolve();await tick();assert.equal(f.$('protection').dataset.status,'released');}finally{f.dispose();}
});
test('worker failure never announces a release, never auto-retries a mutation and remains queryable',async()=>{
 const f=fixture();try{await tick();f.setReply(async()=>{throw Error('VpnOperationPending');});f.$('retry').click();await tick();assert.equal(f.$('protection').dataset.status,'unconfirmed');assert.equal(f.calls.filter(x=>x==='retryProtection').length,1);f.poll();await tick();assert.equal(f.calls.filter(x=>x==='retryProtection').length,1);assert.equal(f.$('refresh').disabled,false);}finally{f.dispose();}
});
test('a delayed state read cannot overwrite a newer explicit release',async()=>{
 const f=fixture();try{await tick();const old=deferred();f.$('release').click();f.setReply(()=>old.promise);const query=f.app.refresh();
 // The previously opened confirmation is preserved during polling.
 f.setReply(async type=>type==='disconnect'?undefined:{...blocked,status:'released',retryAvailable:false});f.$('confirm').click();await tick();assert.equal(f.$('protection').dataset.status,'released');old.resolve(blocked);await query;assert.equal(f.$('protection').dataset.status,'released');}finally{f.dispose();}
});
test('unknown reasons render no service data; locale and theme are shared and polling is disposed',async()=>{
 const f=fixture();try{await tick();f.setReply(async()=>({...blocked,reason:'<img src=x onerror=alert(1)> private-token',retryAvailable:false}));await f.app.refresh();assert.equal(f.$('reason').textContent,'');assert.equal(f.$('retry').hidden,true);f.locale('en');assert.match(f.$('title').textContent,/Browsing paused/);assert.equal(f.w.document.querySelector('img'),null);assert.equal(f.theme,f.w.document.documentElement);f.app.dispose();assert.equal(f.disposed,3);const count=f.calls.length;f.poll();await tick();assert.equal(f.calls.length,count);}finally{f.dispose();}
});
function stateFixture(){
 let generation=0,current={name:'on',data:{error:{message:'secret service error',AccessToken:'private'}}},guard={armed:true,blocked:true},view={signedIn:true,state:{state:'connecting'}},retries=0;
 const {getProtectionStatus,retryProtection}=load(path.join(root,'vendor/proton-source/source/js/vpn/protectionPage.ts'),{}, {'../state':{connectionLifecycle:{capture:()=>generation,isCurrent:n=>n===generation},getCurrentState:()=>current,getConnectionSnapshot:async()=>view,requestConnectionRecovery:async()=>{retries++;}},'./networkGuard':{networkGuard:{status:async()=>guard}}});
 return {status:getProtectionStatus,retry:retryProtection,set:values=>{if(values.current)current=values.current;if(values.guard)guard=values.guard;if(values.view)view=values.view;if(values.bump)generation++;},get retries(){return retries;}};
}
test('protection status exports a closed reason and no credentials and uses actual guard state',async()=>{
 const f=stateFixture();assert.equal((await f.status()).status,'blocked');assert.equal((await f.status()).reason,'VpnTrafficBlocked');assert.ok(!JSON.stringify(await f.status()).includes('private'));f.set({guard:{armed:true,blocked:false}});assert.equal((await f.status()).status,'unconfirmed');f.set({view:{signedIn:true,state:{state:'connected'}}});assert.equal((await f.status()).status,'connected');
});
test('recovery never restores an intent after explicit disconnect or logout',async()=>{
 const f=stateFixture();await f.retry();assert.equal(f.retries,1);f.set({current:{name:'off',data:{}},guard:{armed:false,blocked:false},view:{signedIn:true,state:{state:'disconnected'}}});assert.equal((await f.status()).status,'released');await assert.rejects(f.retry(),/RecoveryUnavailable/);assert.equal(f.retries,1);
});
test('the public redirect target exposes no automatic commands or original URL replay',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));assert.deepEqual(manifest.web_accessible_resources[0].resources,['vpn-blocked.html']);const entry=fs.readFileSync(path.join(root,'vpn/source/blocked-index.js'),'utf8');let mounted=0;const self={};const exports={};vm.runInNewContext(ts.transpileModule(entry,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,window:{top:{},self},require:id=>id==='./blocked'?{mountProtection:()=>{mounted++;}}:{sendMessageTo:()=>{throw Error('unexpected command');}}});assert.equal(mounted,0);const html=fs.readFileSync(path.join(root,'vpn-blocked.html'),'utf8');assert.ok(!/https?:\/\//.test(html));assert.ok(!html.includes('onclick='));
});
test('a state change during guard inspection invalidates the page snapshot',async()=>{
 let generation=0;const gate=deferred();const {getProtectionStatus}=load(path.join(root,'vendor/proton-source/source/js/vpn/protectionPage.ts'),{},{'../state':{connectionLifecycle:{capture:()=>generation,isCurrent:n=>generation===n},getConnectionSnapshot:()=>gate.promise,getCurrentState:()=>({name:'on',data:{}})},'./networkGuard':{networkGuard:{status:async()=>({armed:true,blocked:false})}}});
 const query=getProtectionStatus();generation++;gate.resolve({signedIn:true,state:{state:'connected'}});await assert.rejects(query,/VpnOperationCancelled/);
});
test('guard read failures propagate rather than pretending networking is released',async()=>{
 const {getProtectionStatus}=load(path.join(root,'vendor/proton-source/source/js/vpn/protectionPage.ts'),{},{'../state':{connectionLifecycle:{capture:()=>0,isCurrent:()=>true},getConnectionSnapshot:async()=>({signedIn:false,state:{state:'logged-out'}}),getCurrentState:()=>({name:'initial',data:{}})},'./networkGuard':{networkGuard:{status:async()=>{throw Error('VpnTrafficGuardFailed');}}}});await assert.rejects(getProtectionStatus(),/VpnTrafficGuardFailed/);
});
test('the emitted standalone page bundle boots with only local resources and reads the worker',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,'vpn-blocked.html'),'utf8'),{url:'https://extension.test/vpn-blocked.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.chrome={runtime:{getURL:p=>'chrome-extension://test/'+p,sendMessage:async message=>{calls.push(message);return {received:true,result:blocked};}}};
 w.SuperPreferences={bindTheme:()=>()=>{},locale:{watch(fn){fn('en');return ()=>{};}}};
 try{w.eval(fs.readFileSync(path.join(root,'vpn/blocked.js'),'utf8'));await tick();assert.equal(w.document.querySelector('main').dataset.status,'blocked');assert.match(w.document.querySelector('h1').textContent,/Browsing paused/);assert.deepEqual(calls.map(x=>x.type),['protectionStatus']);w.dispatchEvent(new w.Event('pagehide'));}finally{w.close();}
});
