const {test} = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
const {createConnectionDiagnostics} = load('vpn/engine/diagnostics.ts');

test('connection diagnostics retain only closed reasons and never record service errors or credentials', () => {
  const warnings = [], log = createConnectionDiagnostics(entry => warnings.push(entry), () => 123);
  log.record('credentials', 'started');
  log.record('credentials', 'failed', {message:'private-token alice@example.com 192.0.2.1', Username:'private-user', Password:'private-password'});
  log.record('tunnel-verification', 'failed', Error('VpnTunnelVerificationFailed'));
  const entries = log.read();
  assert.equal(entries[1].reason, 'VpnConnectionFailed');
  assert.equal(entries[2].reason, 'VpnTunnelVerificationFailed');
  assert.equal(warnings.length, 2);
  assert.ok(!/private|alice|192\.0\.2/.test(JSON.stringify([entries, warnings])));
  assert.deepEqual(Object.keys(entries[1]).sort(), ['outcome','reason','stage','time']);
});

test('diagnostics have a bounded history and detached read/console snapshots', () => {
  const warnings = [], log = createConnectionDiagnostics(entry => warnings.push(entry));
  log.record('network-block', 'failed', Error('VpnTrafficGuardFailed'));
  warnings[0].reason = 'changed';
  const first = log.read(); first[0].stage = 'changed'; first.push({});
  assert.equal(log.read().length, 1);
  assert.equal(log.read()[0].stage, 'network-block');
  assert.equal(log.read()[0].reason, 'VpnTrafficGuardFailed');
  for (let i = 0; i < 60; i++) log.record('proxy-read', 'started');
  assert.equal(log.read().length, 50);
  assert.ok(log.read().every(entry => entry.stage === 'proxy-read'));
});
