/* A pinned spare tab keeps Ctrl+W from closing the last normal browser window.
   Only tabs created and tracked by this module may be removed by the guard. */
(function () {
  "use strict";
  let running = false;
  let dirty = false;
  let closingWindows = new Set();
  const STATE_KEY = "tabGuardSession";
  const spareUrl = chrome.runtime.getURL("spare-tab.html");
  const dashboardUrl = chrome.runtime.getURL("newtab/index.html");
  async function reconcile() {
    const data = await chrome.storage.local.get({tabGuard:SuperTools.TAB_DEFAULTS});
    const settings = SuperTools.tabSettings(data.tabGuard);
    const stored = await chrome.storage.session.get({[STATE_KEY]:{firstWindowId:null, owned:{}}});
    const session = stored[STATE_KEY];
    const windows = await chrome.windows.getAll({populate:true, windowTypes:["normal"]});
    const live = new Set(windows.flatMap(window => (window.tabs || []).map(tab => String(tab.id))));
    const owned = session.owned || {};
    for (const id of Object.keys(owned)) if (!live.has(id)) delete owned[id];
    if (!windows.some(window => window.id === session.firstWindowId)) session.firstWindowId = windows[0]?.id ?? null;
    session.owned = owned;
    // Save immediately after ownership changes so worker suspension can't lose it.
    async function save() { await chrome.storage.session.set({[STATE_KEY]:session}); }
    await save();
    for (const window of windows) {
      if (closingWindows.has(window.id)) continue;
      let tabs = window.tabs || [];
      if (!tabs.length) continue;
      const isOwned = tab => owned[String(tab.id)] === window.id;
      // Navigating or unpinning the spare turns it into the user's own tab.
      for (const tab of tabs) {
        if (isOwned(tab) && (!tab.pinned || (tab.pendingUrl || tab.url) !== spareUrl)) {
          delete owned[String(tab.id)]; await save();
        }
      }
      const protectedWindow = SuperTools.protectsWindow(settings, window.id, session.firstWindowId, windows.length);
      const spares = tabs.filter(isOwned);
      const regular = tabs.filter(tab => !isOwned(tab));
      if (!protectedWindow || regular.length >= 2) {
        for (const spare of spares) {
          if (tabs.length > 1) { await chrome.tabs.remove(spare.id); tabs = tabs.filter(tab => tab.id !== spare.id); }
          else { await chrome.tabs.update(spare.id,{pinned:false}); }
          delete owned[String(spare.id)]; await save();
        }
      } else if (tabs.length === 1) {
        const tab = tabs[0];
        if (isOwned(tab) || tab.pinned) {
          // Keep any existing user-pinned tab intact and open a regular new tab.
          const created = await chrome.tabs.create({windowId:window.id,url:"chrome://newtab/",active:true});
          tabs.push(created);
        } else {
          const spare = await chrome.tabs.create({windowId:window.id,url:spareUrl,pinned:true,active:false,index:0});
          owned[String(spare.id)] = window.id; await save(); tabs.unshift(spare);
        }
      }
      if (!settings.enabled || !settings.singleNewTab) continue;
      const blanks = tabs.filter(tab => !tab.pinned && !isOwned(tab) && SuperTools.isNewTab(tab, dashboardUrl));
      const keep = blanks.find(tab => tab.active) || blanks[blanks.length - 1];
      for (const blank of blanks) if (blank.id !== keep.id) {
        await chrome.tabs.remove(blank.id); tabs = tabs.filter(tab => tab.id !== blank.id);
      }
      if (settings.newTabLast && keep && keep.index !== tabs.length - 1) await chrome.tabs.move(keep.id,{index:-1});
    }
  }
  async function schedule() {
    dirty = true;
    if (running) return;
    running = true;
    try {
      while (dirty) {
        dirty = false;
        try { await reconcile(); }
        catch (error) {
          // A tab/window can disappear while awaiting a Chrome API. The next
          // event retries from a fresh snapshot, without reopening closed windows.
          console.debug("Super Extensão: reconciliação de abas interrompida", String(error));
        }
      }
    } finally { running = false; }
  }
  chrome.tabs.onCreated.addListener(schedule);
  chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url || change.pinned !== undefined || change.status === "complete") void schedule(); });
  chrome.tabs.onRemoved.addListener((_id, info) => {
    if (info.isWindowClosing) { closingWindows.add(info.windowId); return; }
    void schedule();
  });
  chrome.tabs.onAttached.addListener(schedule);
  chrome.tabs.onDetached.addListener(schedule);
  chrome.tabs.onMoved.addListener(schedule);
  chrome.tabs.onActivated.addListener(schedule);
  chrome.windows.onCreated.addListener(schedule);
  chrome.windows.onRemoved.addListener(id => { closingWindows.delete(id); void schedule(); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.tabGuard) void schedule(); });
  chrome.runtime.onStartup.addListener(schedule);
  chrome.runtime.onInstalled.addListener(async () => {
    const current = await chrome.storage.local.get(["autoplay","tabGuard"]);
    const initial = {};
    if (!current.autoplay) initial.autoplay = SuperTools.AUTOPLAY_DEFAULTS;
    if (!current.tabGuard) initial.tabGuard = SuperTools.TAB_DEFAULTS;
    if (Object.keys(initial).length) await chrome.storage.local.set(initial);
    void schedule();
  });
  void schedule();
})();
