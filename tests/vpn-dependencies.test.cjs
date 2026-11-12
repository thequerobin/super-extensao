const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),provider=path.join(root,'vendor/proton-source'),dependency=createRequire(path.join(provider,'package.json'));
const {zipSync,unzipSync,strToU8,strFromU8}=dependency('fflate');
const {repack}=require(path.join(provider,'repack.js'));
const mtime=Date.UTC(2026,10,12,12,30,0);
function temporary(run){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vpn-repack-test-'));try{return run(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('repacking preserves nested files and names containing spaces or shell characters without extracting',()=>temporary(dir=>{
 const source=path.join(dir,'source.zip'),target=path.join(dir,'output archive.zip');fs.writeFileSync(source,zipSync({'folder/a file.txt':strToU8('first'),'folder/$(touch injected).txt':strToU8('second')}));
 repack(source,target,mtime);const result=unzipSync(fs.readFileSync(target));assert.equal(strFromU8(result['folder/a file.txt']),'first');assert.equal(strFromU8(result['folder/$(touch injected).txt']),'second');assert.ok(!fs.existsSync(path.join(dir,'injected')));assert.deepEqual(fs.readdirSync(dir).sort(),['output archive.zip','source.zip']);
}));
test('ZIP repack is deterministic across entry order and host timezone',()=>temporary(dir=>{
 const a=path.join(dir,'a.zip'),b=path.join(dir,'b.zip');const entries={'z.txt':strToU8('z'),'a.txt':strToU8('a')};fs.writeFileSync(a,zipSync(entries));fs.writeFileSync(b,zipSync({'a.txt':entries['a.txt'],'z.txt':entries['z.txt']}));
 const code='require(process.argv[1]).repack(process.argv[2],process.argv[2],Number(process.argv[3]))';
 for(const [file,tz] of [[a,'UTC'],[b,'America/Sao_Paulo']]){const result=spawnSync(process.execPath,['-e',code,path.join(provider,'repack.js'),file,String(mtime)],{env:{...process.env,TZ:tz},encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
 assert.deepEqual(fs.readFileSync(a),fs.readFileSync(b));
}));
test('invalid ZIP paths are rejected before replacing the original archive or creating files',()=>temporary(dir=>{
 for(const name of ['../escape.txt','/absolute.txt','C:/outside.txt','folder/../../out','folder\\escape.txt']){
  const source=path.join(dir,'source.zip'),bytes=zipSync({[name]:strToU8('payload')});fs.writeFileSync(source,bytes);assert.throws(()=>repack(source,source,mtime),/Caminho inválido/);assert.deepEqual(fs.readFileSync(source),Buffer.from(bytes));
 }
 assert.deepEqual(fs.readdirSync(dir),['source.zip']);
}));
test('invalid ZIP input exits nonzero and preserves an existing destination',()=>temporary(dir=>{
 const source=path.join(dir,'bad.zip'),target=path.join(dir,'target.zip');fs.writeFileSync(source,'invalid');fs.writeFileSync(target,'unchanged');const result=spawnSync(process.execPath,[path.join(provider,'repack.js'),source,target],{cwd:dir,encoding:'utf8'});assert.notEqual(result.status,0);assert.equal(fs.readFileSync(target,'utf8'),'unchanged');assert.ok(!fs.existsSync(path.join(dir,'commit-time.txt')));
}));
test('oversized ZIP metadata is rejected before decompression and invalid timestamps do not replace the source',()=>temporary(dir=>{
 const source=path.join(dir,'source.zip'),bytes=Buffer.from(zipSync({'small.txt':strToU8('small')}));const central=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));bytes.writeUInt32LE(257*1024*1024,central+24);fs.writeFileSync(source,bytes);assert.throws(()=>repack(source,source,mtime),/limite/);assert.deepEqual(fs.readFileSync(source),bytes);assert.throws(()=>repack(source,source,NaN),/Data inválida/);
}));
test('updated real Sentry client remains disabled and has no reporting destination',async()=>{
 const load=require('./helpers/load-ts.cjs');const {initSentry}=load(path.join(provider,'source/js/tools/sentry.ts'),{}, {
  '@sentry/browser':dependency('@sentry/browser'),'../config':{getFullAppVersion:()=> 'test',hostname:'extension.local'},'../tools/storage':{storage:{item:()=>({})}},'../tools/getErrorMessage':{getErrorAsString:e=>String(e)},'../tools/milliSeconds':{milliSeconds:{fromMinutes:n=>n*60000}},'../vpn/features/CrashReports':{CrashReports:{create:async()=>({getConfig:async()=>({value:false})})}},
 });
 const client=initSentry().getClient(),options=client.getOptions();assert.equal(options.enabled,false);assert.equal(options.dsn,undefined);assert.equal(options.sendClientReports,false);assert.ok(!options.integrations.some(i=>['Breadcrumbs','GlobalHandlers','BrowserApiErrors'].includes(i.name)));await client.close(10);
});
test('production package license texts and exact sources are delivered reproducibly with the VPN',()=>{
 const {vpnNotices}=require('../scripts/vpn-licenses.cjs');const generated=vpnNotices();assert.equal(fs.readFileSync(path.join(root,'vpn/THIRD-PARTY-NOTICES.txt'),'utf8'),generated);assert.match(generated,/@sentry\/browser@10\.78\.0/);assert.match(generated,/Mozilla Public License/);assert.match(generated,/Permission is hereby granted/);assert.match(generated,/registry\.npmjs\.org/);
});
