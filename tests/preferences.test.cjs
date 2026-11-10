const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'preferences.js'), 'utf8');

test('shared preferences keep the existing storage keys and normalize legacy values', async () => {
  const writes = [];
  const storage = {
    local: { get: async () => ({ theme: 'auto' }), set: async value => writes.push(['local', value]) },
    sync: { get: async () => ({ 'tabliss/config/locale': 'en_US' }), set: async value => writes.push(['sync', value]) }
  };
  const context = vm.createContext({ chrome: { storage }, console });
  vm.runInContext(source, context);
  const { theme, locale } = context.SuperPreferences;
  assert.equal(await theme.get(), 'system');
  assert.equal(await locale.get(), 'en');
  await theme.set('light');
  await locale.set('pt-PT');
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [
    ['local', { theme: 'light' }],
    ['sync', { 'tabliss/config/locale': 'pt-BR' }]
  ]);
});

test('an update from another panel wins over the initial storage read', async () => {
  let completeRead;
  const pendingRead = new Promise(resolve => { completeRead = resolve; });
  const listeners = new Set();
  const storage = {
    sync: { get: () => pendingRead },
    onChanged: {
      addListener: listener => listeners.add(listener),
      removeListener: listener => listeners.delete(listener)
    }
  };
  const context = vm.createContext({ chrome: { storage }, console });
  vm.runInContext(source, context);
  const received = [];
  const unsubscribe = context.SuperPreferences.locale.watch(value => received.push(value));
  for (const listener of listeners) {
    listener({ 'tabliss/config/locale': { newValue: 'en' } }, 'sync');
  }
  completeRead({ 'tabliss/config/locale': 'pt-BR' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(received, ['en']);
  unsubscribe();
  assert.equal(listeners.size, 0);
});
