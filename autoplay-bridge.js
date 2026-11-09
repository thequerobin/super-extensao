/* Only this isolated script reads extension settings. The page receives one
   boolean, never cookie exceptions, bookmarks, or other extension settings. */
(function () {
  "use strict";
  let generation = 0;
  let latest = {block:true};
  function emit() {
    document.dispatchEvent(new CustomEvent("super-extensao:autoplay-config", {detail:JSON.stringify(latest)}));
  }
  async function refresh() {
    const id = ++generation;
    try {
      const {autoplay} = await chrome.storage.local.get({autoplay:SuperTools.AUTOPLAY_DEFAULTS});
      if (id !== generation) return;
      let hostname = location.hostname;
      if (!hostname && document.referrer) {
        try { hostname = new URL(document.referrer).hostname; } catch { }
      }
      latest = {block:SuperTools.autoplayPolicy(hostname, autoplay).block};
      emit();
    } catch { /* Invalidated extension contexts leave existing page state alone. */ }
  }
  document.addEventListener("super-extensao:autoplay-ready", emit);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.autoplay) void refresh();
  });
  void refresh();
})();
