const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('popup height restores, drags with screen coordinates, clamps and saves on release', async () => {
  const events = {}, attrs = {}, saved = [];
  let css, captured = false;
  const grip = {
    addEventListener: (name, fn) => { events[name] = fn; },
    setAttribute: (name, value) => { attrs[name] = value; },
    setPointerCapture: () => { captured = true; },
    hasPointerCapture: () => captured,
    releasePointerCapture: () => { captured = false; }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../popup-resize.js'), 'utf8'), {
    console,
    document: {
      getElementById: () => grip,
      documentElement: {style: {setProperty: (_, value) => { css = value; }}},
      body: {classList: {add() {}, remove() {}}}
    },
    chrome: {storage: {local: {
      get: async () => ({popupHeight:460}),
      set: async value => { saved.push(value.popupHeight); }
    }}}
  });
  await Promise.resolve();
  assert.equal(css, '460px');
  const event = {button:0, pointerId:1, screenY:500, preventDefault() {}};
  events.pointerdown(event);
  events.pointermove({...event, screenY:580});
  assert.equal(css, '540px');
  assert.deepEqual(saved, []);
  events.pointerup(event);
  assert.deepEqual(saved, [540]);
  assert.equal(captured, false);
  events.keydown({...event, key:'End'});
  assert.equal(css, '600px');
  events.pointerdown(event);
  events.pointermove({...event, screenY:100});
  assert.equal(css, '360px');
  events.pointercancel(event);
  assert.equal(saved.at(-1), 360);
  events.dblclick();
  assert.equal(attrs['aria-valuenow'], '580');
  assert.equal(saved.at(-1), 580);
});
