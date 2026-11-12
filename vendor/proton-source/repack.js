// Repack build ZIPs without extracting files or interpolating paths into a shell.
const fs = require('node:fs');
const path = require('node:path');
const {unzipSync, zipSync} = require('fflate');
const maxCompressedBytes = 128 * 1024 * 1024;
const maxExpandedBytes = 256 * 1024 * 1024;

function repack(source, destination = source, mtime = Date.now()) {
 if (!source) throw new Error('Informe o arquivo ZIP de origem.');
 if (fs.statSync(source).size > maxCompressedBytes) throw new Error('ZIP acima do limite de 128 MiB.');
 const date = new Date(mtime);
 if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1980 || date.getUTCFullYear() > 2107) throw new Error('Data inválida para ZIP.');
 // DOS ZIP dates are local fields; normalize those fields to UTC independently of host TZ.
 const zipDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
 let expanded = 0, entries = 0;
 const files = unzipSync(fs.readFileSync(source), {filter(file) {
  const name = file.name.replace(/\/$/, '');
  if (!name || /[\\:\0]/.test(name) || name.startsWith('/') || name.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Caminho inválido no ZIP.');
  expanded += file.originalSize;
  if (++entries > 10000 || expanded > maxExpandedBytes) throw new Error('ZIP expandido acima do limite.');
  return !file.name.endsWith('/');
 }});
 const sorted = Object.create(null);
 for (const name of Object.keys(files).sort()) sorted[name] = [files[name], {mtime: zipDate}];
 const result = zipSync(sorted, {level: 9});
 const target = path.resolve(destination);
 const temporary = fs.mkdtempSync(path.join(path.dirname(target), '.vpn-repack-'));
 try {
  const pending = path.join(temporary, 'archive.zip');
  fs.writeFileSync(pending, result);
  fs.renameSync(pending, target);
 } finally {fs.rmSync(temporary, {recursive: true, force: true});}
}
module.exports = {repack};
if (require.main === module) {
 try {
  const timeFile = 'commit-time.txt';
  const mtime = fs.existsSync(timeFile) ? Number(fs.readFileSync(timeFile, 'utf8')) : Number(process.env.COMMIT_TIME) * 1000 || Date.now();
  repack(process.argv[2], process.argv[3] || process.argv[2], mtime);
  if (!fs.existsSync(timeFile)) fs.writeFileSync(timeFile, String(mtime));
 } catch (error) {console.error(error.message);process.exitCode = 1;}
}
