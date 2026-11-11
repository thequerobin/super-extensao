const { test } = require('node:test');
const assert = require('node:assert/strict');
const { synchronize } = require('../sync/engine/runner.cjs');
const { serializeXbel, parseXbel } = require('../sync/engine/tree.cjs');
const { index, merge, changes, identify } = require('../sync/engine/model.cjs');
const { encode, decode } = require('../sync/engine/crypto.cjs');
const { apply } = require('../sync/engine/local.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const bookmark = (id, title, url = 'https://' + title + '.test') => ({ kind: 'bookmark', id, title, url: new URL(url).href });
const folder = (id, title, children = []) => ({ kind: 'folder', id, title, children });
const root = children => folder('root', '', children);
function device(initial) {
  let tree = clone(initial), nextId = 100;
  const calls = [];
  function get(id, node = tree) { if (node.id === id) return node; for (const child of node.children || []) { const found = get(id, child); if (found) return found; } }
  function parent(id, node = tree) { if (node.children?.some(child => child.id === id)) return node; for (const child of node.children || []) { const found = parent(id, child); if (found) return found; } }
  const api = {
    async getSubTree(id) { return get(id) ? [clone(get(id))] : []; },
    async create(data) { calls.push(['create', clone(data)]); const item = data.url === undefined ? folder(String(++nextId), data.title) : bookmark(String(++nextId), data.title, data.url); get(data.parentId).children.splice(data.index, 0, item); return clone(item); },
    async update(id, data) { calls.push(['update', id, data]); Object.assign(get(id), data); return clone(get(id)); },
    async move(id, data) { calls.push(['move', id, data]); const item = get(id), old = parent(id); old.children.splice(old.children.indexOf(item), 1); get(data.parentId).children.splice(data.index, 0, item); return clone(item); },
    async remove(id) { calls.push(['remove', id]); const item = get(id); if (item.children?.length) throw Error('Folder not empty'); const old = parent(id); old.children.splice(old.children.indexOf(item), 1); },
  };
  return { api, calls, get tree() { return tree; }, edit(fn) { fn(tree); } };
}
function drive(initial, options = {}) {
  let file = initial ? { exists: true, id: 'file', content: serializeXbel(initial, 20), revision: '1' } : { exists: false, content: null };
  const calls = [];
  return {
    calls,
    async read() { return clone(file); },
    async generateId() { return 'new-file'; },
    async write(before, content, name, id) {
      calls.push({ before, content, name, id });
      if (before.content !== file.content) throw Object.assign(Error('SyncRemoteFileChanged'), { code: 'SyncRemoteFileChanged' });
      file = { exists: true, id: before.id || id, content, revision: String(Number(file.revision || 0) + 1) };
      if (options.afterWrite) await options.afterWrite();
      return clone(file);
    },
    edit(fn) { const tree = parseXbel(file.content); fn(tree); file.content = serializeXbel(tree, 30); file.revision = String(Number(file.revision) + 1); },
    get file() { return file; },
  };
}
function setup(localTree, remoteTree, extra = {}) {
  const d = device(localTree), remote = drive(remoteTree, extra), data = {}, writes = [];
  const storage = { async load(id) { return clone(data[id] || null); }, async save(id, value) { data[id] = clone(value); writes.push(clone(value)); if (extra.onSave) await extra.onSave(value); } };
  const args = { id: 'profile', profile: { type: 'google-drive', localRoot: localTree.id, bookmark_file: 'bookmarks.xbel', refreshToken: 'private', failsafe: true }, oauth: { googleClientId: 'id' }, bookmarks: d.api, storage, client: remote };
  return { d, remote, data, writes, args, run: overrides => synchronize({ ...args, ...overrides }) };
}
function content(tree) { return tree.children.map(node => ({ kind: node.kind, title: node.title, ...(node.kind === 'bookmark' ? { url: node.url } : { children: content(node) }) })); }
test('first synchronization merges both sides, preserves IDs and backs up before writing', async () => {
  const f = setup(root([bookmark('a', 'local')]), root([bookmark('1', 'remote')]));
  await f.run();
  assert.deepEqual(content(f.d.tree), content(parseXbel(f.remote.file.content)));
  assert.equal(f.d.tree.children.length, 2);
  assert.equal(f.data.profile.migrationBackup.local.children[0].id, 'a');
  assert.equal(f.data.profile.migrationBackup.remote.id, 'file');
  assert.ok(f.writes[0].journal && f.writes[0].backups.length);
  const calls = f.d.calls.length, uploads = f.remote.calls.length;
  await f.run();
  assert.equal(f.d.calls.length, calls); assert.equal(f.remote.calls.length, uploads);
});
test('a new file is created once and local duplicates remain separate occurrences', async () => {
  const f = setup(root([bookmark('a', 'same'), bookmark('b', 'same')]), null);
  await f.run(); await f.run();
  assert.equal(f.remote.calls.length, 1);
  assert.equal(parseXbel(f.remote.file.content).children.length, 2);
  assert.notEqual(parseXbel(f.remote.file.content).children[0].id, parseXbel(f.remote.file.content).children[1].id);
});
test('edits, moves, reorders and small deletions propagate in both directions', async () => {
  const items = Array.from({ length: 8 }, (_, i) => bookmark(String(i + 1), 'item' + i));
  const f = setup(root([folder('f', 'Folder', items.map((item, n) => ({ ...item, id: 'l' + n })))]), root([folder('20', 'Folder', items)]));
  await f.run();
  f.d.edit(tree => { const list = tree.children[0].children; list[0].title = 'changed'; tree.children.push(list.splice(1, 1)[0]); list.splice(2, 1); list.reverse(); });
  await f.run();
  assert.deepEqual(content(f.d.tree), content(parseXbel(f.remote.file.content)));
  f.remote.edit(tree => { tree.children[0].title = 'Renamed'; tree.children[0].children[0].url = 'https://edited.test'; });
  await f.run();
  assert.deepEqual(content(f.d.tree), content(parseXbel(f.remote.file.content)));
});
test('disjoint concurrent edits merge and same-field conflicts stop before any write', async () => {
  const f = setup(root([bookmark('local', 'one')]), root([bookmark('1', 'one')]));
  await f.run(); f.d.edit(tree => { tree.children[0].title = 'local title'; });
  f.remote.edit(tree => { tree.children[0].url = 'https://remote.test'; });
  await f.run();
  assert.equal(f.d.tree.children[0].url, 'https://remote.test/');
  f.d.edit(tree => { tree.children[0].title = 'left'; }); f.remote.edit(tree => { tree.children[0].title = 'right'; });
  const calls = f.remote.calls.length;
  await assert.rejects(f.run, /SyncConflict/); assert.equal(f.remote.calls.length, calls);
});
test('deletion-versus-edit and concurrently added children in a deleted folder are conflicts', () => {
  const base = root([folder('1', 'folder', [bookmark('2', 'a')])]);
  const left = root([]), right = clone(base); right.children[0].children[0].title = 'edit';
  assert.throws(() => merge(base, left, right), /SyncConflict/);
  const added = clone(base); added.children[0].children.push(bookmark('3', 'new'));
  assert.throws(() => merge(base, left, added), /SyncConflict/);
});
test('conflicting orders and folder cycles cannot become a destructive plan', () => {
  const base = root([bookmark('1', 'a'), bookmark('2', 'b'), bookmark('3', 'c')]);
  const left = root([base.children[1], base.children[0], base.children[2]]), right = root([base.children[0], base.children[2], base.children[1]]);
  assert.throws(() => merge(base, left, right), /SyncOrderConflict/);
  const b = root([folder('1', 'A'), folder('2', 'B')]);
  const l = root([folder('2', 'B', [folder('1', 'A')])]), r = root([folder('1', 'A', [folder('2', 'B')])]);
  assert.throws(() => merge(b, l, r), /SyncFolderCycle/);
});
test('deleting all bookmarks is blocked even on a one-item folder', async () => {
  const f = setup(root([bookmark('local', 'one')]), root([bookmark('1', 'one')]));
  await f.run(); f.d.edit(tree => { tree.children = []; });
  await assert.rejects(f.run, /SyncDeletionGuard/);
  assert.equal(parseXbel(f.remote.file.content).children.length, 1);
});
test('explicit upload/download use the requested source and still honor deletion guards', async () => {
  const up = setup(root([bookmark('a', 'local')]), root([bookmark('1', 'remote')]));
  await up.run({ profile: { ...up.args.profile, strategy: 'overwrite', failsafe: false } });
  assert.deepEqual(content(up.d.tree), content(parseXbel(up.remote.file.content)));
  assert.equal(up.d.tree.children[0].title, 'local');
  const down = setup(root([bookmark('a', 'local')]), root([bookmark('1', 'remote')]));
  await down.run({ profile: { ...down.args.profile, strategy: 'slave', failsafe: false } });
  assert.equal(down.d.tree.children[0].title, 'remote');
  assert.equal(down.remote.calls.length, 0);
});
test('legacy IDs and cache migrate without duplicating an edited bookmark', async () => {
  const f = setup(root([bookmark('local', 'edited')]), root([bookmark('1', 'one')]));
  await f.run({ legacy: { cache: { id: 'root', title: '', children: [{ id: 'local', title: 'one', url: 'https://one.test' }] }, mapping: { local: '1' } } });
  assert.equal(parseXbel(f.remote.file.content).children.length, 1);
  assert.equal(f.d.tree.children[0].id, 'local');
  assert.equal(parseXbel(f.remote.file.content).children[0].id, '1');
});
test('a committed upload followed by failure resumes without another upload', async () => {
  let fail = true;
  const f = setup(root([bookmark('a', 'local')]), root([bookmark('1', 'remote')]), { afterWrite() { if (fail) { fail = false; throw Error('network stopped after upload'); } } });
  await assert.rejects(f.run);
  assert.ok(f.data.profile.journal);
  await f.run();
  assert.equal(f.remote.calls.length, 1); assert.equal(f.data.profile.journal, null);
  assert.deepEqual(content(f.d.tree), content(parseXbel(f.remote.file.content)));
});
test('creation followed by a checkpoint failure resumes without duplicating the bookmark', async () => {
  let failed = false;
  const f = setup(root([]), root([bookmark('1', 'remote')]), { onSave(state) {
    if (state.journal?.pending?.result && !failed) { failed = true; throw Error('worker interrupted'); }
  } });
  await assert.rejects(f.run);
  await f.run();
  assert.equal(f.d.calls.filter(([kind]) => kind === 'create').length, 1);
  assert.equal(f.d.tree.children.length, 1);
});
test('unrelated local edits while a journal is pending stop recovery rather than overwrite the user', async () => {
  let fail = true;
  const f = setup(root([]), root([bookmark('1', 'remote')]), { onSave(state) { if (state.journal?.phase === 'applying' && fail) { fail = false; throw Error('pause'); } } });
  await assert.rejects(f.run); f.d.edit(tree => tree.children.push(bookmark('user', 'user')));
  await assert.rejects(f.run, /SyncLocalTreeChanged|SyncRecoveryConflict/);
  assert.equal(f.d.tree.children[0].title, 'user');
});
test('folder parent inversion moves children out before nesting the former parent', async () => {
  const f = setup(root([folder('a', 'A', [folder('b', 'B')])]), root([folder('1', 'A', [folder('2', 'B')])]));
  await f.run(); f.remote.edit(tree => { tree.children = [folder('2', 'B', [folder('1', 'A')])]; });
  await f.run(); assert.deepEqual(content(f.d.tree), content(parseXbel(f.remote.file.content)));
});
test('encryption remains enabled and its envelope can be read back', async () => {
  const xml = serializeXbel(root([bookmark('1', 'secret')]), 1);
  const encrypted = await encode(xml, 'test password');
  assert.ok(!encrypted.includes('secret'));
  assert.equal(await decode(encrypted, 'test password', 'bookmarks.xbel'), xml);
  await assert.rejects(() => decode(encrypted, 'wrong', 'bookmarks.xbel'), /SyncDecryptionFailed/);
});
const { GoogleDriveClient } = require('../sync/engine/google-drive.cjs');
const { createHash } = require('node:crypto');
function httpDrive(initial, config = {}) {
  let file = initial ? { id: 'file', content: serializeXbel(initial, 20), props: {}, version: 1 } : null;
  const calls = [];
  const meta = () => ({ id: file.id, name: 'bookmarks.xbel', version: String(file.version), size: String(Buffer.byteLength(file.content)), md5Checksum: createHash('md5').update(file.content).digest('hex'), appProperties: file.props });
  const etag = () => '"etag-' + file.version + '"';
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const fetchImpl = async (url, init) => {
    const method = init.method || 'GET'; calls.push({ url, method, headers: init.headers, body: init.body });
    if (url.includes('oauth2.googleapis.com')) return json({ access_token: 'secret-access' });
    if (url.includes('generateIds')) return json({ ids: ['generated-id'] });
    if (method === 'GET' && url.includes('/drive/v2/files/')) return json({ id: file.id, etag: config.noEtag ? undefined : etag(), fileSize: meta().size, md5Checksum: meta().md5Checksum, properties: Object.entries(file.props).map(([key, value]) => ({ key, value, visibility: 'PRIVATE' })) });
    if (method === 'PATCH') {
      if (init.headers['If-Match'] !== etag()) return json({}, 412);
      file.props = Object.fromEntries(JSON.parse(init.body).properties.map(({ key, value }) => [key, value])); file.version++;
      return json({ id: file.id });
    }
    if (method === 'PUT') {
      if (config.stale) { file.content = serializeXbel(root([bookmark('9', 'concurrent')]), 20); file.version++; config.stale = false; }
      if (init.headers['If-Match'] !== etag()) return json({}, 412);
      file.content = init.body; file.version++;
      if (config.afterPut) config.afterPut();
      return json({ id: file.id });
    }
    if (method === 'POST') {
      const boundary = init.headers['Content-Type'].split('boundary=')[1];
      const parts = init.body.split('--' + boundary);
      const metadata = JSON.parse(parts[1].split('\r\n\r\n')[1].trim());
      if (file) return json({}, 409);
      const content = parts[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      file = { id: metadata.id, content, props: {}, version: 1 };
      return json(meta());
    }
    if (url.includes('alt=media')) return new Response(file.content);
    if (/\/files\?/.test(url)) return json({ files: file ? [meta()] : [] });
    return json(meta());
  };
  return { fetchImpl, calls, get file() { return file; } };
}
test('production Drive transport uses conditional lock/upload/release and verifies the resulting bytes', async () => {
  const f = setup(root([bookmark('local', 'local')]), null);
  const drive = httpDrive(root([bookmark('1', 'remote')]));
  const client = new GoogleDriveClient({ oauth: f.args.oauth, refreshToken: 'secret', fetchImpl: drive.fetchImpl });
  await f.run({ client });
  assert.equal(drive.calls.filter(call => call.method === 'PUT').length, 1);
  assert.ok(drive.calls.filter(call => ['PUT', 'PATCH'].includes(call.method)).every(call => /^"etag-/.test(call.headers['If-Match'])));
  assert.equal(drive.file.props.locked, 'false');
  assert.deepEqual(content(f.d.tree), content(parseXbel(drive.file.content)));
  assert.ok(!JSON.stringify(f.data).includes('secret'));
});
test('a stale production Drive ETag never overwrites concurrent data or applies a stale local plan', async () => {
  const f = setup(root([bookmark('local', 'local')]), null), config = { stale: true };
  const drive = httpDrive(root([bookmark('1', 'remote')]), config);
  const client = new GoogleDriveClient({ oauth: f.args.oauth, refreshToken: 'secret', fetchImpl: drive.fetchImpl });
  await assert.rejects(() => f.run({ client }), /SyncRemoteFileChanged/);
  assert.equal(f.d.calls.length, 0);
  assert.equal(parseXbel(drive.file.content).children[0].title, 'concurrent');
  assert.equal(drive.file.props.locked, 'false');
});
test('no ETag means no fallback to unconditional writing', async () => {
  const f = setup(root([bookmark('local', 'local')]), null);
  const drive = httpDrive(root([bookmark('1', 'remote')]), { noEtag: true });
  const client = new GoogleDriveClient({ oauth: f.args.oauth, refreshToken: 'secret', fetchImpl: drive.fetchImpl });
  await assert.rejects(() => f.run({ client }), /SyncWritePrecondition/);
  assert.equal(drive.calls.filter(call => ['POST', 'PUT', 'PATCH'].includes(call.method) && !call.url.includes('oauth2')).length, 0);
});
test('production transport creates with a persisted generated ID and does not create a second file on retry', async () => {
  const f = setup(root([bookmark('local', 'local')]), null), drive = httpDrive(null);
  const client = new GoogleDriveClient({ oauth: f.args.oauth, refreshToken: 'secret', fetchImpl: drive.fetchImpl });
  await f.run({ client });
  await f.run({ client });
  assert.equal(drive.calls.filter(call => call.method === 'POST' && call.url.includes('/upload/')).length, 1);
  assert.equal(f.data.profile.fileId, 'generated-id');
});
test('cancellation after a remote upload preserves the journal and releases the lease', async () => {
  const f = setup(root([bookmark('local', 'local')]), null), abort = new AbortController();
  const drive = httpDrive(root([bookmark('1', 'remote')]), { afterPut() { abort.abort(); } });
  const client = new GoogleDriveClient({ oauth: f.args.oauth, refreshToken: 'secret', fetchImpl: drive.fetchImpl, signal: abort.signal });
  await assert.rejects(() => f.run({ client, signal: abort.signal }), /SyncCancelled/);
  assert.ok(f.data.profile.journal);
  assert.equal(drive.file.props.locked, 'false');
  assert.equal(f.d.calls.length, 0);
  const resumed = new GoogleDriveClient({ oauth: f.args.oauth, refreshToken: 'secret', fetchImpl: drive.fetchImpl });
  await f.run({ client: resumed });
  assert.equal(drive.calls.filter(call => call.method === 'PUT').length, 1);
});
test('every persisted local checkpoint recovers after interruption before or after its storage commit', async () => {
  function scenario() {
    const items = Array.from({ length: 7 }, (_, i) => bookmark(String(i + 1), 'v' + i));
    return setup(root([folder('f', 'Folder', items.map((item, n) => ({ ...item, id: 'l' + n })))]), root([folder('20', 'Folder', items)]));
  }
  function edit(f) {
    f.d.edit(tree => { tree.children.push(tree.children[0].children.splice(0, 1)[0]); });
    f.remote.edit(tree => { tree.children[0].children[0].title = 'renamed'; tree.children[0].children.splice(1, 1); tree.children[0].children.push(bookmark('99', 'new')); tree.children[0].children.reverse(); });
  }
  const probe = scenario(); await probe.run(); edit(probe);
  const saves = probe.writes.length; await probe.run(); const checkpoints = probe.writes.length - saves;
  for (const when of ['before', 'after']) for (let interruption = 1; interruption <= checkpoints; interruption++) {
    const f = scenario(); await f.run(); edit(f);
    const save = f.args.storage.save; let count = 0, failed = false;
    f.args.storage.save = async (id, value) => {
      count++; const hit = count === interruption;
      if (hit && when === 'before') { failed = true; throw Error('power off'); }
      await save(id, value);
      if (hit && when === 'after') { failed = true; throw Error('power off'); }
    };
    await f.run().catch(() => {}); f.args.storage.save = save;
    await f.run();
    assert.equal(failed, true, when + ' checkpoint ' + interruption);
    assert.deepEqual(content(f.d.tree), content(parseXbel(f.remote.file.content)), when + ' checkpoint ' + interruption);
    assert.equal(f.d.calls.filter(([type]) => type === 'create').length, 1);
  }
});
test('encrypted profiles synchronize through the production transport without uploading plaintext', async () => {
  const f = setup(root([bookmark('local', 'local')]), null), drive = httpDrive(null);
  const client = new GoogleDriveClient({ oauth: f.args.oauth, refreshToken: 'secret', fetchImpl: drive.fetchImpl });
  const profile = { ...f.args.profile, password: 'password' };
  await f.run({ client, profile });
  assert.ok(!drive.file.content.includes('local.test'));
  const plain = await decode(drive.file.content, profile.password, profile.bookmark_file);
  assert.equal(parseXbel(plain).children[0].title, 'local');
  const resumed = new GoogleDriveClient({ oauth: f.args.oauth, refreshToken: 'secret', fetchImpl: drive.fetchImpl });
  await f.run({ client: resumed, profile });
  assert.equal(drive.calls.filter(call => call.method === 'POST' && call.url.includes('/upload/')).length, 1);
});
test('legacy XBEL header and metadata round-trip without loading external DTDs', () => {
  const text = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xbel PUBLIC "+//IDN python.org//DTD XML Bookmark Exchange Language 1.0//EN//XML" "http://pyxml.sourceforge.net/topics/dtds/xbel.dtd">\n<xbel version="1.0"><bookmark id="1" href="https://x.test"><title>A &amp; B</title><desc>Keep me</desc><info><metadata owner="example">data</metadata></info></bookmark></xbel>';
  const parsed = parseXbel(text), serialized = serializeXbel(parsed, 10), again = parseXbel(serialized);
  assert.equal(again.children[0].title, 'A & B');
  assert.match(serialized, /Keep me/); assert.match(serialized, /owner="example"/);
  assert.throws(() => parseXbel('<!DOCTYPE xbel SYSTEM "https://evil.test"><xbel/>'), /SyncUnsupportedXml/);
});
test('independent crypto remains compatible with the existing AES-GCM envelope', async () => {
  const { pbkdf2Sync, createCipheriv, createDecipheriv } = require('node:crypto');
  const password = 'test password', salt = 'bookmarks.xbel', text = '<xbel/>', iv = Buffer.alloc(16, 7);
  const key = pbkdf2Sync(password, salt, 250000, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const payload = Buffer.concat([iv, cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64');
  assert.equal(await decode(payload, password, salt), text);
  const encoded = JSON.parse(await encode(text, password)), bytes = Buffer.from(encoded.ciphertext, 'base64');
  const ownKey = pbkdf2Sync(password, encoded.salt, 250000, 32, 'sha256');
  const decrypt = createDecipheriv('aes-256-gcm', ownKey, bytes.subarray(0, 16)); decrypt.setAuthTag(bytes.subarray(-16));
  assert.equal(Buffer.concat([decrypt.update(bytes.subarray(16, -16)), decrypt.final()]).toString('utf8'), text);
});
test('two devices converge through shared file IDs across alternating concurrent changes', async () => {
  const common = root([bookmark('1', 'one')]), remote = drive(common);
  const a = setup(root([bookmark('a', 'one')]), common), b = setup(root([bookmark('b', 'one')]), common);
  await a.run({ client: remote }); await b.run({ client: remote });
  a.d.edit(tree => tree.children.push(bookmark('a2', 'two')));
  b.d.edit(tree => tree.children.push(bookmark('b2', 'three')));
  await a.run({ client: remote }); await b.run({ client: remote }); await a.run({ client: remote });
  assert.deepEqual(content(a.d.tree), content(b.d.tree));
  assert.equal(a.d.tree.children.length, 3);
  const uploads = remote.calls.length; await b.run({ client: remote });
  assert.equal(remote.calls.length, uploads);
});
test('expired journal directions and changed profiles never apply an old plan to a new scope', async () => {
  let once = true;
  const f = setup(root([]), root([bookmark('1', 'one')]), { onSave(state) { if (once && state.journal?.phase === 'applying') { once = false; throw Error('interrupted'); } } });
  await assert.rejects(f.run);
  f.data.profile.journal.paused = true;
  await assert.rejects(() => f.run({ profile: { ...f.args.profile, strategy: 'slave' } }), /SyncRecoveryDirection/);
  assert.equal(f.data.profile.journal.paused, true);
  await assert.rejects(() => f.run({ profile: { ...f.args.profile, bookmark_file: 'other.xbel' } }), /SyncProfileChanged/);
  assert.equal(f.d.calls.length, 0);
});
test('reauthorizing a profile starts a conservative merge instead of applying mappings from a different scope', async () => {
  const f = setup(root([bookmark('local', 'one')]), root([bookmark('1', 'one')]));
  await f.run(); f.remote.edit(tree => { tree.children = [bookmark('8', 'other-account')]; });
  await f.run({ profile: { ...f.args.profile, refreshToken: 'different-account' }, legacy: { cache: { id: 'root', title: '', children: [{ id: 'local', title: 'one', url: 'https://one.test' }] }, mapping: { local: '1' } } });
  assert.equal(f.d.tree.children.length, 2);
  assert.deepEqual(new Set(f.d.tree.children.map(item => item.title)), new Set(['one', 'other-account']));
});
test('protected browser root and managed bookmarks are rejected before content writes', async () => {
  const f = setup(folder('0', 'All bookmarks', []), root([]));
  await assert.rejects(f.run, /SyncProtectedRoot/);
  assert.equal(f.remote.calls.length, 0);
  const managed = setup(root([{ ...bookmark('m', 'managed'), unmodifiable: 'managed' }]), root([]));
  await assert.rejects(managed.run, /SyncManagedBookmarks/);
  assert.equal(managed.remote.calls.length, 0);
});
test('an explicit resume clears the paused marker before continuing its journal', async () => {
  let first = true;
  const f = setup(root([]), root([bookmark('1', 'one')]), { onSave(state) { if (first && state.journal?.phase === 'applying') { first = false; throw Error('pause'); } } });
  await assert.rejects(f.run);
  f.data.profile.journal.paused = true;
  const save = f.args.storage.save; let cleared = false;
  f.args.storage.save = async (id, state) => { if (state.journal && !state.journal.paused) cleared = true; await save(id, state); };
  await f.run(); assert.equal(cleared, true); assert.equal(f.data.profile.journal, null);
});
