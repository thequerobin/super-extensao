const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseXbel, fromBrowserTree, compareTrees, LIMITS } = require('../sync/engine/tree.cjs');
const { GoogleDriveReader } = require('../sync/engine/google-drive.cjs');
const { inspectGoogleDriveProfile } = require('../sync/engine/index.cjs');
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<xbel><folder id="1"><title>Estudos &amp; trabalho</title><bookmark id="2" href="https://example.com/?a=1&amp;b=2"><title>Favorito</title></bookmark></folder></xbel>';
const profile = { type: 'google-drive', refreshToken: 'private-refresh', bookmark_file: "Luiz's bookmarks.xbel", localRoot: '5' };
const oauth = { googleClientId: 'client', googleClientSecret: 'private-secret' };
const metadata = { id: 'file-id', name: profile.bookmark_file, size: String(Buffer.byteLength(xml)), version: '7', md5Checksum: 'checksum' };
const browserRoot = { id: '5', title: 'Minha pasta', children: [{ id: '6', title: 'Estudos & trabalho', children: [{ id: '7', title: 'Favorito', url: 'https://example.com/?a=1&b=2' }] }] };
function fixture(options = {}) {
  const calls = [];
  async function fetchImpl(url, init) {
    calls.push({ url, init });
    if (options.fetch) return options.fetch(url, init);
    if (url.includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'private-access' }));
    if (url.includes('alt=media')) return new Response(options.content ?? xml);
    if (url.includes('/file-id?')) return new Response(JSON.stringify(options.after || metadata));
    return new Response(JSON.stringify(options.list || { files: [metadata] }));
  }
  return { calls, fetchImpl, reader: new GoogleDriveReader({ oauth, refreshToken: profile.refreshToken, fetchImpl, signal: options.signal, timeout: options.timeout || 30000 }) };
}
test('own XBEL reader preserves entities, nested folders, empty titles and string IDs', () => {
  const tree = parseXbel(xml);
  assert.equal(tree.children[0].title, 'Estudos & trabalho');
  assert.equal(tree.children[0].children[0].url, 'https://example.com/?a=1&b=2');
  assert.equal(tree.children[0].id, '1');
  assert.equal(parseXbel('<xbel><folder id="001"><title></title></folder></xbel>').children[0].title, '');
});
test('invalid, entity-expanding, ambiguous-ID and unsupported XBEL cannot become empty successful inventories', () => {
  for (const input of ['<xbel><folder></xbel>', '<html>login</html>', '<!DOCTYPE xbel [<!ENTITY x "secret">]><xbel/>', '<xbel><separator/></xbel>', '<xbel><bookmark href="https://a" id="1"/><folder id="1"/></xbel>']) assert.throws(() => parseXbel(input), /Sync/);
  const deep = '<xbel>' + '<folder>'.repeat(103) + '</folder>'.repeat(103) + '</xbel>';
  assert.throws(() => parseXbel(deep), /SyncTreeTooLarge/);
});
test('comparison ignores device IDs, preserves duplicate occurrences and distinguishes slash titles from folder nesting', () => {
  const local = fromBrowserTree(browserRoot), remote = parseXbel(xml);
  assert.deepEqual(compareTrees(local, remote), { common: 2, localOnly: 0, remoteOnly: 0, localTotal: 2, remoteTotal: 2 });
  local.children[0].children.push({ ...local.children[0].children[0], id: '8' });
  assert.equal(compareTrees(local, remote).localOnly, 1);
  remote.children[0].title = 'Renamed';
  assert.equal(compareTrees(local, remote).common, 0);
  const slash = { kind: 'folder', children: [{ kind: 'bookmark', title: 'a/b', url: 'https://a' }] };
  const nested = { kind: 'folder', children: [{ kind: 'folder', title: 'a', children: [{ kind: 'bookmark', title: 'b', url: 'https://a' }] }] };
  assert.equal(compareTrees(slash, nested).common, 0);
});
test('Google Drive connector refreshes OAuth, escapes the file query and performs no Drive writes', async () => {
  const f = fixture();
  const file = await f.reader.read(profile.bookmark_file);
  assert.equal(file.content, xml);
  assert.equal(file.revision, '7');
  assert.equal(f.calls[0].init.body.get('refresh_token'), 'private-refresh');
  const list = new URL(f.calls[1].url);
  assert.match(list.searchParams.get('q'), /Luiz\\'s bookmarks/);
  assert.ok(f.calls.slice(1).every(({ init }) => !init.method || init.method === 'GET'));
  assert.ok(f.calls.every(({ init }) => init.credentials === 'omit' && init.redirect === 'error'));
});
test('duplicate names and a missing remote file are handled without selecting, deleting or creating files', async () => {
  const duplicate = fixture({ list: { files: [metadata, { ...metadata, id: 'other' }] } });
  await assert.rejects(() => duplicate.reader.read(profile.bookmark_file), /SyncAmbiguousDriveFile/);
  assert.equal(duplicate.calls.length, 2);
  const empty = fixture({ list: { files: [] } });
  assert.deepEqual(await empty.reader.read(profile.bookmark_file), { exists: false, content: null });
  assert.equal(empty.calls.length, 2);
});
test('changed remote revisions and truncated content cannot be presented as consistent comparisons', async () => {
  const changed = fixture({ after: { ...metadata, version: '8' } });
  await assert.rejects(() => changed.reader.read(profile.bookmark_file), /SyncRemoteFileChanged/);
  const truncated = fixture({ content: '<xbel/>' });
  await assert.rejects(() => truncated.reader.read(profile.bookmark_file), /SyncRemoteFileChanged/);
});
test('authorization and rate failures never expose response bodies or credentials', async () => {
  for (const [status, code] of [[400, 'SyncGoogleAuthorizationRequired'], [401, 'SyncGoogleAuthorizationRequired'], [429, 'SyncGoogleRateLimited'], [500, 'SyncGoogleRequestFailed']]) {
    const f = fixture({ fetch: async () => new Response('private-refresh private-secret', { status }) });
    await assert.rejects(() => f.reader.read(profile.bookmark_file), (error) => error.code === code && !error.message.includes('private'));
  }
});
test('cancellation and deadlines abort in-flight OAuth requests', async () => {
  const fetch = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  const controller = new AbortController();
  const f = fixture({ fetch, signal: controller.signal });
  const pending = f.reader.read(profile.bookmark_file);
  controller.abort();
  await assert.rejects(pending, /SyncCancelled/);
  const timeout = fixture({ fetch, timeout: 5 });
  await assert.rejects(() => timeout.reader.read(profile.bookmark_file), /SyncRequestTimedOut/);
});
test('oversized response headers are rejected before any XML processing', async () => {
  const f = fixture({ fetch: async () => new Response('oversized', { headers: { 'content-length': String(LIMITS.bytes + 1) } }) });
  await assert.rejects(() => f.reader.read(profile.bookmark_file), /SyncFileTooLarge/);
});
test('profile inspection is read-only, returns counts only and blocks unsupported or busy profiles before network access', async () => {
  const f = fixture();
  const bookmarks = { getSubTree: async (id) => { assert.equal(id, '5'); return [browserRoot]; } };
  const result = await inspectGoogleDriveProfile({ profile, oauth, bookmarks, fetchImpl: f.fetchImpl });
  assert.equal(result.common, 2);
  assert.equal(result.remoteExists, true);
  assert.ok(!JSON.stringify(result).includes('private'));
  for (const data of [{ ...profile, type: 'webdav' }, { ...profile, password: 'encrypted' }, { ...profile, localRoot: 'tabs' }, { ...profile, syncing: true }]) {
    await assert.rejects(() => inspectGoogleDriveProfile({ profile: data, oauth, bookmarks, fetchImpl: () => { throw Error('must not fetch'); } }), /Sync/);
  }
  assert.equal(browserRoot.children[0].children.length, 1);
});
test('a concurrent local edit invalidates the inventory without any local or remote mutation', async () => {
  const f = fixture();
  let reads = 0;
  const bookmarks = { getSubTree: async () => {
    reads++;
    return reads === 1 ? [browserRoot] : [{ ...browserRoot, children: [] }];
  } };
  await assert.rejects(() => inspectGoogleDriveProfile({ profile, oauth, bookmarks, fetchImpl: f.fetchImpl }), /SyncLocalTreeChanged/);
});
test('HTTP URL normalization matches browser bookmark canonicalization without changing query semantics', () => {
  const remote = parseXbel('<xbel><bookmark id="1" href="HTTPS://Example.COM:443"><title>One</title></bookmark></xbel>');
  const local = fromBrowserTree({ id: 'root', title: '', children: [{ id: 'native', title: 'One', url: 'https://example.com/' }] });
  assert.equal(compareTrees(local, remote).common, 1);
  assert.throws(() => parseXbel('<xbel><bookmark id="1" href="relative/path"><title>Bad</title></bookmark></xbel>'), /SyncInvalidUrl/);
});
test('the default browser fetch keeps its global receiver instead of the connector instance', async () => {
  const original = globalThis.fetch;
  let calls = 0, reader;
  globalThis.fetch = function () {
    assert.equal(this, globalThis, 'native worker fetch requires the global receiver');
    return Promise.resolve(new Response(JSON.stringify(++calls === 1 ? { access_token: 'private' } : { files: [] })));
  };
  try { reader = new GoogleDriveReader({ oauth, refreshToken: 'private' }); }
  finally { globalThis.fetch = original; }
  assert.deepEqual(await reader.read('bookmarks.xbel'), { exists: false, content: null });
  assert.equal(calls, 2);
});
test('network diagnostics identify the failing stage without exposing exception messages or URLs', async () => {
  const f = fixture({ fetch: async () => { throw new TypeError('private-refresh https://private.test/?token=secret'); } });
  for (const [url, options, stage] of [
    ['https://oauth2.googleapis.com/token', {}, 'oauth'],
    ['https://www.googleapis.com/drive/v3/files?q=private', {}, 'list'],
    ['https://www.googleapis.com/drive/v3/files/private?alt=media', {}, 'download'],
    ['https://www.googleapis.com/drive/v2/files/private?fields=etag', {}, 'metadata'],
    ['https://www.googleapis.com/drive/v2/files/private', { method: 'PATCH' }, 'lock'],
    ['https://www.googleapis.com/upload/drive/v2/files/private', { method: 'PUT' }, 'upload'],
    ['https://www.googleapis.com/drive/v3/files/generateIds', {}, 'createId'],
  ]) {
    await assert.rejects(() => f.reader.request(url, options), error => {
      assert.equal(error.code, 'SyncGoogleNetworkFailed'); assert.equal(error.requestStage, stage);
      assert.equal(error.reason, 'TypeError'); assert.doesNotMatch(JSON.stringify(error) + error.message, /private|secret/);
      return true;
    });
  }
});
test('HTTP failures retain their numeric status and failing stage', async () => {
  const f = fixture({ fetch: async () => new Response('private', { status: 503 }) });
  await assert.rejects(() => f.reader.read('bookmarks.xbel'), error => error.code === 'SyncGoogleRequestFailed' && error.status === 503 && error.requestStage === 'oauth');
});
