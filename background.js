importScripts("rules.js");
importScripts("navigation-rules.js", "tab-guard.js");
// ====== デフォルト設定 ======
const DEFAULT_SETTINGS = {
  enabled: true,
  clearHistory: true,
  clearCache: false,
  clearCookies: false,
  clearDownloads: false,
  clearFormData: false,
  clearLocalStorage: false,
  excludedSites: [],
  theme: "dark",
  pendingSession: null,
  pendingClearNotification: null,
  lastClearTime: null,
  lastClearTypeKeys: [],
  lastClearTypes: [],
  paused: false,
  pauseUntil: null,
  installDate: null,
  firstSuccessfulClearAt: null,
  successfulClearCount: 0,
  lastSuccessfulClearAt: null,
  lastClearErrorAt: null
};

const CLEAR_NOTIFICATION_PREFIX = "clear-done-";
const SETTINGS_WINDOW_IDS_KEY = "settingsWindowIds";
const SETTINGS_WINDOW = {
  width: 600,
  height: 760
};
let pendingSettingsWindowCreates = 0;
let clearQueue = Promise.resolve();
const pendingSessionClears = new Map();

function getTypeLabels() {
  const m = chrome.i18n.getMessage;
  return {
    history: m("browsingHistory"), cache: m("cache"), cookies: m("cookies"),
    downloads: m("downloadHistory"), formData: m("formData"),
    localStorage: m("localStorage")
  };
}

// ====== 削除対象の構築 ======
function buildDataToRemove(settings) {
  return {
    history: settings.clearHistory,
    cache: settings.clearCache,
    cookies: settings.clearCookies,
    downloads: settings.clearDownloads,
    formData: settings.clearFormData,
    localStorage: settings.clearLocalStorage
  };
}

function normalizeManualSettings(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return {
    clearHistory: snapshot.clearHistory === undefined ? true : snapshot.clearHistory === true,
    clearCache: snapshot.clearCache === true,
    clearCookies: snapshot.clearCookies === true,
    clearDownloads: snapshot.clearDownloads === true,
    clearFormData: snapshot.clearFormData === true,
    clearLocalStorage: snapshot.clearLocalStorage === true,
    excludedSites: ClearRules.normalizeList(snapshot.excludedSites === undefined ? [] : snapshot.excludedSites)
  };
}

async function removeSelectedData(settings) {
  const plan = ClearRules.removalPlan(settings);
  for (const operation of plan) {
    if (operation.method === "removeCookies") {
      await chrome.browsingData.removeCookies(operation.options);
    } else {
      await chrome.browsingData.remove(operation.options, operation.data);
    }
  }
}

