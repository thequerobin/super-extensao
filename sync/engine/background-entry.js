// Compatibility shell: existing profile/authentication/scheduling APIs remain
// stable while Google Drive bookmark execution uses the independent core.
import BrowserController from "@sync-engine/browser/BrowserController";
import Account from "@sync-engine/Account";
import browser from "@sync-engine/browser-api";
import Logger from "@sync-engine/Logger";
import { i18n } from "@sync-engine/native/I18n";
import { uiMessages } from "../source/messages";
import { synchronize } from "./runner.cjs";
import { fingerprint } from "./crypto.cjs";

const controller = new BrowserController();
const originalSync = controller.syncAccount.bind(controller);
const originalCancel = controller.cancelSync.bind(controller);
const originalCheck = controller.checkAccount.bind(controller);
const active = new Map();
let queue = Promise.resolve();
let unlockingProfiles = false;
const originalUnlock = controller.unlock.bind(controller);
const key = (id) => `superSync:engine[${id}]`;
const storage = {
  async load(id) {
    return (await chrome.storage.local.get(key(id)))[key(id)];
  },
  async save(id, state) {
    try {
      await chrome.storage.local.set({ [key(id)]: state });
    } catch {
      throw Object.assign(new Error("SyncStorageFailed"), {
        code: "SyncStorageFailed",
      });
    }
  },
};
const usesOwnEngine = (data) =>
  data.type === "google-drive" && data.localRoot !== "tabs";
