"use strict";
const $ = id => document.getElementById(id);
const TOGGLES = ["enabled", "clearHistory", "clearCache", "clearCookies", "clearDownloads", "clearFormData", "clearLocalStorage"];
const DEFAULTS = {enabled:true, clearHistory:true, clearCache:false, clearCookies:false, clearDownloads:false, clearFormData:false, clearLocalStorage:false, excludedSites:[], paused:false, pauseUntil:null};
const PRESETS = {
  safe: {clearHistory:true, clearCache:false, clearCookies:false, clearDownloads:false, clearFormData:false, clearLocalStorage:false},
  standard: {clearHistory:true, clearCache:true, clearCookies:false, clearDownloads:false, clearFormData:false, clearLocalStorage:false},
  strong: {clearHistory:true, clearCache:true, clearCookies:true, clearDownloads:true, clearFormData:true, clearLocalStorage:true}
};
const LABELS = {history:SuperI18n.text("histórico"), cache:SuperI18n.text("cache"), cookies:SuperI18n.text("cookies"), downloads:SuperI18n.text("histórico de downloads"), formData:SuperI18n.text("formulários"), localStorage:SuperI18n.text("armazenamento local")};
let folders = new Map();
let preview = {domains:[], skipped:0};
let mutationQueue = Promise.resolve();

