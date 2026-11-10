"use strict";
// Keep internal router navigation inside the embedded panel. Standalone views
// retain their existing behavior; external help and provider sign-in stay external.
const embeddedSyncPanel = document.getElementById("syncPanel");
if (embeddedSyncPanel || window.self !== window.top) {
  const root = embeddedSyncPanel || document.documentElement;
  root.dataset.embedded = "true";
  root.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname) {
      link.target = "_self";
    }
  }, true);
}
