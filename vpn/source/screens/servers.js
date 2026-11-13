/* SPDX-License-Identifier: GPL-3.0-only */
import {flag, filterServers, escapeHtml as e} from "../model";
import {asyncStateMarkup} from "../../../ui/async-state.js";
export function createServerViews({model, t, country, button, openCountries}) {
  function countryFlag(code) {
    const src = flag(code);
    return src
      ? `<img class="vpn-flag" src="${e(src)}" alt="" width="24" height="18" loading="lazy">`
      : "";
  }
  function serverRows(servers, key) {
    const limit = model.limits[key] || 50;
    return (
      servers
        .slice(0, limit)
        .map((server) => {
          const label = server.name + (server.city ? " · " + server.city : "");
          const unavailable = !server.available || !server.allowed;
          return `<ui-button type="button" class="vpn-server" data-action="connect" data-server="${e(server.id)}" ${model.busy || unavailable ? "disabled" : ""} aria-label="${e(t("connect") + " " + label)}"><span><strong>${e(server.name)}</strong><small>${e(server.city || country(server.country))}${server.secureCore ? " · Secure Core" : ""}</small></span><span class="vpn-server-meta">${e(!server.allowed ? t("paid") : !server.available ? t("maintenance") : Number.isFinite(server.load) ? `${Math.round(server.load)}% ${t("load")}` : t("connect"))}</span></ui-button>`;
        })
        .join("") +
      (servers.length > limit
        ? button(t("more"), "more", `data-list="${e(key)}"`)
        : "")
    );
  }
  function listMarkup(servers, list) {
    const groups = new Map();
    for (const server of servers) {
      const code = server.country || "";
      if (!groups.has(code)) groups.set(code, []);
      groups.get(code).push(server);
    }
    if (!groups.size) return `<p class="vpn-empty">${e(t("empty"))}</p>`;
    return `<div class="vpn-countries">${[...groups]
      .map(([code, items]) => {
        const key = list + ":" + code;
        const open = openCountries.has(key);
        return `<details class="vpn-country-group" data-country-group="${e(key)}" ${open ? "open" : ""}><summary>${countryFlag(code)}<span>${e(country(code))}</span><span class="vpn-count ui-count">${items.length}</span></summary>${open ? `<div class="vpn-country-servers">${serverRows(items, key)}</div>` : ""}</details>`;
      })
      .join("")}</div>`;
  }
  const serversStatus = () => asyncStateMarkup({
    kind: model.serversLoading ? "loading" : model.serversError ? "error" : "",
    text: model.serversLoading ? t("loadingServers") : model.serversError,
    retry: model.serversError ? t("retry") : "", action: "refresh", disabled: model.busy,
  });
  function serverMarkup() {
    const servers = filterServers(
      model.snapshot.servers || [],
      model.query,
      model.filter,
      model.locale,
    );
    return `<section><div class="vpn-section-heading"><h2>${e(t("servers"))} <span class="vpn-count ui-count">${servers.length}</span></h2>${button(t("refresh"), "refresh")}</div><ui-field class="vpn-field vpn-search ui-search ui-focus-within"><span class="vpn-sr-only">${e(t("search"))}</span><ui-control type="search" data-field="search" placeholder="${e(t("search"))}" value="${e(model.query)}" class="ui-control" /></ui-field><ui-field class="vpn-field"><span class="vpn-sr-only">${e(t("servers"))}</span><ui-control as="select" data-field="server-filter" class="ui-control">${["available", "free", "all", "secureCore"].map((filter) => `<option value="${filter}" ${model.filter === filter ? "selected" : ""}>${e(t(filter))}</option>`).join("")}</ui-control></ui-field>${serversStatus() || listMarkup(servers, "servers")}</section>`;
  }
  return {listMarkup, serversStatus, serverMarkup};
}
