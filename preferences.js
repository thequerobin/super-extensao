"use strict";

(() => {
  function preference(area, key, defaultValue, normalize) {
    const get = async () => {
      const values = await chrome.storage[area].get({[key]: defaultValue});
      return normalize(values[key]);
    };

    function watch(callback) {
      let active = true;
      let receivedChange = false;
      let previous;
      function publish(value) {
        if (!active || value === previous) return;
        previous = value;
        callback(value);
      }
      function onChanged(changes, changedArea) {
        if (changedArea !== area || !changes[key]) return;
        receivedChange = true;
        publish(normalize(changes[key].newValue));
      }
      chrome.storage.onChanged.addListener(onChanged);
      get().catch(error => {
        console.error("Could not read preference", key, error);
        return defaultValue;
      }).then(value => {
        if (!receivedChange) publish(value);
      });
      return () => {
        active = false;
        chrome.storage.onChanged.removeListener(onChanged);
      };
    }

    return Object.freeze({
      defaultValue, get, normalize, watch,
      set: value => chrome.storage[area].set({[key]: normalize(value)})
    });
  }

  const theme = preference("local", "theme", "dark", value => {
    if (value === "light") return "light";
    if (value === "system" || value === "auto") return "system";
    return "dark";
  });
  const locale = preference("sync", "tabliss/config/locale", "pt-BR", value =>
    typeof value === "string" && /^en(?:[-_]|$)/i.test(value) ? "en" : "pt-BR"
  );

  function watchTheme(callback) {
    const system = matchMedia("(prefers-color-scheme: dark)");
    let selected = theme.defaultValue;
    const apply = () => callback(selected, selected === "system" ? (system.matches ? "dark" : "light") : selected);
    const unsubscribe = theme.watch(value => {
      selected = value;
      apply();
    });
    const onSystemChange = () => {
      if (selected === "system") apply();
    };
    system.addEventListener("change", onSystemChange);
    return () => {
      unsubscribe();
      system.removeEventListener("change", onSystemChange);
    };
  }

  globalThis.SuperPreferences = Object.freeze({theme, locale, watchTheme});
})();
