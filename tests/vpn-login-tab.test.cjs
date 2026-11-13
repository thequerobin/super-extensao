const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-ts.cjs');
const account='https://account.proton.me';
const url=account+'/authorize?state='+'A'.repeat(43);
function fixture(result,createError){
 const calls=[];
 const tabs={create:async options=>{
  calls.push(JSON.parse(JSON.stringify(options)));
  if(Object.keys(options).some(key=>key!=='url')||typeof options.url!=='string')throw Error('No matching signature.');
  if(createError)throw createError;
  return {id:42};
 },onRemoved:{addListener(){}}};
 const {openForkTab}=load(path.resolve(__dirname,'../vendor/proton-source/source/js/account/openForkTab.ts'),{setTimeout:()=>0},{
  '../config':{baseDomainURL:account},
  '../tools/getTabs':{getTabs:()=>tabs},'./getTabs':{getTabs:()=>tabs},
  '../tools/openTabs':{connectTab(){}},
  '../tools/exponentialBackoff':{isSuspended:async()=>false,suspend(){}},
  '../tools/getGlobalBrowser':{getGlobalBrowser:()=>({})},
  './triggerPromise':{triggerPromise(){}},'./delay':{delay:async()=>{}},
  '../../tools/sendMessageToBackground':{sendMessageToBackground:async()=>result},
 });
 return {openForkTab,calls};
}
test('Proton sign-in opens a native tab with the validated worker URL',async()=>{
 const f=fixture(url);await f.openForkTab();assert.deepEqual(f.calls,[{url}]);
});
test('a worker warning cannot become invalid tabs.create properties during Proton sign-in',async()=>{
 const warning={Warning:true,Error:'Temporary account failure'};
 const f=fixture({error:warning});await assert.rejects(f.openForkTab(),error=>error===warning);assert.equal(f.calls.length,0);
});
test('malformed and non-authorization login replies never reach the native tab API',async()=>{
 for(const result of [undefined,null,true,17,{}, {url}, {[0]:'h'},'https://evil.test/authorize',account+'/dashboard','http://account.proton.me/authorize','https://account.protonvpn.com/authorize']){
  const f=fixture(result);await assert.rejects(f.openForkTab(),/VpnSignInInvalidResponse/);assert.equal(f.calls.length,0);
 }
});
test('a native tab failure after a valid login reply remains observable',async()=>{
 const failure=Error('Tab creation failed');const f=fixture(url,failure);await assert.rejects(f.openForkTab(),error=>error===failure);assert.deepEqual(f.calls,[{url}]);
});
