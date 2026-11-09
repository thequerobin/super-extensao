"use strict";
const $ = id => document.getElementById(id);
const TOGGLES = ["enabled", "clearHistory", "clearCache", "clearCookies", "clearDownloads", "clearFormData", "clearLocalStorage"];
const DEFAULTS = {enabled:true, clearHistory:true, clearCache:false, clearCookies:false, clearDownloads:false, clearFormData:false, clearLocalStorage:false, excludedSites:[], theme:"dark", paused:false, pauseUntil:null};
const PRESETS = {
  safe: {clearHistory:true, clearCache:false, clearCookies:false, clearDownloads:false, clearFormData:false, clearLocalStorage:false},
  standard: {clearHistory:true, clearCache:true, clearCookies:false, clearDownloads:false, clearFormData:false, clearLocalStorage:false},
  strong: {clearHistory:true, clearCache:true, clearCookies:true, clearDownloads:true, clearFormData:true, clearLocalStorage:true}
};
const LABELS = {history:"histórico", cache:"cache", cookies:"cookies", downloads:"histórico de downloads", formData:"formulários", localStorage:"armazenamento local"};
let folders = new Map();
let preview = {domains:[], skipped:0};
let mutationQueue = Promise.resolve();
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function showError(error) {
  $("error").textContent = error?.message || String(error);
  $("error").hidden = false;
}
function notify(message) { $("status").textContent = message; $("error").hidden = true; }
function handle(action) { return (...args) => Promise.resolve().then(() => action(...args)).catch(showError); }
function serializeMutation(action) {
  const result = mutationQueue.catch(() => {}).then(action);
  mutationQueue = result.catch(() => {});
  return result;
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "system" ? (systemTheme.matches ? "dark" : "light") : theme;
}
function activateTab(tab) {
  for (const name of ["cleanup", "exceptions", "bookmarks", "autoplay", "tabs"]) {
    $("panel-" + name).hidden = name !== tab;
    $("tab-" + name).classList.toggle("active", name === tab);
    $("tab-" + name).setAttribute("aria-pressed", String(name === tab));
  }
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
    $("reportTitle").textContent = "A última tentativa não foi concluída";
    $("reportDetail").textContent = "Confira as configurações. Uma limpeza automática pendente será tentada na próxima abertura.";
  } else if (data.lastClearTime) {
    const reason = {manual:"Manual", exit:"Ao fechar", startup:"Recuperação na abertura"}[data.lastClearReason] || "Automática";
    $("reportTitle").textContent = new Date(data.lastClearTime).toLocaleString("pt-BR");
    const labels = data.lastClearTypeKeys?.map(key => LABELS[key]).filter(Boolean) || data.lastClearTypes || [];
    $("reportDetail").textContent = `${reason} · ${labels.join(", ")}`;
  } else {
    $("reportTitle").textContent = "Nenhuma limpeza registrada";
    $("reportDetail").textContent = "Por padrão, somente o histórico será apagado.";
  }
}
async function refreshPause() {
  const {paused, pauseUntil} = await chrome.storage.local.get(DEFAULTS);
  const active = paused && (!pauseUntil || Date.parse(pauseUntil) > Date.now());
  $("pauseRow").hidden = !active;
  $("pauseStatus").textContent = pauseUntil ? "Pausada até " + new Date(pauseUntil).toLocaleString("pt-BR") : "Pausada até você retomar";
}
async function message(payload) {
  const response = await chrome.runtime.sendMessage(payload);
  if (!response?.ok) throw new Error(response?.error || "O serviço de limpeza não respondeu.");
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
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remover ${domain}`);
    remove.addEventListener("click", handle(async () => {
      remove.disabled = true;
      await serializeMutation(async () => {
        const data = await chrome.storage.local.get({excludedSites:[]});
        await chrome.storage.local.set({excludedSites: ClearRules.normalizeList(data.excludedSites).filter(site => site !== domain)});
      });
      await refreshList();
      await refreshPreview();
      notify("Exceção removida.");
    }));
    li.append(text, remove);
    $("domainList").append(li);
  }
  $("listCount").textContent = `${sites.length} ${sites.length === 1 ? "domínio" : "domínios"}`;
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
  $("previewCount").textContent = `${fresh.length} ${fresh.length === 1 ? "novo domínio" : "novos domínios"}`;
  $("previewDetail").textContent = `${preview.domains.length} únicos nesta pasta · ${preview.domains.length - fresh.length} já na lista · ${preview.skipped} links incompatíveis ignorados`;
  $("previewDomains").replaceChildren();
  for (const domain of preview.domains) {
    const li = document.createElement("li");
    li.textContent = domain + (existing.has(domain) ? " (já na lista)" : "");
    $("previewDomains").append(li);
  }
  $("importBookmarks").disabled = fresh.length === 0;
}
async function loadBookmarks() {
  // Must be called directly from the click listener to retain the user gesture.
  const granted = await chrome.permissions.request({permissions:["bookmarks"]});
  if (!granted) { notify("Acesso aos favoritos não concedido. Você ainda pode adicionar domínios manualmente."); return; }
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
  $("loadFolders").textContent = "Atualizar pastas de favoritos";
  if (!$("bookmarkFolder").options.length) notify("Nenhuma pasta de favoritos disponível.");
  await refreshPreview();
}
async function init() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  for (const key of TOGGLES) $(key).checked = settings[key] === true;
  $("theme").value = ["dark", "light", "system"].includes(settings.theme) ? settings.theme : "dark";
  applyTheme($("theme").value);
  refreshPresets();
  $("theme").addEventListener("change", handle(async () => {
    applyTheme($("theme").value);
    await chrome.storage.local.set({theme:$("theme").value});
  }));
  systemTheme.addEventListener("change", () => applyTheme($("theme").value));
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => activateTab(button.dataset.tab)));
  for (const key of TOGGLES) $(key).addEventListener("change", handle(async () => {
    if (key === "clearCookies" && $(key).checked && !confirm("Apagar cookies pode desconectar suas contas. As exceções protegem somente cookies. Ativar exclusão de cookies?")) {
      $(key).checked = false; return;
    }
    await serializeMutation(() => chrome.storage.local.set({[key]:$(key).checked}));
    refreshPresets();
  }));
  document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", handle(async () => {
    const preset = PRESETS[button.dataset.preset];
    if (preset.clearCookies && !confirm("O modo Forte apaga todos os tipos selecionáveis, inclusive cookies e armazenamento local. Exceções preservam somente cookies. Aplicar?")) return;
    await serializeMutation(() => chrome.storage.local.set(preset));
    Object.entries(preset).forEach(([key, value]) => { $(key).checked = value; });
    refreshPresets(); notify("Modo de limpeza salvo.");
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
      notify(count ? "Domínio adicionado às exceções de cookies." : "Esse domínio já está na lista.");
    })();
  });
  $("goImport").addEventListener("click", () => activateTab("bookmarks"));
  $("openSync").addEventListener("click", handle(() => chrome.tabs.create({url:chrome.runtime.getURL("sync/html/options.html")})));
  $("openNewtab").addEventListener("click", handle(() => chrome.tabs.create({url:chrome.runtime.getURL("newtab/index.html")})));
  $("loadFolders").addEventListener("click", () => { loadBookmarks().catch(showError); });
  $("bookmarkFolder").addEventListener("change", handle(refreshPreview));
  $("includeSubfolders").addEventListener("change", handle(refreshPreview));
  $("importBookmarks").addEventListener("click", handle(async () => {
    $("importBookmarks").disabled = true;
    try {
      const folder = folders.get($("bookmarkFolder").value);
      if (!folder) throw new Error("Escolha uma pasta de favoritos.");
      const selected = ClearRules.bookmarkDomains(folder, $("includeSubfolders").checked);
      const count = await addDomains(selected.domains);
      await refreshList(); await refreshPreview();
      notify(`${count} ${count === 1 ? "domínio importado" : "domínios importados"} para as exceções de cookies.`);
    } finally { await refreshPreview(); }
  }));
  $("clearNow").addEventListener("click", handle(async () => {
    await mutationQueue;
    const snapshot = await chrome.storage.local.get(DEFAULTS);
    if (!Object.keys(LABELS).some(type => snapshot[{history:"clearHistory", cache:"clearCache", cookies:"clearCookies", downloads:"clearDownloads", formData:"clearFormData", localStorage:"clearLocalStorage"}[type]])) {
      notify("Escolha pelo menos um tipo de dado na aba Limpeza."); return;
    }
    if (snapshot.clearCookies && !confirm("Limpar os dados selecionados agora? Cookies fora das exceções serão apagados e isso pode desconectar contas.")) return;
    $("clearNow").disabled = true;
    notify("Limpando…");
    try {
      const response = await message({action:"clearNow", settings:snapshot});
      if (!response.cleared) throw new Error("A limpeza não foi executada.");
      notify("Limpeza concluída.");
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
