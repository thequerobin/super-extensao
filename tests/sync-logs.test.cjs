const { test } = require('node:test');
const assert = require('node:assert/strict');
const { downloadSyncLogs } = require('../sync/source/logs.cjs');
for (const anonymous of [false, true]) {
  test(`diagnostic export uses product name/version and preserves anonymization=${anonymous}`, async () => {
    let downloaded, redacted = false;
    const logger = {
      async getLogs() { return ['private bookmark title']; },
      async anonymizeLogs(logs) { redacted = true; assert.deepEqual(logs, ['private bookmark title']); return ['redacted']; },
      async download(name, blob) { downloaded = { name, text: await blob.text() }; },
    };
    await downloadSyncLogs({ logger, version: '1.6.2', anonymous, now: new Date('2026-11-11T12:00:00Z') });
    assert.equal(downloaded.name, `super-extensao-sincronizacao-1.6.2-2026-11-11-${anonymous ? 'anonimizado' : 'completo'}.log`);
    assert.match(downloaded.text, /Super Extensão — Sincronização\nVersão: 1\.6\.2/);
    assert.equal(redacted, anonymous);
    if (anonymous) assert.doesNotMatch(downloaded.text, /private/);
    else assert.match(downloaded.text, /private bookmark title/);
  });
}
