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

function themeContext() {
  const listeners = new Set(), systemListeners = new Set();
  const values = { theme: 'system' };
  const media = {
    matches: false,
    addEventListener(_type, fn) { systemListeners.add(fn); },
    removeEventListener(_type, fn) { systemListeners.delete(fn); },
  };
  const context = vm.createContext({ console, matchMedia: () => media, chrome: { storage: {
    local: { get: async defaults => ({ ...defaults, ...values }), set: async next => {
      Object.assign(values, next);
      for (const fn of listeners) fn({ theme: { newValue: next.theme } }, 'local');
    } },
    onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
  } } });
  vm.runInContext(source, context);
  return { preferences: context.SuperPreferences, listeners, systemListeners, media };
}
test('shared theme bindings distinguish selected theme from resolved system theme and clean up listeners', async () => {
  const f = themeContext(), target = { dataset: {} }, received = [];
  const stop = f.preferences.bindTheme(target, (...args) => received.push(args));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(target.dataset.superTheme, 'light');
  f.media.matches = true; for (const fn of f.systemListeners) fn();
  assert.equal(target.dataset.superTheme, 'dark');
  await f.preferences.theme.set('light');
  f.media.matches = false; for (const fn of f.systemListeners) fn();
  f.media.matches = true; for (const fn of f.systemListeners) fn();
  assert.equal(target.dataset.superTheme, 'light');
  assert.deepEqual(received, [['system', 'light'], ['system', 'dark'], ['light', 'light']]);
  stop(); assert.equal(f.listeners.size, 0); assert.equal(f.systemListeners.size, 0);
});
test('disposing a theme binding before its first read prevents changes to a destroyed view', async () => {
  const f = themeContext(), target = { dataset: {} };
  const stop = f.preferences.bindTheme(target);
  stop(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(target.dataset.superTheme, undefined);
  assert.equal(f.listeners.size, 0); assert.equal(f.systemListeners.size, 0);
});
test('preference watchers ignore unrelated changes and normalize removal and legacy values once', async () => {
  const f = themeContext(), received = [];
  const stop = f.preferences.theme.watch(value => received.push(value));
  await new Promise(resolve => setImmediate(resolve));
  for (const fn of f.listeners) {
    fn({ theme: { newValue: 'light' } }, 'sync');
    fn({ other: { newValue: 'light' } }, 'local');
    fn({ theme: { newValue: 'auto' } }, 'local');
    fn({ theme: { newValue: undefined } }, 'local');
    fn({ theme: { newValue: 'invalid' } }, 'local');
  }
  assert.deepEqual(received, ['system', 'dark']); stop();
});
