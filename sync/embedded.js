"use strict";
// Keep internal router navigation inside the embedded panel. Standalone views
// retain their existing behavior; external help and provider sign-in stay external.
if (window.self !== window.top) {
  document.documentElement.dataset.embedded = "true";
  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname) {
      link.target = "_self";
    }
  }, true);
}