function makeUniqueId(prefix) {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getPendingSession(settings) {
  const pending = settings.pendingSession;
  if (pending && typeof pending.id === "string") {
    return {
      id: pending.id,
      markedAt: Number.isFinite(pending.markedAt) ? pending.markedAt : 0
    };
  }

  // 2.0.5以前の未完了フラグを次回の正常終了/起動で回収する。
  if (settings.pendingClear || settings.lastExitTime) {
    return {
      id: `legacy-${settings.lastExitTime || "pending"}`,
      markedAt: 0
    };
  }
  return null;
}

async function markSessionPending() {
  const pendingSession = {
    id: makeUniqueId("session"),
    markedAt: Date.now()
  };
  await chrome.storage.local.set({
    pendingSession,
    pendingClear: false,
    lastExitTime: null
  });
  return pendingSession;
}

function requestClear(trigger, options = {}) {
  const operation = clearQueue
    .catch(() => undefined)
    .then(() => performClear(trigger, options));
  clearQueue = operation.catch(() => undefined);
  return operation;
}

// ====== メイン削除処理 ======
async function performClear(
  trigger,
  { ignoreAutomationState = false, settingsSnapshot = null } = {}
) {
  const storedSettings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const manualSettings = normalizeManualSettings(settingsSnapshot);
  const settings = manualSettings
    ? { ...storedSettings, ...manualSettings }
    : storedSettings;
  const startedAt = Date.now();

  // 最後のウィンドウ判定後に新しいウィンドウが開かれた場合は中止する。
  if (trigger === "exit") {
    const windows = await chrome.windows.getAll();
    if (windows.length > 0) return { cleared: false, startedAt };
  }

  // 一時停止チェック
  if (!ignoreAutomationState && settings.paused) {
    if (settings.pauseUntil) {
      const until = new Date(settings.pauseUntil);
      if (until > new Date()) return { cleared: false, startedAt };
      await chrome.storage.local.set({ paused: false, pauseUntil: null });
      chrome.action.setBadgeText({ text: "" });
    } else {
      return { cleared: false, startedAt };
    }
  }

  if (!ignoreAutomationState && !settings.enabled) {
    return { cleared: false, startedAt };
  }

  const dataToRemove = buildDataToRemove(settings);
  const hasTarget = Object.values(dataToRemove).some(v => v);
  if (!hasTarget) return { cleared: false, startedAt };

  try {
    // Cookieは必ず他データの後に専用APIで削除する。
    await removeSelectedData(settings, dataToRemove);
  } catch (error) {
    await chrome.storage.local.set({ lastClearErrorAt: new Date().toISOString() });
    throw error;
  }

  // Record the completion time only after every removal API has succeeded.
  const now = new Date().toISOString();
  // 削除記録
  const clearedTypeKeys = Object.entries(dataToRemove)
    .filter(([, v]) => v)
    .map(([key]) => key);
  const clearedTypes = clearedTypeKeys.map((key) => getTypeLabels()[key]);

  const notificationReceipt = {
    id: makeUniqueId("receipt"),
    trigger,
    time: now,
    clearedTypeKeys
  };

  await chrome.storage.local.set({
    lastClearTime: now,
    lastClearTypeKeys: clearedTypeKeys,
    lastClearTypes: clearedTypes,
    lastClearReason: trigger,
    firstSuccessfulClearAt: settings.firstSuccessfulClearAt || now,
    successfulClearCount: (settings.successfulClearCount || 0) + 1,
    lastSuccessfulClearAt: now,
    lastClearErrorAt: null,
    notifDismissed: null,
    pendingClearNotification: notificationReceipt
  });

  // 削除成功と通知/レビュー表示は別物。後者の失敗で削除を失敗扱いしない。
  void deliverPendingClearNotification(notificationReceipt);


  return { cleared: true, startedAt, notificationReceipt };
}

async function clearPendingSession(trigger, pendingSession) {
  if (!pendingSession) return { cleared: false, startedAt: Date.now() };
  if (pendingSessionClears.has(pendingSession.id)) {
    return pendingSessionClears.get(pendingSession.id);
  }

  const operation = requestClear(trigger).then(async (result) => {
    if (!result.cleared) return result;

    const currentSettings = await chrome.storage.local.get({
      pendingSession: null,
      pendingClear: false,
      lastExitTime: null
    });
    const currentPending = getPendingSession(currentSettings);

    // 削除中に新しいウィンドウが開いた場合、新しい世代は次回用に残す。
    if (
      currentPending &&
      currentPending.id === pendingSession.id
    ) {
      await chrome.storage.local.set({
        pendingSession: null,
        pendingClear: false,
        lastExitTime: null
      });

      // storage.get() と set() の間に開かれたウィンドウの世代を
      // 上書きした可能性があるため、実際にウィンドウが残る場合は再アームする。
      const remainingWindows = await chrome.windows.getAll();
      if (remainingWindows.length > 0) await markSessionPending();
    }
    return result;
  });

  pendingSessionClears.set(pendingSession.id, operation);
  operation.then(
    () => pendingSessionClears.delete(pendingSession.id),
    () => pendingSessionClears.delete(pendingSession.id)
  );
  return operation;
}

// ====== デスクトップ通知 ======
async function showClearNotification(receipt, { deferred = false } = {}) {
  const m = chrome.i18n.getMessage;
  const trigger = receipt.trigger;
  const clearedTypes = Array.isArray(receipt.clearedTypeKeys)
    ? receipt.clearedTypeKeys.map((key) => getTypeLabels()[key]).filter(Boolean)
    : (receipt.clearedTypes || []);
  const triggerLabel = {
    exit: m("desktopNotifExit"),
    startup: m("desktopNotifStartup"),
    manual: m("desktopNotifManual")
  }[trigger] || trigger;

  const completedAt = new Date(receipt.time || Date.now());
  const timeStr = completedAt.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
  const notificationId = CLEAR_NOTIFICATION_PREFIX + receipt.id;
  const isExitNotification = trigger === "exit";
  const clearedTypeText = clearedTypes.join(", ");
  const notificationOptions = {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: isExitNotification
      ? m(deferred ? "desktopNotifDeferredTitle" : "desktopNotifExitTitle")
      : m("desktopNotifTitle"),
    message: isExitNotification
      ? m(deferred ? "desktopNotifDeferredBody" : "desktopNotifExitBody", [timeStr])
      : trigger === "startup"
        ? m("desktopNotifRecoveryBody", [timeStr])
        : m("desktopNotifBody", [triggerLabel, timeStr, clearedTypeText]),
    priority: isExitNotification ? 2 : 1,
    requireInteraction: isExitNotification,
    buttons: [
      { title: m("desktopNotifSettings") }
    ]
  };

  if (clearedTypeText) {
    notificationOptions.contextMessage = m("desktopNotifContext", [clearedTypeText]);
  }

  await chrome.notifications.create(notificationId, notificationOptions);
}

async function deliverPendingClearNotification(receipt, options = {}) {
  if (!receipt || typeof receipt.id !== "string") return false;

  try {
    await showClearNotification(receipt, options);
    const { pendingClearNotification = null } = await chrome.storage.local.get({
      pendingClearNotification: null
    });
    if (pendingClearNotification && pendingClearNotification.id === receipt.id) {
      await chrome.storage.local.set({
        pendingClearNotification: null,
        lastNotificationErrorAt: null
      });
    }
    return true;
  } catch (error) {
    await chrome.storage.local.set({ lastNotificationErrorAt: new Date().toISOString() });
    console.error("Auto Clear History: failed to show completion notification", error);
    return false;
  }
}

async function rememberSettingsWindowId(windowId) {
  if (typeof windowId !== "number") return;
  const data = await chrome.storage.local.get({ [SETTINGS_WINDOW_IDS_KEY]: [] });
  const ids = data[SETTINGS_WINDOW_IDS_KEY].filter((id) => typeof id === "number");
  if (!ids.includes(windowId)) ids.push(windowId);
  await chrome.storage.local.set({ [SETTINGS_WINDOW_IDS_KEY]: ids });
}

async function forgetSettingsWindowId(windowId) {
  const data = await chrome.storage.local.get({ [SETTINGS_WINDOW_IDS_KEY]: [] });
  const ids = data[SETTINGS_WINDOW_IDS_KEY].filter((id) => typeof id === "number");
  const nextIds = ids.filter((id) => id !== windowId);
  if (nextIds.length !== ids.length) {
    await chrome.storage.local.set({ [SETTINGS_WINDOW_IDS_KEY]: nextIds });
    return true;
  }
  return false;
}

async function openSettingsPopup() {
  pendingSettingsWindowCreates += 1;
  setTimeout(() => {
    pendingSettingsWindowCreates = Math.max(0, pendingSettingsWindowCreates - 1);
  }, 3000);

  try {
    const settingsWindow = await chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: SETTINGS_WINDOW.width,
      height: SETTINGS_WINDOW.height,
      focused: true
    });
    await rememberSettingsWindowId(settingsWindow.id);
  } catch (error) {
    pendingSettingsWindowCreates = Math.max(0, pendingSettingsWindowCreates - 1);
    throw error;
  }
}

