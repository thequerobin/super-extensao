const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const routing = require('../vpn/engine/routing.js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'vpn/engine/routing.js'), 'utf8');
const locals = ['localhost', '127.0.0.1', '127.0.0.0/8', '127.0.0.1:80', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '[::1]', '<local>'];
const options = { scheme: 'https', apiExclusions: ['account.proton.me'], localExclusions: locals };
const fixed = (split = {}) => routing.createFixedConfig('node.protonvpn.net', 4443, split, options);
function pac(config, api = routing) {
  const context = vm.createContext({ isInNet(host, network, mask) {
    const ip = text => text.split('.').reduce((sum, part) => (sum * 256 + Number(part)) >>> 0, 0);
    if (!/^\d+(\.\d+){3}$/.test(host)) return false;
    return (ip(host) & ip(mask)) === (ip(network) & ip(mask));
  } });
  vm.runInContext(api.createPacScript(config, locals).pacScript.data, context, { timeout: 1000 });
  return url => { const parsed = new URL(url); return context.FindProxyForURL(url, parsed.hostname); };
}
test('own routing preserves effective exclusion/include lists, service exceptions and disabled defaults', () => {
  assert.deepEqual(fixed({ mode: 'exclude', filteredDomains: ['skip.test', '.skip.test'] }), {
    mode: 'fixed_servers', rules: { singleProxy: { scheme: 'https', host: 'node.protonvpn.net', port: 4443 }, bypassList: ['skip.test', '.skip.test', 'account.proton.me', ...locals] },
  });
  const include = fixed({ mode: 'include', filteredDomains: ['only.test', '.only.test'] });
  assert.deepEqual(include.rules.bypassList, ['account.proton.me', ...locals]);
  assert.deepEqual(include.rules.includeOnly, ['only.test', '.only.test', '.protonvpn.net', '.protonvpn.com']);
  assert.equal(fixed().rules.includeOnly, undefined);
  assert.equal(routing.createFixedConfig('', 0, {}, options).rules.singleProxy.host, '');
});
test('PAC and indicator agree on exact hosts, suffixes, API bypasses, private networks and include-only routes', () => {
  for (const split of [
    {}, { mode: 'exclude', filteredDomains: ['skip.test', '.skip.test', '203.0.113.0/24'] },
    { mode: 'include', filteredDomains: ['only.test', '.only.test', '10.1.1.1', '192.0.2.5'] },
    { mode: 'include', filteredDomains: [] },
  ]) {
    const config = fixed(split), route = pac(config);
    for (const url of ['https://only.test', 'https://sub.only.test', 'https://notonly.test', 'https://skip.test', 'https://sub.skip.test', 'https://notskip.test', 'https://other.test', 'https://account.proton.me', 'https://node.protonvpn.net', 'http://localhost', 'http://printer', 'http://127.0.0.2', 'http://10.1.1.1', 'http://192.168.1.2', 'http://172.31.2.3', 'http://203.0.113.5', 'http://192.0.2.5', 'http://169.254.1.2', 'http://[::1]', 'http://[fe80::1]'])
      if (split.mode === 'include' || url !== 'http://192.0.2.5')
        assert.equal(route(url) !== 'DIRECT', routing.usesVpn(url, config.rules), JSON.stringify({ split, url }));
  }
});
test('empty include mode retains only required service routing and exclusion always wins', () => {
  const config = fixed({ mode: 'include' }), route = pac(config);
  assert.equal(route('https://other.test'), 'DIRECT');
  assert.equal(route('https://node.protonvpn.net'), 'HTTPS node.protonvpn.net:4443');
  config.rules.includeOnly.push('account.proton.me');
  assert.equal(pac(config)('https://account.proton.me'), 'DIRECT');
});
test('port-aware rules, CIDR boundaries and internal pages cannot give a false protected indication', () => {
  const policy = { bypassList: ['port.test:8443', '203.0.113.0/24'] };
  assert.equal(routing.usesVpn('https://port.test:8443', policy), false);
  assert.equal(routing.usesVpn('https://port.test:443', policy), true);
  assert.equal(routing.usesVpn('https://203.0.113.255', policy), false);
  assert.equal(routing.usesVpn('https://203.0.114.0', policy), true);
  for (const url of ['about:blank', 'chrome://settings', 'file:///tmp/file', 'invalid']) assert.equal(routing.usesVpn(url, policy), false);
  const config = fixed({ mode: 'include', filteredDomains: ['port.test:8443'] });
  assert.equal(pac(config)('https://port.test:8443'), 'HTTPS node.protonvpn.net:4443');
  assert.equal(pac(config)('https://port.test'), 'DIRECT');
});
test('PAC is injection-safe and rejects invalid endpoints before a browser write', () => {
  const config = fixed({ mode: 'include', filteredDomains: ['evil.test\"); throw Error("injected");//'] });
  assert.equal(pac(config)('https://safe.test'), 'DIRECT');
  for (const proxy of [{ host: 'bad";throw Error()//' }, { port: 0 }, { port: 65536 }, { port: '4443' }, { scheme: 'socks5' }])
    assert.throws(() => routing.createPacScript({ ...config, rules: { ...config.rules, singleProxy: { ...config.rules.singleProxy, ...proxy } } }), /VpnInvalidProxyEndpoint/);
  assert.throws(() => fixed({ filteredDomains: [null] }), /VpnInvalidRoutingRules/);
});
test('the core loads without browser/storage/network APIs and does not mutate inputs', () => {
  const context = vm.createContext({ URL }); vm.runInContext(source, context);
  const split = { mode: 'exclude', filteredDomains: ['skip.test'] }, before = JSON.stringify(split);
  const config = context.SuperVpnRouting.createFixedConfig('node.protonvpn.net', 4443, split, options);
  config.rules.bypassList.push('other.test'); assert.equal(JSON.stringify(split), before);
  assert.equal(Object.isFrozen(context.SuperVpnRouting), true);
});
test('production Babel/minification keeps generated PAC self-contained', async () => {
  const babel = await import('../vendor/proton-source/node_modules/@babel/core/lib/index.js');
  const { minify } = require('../vendor/proton-source/node_modules/terser');
  const transformed = await babel.transformAsync(source, { configFile: path.join(root, 'vendor/proton-source/.babelrc'), filename: path.join(root, 'vpn/engine/routing.js') });
  const compressed = await minify(transformed.code, { compress: true, mangle: true });
  const context = vm.createContext({ URL }); vm.runInContext(compressed.code, context);
  const config = context.SuperVpnRouting.createFixedConfig('node.protonvpn.net', 4443, { mode: 'include', filteredDomains: ['only.test'] }, options);
  assert.equal(pac(config, context.SuperVpnRouting)('https://only.test'), 'HTTPS node.protonvpn.net:4443');
  assert.equal(pac(config, context.SuperVpnRouting)('https://other.test'), 'DIRECT');
});
test('the worker compatibility boundary delegates compilation to the own core', () => {
  const filename = path.join(root, 'vendor/proton-source/source/js/tools/proxy.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const calls = [], exports = {};
  const mocks = {
    '../../../../../vpn/engine/routing': {
      createFixedConfig(...args) { calls.push('fixed'); return routing.createFixedConfig(...args); },
      createPacScript(...args) { calls.push('pac'); return routing.createPacScript(...args); },
    },
    '../config': { scheme: 'https', excludeApiFromProxy: true, apiDomainsExclusion: options.apiExclusions, proxyLocalNetworkExclusion: locals },
  };
  vm.runInNewContext(code, { exports, require: name => mocks[name] || {} });
  const config = exports.getFixedServerConfig('node.protonvpn.net', 4443, { mode: 'include', filteredDomains: ['only.test'] });
  assert.equal(pac(config)('https://only.test'), 'HTTPS node.protonvpn.net:4443');
  assert.match(exports.getPacScript(config).pacScript.data, /FindProxyForURL/);
  assert.deepEqual(calls, ['fixed', 'pac']);
  const host = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
  assert.ok(host.indexOf('vpn/engine/routing.js') < host.indexOf('vpn-indicator.js'));
  assert.ok(host.indexOf('vpn-indicator.js') < host.indexOf('vpn/js/service.js'));
});
