/* Shared bookmark import preview for cleanup and VPN. Labels are plain text. */
(function (root) {
  "use strict";
  function renderBookmarkPreview(card, {domains, fresh, skipped}, locale, ids = {}) {
    const english = locale === "en";
    const known = new Set(fresh);
    const count = domains.length - fresh.length;
    const doc = card.ownerDocument;
    const heading = doc.createElement("strong");
    const detail = doc.createElement("p");
    const list = doc.createElement("ul");
    heading.textContent = english
      ? `${fresh.length} new domain${fresh.length === 1 ? "" : "s"}`
      : `${fresh.length} novo${fresh.length === 1 ? " domínio" : "s domínios"}`;
    detail.textContent = english
      ? `${domains.length} unique in this folder · ${count} already listed · ${skipped} incompatible links skipped`
      : `${domains.length} únicos nesta pasta · ${count} já na lista · ${skipped} links incompatíveis ignorados`;
    for (const domain of domains) {
      const item = doc.createElement("li");
      item.textContent = domain + (known.has(domain) ? "" : english ? " (already listed)" : " (já na lista)");
      list.append(item);
    }
    if (ids.count) heading.id = ids.count;
    if (ids.detail) detail.id = ids.detail;
    if (ids.domains) list.id = ids.domains;
    card.classList.add("ui-bookmark-preview");
    card.setAttribute("role", "status");
    card.replaceChildren(heading, detail, list);
  }
  if (typeof module !== "undefined" && module.exports) module.exports = {renderBookmarkPreview};
  else root.SuperBookmarkPreview = {renderBookmarkPreview};
})(globalThis);