async function handleClearNotificationAction(notificationId) {
  if (!notificationId.startsWith(CLEAR_NOTIFICATION_PREFIX)) return;
  await openSettingsPopup();
  await chrome.notifications.clear(notificationId);
}

chrome.notifications.onClicked.addListener((notificationId) => {
  handleClearNotificationAction(notificationId).catch((err) => {
    console.error("Auto Clear History: failed to open settings from notification", err);
  });
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex !== 0) return;
  handleClearNotificationAction(notificationId).catch((err) => {
    console.error("Auto Clear History: failed to open settings from notification button", err);
  });
});

// ====== ウィンドウ閉じ検知（ベストエフォート） ======
async function handleWindowRemoved(windowId) {
  const wasExtensionWindow = await forgetSettingsWindowId(windowId);
  // セッション世代を先に捕まえる。getAll()の後に新規ウィンドウが
  // 開いてその新世代を読むと、稼働中のセッションを削除してしまうため。
  const state = await chrome.storage.local.get({
    pendingSession: null,
    pendingClear: false,
    lastExitTime: null
  });
  let pendingSession = getPendingSession(state);

  const windows = await chrome.windows.getAll();
  if (windows.length > 0) return;

  // 通知から開いた拡張自身のウィンドだけを閉じた場合は再削除しない。
  if (wasExtensionWindow && !pendingSession) return;
  if (!pendingSession) pendingSession = await markSessionPending();

  // Chromeプロセスが先に終了した場合は、pendingSessionを
  // 残したままにし、次回起動直後に同じ削除を再試行する。
  await clearPendingSession("exit", pendingSession);
}

