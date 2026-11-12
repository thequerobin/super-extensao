const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-ts.cjs');
const root = path.resolve(__dirname, '..');
const {StorageLane, RequestChannel, VpnIOError} = load(path.join(root, 'vpn/engine/io.ts'));
const deferred = () => {let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject};};
const tick = () => new Promise(resolve=>setImmediate(resolve));
function timer() {let next=0; const jobs=new Map(); return {set(fn){jobs.set(++next,fn);return next;},clear(id){jobs.delete(id);},expire(){const current=[...jobs.values()];jobs.clear();current.forEach(fn=>fn());},get size(){return jobs.size;}};}
const code = expected => error => error.code === expected;

test('storage read timeout permits another read and ignores the old native reply', async()=>{
 const clock=timer(),lane=new StorageLane(clock),old=deferred();
 const first=lane.read(()=>old.promise,10),failed=assert.rejects(first,code('VpnStorageReadTimedOut'));
 await tick();clock.expire();await failed;
 assert.equal(await lane.read(async()=> 'current',10),'current');old.resolve('obsolete');await tick();assert.equal(clock.size,0);
});
test('native writes retain their lane after observer timeout; logout removal runs after late completion',async()=>{
 const clock=timer(),lane=new StorageLane(clock),write=deferred(),events=[];let disk;
 const first=lane.mutate(async()=>{events.push('write');await write.promise;disk='secret';},10),failed=assert.rejects(first,error=>error.uncertain&&code('VpnStorageWriteTimedOut')(error));
 await tick();clock.expire();await failed;
 const remove=lane.mutate(async()=>{events.push('remove');disk=undefined;},10),removed=assert.rejects(remove,code('VpnStorageWriteTimedOut'));
 await tick();assert.deepEqual(events,['write']);clock.expire();await removed;
 write.resolve();await tick();assert.deepEqual(events,['write','remove']);assert.equal(disk,undefined);
});
test('a read queued behind a stuck write expires without issuing a stale native get',async()=>{
 const clock=timer(),lane=new StorageLane(clock),write=deferred();let reads=0;
 const mutation=lane.mutate(()=>write.promise,10),failed=assert.rejects(mutation,code('VpnStorageWriteTimedOut'));
 const read=lane.read(async()=>++reads,10),expired=assert.rejects(read,code('VpnStorageReadTimedOut'));
 await tick();clock.expire();await Promise.all([failed,expired]);write.resolve();await tick();assert.equal(reads,0);
});
test('native mutation rejection does not poison the following operation',async()=>{
 const clock=timer(),lane=new StorageLane(clock);await assert.rejects(lane.mutate(async()=>{throw Error('failure');},10));
 let removed=false;await lane.mutate(async()=>{removed=true;},10);assert.equal(removed,true);assert.equal(clock.size,0);
});
test('worker reads expire, can retry and never deliver late data',async()=>{
 const clock=timer(),channel=new RequestChannel(clock),old=deferred();let delivered=false;
 const first=channel.send('state',()=>old.promise,10).then(()=>{delivered=true;});const failed=assert.rejects(first,code('VpnWorkerTimedOut'));
 clock.expire();await failed;assert.equal(await channel.send('state',async()=> 'new',10),'new');old.resolve('old');await tick();assert.equal(delivered,false);
});
test('worker mutation cancels pending state queries before logout and suppresses duplicate resends',async()=>{
 const clock=timer(),channel=new RequestChannel(clock),state=deferred(),logout=deferred();let sends=0;
 const query=channel.send('user',()=>state.promise,10),cancelled=assert.rejects(query,code('VpnOperationCancelled'));
 const first=channel.send('logOut',()=>{sends++;return logout.promise;},10),pending=assert.rejects(first,error=>error.uncertain&&code('VpnOperationPending')(error));
 await cancelled;clock.expire();await pending;
 await assert.rejects(channel.send('logOut',async()=>{sends++;},10),code('VpnOperationPending'));assert.equal(sends,1);
 state.resolve('old user');logout.resolve();await tick();await channel.send('logOut',async()=>{sends++;},10);assert.equal(sends,2);
});
test('worker exceptions are sanitized and leave commands available for a later attempt',async()=>{
 const channel=new RequestChannel(timer());await assert.rejects(channel.send('disconnect',()=>{throw Error('private');},10),error=>error.uncertain&&error.message==='VpnWorkerUnavailable');
 assert.equal(await channel.send('disconnect',async()=>true,10),true);
});
function adapter(chrome) {
 const loaded=load(path.join(root,'vendor/proton-source/source/js/tools/nativeStorage.ts'),{chrome});
 loaded.storageTimeouts.read=5;loaded.storageTimeouts.write=5;loaded.storageTimeouts.managed=5;return loaded.nativeStorage;
}
test('shared native adapter consumes callback errors, reports faults, and supports Promise-only APIs',async()=>{
 const chrome={runtime:{},storage:{local:{get(key,done){chrome.runtime.lastError={message:'private'};done({});delete chrome.runtime.lastError;}}}},storage=adapter(chrome),faults=[];storage.watchFailures(e=>faults.push(e.code));
 await assert.rejects(storage.get('local','secret'),code('VpnStorageFailed'));assert.deepEqual(faults,['VpnStorageFailed']);
 chrome.storage.local.get=async key=>({[key]:'ok'});assert.equal((await storage.get('local','secret')).secret,'ok');
});
test('adapter distinguishes missing managed policy from a hung managed service',async()=>{
 const chrome={runtime:{},storage:{}},storage=adapter(chrome),faults=[];storage.watchFailures(e=>faults.push(e.code));
 await assert.rejects(storage.get('managed','config'),code('VpnManagedStorageUnavailable'));assert.equal(faults.length,0);
 chrome.storage.managed={get(){}};await assert.rejects(storage.get('managed','config'),code('VpnStorageReadTimedOut'));assert.deepEqual(faults,['VpnStorageReadTimedOut']);
});
test('adapter snapshots queued writes and preserves removal after a missing callback arrives late',async()=>{
 let finish;const disk={},events=[],chrome={runtime:{},storage:{local:{set(value,done){events.push('set');finish=()=>{Object.assign(disk,value);done();};},remove(key,done){events.push('remove');delete disk[key];done();}}}},storage=adapter(chrome);
 const value={session:{token:'original'}},save=storage.set('local',value);value.session.token='changed';await assert.rejects(save,code('VpnStorageWriteTimedOut'));
 await assert.rejects(storage.remove('local','session'),code('VpnStorageWriteTimedOut'));assert.deepEqual(events,['set']);finish();await tick();assert.deepEqual(events,['set','remove']);assert.equal(disk.session,undefined);
});
test('session logout attempts deletion and credential invalidation even when its initial read failed',async()=>{
 const {SessionStore}=load(path.join(root,'vpn/engine/session.ts'));const calls=[];
 const store=new SessionStore({read:async()=>{throw new VpnIOError('VpnStorageReadTimedOut');},write:async()=>{},remove:async()=>{calls.push('remove');throw new VpnIOError('VpnStorageWriteTimedOut',true);},changed:async()=>{calls.push('invalidate');}});
 const before=store.capture();const logout=store.clear();assert.equal(store.capture(),before+1);await assert.rejects(logout,code('VpnStorageWriteTimedOut'));assert.deepEqual(calls,['remove','invalidate']);
});
test('failed policy reads do not cache permissive defaults and a later request can recover',async()=>{
 let failures=1,fetches=0;
 const {getFeatureConfig}=load(path.join(root,'vendor/proton-source/source/js/vpn/features/getFeatureConfig.ts'),{fetch:async()=>{fetches++;return {ok:true,json:async()=>({test:{controllable:true}})};}},{'../../tools/storage':{Storage:{MANAGED:'managed'},storage:{selfItem:()=>({get:async()=>{if(failures-->0)throw new VpnIOError('VpnStorageReadTimedOut');return {test:{controllable:false}};}})}}});
 await assert.rejects(getFeatureConfig('test'),code('VpnStorageReadTimedOut'));assert.equal(fetches,0);
 assert.equal((await getFeatureConfig('test')).controllable,false);assert.equal(fetches,0);
});
test('storage facade propagates native failures instead of presenting an empty successful cache',async()=>{
 const chrome={runtime:{},storage:{local:{get(_,done){chrome.runtime.lastError={message:'private'};done({});delete chrome.runtime.lastError;}}}};
 const {storage}=load(path.join(root,'vendor/proton-source/source/js/tools/storage.ts'),{chrome});
 await assert.rejects(storage.item('session').load(),code('VpnStorageFailed'));
 chrome.storage.local.get=(_,done)=>done({});assert.deepEqual(Object.keys(await storage.item('session').load()),[]);
});
test('shared panel operations work with the sync module Promise implementation lacking finally',async()=>{
 class LegacyPromise extends Promise {} Object.defineProperty(LegacyPromise.prototype,'finally',{value:undefined});
 const {StorageLane,RequestChannel}=load(path.join(root,'vpn/engine/io.ts'),{Promise:LegacyPromise});const clock=timer(),lane=new StorageLane(clock),channel=new RequestChannel(clock);
 assert.equal(await lane.read(async()=>true,10),true);assert.equal(await channel.send('state',async()=> 'connected',10),'connected');
 const gate=deferred(),query=channel.send('user',()=>gate.promise,10),failed=assert.rejects(query,code('VpnOperationCancelled'));
 await channel.send('signOut',async()=>{},10);await failed;gate.resolve();assert.equal(clock.size,0);
});
