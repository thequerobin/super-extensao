"use strict";

(() => {
  const stopTheme = SuperPreferences.bindTheme(document.documentElement);
  window.addEventListener("unload", stopTheme, { once: true });
})();
