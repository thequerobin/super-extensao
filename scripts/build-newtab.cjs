const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'vendor/tabliss-source');
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:chromium'], {
  cwd: source, stdio: 'inherit', shell: process.platform === 'win32'
});
// Preserve the host's HTML, integrations and manifest. Copy only runtime assets.
for (const file of ['main.js', 'main.css', 'polyfills.js', 'theme.js', 'main.js.LICENSE.txt']) {
  fs.copyFileSync(path.join(source, 'dist/chromium', file), path.join(root, 'newtab', file));
}
