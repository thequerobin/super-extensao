// Isolated native smoke test: no account, tokens or user browser profile.
// Requires Playwright and a Chromium build that can load unpacked extensions.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'super-vpn-audit-')),extension=path.join(temp,'extension'),profile=path.join(temp,'profile');
fs.mkdirSync(extension);
for(const file of ['vpn-blocked.html','vpn-blocked.css','ui-theme.css','ui-components.css','preferences.js','vpn/blocked.js']){
 const target=path.join(extension,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);
}
const modules={
 guard:'vpn/engine/network-guard.ts',native:'vendor/proton-source/source/js/vpn/networkGuard.ts',routing:'vpn/engine/routing.js',
};
const factories=Object.entries(modules).map(([name,file])=>`${JSON.stringify(name)}:function(module,exports,require){${file.endsWith('.ts')?ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText:fs.readFileSync(path.join(root,file),'utf8')}\n}`).join(',');
fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'Super VPN isolated privacy audit',version:'1.0',permissions:['proxy','declarativeNetRequest','storage'],host_permissions:['<all_urls>'],background:{service_worker:'worker.js'},web_accessible_resources:[{resources:['vpn-blocked.html'],matches:['<all_urls>']}]}));
fs.writeFileSync(path.join(extension,'worker.js'),`const modules={${factories}},cache={};function require(id){id=id.includes('network-guard')?'guard':id;if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,require);return m.exports;}globalThis.safety=require('native').networkGuard;globalThis.routing=require('routing');chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(message.channel!=='super-vpn'||message.type!=='protectionStatus')return;void safety.status().then(state=>reply({received:true,result:{status:state.blocked?'blocked':state.armed?'connected':'released',retryAvailable:false}}));return true;});`);
let browser,direct=0,proxied=0;const origin=http.createServer((req,res)=>{if(req.url.startsWith('/audit'))direct++;res.end('DIRECT');}),proxy=http.createServer((req,res)=>{if(req.url.includes('/audit'))proxied++;res.end('PROXY');});
const listen=s=>new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',()=>resolve(s.address().port));});
const close=s=>new Promise(resolve=>{s.closeAllConnections?.();s.close(()=>resolve());});
async function launch(){browser=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',ignoreDefaultArgs:['--disable-extensions'],args:['--no-sandbox','--disable-dev-shm-usage',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--host-resolver-rules=MAP *.audit.test 127.0.0.1']});const worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker');return worker;}
async function blocked(page,url,redirect=true){if(!redirect){await assert.rejects(page.goto(url,{timeout:5000}));return;}await page.goto(url,{timeout:5000,waitUntil:'domcontentloaded'});assert.match(page.url(),/^chrome-extension:\/\/[^/]+\/vpn-blocked\.html#return=/);}
(async()=>{
 const originPort=await listen(origin),proxyPort=await listen(proxy),url=`http://site.audit.test:${originPort}/audit`;
 let worker=await launch(),page=await browser.newPage();
 await worker.evaluate(()=>safety.block());await blocked(page,url+'?before-connect');assert.equal(direct,0);assert.equal(proxied,0);
 await worker.evaluate(async port=>{const config=routing.createFixedConfig('127.0.0.1',port,{mode:'include',filteredDomains:['site.audit.test']},{scheme:'http',localExclusions:[],apiExclusions:[]});const pac=routing.createPacScript(config);await chrome.proxy.settings.set({value:pac,scope:'regular'});const current=await chrome.proxy.settings.get({incognito:false});if(current.value.pacScript.mandatory!==true)throw Error('mandatory PAC missing');if(!await safety.open(async()=>true))throw Error('guard did not open');},proxyPort);
 await page.waitForSelector('#return:not([hidden])');await page.click('#return');await page.waitForURL(url+'?before-connect');assert.equal(await page.textContent('body'),'PROXY');
 await page.goto(url+'?healthy');assert.equal(await page.textContent('body'),'PROXY');assert.equal(direct,0);assert.ok(proxied>0);
 const beforePost=proxied;await worker.evaluate(()=>safety.block());await page.evaluate(action=>{const form=document.createElement('form');form.method='post';form.action=action;document.body.append(form);form.submit();},url+'?post');await page.waitForURL(/^chrome-extension:\/\/[^/]+\/vpn-blocked\.html$/);assert.equal(proxied,beforePost);assert.equal(direct,0);await worker.evaluate(()=>safety.open(async()=>true));await page.waitForFunction(()=>document.querySelector('main').dataset.status==='connected');assert.equal(await page.locator('#return').isVisible(),false);await page.goto(url+'?healthy-again');
 await close(proxy);await blocked(page,url+'?proxy-down',false);assert.equal(direct,0);
 await worker.evaluate(()=>safety.block());await worker.evaluate(()=>chrome.proxy.settings.clear({scope:'regular'}));await blocked(page,url+'?override');assert.equal(direct,0);
 // Persist blocker while simulating an allowed session; browser restart must revoke the allowance.
 await worker.evaluate(()=>safety.open(async()=>true));await browser.close();browser=undefined;
 worker=await launch();page=await browser.newPage();assert.equal((await worker.evaluate(()=>safety.status())).blocked,true);await blocked(page,url+'?restart');assert.equal(direct,0);
 await worker.evaluate(()=>safety.disarm(()=>true));await page.goto(url+'?explicit-release');assert.equal(await page.textContent('body'),'DIRECT');assert.ok(direct>0);
 console.log(JSON.stringify({native:true,checks:['block-before-connect','proxied-HTTP','explicit-return-after-recovery','no-return-for-POST','no-DIRECT-after-proxy-down','block-after-override','block-across-browser-restart','explicit-release'],directRequestsBeforeRelease:0}));
})().catch(error=>{console.error('NATIVE VALIDATION BLOCKED/FAILED: '+error.message.split('\n')[0]);process.exitCode=1;}).finally(async()=>{await browser?.close().catch(()=>{});await Promise.all([close(origin),close(proxy)]);fs.rmSync(temp,{recursive:true,force:true});});
