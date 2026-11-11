"use strict";
(() => {
  const assets = {
    sync: ["sync/embedded.js", "sync/js/options.js"],
    vpn: ["vpn/js/browser-polyfill.min.js", "vpn/interface.js"]
  };
  const panels = new Map();
  const firstPaint = new Promise(resolve => {
    // Chromium shows the native popup only after its first document load.
    window.addEventListener("load", () => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, {once:true});
  });
  let styles;

  function appendAsset(element, path) {
    return new Promise((resolve, reject) => {
      element.addEventListener("load", resolve, {once:true});
      element.addEventListener("error", () => reject(new Error(path)), {once:true});
      document.head.append(element);
    });
  }

  function loadStyles() {
    if (!styles) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "popup-panels.css";
      styles = appendAsset(link, link.href);
    }
    return styles;
  }

  function prepare(tab) {
    if (!Object.hasOwn(assets, tab)) return Promise.resolve();
    if (!panels.has(tab)) {
      const status = document.getElementById(tab + "PanelStatus");
      const loaded = firstPaint.then(async () => {
        await loadStyles();
        for (const path of assets[tab]) {
          const script = document.createElement("script");
          script.src = path;
          await appendAsset(script, path);
        }
        status.hidden = true;
      }).catch(error => {
        status.textContent = SuperI18n.text("Não foi possível carregar este painel. Feche o popup e tente novamente.");
        console.error(error);
      });
      panels.set(tab, loaded);
    }
    return panels.get(tab);
  }

  document.addEventListener("super-extension:panel-selected", event => {
    const tab = event.detail;
    if (tab === "vpn") {
      prepare(tab).then(() => document.getElementById("vpnPanel").dispatchEvent(new Event("super-vpn:show")));
    } else {
      prepare(tab);
    }
  });
  firstPaint.then(async () => {
    await prepare(document.body.dataset.activeTab);
    prepare("sync");
    prepare("vpn");
  });
})();
