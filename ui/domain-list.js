/* Shared editable domain list. Adapters own persistence and removal behavior. */
(function (root) {
  "use strict";
  function renderDomainList(list, items, options) {
    const scroll = list.scrollTop;
    const doc = list.ownerDocument;
    list.classList.add("ui-domain-list");
    list.replaceChildren();
    for (const item of items) {
      const row = doc.createElement("li");
      const text = doc.createElement("span");
      text.textContent = item.domain;
      if (item.detail) {
        const detail = doc.createElement("small");
        detail.textContent = item.detail;
        text.append(detail);
      }
      const remove = doc.createElement("button");
      remove.type = "button";
      remove.className = "ui-button ui-button-compact ui-button-danger";
      remove.textContent = "×";
      remove.setAttribute("aria-label", options.removeLabel(item.domain));
      remove.disabled = Boolean(options.disabled);
      if (options.action) {
        remove.dataset.action = options.action;
        remove.dataset.domain = item.domain;
      }
      if (options.onRemove) remove.addEventListener("click", () => options.onRemove(item.domain, remove));
      row.append(text, remove);
      list.append(row);
    }
    list.scrollTop = scroll;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = {renderDomainList};
  else root.SuperDomainList = {renderDomainList};
})(globalThis);
