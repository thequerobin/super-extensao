/* SPDX-License-Identifier: GPL-3.0-only */
export const pages = ["connection", "servers", "features", "account"];
export function restorePage(value) {
  return pages.includes(value)
    ? value
    : {
        world: "connection",
        "split-tunneling": "features",
        settings: "account",
        help: "account",
      }[value] || "connection";
}
export function countryName(code, locale) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) || code;
  } catch {
    return code || "";
  }
}
export function flag(code) {
  return /^[A-Z]{2}$/.test(code || "")
    ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)))
    : "";
}
export function filterServers(
  servers,
  query = "",
  filter = "available",
  locale = "pt-BR",
) {
  const search = query.trim().toLocaleLowerCase(locale);
  return servers
    .filter((server) => {
      if (filter === "free" && (server.tier !== 0 || server.secureCore))
        return false;
      if (filter === "available" && !server.allowed) return false;
      if (filter === "secureCore" && !server.secureCore) return false;
      return [
        server.name,
        server.city,
        server.country,
        countryName(server.country, locale),
      ]
        .join(" ")
        .toLocaleLowerCase(locale)
        .includes(search);
    })
    .slice()
    .sort(
      (a, b) =>
        countryName(a.country, locale).localeCompare(
          countryName(b.country, locale),
          locale,
        ) ||
        Number(b.available) - Number(a.available) ||
        (a.load ?? 100) - (b.load ?? 100) ||
        a.name.localeCompare(b.name, locale, { numeric: true }),
    );
}
export function normalizeDomain(value) {
  const text = value.trim();
  if (!text || /[\s*]/.test(text)) throw new Error("invalidDomain");
  const url = new URL(text.includes("://") ? text : "https://" + text);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    !url.hostname ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  )
    throw new Error("invalidDomain");
  return url.hostname.toLowerCase().replace(/\.$/, "");
}
export function domainRules(config, mode) {
  return (config.value || []).filter(
    (item) => (item.mode || "exclude") === mode,
  );
}
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
