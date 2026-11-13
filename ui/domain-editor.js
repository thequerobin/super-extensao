/* Shared domain entry, count, list and empty state. Policy stays in adapters. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./async-state.js"));
  else root.SuperDomainEditor = factory(root.SuperAsyncState);
})(globalThis, function ({escape: e}) {
  function domainEditorMarkup({ids = {}, labels, value = "", subdomains, count = 0, form = false, importLink = false, markers = {}}) {
    const id = key => ids[key] ? ` id="${e(ids[key])}"` : "";
    const marker = key => markers[key] ? ` data-i18n="${e(markers[key])}"` : "";
    return `<${form ? "form" : "div"}${id("form")} class="ui-domain-editor" data-domain-editor>
      <label class="ui-field"${ids.input ? ` for="${e(ids.input)}"` : ""}><span${marker("domain")}>${e(labels.domain)}</span><span class="ui-actions ui-domain-entry"><input${id("input")} class="ui-control" data-domain-input data-field="domain" value="${e(value)}" placeholder="example.com" autocomplete="off" spellcheck="false" ${form ? "required" : ""}><button type="button" class="ui-button" data-domain-add data-action="add-domain"${marker("add")}>${e(labels.add)}</button></span></label>
      ${subdomains !== undefined ? `<label class="ui-check"><input type="checkbox" data-field="subdomains" ${subdomains ? "checked" : ""}> ${e(labels.subdomains)}</label>` : ""}
      <div class="ui-domain-heading"><span${id("count")} data-domain-count>${e(labels.count || count)}</span>${importLink ? `<button type="button"${id("import")} class="ui-button ui-domain-import"${marker("import")}>${e(labels.import)}</button>` : ""}</div>
      <ul${id("list")} data-domain-list class="domain-list"></ul><p${id("empty")} class="ui-empty" data-domain-empty${marker("empty")}>${e(labels.empty)}</p>
    </${form ? "form" : "div"}>`.replace(/[ \t]+$/gm, "");
  }
  function bindDomainEditor(host, {normalize, onAdd, onError}) {
    let busy = false, disposed = false;
    const input = host.querySelector("[data-domain-input]");
    const button = host.querySelector("[data-domain-add]");
    const add = async event => {
      event.preventDefault(); event.stopPropagation();
      if (busy || button.disabled || button.closest("fieldset:disabled")) return;
      busy = true; button.disabled = true;
      const value = input.value;
      try {
        await onAdd(normalize(value));
        if (!disposed && input.value === value) input.value = "";
      } catch (error) { if (!disposed) onError(error); }
      finally { busy = false; if (!disposed) button.disabled = false; }
    };
    const keydown = event => { if (event.key === "Enter" && event.target === input) void add(event); };
    button.addEventListener("click", add);
    input.addEventListener("keydown", keydown);
    if (host.tagName === "FORM") host.addEventListener("submit", add);
    return () => {
      disposed = true;
      button.removeEventListener("click", add); input.removeEventListener("keydown", keydown);
      host.removeEventListener("submit", add);
    };
  }
  return {domainEditorMarkup, bindDomainEditor};
});
