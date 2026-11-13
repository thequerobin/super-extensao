/* Shared loading, failure, empty and retry presentation. No IO. */
(function (root) {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  function asyncStateMarkup({kind = "", text = "", detail = "", retry = "", action = "retry", disabled = false} = {}) {
    if (!kind) return "";
    return `<div class="ui-async-state ui-notice ${kind === "error" ? "ui-notice-error" : ""}" role="${kind === "error" ? "alert" : "status"}" data-state="${escape(kind)}"><p>${escape(text)}</p>${detail ? `<p>${escape(detail)}</p>` : ""}${retry ? `<button type="button" class="ui-button ui-button-secondary" data-action="${escape(action)}" ${disabled ? "disabled" : ""}>${escape(retry)}</button>` : ""}</div>`;
  }
  function renderAsyncState(host, state, onRetry) {
    host.innerHTML = asyncStateMarkup(state);
    if (onRetry) host.querySelector("button")?.addEventListener("click", event => {event.stopPropagation(); onRetry(event);});
  }
  const api = {asyncStateMarkup, renderAsyncState, escape};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SuperAsyncState = api;
})(globalThis);
