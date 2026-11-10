const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'vendor/proton-source');
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: source, stdio: 'inherit', shell: process.platform === 'win32'
});
const target = path.join(root, 'vpn');
fs.rmSync(target, {recursive: true, force: true});
fs.cpSync(path.join(source, 'distribution'), target, {recursive: true});
// The host owns the manifest and service worker. Never ship a second manifest.
fs.rmSync(path.join(target, 'manifest.json'));
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
fs.copyFileSync(path.join(root, 'docs/proton-vpn.md'), path.join(target, 'INTEGRACAO.md'));
