/* One folder picker/import flow. Browser access and destination rules are injected. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("../rules.js"), require("./bookmark-preview.js"), require("./async-state.js"));
  else root.SuperBookmarkImporter = factory(root.ClearRules, root.SuperBookmarkPreview, root.SuperAsyncState);
})(globalThis, function (rules, {renderBookmarkPreview}, {escape: e, renderAsyncState}) {
  const words = locale => locale === "en" ? {
    choose: "Choose bookmarks folder", refresh: "Refresh bookmarks folders", folder: "Folder", recursive: "Include subfolders", apply: "Import domains", loading: "Loading bookmarks…", denied: "Bookmark access was not granted. You can still add domains manually.", failed: "Could not access bookmarks. Try again.", empty: "No bookmarks folders available.", retry: "Try again",
  } : {
    choose: "Escolher pasta de favoritos", refresh: "Atualizar pastas de favoritos", folder: "Pasta", recursive: "Incluir subpastas", apply: "Importar domínios", loading: "Carregando favoritos…", denied: "Acesso aos favoritos não concedido. Você ainda pode adicionar domínios manualmente.", failed: "Não foi possível acessar os favoritos. Tente novamente.", empty: "Nenhuma pasta de favoritos disponível.", retry: "Tentar novamente",
  };
  function bookmarkImporterMarkup({ids = {}, locale = "pt-BR"} = {}) {
    const t = words(locale), id = key => ids[key] ? ` id="${e(ids[key])}"` : "";
    return `<div class="ui-bookmark-importer" data-bookmark-importer><button type="button" class="ui-button ui-button-secondary" data-bookmark-load data-action="load-bookmarks"${id("load")}>${e(t.choose)}</button><div data-bookmark-status></div><div data-bookmark-controls${id("controls")} hidden><label class="ui-field"><span data-bookmark-folder-label>${e(t.folder)}</span><select class="ui-control" data-bookmark-folder data-field="bookmark-folder"${id("folder")}></select></label><label class="ui-check"><input type="checkbox" data-bookmark-recursive data-field="bookmark-recursive"${id("recursive")} checked><span data-bookmark-recursive-label>${e(t.recursive)}</span></label><div class="ui-card import-preview" data-bookmark-preview><strong${id("count")}></strong><p${id("detail")}></p><ul${id("domains")}></ul></div><button type="button" class="ui-button" data-bookmark-apply data-action="import-bookmarks"${id("apply")} disabled>${e(t.apply)}</button></div></div>`;
  }
  function createBookmarkImporter(options) {
    const state = {folders: null, folder: "", recursive: true, busy: false, error: "", preview: {domains: [], fresh: [], skipped: 0}};
    let host, unbind, disposed = false, revision = 0, pending;
    const locale = () => options.locale();
    const disabled = () => Boolean(options.disabled?.());
    function render() {
      if (!host?.isConnected || disposed) return;
      const t = words(locale());
      const load = host.querySelector("[data-bookmark-load]");
      load.textContent = state.folders ? t.refresh : t.choose;
      load.disabled = state.busy || disabled();
      const controls = host.querySelector("[data-bookmark-controls]");
      controls.hidden = !state.folders?.length;
      const select = host.querySelector("[data-bookmark-folder]");
      select.replaceChildren(...(state.folders || []).map(folder => {
        const option = host.ownerDocument.createElement("option"); option.value = folder.id; option.textContent = folder.label; return option;
      }));
      select.value = state.folder; select.disabled = state.busy || disabled();
      const recursive = host.querySelector("[data-bookmark-recursive]");
      recursive.checked = state.recursive; recursive.disabled = state.busy || disabled();
      host.querySelector("[data-bookmark-folder-label]").textContent = t.folder;
      host.querySelector("[data-bookmark-recursive-label]").textContent = t.recursive;
      const apply = host.querySelector("[data-bookmark-apply]");
      apply.textContent = t.apply; apply.disabled = state.busy || disabled() || Boolean(state.error) || !state.preview.fresh.length;
      const card = host.querySelector("[data-bookmark-preview]");
      const ids = Object.fromEntries([['count','strong'],['detail','p'],['domains','ul']].map(([key,tag]) => [key,card.querySelector(tag)?.id]));
      renderBookmarkPreview(card, state.preview, locale(), ids);
      renderAsyncState(host.querySelector("[data-bookmark-status]"), {
        kind: state.error ? "error" : state.busy ? "loading" : state.folders && !state.folders.length ? "empty" : "",
        text: state.error ? t[state.error] || state.error : state.busy ? t.loading : t.empty,
        retry: state.error ? t.retry : "", disabled: state.busy || disabled(),
      }, () => { void loadFolders(); });
    }
    async function preview(scope = options.scope()) {
      const current = ++revision;
      const folder = state.folders?.find(item => item.id === state.folder)?.node;
      const result = folder ? rules.bookmarkDomains(folder, state.recursive, options.normalize) : {domains: [], skipped: 0};
      const existing = new Set(await options.existing(scope));
      const value = {...result, fresh: result.domains.filter(domain => !existing.has(domain))};
      if (!disposed && current === revision && scope === options.scope()) { state.preview = value; render(); }
      return value;
    }
    function loadFolders() {
      if (disposed || disabled()) return Promise.resolve();
      if (pending) return pending;
      // Invoke request in the originating click, before any async work.
      let permission;
      try { permission = options.browser.permissions.request({permissions: ["bookmarks"]}); }
      catch { state.error = "failed"; render(); return Promise.resolve(); }
      state.busy = true; state.error = ""; render();
      pending = (async () => {
        try {
          if (!await permission) { state.error = "denied"; return; }
          if (disposed) return;
          const tree = await options.browser.bookmarks.getTree();
          if (disposed) return;
          state.folders = rules.bookmarkFolders(tree, true);
          if (!state.folders.some(item => item.id === state.folder)) state.folder = state.folders[0]?.id || "";
          await preview();
        } catch { if (!disposed) state.error = "failed"; }
        finally { state.busy = false; pending = undefined; render(); }
      })();
      return pending;
    }
    async function apply() {
      if (disposed || state.busy || disabled() || state.error) return;
      const scope = options.scope();
      state.busy = true; state.error = ""; render();
      try {
        const value = await preview(scope);
        if (disposed || scope !== options.scope() || disabled()) return;
        if (value.fresh.length) await options.import(value.fresh, scope);
        if (!disposed) await preview();
      } catch (error) { if (!disposed) state.error = error?.message || "failed"; }
      finally { state.busy = false; render(); }
    }
    function attach(element) {
      unbind?.(); host = element;
      const click = event => {
        if (event.target.closest("[data-bookmark-load]")) { event.stopPropagation(); void loadFolders(); }
        if (event.target.closest("[data-bookmark-apply]")) { event.stopPropagation(); void apply(); }
      };
      const change = event => {
        if (event.target.matches("[data-bookmark-folder]")) state.folder = event.target.value;
        else if (event.target.matches("[data-bookmark-recursive]")) state.recursive = event.target.checked;
        else return;
        event.stopPropagation(); void preview().catch(() => {state.error = "failed"; render();});
      };
      element.addEventListener("click", click); element.addEventListener("change", change);
      unbind = () => {element.removeEventListener("click", click); element.removeEventListener("change", change);};
      render();
    }
    return {state, attach, load: loadFolders, refresh: preview, render, apply, dispose() {disposed = true; revision++; unbind?.(); host = undefined;}};
  }
  return {bookmarkImporterMarkup, createBookmarkImporter};
});
