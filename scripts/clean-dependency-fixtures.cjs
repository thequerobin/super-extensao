const fs = require('node:fs');
const path = require('node:path');

// Chromium scans the unpacked project, including ignored build dependencies.
// These public-encrypt fixtures are used only by the dependency's own tests.
const directory = path.resolve(__dirname, '../vendor/floccus-source/node_modules/public-encrypt/test');
const fixtures = [
  'test_cert.pem',
  'test_key.pem',
  'test_rsa_privkey.pem',
  'test_rsa_privkey_encrypted.pem',
  'test_rsa_pubkey.pem',
];
let removed = 0;
for (const name of fixtures) {
  const file = path.join(directory, name);
  if (!fs.existsSync(file)) continue;
  fs.unlinkSync(file);
  removed++;
}
console.log(`Chaves/certificados de teste removidos das dependências: ${removed}.`);