async function unlocked() {
  const data = await browser.storage.local.get({ accountsLocked: null });
  return (
    !unlockingProfiles &&
    controller.enabled &&
    !data.accountsLocked &&
    (await controller.getUnlocked())
  );
}
async function options(account, signal) {
  const profile = { ...account.getData() };
  const oauth = (await browser.storage.local.get({ oauthClients: {} }))
    .oauthClients;
  const mappings = (await account.storage.getMappings()).getSnapshot()
    .LocalToServer;
  const mapping = { ...mappings.bookmark, ...mappings.folder };
  const cache = await account.storage.getCache();
  const profiles = await Account.getAllAccounts();
  // Overlapping scopes need a shared ownership model. Fail closed rather than
  // run different engines against the same subtree.
  const [root] = await chrome.bookmarks.getSubTree(String(profile.localRoot));
  const descendants = new Set();
  const walk = (node) => {
    descendants.add(String(node.id));
    (node.children || []).forEach(walk);
  };
  if (root) walk(root);
  for (const other of profiles) {
    if (
      other.id === account.id ||
      !other.getData().localRoot ||
      other.getData().localRoot === "tabs"
    )
      continue;
    const otherRoot = String(other.getData().localRoot);
    if (descendants.has(otherRoot))
      throw Object.assign(new Error("SyncOverlappingProfiles"), {
        code: "SyncOverlappingProfiles",
      });
    let ancestor = root;
    while (ancestor?.parentId) {
      if (ancestor.parentId === otherRoot)
        throw Object.assign(new Error("SyncOverlappingProfiles"), {
          code: "SyncOverlappingProfiles",
        });
      [ancestor] = await chrome.bookmarks.get(ancestor.parentId);
    }
  }
  const expected = await fingerprint([
    profile.localRoot,
    profile.bookmark_file,
    profile.refreshToken,
    profile.password,
    oauth.googleClientId,
  ]);
  async function validate() {
    const lock = await browser.storage.local.get({
      accountsLocked: null,
      oauthClients: {},
    });
    if (lock.accountsLocked)
      throw Object.assign(new Error("SyncProfilesLocked"), {
        code: "SyncProfilesLocked",
      });
    const current = await account.storage.getAccountData(null);
    const actual = await fingerprint([
      current.localRoot,
      current.bookmark_file,
      current.refreshToken,
      current.password,
      lock.oauthClients.googleClientId,
    ]);
    if (expected !== actual)
      throw Object.assign(new Error("SyncProfileChanged"), {
        code: "SyncProfileChanged",
      });
  }
  return {
    validate,
    id: account.id,
    profile,
    oauth,
    bookmarks: chrome.bookmarks,
    storage,
    signal,
    legacy: { cache, mapping },
  };
}
async function execute(id, strategy, abort, dryRun = false) {
  if (!(await unlocked()) || abort.signal.aborted) return;
  const account = await Account.get(id);
  const keepAlive = setInterval(
    () => browser.tabs.getCurrent().catch(() => {}),
    20000
  );
  account.syncing = true;
  try {
    await account.setData({
      syncing: 0.05,
      scheduled: false,
      error: null,
      lastAttempt: Date.now(),
    });
    controller.updateStatus();
    const input = await options(account, abort.signal);
    input.profile.strategy = strategy || input.profile.strategy || "default";
    input.progress = async (value) => {
      await input.validate();
      await account.setData({ syncing: value });
      await controller.updateStatus();
    };
    input.dryRun = dryRun;
    const result = await synchronize(input);
    await input.validate();
    if (dryRun) {
      const pending = result.local || result.server ? result : null;
      await account.setData({
        pendingChanges: pending,
        lastCheck: Date.now(),
        checkScheduled: false,
      });
      if (pending) await controller.showPendingNotification(account, pending);
    } else {
      await account.setData({
        lastSync: Date.now(),
        errorCount: 0,
        isTransientError: false,
        pendingChanges: null,
        checkScheduled: false,
        syncEngine: "super-drive-v1",
      });
      await controller.clearPendingNotification(id);
      Logger.log(`Super Sync ${id}: completed`);
    }
  } catch (error) {
    const code =
      typeof error.code === "string" ? error.code : "SyncGoogleRequestFailed";
    const locale = await globalThis.SuperPreferences.locale.get();
    const text = uiMessages[code]?.[locale] || uiMessages[code]?.en || code;
    if (code === "SyncCancelled") {
      const state = await storage.load(id);
      if (state?.journal) {
        state.journal.paused = true;
        await storage.save(id, state);
      }
    }
    const lockedNow =
      unlockingProfiles ||
      (await browser.storage.local.get({ accountsLocked: null }))
        .accountsLocked;
    if (!lockedNow)
      await account.setData({
        error:
          code === "SyncCancelled"
            ? null
            : text +
              (Number.isInteger(error.status) ? ` (HTTP ${error.status})` : ""),
        errorCount: (account.getData().errorCount || 0) + 1,
        isTransientError: [
          "SyncGoogleRequestFailed",
          "SyncGoogleRateLimited",
          "SyncRequestTimedOut",
          "SyncRemoteLocked",
          "SyncRemoteFileChanged",
          "SyncLocalWriteFailed",
          "SyncStorageFailed",
        ].includes(code),
      });
    Logger.log(
      `Super Sync ${id}: ${code}${
        Number.isInteger(error.status) ? ` HTTP ${error.status}` : ""
      }`
    );
  } finally {
    clearInterval(keepAlive);
    account.syncing = false;
    const lockedNow =
      unlockingProfiles ||
      (await browser.storage.local.get({ accountsLocked: null }))
        .accountsLocked;
    if (!lockedNow) await account.setData({ syncing: false, scheduled: false });
    controller.updateStatus();
  }
}
function enqueue(id, strategy, dryRun) {
  if (active.has(id)) {
    const current = active.get(id);
    if (
      (!dryRun && current.dryRun) ||
      (!dryRun && strategy !== current.strategy)
    ) {
      return current.promise
        .catch(() => {})
        .then(() => enqueue(id, strategy, dryRun));
    }
    return current.promise;
  }
  const abort = new AbortController();
  const promise = queue
    .catch(() => {})
    .then(() => execute(id, strategy, abort, dryRun));
  active.set(id, { abort, promise, dryRun, strategy });
  queue = promise;
  promise.finally(() => active.delete(id)).catch(() => {});
  return promise;
}
controller.syncAccount = async (id, strategy, force) => {
  if (!(await unlocked())) return;
  const account = await Account.get(id);
  if (!usesOwnEngine(account.getData()))
    return originalSync(id, strategy, force);
  return enqueue(id, strategy, false);
};
controller.checkAccount = async (id) => {
  if (!(await unlocked())) return;
  const account = await Account.get(id);
  if (!usesOwnEngine(account.getData())) return originalCheck(id);
  return enqueue(id, undefined, true);
};
controller.cancelSync = async (id, keepEnabled) => {
  if (!active.has(id)) return originalCancel(id, keepEnabled);
  active.get(id).abort.abort();
  await (
    await Account.get(id)
  ).setData({
    scheduled: false,
    checkScheduled: false,
    ...(!keepEnabled ? { enabled: false } : {}),
  });
  const state = await storage.load(id);
  if (state?.journal) {
    state.journal.paused = true;
    await storage.save(id, state);
  }
};
const originalRequest = controller._isRequest.bind(controller);
controller._isRequest = (data) =>
  originalRequest(data) ||
  (data?.channel === "super-sync" &&
    ["resetOwnSync", "assertOwnSyncIdle"].includes(data.type) &&
    Array.isArray(data.params) &&
    data.params.length === 1 &&
    typeof data.params[0] === "string");
