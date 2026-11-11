"use strict";
(() => {
  const { catalogs, literals } = __SUPER_I18N_DATA__;
  const listeners = new Set();
  let locale = "pt-BR",
    resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const reverse = new Map(Object.entries(literals));
  for (const [literal, key] of Object.entries(literals))
    reverse.set(catalogs.en[key]?.message || literal, key);
  function t(key, values = {}) {
    const entry = catalogs[locale]?.[key] || catalogs.en[key];
    if (!entry) return key;
    let message = entry.message;
    if (Array.isArray(values) || typeof values === "string") {
      const args = Array.isArray(values) ? values : [values];
      message = message
        .replace(/\$([A-Za-z_][A-Za-z0-9_]*)\$/g, (_, name) => {
          const placeholder =
            entry.placeholders?.[name] ||
            entry.placeholders?.[name.toLowerCase()] ||
            entry.placeholders?.[name.toUpperCase()];
          return (placeholder?.content || "").replace(/\$(\d+)/g, (_, index) =>
            String(args[Number(index) - 1] ?? ""),
          );
        })
        .replace(/\$(\d+)/g, (_, index) =>
          String(args[Number(index) - 1] ?? ""),
        );
    } else
      message = message.replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : match,
      );
    return message;
  }
  function text(literal) {
    const prefix = literal.startsWith("Error: ") ? "Error: " : "";
    const value = prefix ? literal.slice(7) : literal;
    return prefix + (reverse.has(value) ? t(reverse.get(value)) : value);
  }
  function apply(root = globalThis.document) {
    if (!root) return;
    for (const element of root.querySelectorAll("[data-i18n]"))
      element.textContent = t(element.dataset.i18n);
    for (const attribute of ["title", "aria-label", "placeholder"])
      for (const element of root.querySelectorAll(
        "[data-i18n-" + attribute + "]",
      ))
        element.setAttribute(
          attribute,
          t(element.getAttribute("data-i18n-" + attribute)),
        );
    if (root === globalThis.document) root.documentElement.lang = locale;
  }
  function update(value) {
    locale = globalThis.SuperPreferences.locale.normalize(value);
    apply();
    resolveReady(locale);
    for (const listener of listeners) listener(locale);
  }
  globalThis.SuperI18n = Object.freeze({
    t,
    text,
    apply,
    ready,
    get locale() {
      return locale;
    },
    watch(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  // Small isolated worker tests intentionally omit browser sync/events.
  if (globalThis.chrome?.storage?.sync && globalThis.chrome?.storage?.onChanged)
    globalThis.SuperPreferences.locale.watch(update);
  else {
    apply();
    resolveReady(locale);
  }
})();
