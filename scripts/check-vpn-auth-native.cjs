// Real Chromium proxy-auth event during a simulated cold VPN state. Local fake proxy only.
// Does not access a Proton account or measure a real VPN connection.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'super-auth-native-'));
const extension=path.join(temp,'extension'),profile=path.join(temp,'profile');fs.mkdirSync(extension);fs.mkdirSync(profile);
let proc,server,browserControl;let proxyRequests=0,receivedCredentials=0;
const sockets = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect(url) {
  const socket = new WebSocket(url);
  sockets.push(socket);
  await new Promise((r, j) => {
    socket.addEventListener("open", r, { once: true });
    socket.addEventListener("error", j, { once: true });
  });
  let next = 0;
  const pending = new Map();
  socket.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === "Network.loadingFailed")
      console.error(JSON.stringify({ networkFailure: msg.params.errorText }));
    if (msg.id && pending.has(msg.id)) {
      const { r, j, t } = pending.get(msg.id);
      clearTimeout(t);
      pending.delete(msg.id);
      msg.error ? j(Error(msg.error.message)) : r(msg.result);
    }
  });
  return (method, params = {}) =>
    new Promise((r, j) => {
      const id = ++next,
        t = setTimeout(() => {
          pending.delete(id);
          j(Error("CDP timed out: " + method));
        }, 12000);
      pending.set(id, { r, j, t });
      socket.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(call, expression) {
  const result = await call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text,
    );
  return result.result.value;
}

(async()=>{
  server=http.createServer((request,response)=>{
    proxyRequests++;if(request.headers['proxy-authorization'])receivedCredentials++;
    response.writeHead(407,{'Proxy-Authenticate':'Basic realm="local-test"','Connection':'close'});response.end();
  });
  server.on('connect',(request,socket)=>{
    proxyRequests++;if(request.headers['proxy-authorization'])receivedCredentials++;
    socket.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="local-test"\r\nConnection: close\r\n\r\n');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const proxyPort=server.address().port;
  const sources={auth:'vendor/proton-source/source/js/vpn/authHandler.ts',chromium:'vpn/engine/chromium.ts',controller:'vpn/engine/controller.ts',endpoint:'vpn/engine/proxy-auth.ts'};
  const factories=Object.entries(sources).map(([id,file])=>JSON.stringify(id)+':function(module,exports,require){'+ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText+'}').join(',');
  fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'Isolated proxy authentication test',version:'1.0',permissions:['proxy','webRequest','webRequestAuthProvider'],host_permissions:['<all_urls>'],background:{service_worker:'worker.js'}}));
  fs.writeFileSync(path.join(extension,'worker.js'),`
    globalThis.events=[];globalThis.credentialReads=0;
    const modules={${factories}},cache={};
    function require(id){
      if(id==='../state')return {getCurrentStateIfDefined:()=>undefined,isProxyKnownHost:()=>false,privacyFault:()=>{}};
      if(id==='../tools/milliSeconds')return {milliSeconds:{fromSeconds:n=>n*1000}};
      if(id==='../config')return {requestMaxAge:20};
      if(id==='../tools/proxyAuth')return {isPending:()=>false};
      if(id==='../account/credentials/getConnectionCredentials')return {getCredentials:async()=>{credentialReads++;throw Error('Unexpected credential request');}};
      id=id.includes('proxy-auth')?'endpoint':id.includes('chromium')?'chromium':id.includes('controller')?'controller':id;
      if(cache[id])return cache[id].exports;
      const module=cache[id]={exports:{}};modules[id](module,module.exports,require);return module.exports;
    }
    const handler=require('auth').authHandler;
    chrome.webRequest.onAuthRequired.addListener((details,done)=>handler(details,response=>{events.push({proxy:details.isProxy,canceled:response.cancel===true,credentialResponse:!!response.authCredentials});done(response);}),{urls:['<all_urls>']},['asyncBlocking']);
    globalThis.ready=new Promise((resolve,reject)=>chrome.proxy.settings.set({value:{mode:'fixed_servers',rules:{singleProxy:{scheme:'http',host:'127.0.0.1',port:${proxyPort}},bypassList:['localhost','127.0.0.1']}},scope:'regular'},()=>chrome.runtime.lastError?reject(Error(chrome.runtime.lastError.message)):resolve(true)));
  `);
  proc=spawn(process.env.CHROMIUM_PATH||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':'/usr/bin/chromium'),['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--disable-background-networking','--disable-component-update','--host-resolver-rules=EXCLUDE 127.0.0.1,MAP * ~NOTFOUND','--disable-extensions-except='+extension,'--load-extension='+extension,'about:blank'],{windowsHide:true,stdio:'ignore'});
  proc.on('error',error=>console.error(error.message));
  let port;for(let i=0;i<150;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await pause(100);}
  assert.ok(port,'DevTools startup');
  const url='http://127.0.0.1:'+port;
  let worker;for(let i=0;i<100;i++){worker=(await(await fetch(url+'/json/list')).json()).find(t=>t.type==='service_worker'&&t.url.endsWith('/worker.js'));if(worker)break;await pause(100);}
  assert.ok(worker,'worker startup');const workerCall=await connect(worker.webSocketDebuggerUrl);
  let initialized=false;for(let i=0;i<100;i++){initialized=await evaluate(workerCall,'typeof ready !== "undefined"');if(initialized)break;await pause(100);}
  assert.ok(initialized,'proxy initialization');await evaluate(workerCall,'ready');
  const info=await(await fetch(url+'/json/version')).json();browserControl=await connect(info.webSocketDebuggerUrl);
  await browserControl('Target.createTarget',{url:'http://proxy-auth-check.test/startup'});
  let events=[];for(let i=0;i<100;i++){events=await evaluate(workerCall,'events');if(events.some(event=>event.proxy&&event.canceled))break;await pause(100);}
  assert.ok(proxyRequests>0,'real proxy challenge');assert.ok(events.some(event=>event.proxy&&event.canceled),'native callback canceled the startup challenge');
  assert.equal(await evaluate(workerCall,'credentialReads'),0);assert.equal(receivedCredentials,0);assert.equal(events.some(event=>event.credentialResponse),false);
  console.log(JSON.stringify({native:true,browser:info.Browser,checks:['real-407-challenge','startup-challenge-canceled','no-credential-request','no-credentials-sent']}));
})().catch(error=>{console.error('NATIVE TEST FAILED: '+error.message);process.exitCode=1;}).finally(async()=>{
  if(browserControl)await browserControl('Browser.close').catch(()=>{});
  for(const socket of sockets)socket.close();
  if(proc?.exitCode===null)await Promise.race([new Promise(resolve=>proc.once('close',resolve)),pause(3000)]);
  if(proc?.exitCode===null){proc.kill();await pause(1000);}
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  const target=path.resolve(temp);if(path.dirname(target)!==path.resolve(os.tmpdir())||!path.basename(target).startsWith('super-auth-native-'))throw Error('Unexpected temporary path');
  fs.rmSync(target,{recursive:true,force:true,maxRetries:5,retryDelay:200});
});