controller.assertOwnSyncIdle = async (id) => {
  if (!(await unlocked()) || active.has(id)) throw new Error("SyncProfileBusy");
};
controller.resetOwnSync = async (id) => {
  await controller.assertOwnSyncIdle(id);
  const state = await storage.load(id);
  if (state)
    await storage.save(id, {
      schema: 1,
      scope: state.scope,
      leaseOwner: state.leaseOwner,
      backups: state.backups || [],
      migrationBackup: state.migrationBackup,
      history: state.history || [],
    });
};
// Legacy caches do not track IDs created by the new core. Use its own mapping
// to schedule removed/moved-out items as well as the inherited live-tree checks.
const previousChange = controller.onchange.bind(controller);
const changed = new Set();
let changeTimer;
async function flushChanges() {
  const lock = await browser.storage.local.get({ accountsLocked: null });
  if (lock.accountsLocked) {
    changed.clear();
    return;
  }
  if (!controller.enabled) {
    changeTimer = setTimeout(() => flushChanges().catch(() => {}), 500);
    return;
  }
  const ids = [...changed];
  changed.clear();
  for (const account of await Account.getAllAccounts()) {
    const data = account.getData();
    if (!usesOwnEngine(data) || !data.enabled || data.syncing) continue;
    const state = await storage.load(account.id);
    if (ids.some((id) => state?.mapping?.[id]))
      controller.scheduleSyncOrCheck(account, true);
  }
}
controller.onchange = async (id, details) => {
  changed.add(String(id));
  try {
    await previousChange(id, details);
  } finally {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => flushChanges().catch(() => {}), 250);
  }
};
async function recoverPending() {
  const lock = await browser.storage.local.get({ accountsLocked: null });
  if (lock.accountsLocked || unlockingProfiles) return;
  await controller.onLoad();
  for (const account of await Account.getAllAccounts()) {
    if (!usesOwnEngine(account.getData())) continue;
    const state = await storage.load(account.id);
    if (state?.journal && !state.journal.paused)
      await account.setData({ scheduled: true });
  }
}
controller.unlock = async (...args) => {
  unlockingProfiles = true;
  try {
    const result = await originalUnlock(...args);
    unlockingProfiles = false;
    await recoverPending();
    return result;
  } finally {
    unlockingProfiles = false;
  }
};
recoverPending().catch(() =>
  Logger.log("Super Sync: recovery initialization failed")
);
globalThis.SuperPreferences.locale.watch((locale) => {
  i18n.setLocales([locale]);
  return i18n.load();
});
export { controller };
