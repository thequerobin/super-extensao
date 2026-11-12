const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function vpnNotices() {
  const provider = path.join(root, 'vendor/proton-source');
  const packages = JSON.parse(fs.readFileSync(path.join(provider, 'package-lock.json'), 'utf8')).packages;
  const sections = ['Third-party notices for the VPN module. Generated from its locked production dependency tree.\nIncludes production packages even when tree-shaken out of the delivered bundles.\nThe Proton source license is preserved separately in vpn/LICENSE.'];
  for (const [relative, record] of Object.entries(packages).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    if (!relative || record.dev) continue;
    const folder = path.join(provider, relative);
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
    if (manifest.version !== record.version) throw Error('Install the locked VPN dependencies before building notices: ' + relative);
    const names = fs.readdirSync(folder).filter(name => /^(licen[cs]e|copying|notice)(\..*)?$/i.test(name) && fs.statSync(path.join(folder, name)).isFile()).sort();
    if (!names.length) throw Error('Missing VPN license text: ' + relative);
    sections.push(`${manifest.name}@${record.version}\nLicense: ${record.license || manifest.license}\nSource: ${record.resolved || manifest.homepage}\n\n` + names.map(name => `${name}\n${fs.readFileSync(path.join(folder, name), 'utf8').trim()}`).join('\n\n'));
  }
  return sections.join('\n\n' + '='.repeat(72) + '\n\n').replace(/\r\n/g, '\n') + '\n';
}
module.exports = {vpnNotices};
if (require.main === module) fs.writeFileSync(path.join(root, 'vpn/THIRD-PARTY-NOTICES.txt'), vpnNotices());
