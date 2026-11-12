const { GoogleDriveClient } = require("./google-drive.cjs");
const {
  LIMITS,
  normalizeUrl,
  parseXbel,
  serializeXbel,
  fromBrowserTree,
  fail,
} = require("./tree.cjs");
const {
  ROOT,
  copy,
  same,
  index,
  identify,
  merge,
  changes,
  guard,
} = require("./model.cjs");
const local = require("./local.cjs");
const { normalizeRootTitles, protectRoot } = require("./root.cjs");
const { decode, encode, fingerprint } = require("./crypto.cjs");
function prepareRemote(input, previous) {
  const tree = copy(input),
    seen = new Set();
  tree.assignedIds = false;
  let high = Math.max(tree.highestId || 0, previous?.highestId || 0);
  function scan(folder) {
    for (const item of folder.children || []) {
      if (item.id !== undefined) {
        if (
          !/^-?\d+$/.test(String(item.id)) ||
          !Number.isSafeInteger(Number(item.id))
        )
          fail("SyncInvalidIds");
        if (String(item.id) !== String(Number(item.id)))
          tree.assignedIds = true;
        item.id = String(Number(item.id));
        if (item.id === "0" || seen.has(item.id)) fail("SyncDuplicateIds");
        seen.add(item.id);
        high = Math.max(high, Number(item.id));
      }
      if (item.kind === "folder") scan(item);
    }
  }
  scan(tree);
  if (!Number.isSafeInteger(high) || high < 0) fail("SyncInvalidIds");
  function assign(folder) {
    for (const item of folder.children || []) {
      if (item.id === undefined) {
        if (!Number.isSafeInteger(++high)) fail("SyncInvalidIds");
        item.id = String(high);
        tree.assignedIds = true;
      }
      if (item.kind === "folder") assign(item);
    }
  }
  assign(tree);
  tree.highestId = high;
  return tree;
}
function legacyBase(cache, hints, root) {
  if (!cache || String(cache.id) !== String(root)) return null;
  const used = new Set();
  function convert(folder) {
    return (folder.children || []).map((item) => {
      const id = hints[String(item.id)];
      if (
        id === undefined ||
        !/^-?\d+$/.test(String(id)) ||
        used.has(String(id))
      )
        fail("SyncMigrationMappings");
      used.add(String(id));
      const result = {
        kind: typeof item.url === "string" ? "bookmark" : "folder",
        id: String(id),
        title: String(item.title || ""),
      };
      if (result.kind === "bookmark") result.url = normalizeUrl(item.url);
      else result.children = convert(item);
      return result;
    });
  }
  return { kind: "folder", title: "", children: convert(cache) };
}
function locked(file) {
  if (!file.appProperties?.locked) return false;
  let value;
  try {
    value = JSON.parse(file.appProperties.locked);
  } catch {
    return true;
  }
  return (
    value !== false &&
    (!Number.isFinite(value) || Date.now() - value < 15 * 60 * 1000)
  );
}
async function synchronizeCore({
  id,
  profile,
  oauth,
  bookmarks,
  storage,
  signal,
  legacy = {},
  client,
  owner,
  dryRun = false,
  progress = async () => {},
  validate = async () => {},
}) {
  if (profile.type !== "google-drive" || profile.localRoot === "tabs")
    fail("SyncUnsupportedProvider");
  const check = () => {
    if (signal?.aborted) fail("SyncCancelled");
  };
  const scope = await fingerprint([
    profile.localRoot,
    profile.bookmark_file,
    profile.refreshToken,
    oauth.googleClientId,
  ]);
  let state = (await storage.load(id)) || { schema: 1, scope, backups: [] };
  if (state.schema !== 1) fail("SyncUnsupportedState");
  const scopeChanged = state.scope !== scope;
  if (scopeChanged) {
    if (state.journal) fail("SyncProfileChanged");
    state = {
      schema: 1,
      scope,
      backups: state.backups || [],
      leaseOwner: owner,
    };
  }
  client ||= new GoogleDriveClient({
    oauth,
    refreshToken: profile.refreshToken,
    signal,
  });
  const file = await client.read(profile.bookmark_file);
  check();
  if (locked(file) && file.appProperties?.superSyncOwner !== owner)
    fail("SyncRemoteLocked");
  if (state.fileId && file.id !== state.fileId) fail("SyncRemoteReplaced");
  // Rebase a stale checkpoint only when no browser API operation is in doubt.
  // The expected local checkpoint is the merge base: using the remote target
  // here would mistake remote items not yet downloaded for local deletions.
  const interrupted = state.journal;
  if (!dryRun && interrupted && !interrupted.pending &&
      interrupted.scope === scope &&
      interrupted.root === String(profile.localRoot) &&
      interrupted.strategy === "default" &&
      (profile.strategy || "default") === "default") {
    const current = await local.read(bookmarks, interrupted.root);
    if (!same(current, interrupted.expectedLocal)) {
      const committed = file.exists && file.id === interrupted.fileId &&
        file.content === interrupted.payload;
      const untouched = interrupted.phase === "planned" &&
        (interrupted.before.exists === false ? !file.exists :
          file.id === interrupted.before.id && file.content === interrupted.before.content);
      if (committed) {
        function canonical(node) {
          const result = copy(node);
          if (node !== interrupted.expectedLocal) {
            const id = interrupted.mapping[node.id];
            if (id === undefined) fail("SyncRecoveryConflict");
            result.id = id;
          }
          if (node.children) result.children = node.children.map(canonical);
          return result;
        }
        state.tree = canonical(interrupted.expectedLocal);
        state.mapping = copy(interrupted.mapping);
        state.highestId = interrupted.highestId;
        state.fileId = interrupted.fileId;
      }
      if (committed || untouched) {
        // Persist the rebase before planning, so another interruption is safe.
        await validate();
        state.journal = null;
        await storage.save(id, copy(state));
      }
    }
  }
  const save = async (journal) => {
    await validate();
    await client.renewLease?.();
    state.journal = journal;
    await storage.save(id, copy(state));
  };
  if (!state.journal) {
    const before = await local.read(bookmarks, profile.localRoot);
    check();
    const hints = scopeChanged ? {} : legacy.mapping || {};
    let knownHigh = state.highestId || 0;
    for (const value of Object.values(hints))
      if (Number.isSafeInteger(Number(value)))
        knownHigh = Math.max(knownHigh, Number(value));
    const remote = file.exists
      ? prepareRemote(
          parseXbel(
            await decode(file.content, profile.password, profile.bookmark_file)
          ),
          { ...state, highestId: knownHigh }
        )
      : { kind: "folder", title: "", children: [], highestId: 0 };
    const previous = state.tree
      ? state
      : {
          tree: scopeChanged
            ? null
            : legacyBase(legacy.cache, hints, profile.localRoot),
          mapping: hints,
          highestId: remote.highestId,
        };
    const originalRemote = copy(remote);
    if (String(profile.localRoot) === "0") {
      normalizeRootTitles(remote, before, previous.mapping || hints);
      normalizeRootTitles(previous.tree, before, previous.mapping || hints);
    }
    const identified = identify(before, remote, previous, hints);
    const target = merge(
      previous.tree,
      identified.local,
      remote,
      profile.strategy || "default"
    );
    if (String(profile.localRoot) === "0") protectRoot(target, identified.local);
    if (Object.keys(index(target).nodes).length > LIMITS.nodes)
      fail("SyncTreeTooLarge");
    guard(identified.local, target, profile.failsafe !== false);
    guard(remote, target, profile.failsafe !== false);
    const localChanges = changes(identified.local, target),
      remoteChanges = changes(originalRemote, target);
    if (dryRun)
      return {
        local: localChanges.total,
        server: remoteChanges.total,
        initial: !previous.tree,
      };
    const xml = serializeXbel(target, identified.highestId);
    // Persist generated IDs and encryption upgrades even if the semantic diff is empty.
    const needsRemote =
      !file.exists ||
      remoteChanges.total > 0 ||
      remote.assignedIds ||
      Boolean(profile.password && file.content.trimStart().startsWith("<?xml"));
    const payload = needsRemote
      ? await encode(xml, profile.password)
      : file.content;
    if (new TextEncoder().encode(payload).length > LIMITS.bytes)
      fail("SyncFileTooLarge");
    const createId = !file.exists ? await client.generateId() : null;
    const backup = {
      at: Date.now(),
      scope,
      local: before,
      remote: file.exists
        ? { id: file.id, content: file.content, revision: file.revision }
        : null,
    };
    state.migrationBackup ||= backup;
    state.backups = [backup, ...(state.backups || [])].slice(0, 2);
    await save({
      phase: "planned",
      scope,
      owner,
      root: String(profile.localRoot),
      target,
      highestId: identified.highestId,
      mapping: identified.mapping,
      expectedLocal: before,
      pending: null,
      strategy: profile.strategy || "default",
      before: file.exists
        ? { id: file.id, content: file.content }
        : { exists: false },
      fileId: file.id || createId,
      payload,
      needsRemote,
      stats: { local: localChanges, remote: remoteChanges },
      createdAt: Date.now(),
    });
  }
  const journal = state.journal;
  if (journal.strategy !== (profile.strategy || "default"))
    fail("SyncRecoveryDirection");
  if (journal.scope !== scope || journal.root !== String(profile.localRoot))
    fail("SyncProfileChanged");
  if (!dryRun && journal.paused) {
    delete journal.paused;
    await save(journal);
  }
  if (dryRun)
    return {
      local: 1,
      server: journal.phase === "planned" ? 1 : 0,
      initial: false,
    };
  check();
  // A write may have committed before the worker stopped. Identify it by the
  // exact persisted payload and file ID, not by a retry that could duplicate it.
  const alreadyWritten =
    file.exists &&
    file.id === journal.fileId &&
    file.content === journal.payload;
  if (!alreadyWritten) {
    if (
      journal.phase !== "planned" ||
      (journal.before.exists === false
        ? file.exists
        : file.id !== journal.before.id ||
          file.content !== journal.before.content)
    )
      fail("SyncRecoveryConflict");
    if (!same(await local.read(bookmarks, journal.root), journal.expectedLocal))
      fail("SyncLocalTreeChanged");
    if (journal.needsRemote) {
      try {
        await validate();
        await client.write(
          file,
          journal.payload,
          profile.bookmark_file,
          journal.fileId
        );
      } catch (error) {
        // Definitive precondition failures made no changes: allow a fresh plan.
        if (
          ["SyncRemoteFileChanged", "SyncWritePrecondition"].includes(
            error.code
          )
        ) {
          const latest = await client
            .read(profile.bookmark_file)
            .catch(() => null);
          if (latest && latest.content !== journal.payload) {
            state.journal = null;
            await storage.save(id, state);
          }
        }
        throw error;
      }
    } else fail("SyncRecoveryConflict");
  }
  const confirmedRemote = await client.read(profile.bookmark_file);
  if (
    !confirmedRemote.exists ||
    confirmedRemote.id !== journal.fileId ||
    confirmedRemote.content !== journal.payload
  )
    fail("SyncRecoveryConflict");
  if (!dryRun && client.acquireLease && !client.lease)
    await client.acquireLease(confirmedRemote, owner);
  check();
  journal.phase = "applying";
  await save(journal);
  await progress(0.6);
  await local.apply({ bookmarks, journal, save, signal, validate });
  check();
  const latestRemote = await client.read(profile.bookmark_file);
  if (
    !latestRemote.exists ||
    latestRemote.id !== journal.fileId ||
    latestRemote.content !== journal.payload
  )
    fail("SyncRecoveryConflict");
  const finalLocal = await local.read(bookmarks, journal.root);
  if (!same(finalLocal, journal.expectedLocal)) fail("SyncLocalTreeChanged");
  const verified = identify(finalLocal, journal.target, {
    tree: journal.target,
    mapping: journal.mapping,
    highestId: journal.highestId,
  });
  if (changes(verified.local, journal.target).total)
    fail("SyncLocalTreeChanged");
  state.tree = journal.target;
  state.mapping = journal.mapping;
  state.highestId = journal.highestId;
  state.fileId = journal.fileId;
  state.completedAt = Date.now();
  state.journal = null;
  state.history = [
    ...(state.history || []),
    { at: state.completedAt, status: "success", stats: journal.stats },
  ].slice(-30);
  await validate();
  await storage.save(id, state);
  await progress(1);
  return { ...journal.stats, resumed: alreadyWritten };
}
async function synchronize(input) {
  if (
    input.profile.type !== "google-drive" ||
    input.profile.localRoot === "tabs"
  )
    fail("SyncUnsupportedProvider");
  const client =
    input.client ||
    new GoogleDriveClient({
      oauth: input.oauth,
      refreshToken: input.profile.refreshToken,
      signal: input.signal,
    });
  if (input.dryRun || !client.acquireLease)
    return synchronizeCore({ ...input, client });
  const scope = await fingerprint([
    input.profile.localRoot,
    input.profile.bookmark_file,
    input.profile.refreshToken,
    input.oauth.googleClientId,
  ]);
  const state = (await input.storage.load(input.id)) || {
    schema: 1,
    scope,
    backups: [],
  };
  if (state.journal && state.scope !== scope) fail("SyncProfileChanged");
  if (state.schema !== 1) fail("SyncUnsupportedState");
  const owner = state.leaseOwner || state.journal?.owner || crypto.randomUUID();
  await input.storage.save(input.id, { ...state, leaseOwner: owner });
  try {
    const file = await client.read(input.profile.bookmark_file);
    if (file.exists) await client.acquireLease(file, owner);
    return await synchronizeCore({ ...input, client, owner });
  } finally {
    try {
      await client.releaseLease();
    } catch {
      /* Lease expiry protects a network-interrupted cleanup. */
    }
  }
}
module.exports = { synchronize, prepareRemote, legacyBase };