chrome.windows.onRemoved.addListener((windowId) => {
  handleWindowRemoved(windowId).catch(async (error) => {
    await chrome.storage.local.set({ lastClearErrorAt: new Date().toISOString() });
    console.error("Auto Clear History: exit clear failed", error);
  });
});

// ====== 起動時フォールバック ======
async function handleStartup() {
  const settings = await chrome.storage.local.get({
    ...DEFAULT_SETTINGS,
    pendingClear: false,
    lastExitTime: null
  });

  if (settings.paused) {
    await chrome.action.setBadgeText({ text: "||" });
    await chrome.action.setBadgeBackgroundColor({ color: "#ff9800" });
  }

  // 終了中にOS通知まで到達できなかった場合は、次回起動時に再表示する。
  if (settings.pendingClearNotification) {
    await deliverPendingClearNotification(settings.pendingClearNotification, { deferred: true });
  }

  const pendingSession = getPendingSession(settings);
  try {
    if (pendingSession) await clearPendingSession("startup", pendingSession);
  } finally {
    // onCreatedと削除完了が競合しても、現セッション用の新世代を必ず残す。
    await markSessionPending();
  }

}

chrome.runtime.onStartup.addListener(() => {
  handleStartup().catch(async (error) => {
    await chrome.storage.local.set({ lastClearErrorAt: new Date().toISOString() });
    console.error("Auto Clear History: startup clear failed", error);
  });
});

// ====== ウィンドウ作成時: 現セッションの未完了世代を保存 ======
async function handleWindowCreated(createdWindow) {
  if (createdWindow.type === "popup" && pendingSettingsWindowCreates > 0) {
    pendingSettingsWindowCreates -= 1;
    return;
  }

  await markSessionPending();
}

chrome.windows.onCreated.addListener((createdWindow) => {
  handleWindowCreated(createdWindow).catch((error) => {
    console.error("Auto Clear History: failed to mark active session", error);
  });
});

// ====== インストール時 ======
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const toSet = {};
  for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in existing)) toSet[key] = val;
  }
  if (!existing.installDate) {
    toSet.installDate = new Date().toISOString();
  }
  // Chrome 144以降は拡張APIからパスワードを削除できない。
  toSet.clearPasswords = false;
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }
  await markSessionPending();
});

// ====== ポップアップからの操作 ======
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "pause") {
    handlePause(msg.duration)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (msg.action === "resume") {
    handleResume()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (msg.action === "clearNow") {
    let settingsSnapshot;
    try { settingsSnapshot = normalizeManualSettings(msg.settings); }
    catch (error) {
      sendResponse({ ok: false, error: String(error) });
      return false;
    }
    if (!settingsSnapshot) {
      sendResponse({ ok: false, error: "Missing confirmed settings" });
      return false;
    }
    requestClear("manual", { ignoreAutomationState: true, settingsSnapshot })
      .then((result) => sendResponse({ ok: true, cleared: result.cleared }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});

async function handlePause(durationMinutes) {
  let pauseUntil = null;
  await chrome.alarms.clear("pause-resume");
  if (durationMinutes > 0) {
    pauseUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    chrome.alarms.create("pause-resume", { delayInMinutes: durationMinutes });
  }
  await chrome.storage.local.set({ paused: true, pauseUntil });
  chrome.action.setBadgeText({ text: "||" });
  chrome.action.setBadgeBackgroundColor({ color: "#ff9800" });
}

async function handleResume() {
  await chrome.alarms.clear("pause-resume");
  await chrome.storage.local.set({ paused: false, pauseUntil: null });
  chrome.action.setBadgeText({ text: "" });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "pause-resume") {
    await chrome.storage.local.set({ paused: false, pauseUntil: null });
    chrome.action.setBadgeText({ text: "" });
  }
});

// Motor de sincronizacao isolado em superSync: e super-sync.
importScripts("sync/js/background-script.js");
