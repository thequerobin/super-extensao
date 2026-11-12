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
  function prefetchVpn() {
    if (!globalThis.SuperVpnBootstrap) {
      // Live document-local state only. Listen before requesting so a logout or
      // disconnect during asset loading cannot leave a stale connected preview.
      let latest, revision = 0;
      chrome.runtime.onMessage.addListener((message, sender) => {
        if (message?.channel !== "super-vpn" || message.type !== "changeState" ||
            message.respondTo !== "none" || sender?.id && sender.id !== chrome.runtime.id ||
            !["connected", "connecting", "disconnected", "logged-out"].includes(message.data?.state)) return;
        revision++;
        latest = {signedIn:message.data.state !== "logged-out", state:message.data};
      });
      const started = revision;
      const pending = chrome.runtime.sendMessage({channel:"super-vpn", type:"connectionState"})
        .then(response => {
          if (revision === started && response?.received && response.result?.state) latest = response.result;
        }).catch(() => {});
      globalThis.SuperVpnBootstrap = () => pending.then(() => latest);
    }
  }

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
      if (tab === "vpn") prefetchVpn();
      // The selected VPN panel can hydrate before first paint. Other modules
      // retain lazy loading so opening Cleanup/Sync is not held by VPN requests.
      const eager = tab === "vpn" && document.body.dataset.activeTab === "vpn";
      const loaded = (eager ? Promise.resolve() : firstPaint).then(async () => {
        await loadStyles();
        for (const path of assets[tab]) {
          const script = document.createElement("script");
          script.src = path;
          await appendAsset(script, path);
        }
        if (tab === "vpn") await globalThis.SuperVpnReady;
        status.hidden = true;
      }).catch(error => {
        status.textContent = SuperI18n.text("Não foi possível carregar este painel. Feche o popup e tente novamente.");
        console.error(error);
      });
      panels.set(tab, loaded);
    }
    return panels.get(tab);
  }

  chrome.storage.local.get({popupView:null}).then(({popupView}) => {
    if (popupView?.tab === "vpn") prefetchVpn();
  }).catch(() => {});

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
