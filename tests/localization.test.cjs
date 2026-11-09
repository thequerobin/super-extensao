const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('somente inglês e PT-BR são distribuídos nos catálogos da Nova guia',()=>{
  const directory=path.join(root,'vendor/tabliss-source/src/locales/lang');
  assert.deepEqual(fs.readdirSync(directory).sort(),['en.json','pt-BR.json']);
  assert.deepEqual(fs.readdirSync(path.join(root,'_locales')).sort(),['en','pt_BR']);
});
test('todas as mensagens nativas inglesas têm tradução PT-BR preenchida',()=>{
  const directory=path.join(root,'vendor/tabliss-source/src/locales/lang');
  const english=JSON.parse(fs.readFileSync(path.join(directory,'en.json'),'utf8'));
  const portuguese=JSON.parse(fs.readFileSync(path.join(directory,'pt-BR.json'),'utf8'));
  for(const key of Object.keys(english))assert.ok(typeof portuguese[key]==='string'&&portuguese[key].trim(),key);
});
