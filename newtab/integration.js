/* Super Extensão integration, 2026-11-09. The dashboard is Tabliss 2.6.0;
   upstream configuration controls and import/export remain intact. */
(function () {
  "use strict";
  const stopTheme = SuperPreferences.bindTheme(document.documentElement);
  window.addEventListener("unload", stopTheme, { once: true });
  const button = document.getElementById("super-settings");
  function applyLanguage() {
    button.title = /^en(?:-|$)/i.test(document.documentElement.lang)
      ? "Open cleanup, autoplay and tab settings"
      : "Abrir configurações de limpeza, reprodução automática e abas";
  }
  new MutationObserver(applyLanguage).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  applyLanguage();
  button.addEventListener("click", async () => {
    try { await chrome.runtime.openOptionsPage(); }
    catch { window.open(chrome.runtime.getURL("popup.html"),"_blank","noopener"); }
  });
})();
