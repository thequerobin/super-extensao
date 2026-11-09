/* Super Extensão integration, 2026-11-09. The dashboard is Tabliss 2.6.0;
   upstream configuration controls and import/export remain intact. */
(function () {
  "use strict";
  const preference = window.matchMedia("(prefers-color-scheme: dark)");
  let theme = "dark";
  function applyTheme() {
    document.documentElement.dataset.superTheme = theme === "system" ? (preference.matches ? "dark" : "light") : theme;
  }
  chrome.storage.local.get({theme:"dark"}).then(data => {theme=data.theme;applyTheme();}).catch(applyTheme);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.theme) {theme=changes.theme.newValue || "dark";applyTheme();}
  });
  preference.addEventListener("change",applyTheme);
  applyTheme();
  const button = document.getElementById("super-settings");
  button.addEventListener("click", async () => {
    try { await chrome.runtime.openOptionsPage(); }
    catch { window.open(chrome.runtime.getURL("popup.html"),"_blank","noopener"); }
  });
})();
