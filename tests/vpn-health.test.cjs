const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename=path.resolve(__dirname,'..',relative),exports={};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{exports,Promise,Date,encodeURIComponent,require:id=>mocks[id]||{}},{filename});return exports;
}
const {serverHealth}=load('vpn/engine/health.ts');
const calculate=load('vendor/proton-source/source/js/vpn/calculateLogicalScoreAndUpStatus.ts',{'./calculateScore':{calculateScore:()=>1}});
const merge=load('vendor/proton-source/source/js/vpn/mergeLoadsIntoLogicals.ts',{'./calculateLogicalScoreAndUpStatus':calculate});
function fixture({cached,reply={LogicalServers:[]},loads=[],v2=true,loadError}={}) {
  const requests=[],statusRequests=[];
  const api=load('vendor/proton-source/source/js/vpn/getLogicals.ts',{
    '../../../../../vpn/engine/health':{serverHealth},
    '../tools/storage':{Storage:{LOCAL:'local'},storage:{item:()=>({})}},
    './logicalServers':{logicalServers:{get:async()=>cached}},
    './useLogicalsV2':{useLogicalsV2:async()=>v2},
    '../intervals':{getLogicalCheckUpRefreshInterval:()=>60000},
    '../account/fetchWithUserInfo':{fetchWithUserInfo:async url=>{requests.push(url);return reply;}},
    './getLoads':{getLoads:async id=>{statusRequests.push(id);if(loadError)throw loadError;return {loads,time:Date.now()};}},
    './mergeLoadsIntoLogicals':merge,
  });
  return {check:id=>api.shouldStayOnLogical(id,'BR',{Lat:0,Long:0}),requests,statusRequests};
}
const logical=(id='a')=>({ID:id,StatusReference:{Index:0,Cost:0,Penalty:0}});
test('metadata, visibility and stale UI _up flags do not establish endpoint failure',()=>{
  for(const item of [undefined,{},logical(),{Visible:false},{_up:false},{Enabled:true,Visible:false,_up:false},{Status:1,Servers:[]}])
    assert.notEqual(serverHealth(item),'down');
  assert.equal(serverHealth({Enabled:true,Visible:false,_up:false}),'up');
  assert.equal(serverHealth({Status:1,Servers:[{Status:1,ServicesDown:0}]}),'up');
  for(const item of [{Enabled:false},{Status:0},{Status:1,Servers:[{Status:0}]},{Servers:[{Status:1,ServicesDown:3}]}])
    assert.equal(serverHealth(item),'down');
  assert.equal(serverHealth({Servers:[{Status:0},{}]}),'unknown');
});
test('a v2 metadata response without status data keeps the connected server',async()=>{
  const f=fixture({reply:{LogicalServers:[logical()]}});
  assert.equal(await f.check('a'),true);assert.equal(f.statusRequests.length,0);
});
test('v2 status data is merged before deciding whether to change servers',async()=>{
  for(const enabled of [true,false]) {
    const f=fixture({reply:{LogicalServers:[logical()],StatusID:'status'},loads:[{Enabled:enabled,Visible:true,ServerCapacity:10}]});
    assert.equal(await f.check('a'),enabled);assert.deepEqual(f.statusRequests,['status']);
  }
});
test('fresh cached flags are recomputed without stale _up and tolerate numeric ID representations',async()=>{
  const f=fixture({cached:{lastLoadUpdate:Date.now(),value:[{ID:4,Enabled:true,Visible:false,_up:false}]}});
  assert.equal(await f.check('4'),true);assert.equal(f.requests.length,0);
  const down=fixture({cached:{lastLoadUpdate:Date.now(),value:[{ID:'4',Enabled:false,_up:true}]}});
  assert.equal(await down.check(4),false);
});
test('missing target or load information does not falsely report an outage',async()=>{
  const f=fixture({reply:{LogicalServers:[{ID:'other',Enabled:false}]}});
  assert.equal(await f.check('a'),true);
  const noLoad=fixture({reply:{LogicalServers:[logical()],StatusID:'status'},loads:[]});
  assert.equal(await noLoad.check('a'),true);
  const network=fixture({reply:{LogicalServers:[logical()],StatusID:'status'},loadError:Error('network')});
  await assert.rejects(()=>network.check('a'),/network/);
});
test('legacy v1 keeps a healthy endpoint and still recognizes an explicit outage',async()=>{
  for(const status of [0,1]) {
    const f=fixture({v2:false,reply:{LogicalServers:[{ID:'a',Status:status,Servers:[{Status:status}]}]}});
    assert.equal(await f.check('a'),status===1);assert.ok(f.requests[0].startsWith('vpn/v1/'));
  }
});
