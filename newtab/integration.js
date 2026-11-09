/* Super Extensão integration, 2026-11-09. The dashboard is Tabliss 2.6.0;
   upstream configuration controls and import/export remain intact. */
(function () {
  "use strict";
  const button = document.getElementById("super-settings");
  button.addEventListener("click", async () => {
    try { await chrome.runtime.openOptionsPage(); }
    catch { window.open(chrome.runtime.getURL("popup.html"),"_blank","noopener"); }
  });
})();