function showError(error) {
  $("error").textContent = SuperI18n.text(error?.message || String(error));
  $("error").hidden = false;
}
let lastNotice;
function renderNotice(){if(lastNotice)$("popupStatus").textContent=lastNotice.key?SuperI18n.t(lastNotice.key,lastNotice.values):SuperI18n.text(lastNotice.literal);}
function notify(message) {lastNotice={literal:message};renderNotice();$("error").hidden=true;}
function notifyMessage(key,values){lastNotice={key,values};renderNotice();$("error").hidden=true;}
function handle(action) { return (...args) => Promise.resolve().then(() => action(...args)).catch(showError); }
function serializeMutation(action) {
  const result = mutationQueue.catch(() => {}).then(action);
  mutationQueue = result.catch(() => {});
  return result;
}
const NAV_TABS = ["cleanup", "exceptions", "bookmarks", "autoplay", "tabs", "sync", "vpn"];
let lastCleanupTab = "cleanup";
function activateTab(tab, persist = true) {
  if (!NAV_TABS.includes(tab)) tab = "cleanup";
  document.body.dataset.activeTab = tab;
  const isCleanup = ["cleanup", "exceptions", "bookmarks"].includes(tab);
  if (isCleanup) lastCleanupTab = tab;
  $("cleanupSubmenu").hidden = !isCleanup;
  $("syncSubmenu").hidden = tab !== "sync";
  $("vpnSubmenu").hidden = tab !== "vpn";
  $("section-cleanup").classList.toggle("active", isCleanup);
  $("section-cleanup").setAttribute("aria-pressed", String(isCleanup));
  for (const name of NAV_TABS) {
    $("panel-" + name).hidden = name !== tab;
    $("tab-" + name).classList.toggle("active", name === tab);
    $("tab-" + name).setAttribute("aria-pressed", String(name === tab));
  }
  if (persist) chrome.storage.local.set({popupView:{tab, lastCleanupTab}}).catch(showError);
  document.dispatchEvent(new CustomEvent("super-extension:panel-selected", {detail:tab}));
}
function refreshPresets() {
  document.querySelectorAll("[data-preset]").forEach(button => {
    const active = Object.entries(PRESETS[button.dataset.preset]).every(([key, value]) => $(key).checked === value);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
async function refreshReport() {
  const data = await chrome.storage.local.get(["lastClearTime", "lastClearReason", "lastClearTypeKeys", "lastClearTypes", "lastClearErrorAt"]);
  if (data.lastClearErrorAt && (!data.lastClearTime || Date.parse(data.lastClearErrorAt) > Date.parse(data.lastClearTime))) {
    $("reportTitle").textContent = SuperI18n.text("A última tentativa não foi concluída");
    $("reportDetail").textContent = SuperI18n.text("Confira as configurações. Uma limpeza automática pendente será tentada na próxima abertura.");
  } else if (data.lastClearTime) {
    const reason = {manual:SuperI18n.text("Manual"), exit:SuperI18n.text("Ao fechar"), startup:SuperI18n.text("Recuperação na abertura")}[data.lastClearReason] || SuperI18n.text("Automática");
    $("reportTitle").textContent = new Date(data.lastClearTime).toLocaleString(SuperI18n.locale);
    const labels = data.lastClearTypeKeys?.map(key => SuperI18n.text(LABELS[key])).filter(Boolean) || data.lastClearTypes?.map(value=>SuperI18n.text(value)) || [];
    $("reportDetail").textContent = `${reason} · ${labels.join(", ")}`;
  } else {
    $("reportTitle").textContent = SuperI18n.text("Nenhuma limpeza registrada");
    $("reportDetail").textContent = SuperI18n.text("Por padrão, somente o histórico será apagado.");
  }
}
async function refreshPause() {
  const {paused, pauseUntil} = await chrome.storage.local.get(DEFAULTS);
  const active = paused && (!pauseUntil || Date.parse(pauseUntil) > Date.now());
  $("pauseRow").hidden = !active;
  $("pauseStatus").textContent = pauseUntil ? SuperI18n.t("uiPausedUntil",{time:new Date(pauseUntil).toLocaleString(SuperI18n.locale)}) : SuperI18n.text("Pausada até você retomar");
}
async function message(payload) {
  const response = await chrome.runtime.sendMessage(payload);
  if (!response?.ok) throw new Error(response?.error || SuperI18n.text("O serviço de limpeza não respondeu."));
  return response;
}
async function refreshList() {
  const {excludedSites} = await chrome.storage.local.get({excludedSites:[]});
  const sites = ClearRules.normalizeList(excludedSites);
  $("domainList").replaceChildren();
  for (const domain of sites) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = domain;
    const remove = SuperUi.create("button", {className:"ui-button-compact ui-button-danger"});
    remove.textContent = "×";
    remove.setAttribute("aria-label", SuperI18n.t("uiRemoveDomain",{domain}));
    remove.addEventListener("click", handle(async () => {
      remove.disabled = true;
      await serializeMutation(async () => {
        const data = await chrome.storage.local.get({excludedSites:[]});
        await chrome.storage.local.set({excludedSites: ClearRules.normalizeList(data.excludedSites).filter(site => site !== domain)});
      });
      await refreshList();
      await refreshPreview();
      notify(SuperI18n.text("Exceção removida."));
    }));
    li.append(text, remove);
    $("domainList").append(li);
  }
  $("listCount").textContent = SuperI18n.t(sites.length===1?"uiDomainsOne":"uiDomainsMany",{count:sites.length});
  $("emptyList").hidden = sites.length > 0;
}
async function addDomains(values) {
  return serializeMutation(async () => {
    const data = await chrome.storage.local.get({excludedSites:[]});
    const before = ClearRules.normalizeList(data.excludedSites);
    const after = ClearRules.normalizeList([...before, ...values]);
    await chrome.storage.local.set({excludedSites:after});
    return after.length - before.length;
  });
}
async function refreshPreview() {
  const folder = folders.get($("bookmarkFolder").value);
  if (!folder) { $("importBookmarks").disabled = true; return; }
  preview = ClearRules.bookmarkDomains(folder, $("includeSubfolders").checked);
  const {excludedSites} = await chrome.storage.local.get({excludedSites:[]});
  const existing = new Set(ClearRules.normalizeList(excludedSites));
  const fresh = preview.domains.filter(domain => !existing.has(domain));
  $("previewCount").textContent = SuperI18n.t(fresh.length===1?"uiNewDomainsOne":"uiNewDomainsMany",{count:fresh.length});
  $("previewDetail").textContent = SuperI18n.t("uiPreview",{total:preview.domains.length,existing:preview.domains.length-fresh.length,skipped:preview.skipped});
  $("previewDomains").replaceChildren();
  for (const domain of preview.domains) {
    const li = document.createElement("li");
    li.textContent = domain + (existing.has(domain) ? SuperI18n.t("uiAlreadyListed") : "");
    $("previewDomains").append(li);
  }
  $("importBookmarks").disabled = fresh.length === 0;
}
async function loadBookmarks() {
  // Must be called directly from the click listener to retain the user gesture.
  const granted = await chrome.permissions.request({permissions:["bookmarks"]});
  if (!granted) { notify(SuperI18n.text("Acesso aos favoritos não concedido. Você ainda pode adicionar domínios manualmente.")); return; }
  const tree = await chrome.bookmarks.getTree();
  folders = new Map();
  function index(nodes) { for (const node of nodes) { if (!node.url) { folders.set(node.id, node); index(node.children || []); } } }
  index(tree);
  $("bookmarkFolder").replaceChildren();
  for (const folder of ClearRules.bookmarkFolders(tree)) {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.label;
    $("bookmarkFolder").append(option);
  }
  $("bookmarkControls").hidden = false;
  $("loadFolders").dataset.i18n="uiRefreshbookmarksfolderse7161";
  $("loadFolders").textContent = SuperI18n.text("Atualizar pastas de favoritos");
  if (!$("bookmarkFolder").options.length) notify(SuperI18n.text("Nenhuma pasta de favoritos disponível."));
  await refreshPreview();
}
async function refreshLanguage(){
  $("language").value=SuperI18n.locale;
  SuperI18n.apply();renderNotice();
  if(!$("error").hidden)$("error").textContent=SuperI18n.text($("error").textContent);
  await Promise.all([refreshReport(),refreshPause(),refreshList(),refreshPreview()]);
}
async function init() {
  await SuperI18n.ready;
  $("language").addEventListener("change",handle(()=>SuperPreferences.locale.set($("language").value)));
  SuperI18n.watch(()=>{refreshLanguage().catch(showError);});
  $("language").value=SuperI18n.locale;
  const settings = await chrome.storage.local.get({...DEFAULTS, popupView:null});
  for (const key of TOGGLES) $(key).checked = settings[key] === true;
  const stopTheme = SuperPreferences.bindTheme(document.documentElement, theme => {
    $("theme").value = theme;
  });
  window.addEventListener("unload", stopTheme, { once: true });
  const savedView = settings.popupView;
  if (["cleanup", "exceptions", "bookmarks"].includes(savedView?.lastCleanupTab)) lastCleanupTab = savedView.lastCleanupTab;
  activateTab(savedView?.tab, false);
  refreshPresets();
  $("theme").addEventListener("change", handle(() => SuperPreferences.theme.set($("theme").value)));
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => activateTab(button.dataset.tab)));
  $("section-cleanup").addEventListener("click", () => activateTab(lastCleanupTab));
  for (const key of TOGGLES) $(key).addEventListener("change", handle(async () => {
    if (key === "clearCookies" && $(key).checked && !confirm(SuperI18n.text("Apagar cookies pode desconectar suas contas. As exceções protegem somente cookies. Ativar exclusão de cookies?"))) {
      $(key).checked = false; return;
    }
    await serializeMutation(() => chrome.storage.local.set({[key]:$(key).checked}));
    refreshPresets();
  }));
  document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", handle(async () => {
    const preset = PRESETS[button.dataset.preset];
    if (preset.clearCookies && !confirm(SuperI18n.text("O modo Forte apaga todos os tipos selecionáveis, inclusive cookies e armazenamento local. Exceções preservam somente cookies. Aplicar?"))) return;
    await serializeMutation(() => chrome.storage.local.set(preset));
    Object.entries(preset).forEach(([key, value]) => { $(key).checked = value; });
    refreshPresets(); notify(SuperI18n.text("Modo de limpeza salvo."));
  })));
  $("pauseToggle").addEventListener("click", () => {
    $("pauseMenu").hidden = !$("pauseMenu").hidden;
    $("pauseToggle").setAttribute("aria-expanded", String(!$("pauseMenu").hidden));
  });
  document.querySelectorAll("[data-duration]").forEach(button => button.addEventListener("click", handle(async () => {
    let duration = Number(button.dataset.duration);
    if (button.dataset.duration === "today") {
      const now = new Date();
      duration = Math.max(1, Math.ceil((new Date(now.getFullYear(), now.getMonth(), now.getDate()+1) - now) / 60000));
    }
    await message({action:"pause", duration});
    $("pauseMenu").hidden = true; $("pauseToggle").setAttribute("aria-expanded", "false");
    await refreshPause();
  })));
  $("resume").addEventListener("click", handle(async () => { await message({action:"resume"}); await refreshPause(); }));
  $("domainForm").addEventListener("submit", event => {
    event.preventDefault();
    handle(async () => {
      const domain = ClearRules.normalizeDomain($("domainInput").value);
      const count = await addDomains([domain]);
      $("domainInput").value = "";
      await refreshList(); await refreshPreview();
      notify(count ? SuperI18n.text("Domínio adicionado às exceções de cookies.") : SuperI18n.text("Esse domínio já está na lista."));
    })();
  });
  $("goImport").addEventListener("click", () => activateTab("bookmarks"));
  $("loadFolders").addEventListener("click", () => { loadBookmarks().catch(showError); });
  $("bookmarkFolder").addEventListener("change", handle(refreshPreview));
  $("includeSubfolders").addEventListener("change", handle(refreshPreview));
  $("importBookmarks").addEventListener("click", handle(async () => {
    $("importBookmarks").disabled = true;
    try {
      const folder = folders.get($("bookmarkFolder").value);
      if (!folder) throw new Error(SuperI18n.text("Escolha uma pasta de favoritos."));
      const selected = ClearRules.bookmarkDomains(folder, $("includeSubfolders").checked);
      const count = await addDomains(selected.domains);
      await refreshList(); await refreshPreview();
      notifyMessage(count===1?"uiImportedOne":"uiImportedMany",{count});
    } finally { await refreshPreview(); }
  }));
  $("clearNow").addEventListener("click", handle(async () => {
    await mutationQueue;
    const snapshot = await chrome.storage.local.get(DEFAULTS);
    if (!Object.keys(LABELS).some(type => snapshot[{history:"clearHistory", cache:"clearCache", cookies:"clearCookies", downloads:"clearDownloads", formData:"clearFormData", localStorage:"clearLocalStorage"}[type]])) {
      notify(SuperI18n.text("Escolha pelo menos um tipo de dado na aba Limpeza.")); return;
    }
    if (snapshot.clearCookies && !confirm(SuperI18n.text("Limpar os dados selecionados agora? Cookies fora das exceções serão apagados e isso pode desconectar contas."))) return;
    $("clearNow").disabled = true;
    notify(SuperI18n.text("Limpando…"));
    try {
      const response = await message({action:"clearNow", settings:snapshot});
      if (!response.cleared) throw new Error(SuperI18n.text("A limpeza não foi executada."));
      notify(SuperI18n.text("Limpeza concluída."));
    } finally { $("clearNow").disabled = false; await refreshReport(); }
  }));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.lastClearTime || changes.lastClearErrorAt) refreshReport().catch(showError);
    if (changes.paused || changes.pauseUntil) refreshPause().catch(showError);
  });
  await refreshReport(); await refreshPause(); await refreshList();
}
init().catch(showError);
