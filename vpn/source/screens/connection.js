/* SPDX-License-Identifier: GPL-3.0-only */
import {filterServers, escapeHtml as e} from "../model";
export function createConnectionView({model, t, status, active, country, button, serversStatus, listMarkup}) {
  function connectionMarkup() {
    const server = model.state.server;
    const free = filterServers(
      model.snapshot.servers || [],
      "",
      "free",
      model.locale,
    );
    const recent = (
      model.snapshot.features?.recents?.enabled
        ? model.snapshot.recents || []
        : []
    ).slice(0, 5);
    return `<ui-card as="section" class="vpn-card ui-card vpn-status-card" data-status="${status()}"><span class="vpn-status-dot" aria-hidden="true"></span><p class="vpn-status" role="status">${e(t(status()))}</p><h2>${e(active() ? server?.name || t("connecting") : t("fastest"))}</h2><p>${e(active() ? [server?.exitCity, country(server?.exitCountry)].filter(Boolean).join(" · ") : t("fastestHelp"))}</p>${status() === "connected" && server?.exitIp ? `<p class="vpn-ip">${e(t("exitIp"))}: <strong>${e(server.exitIp)}</strong></p>` : ""}<ui-actions class="vpn-action-row">${active() ? button(t(status() === "connecting" ? "cancel" : "disconnect"), "disconnect", "", "vpn-primary") : button(t("connect"), "fastest", "", "vpn-primary")}${status() === "blocked" ? button(t("retry"), "retry-connection") : model.connectionUncertain ? button(t("retry"), "refresh") : ""}${status() === "connected" ? button(t("connectFastest"), "fastest") : ""}${button(t("choose"), "servers")}</ui-actions></ui-card>
  ${!active() ? `<div class="vpn-quick">${button(t("random"), "random")}</div>` : ""}
  ${!active() ? serversStatus() : ""}
  ${!model.serversLoading && !model.serversError && free.length ? `<details class="vpn-card ui-card vpn-free" data-free><summary>${e(t("free"))} <span class="vpn-count ui-count">${free.length}</span></summary>${listMarkup(free, "free")}</details>` : ""}
  ${
    recent.length
      ? `<ui-card as="section" class="vpn-card ui-card"><h2>${e(t("recent"))}</h2><ui-actions class="vpn-recents">${recent
          .map((choice, index) => {
            const server = (model.snapshot.servers || []).find(
              (s) => String(s.id) === String(choice.logicalId),
            );
            return button(
              server?.name || country(choice.exitCountry) || t("fastest"),
              "recent",
              `data-index="${index}"`,
            );
          })
          .join("")}</ui-actions></ui-card>`
      : ""
  }`;
  }
  return connectionMarkup;
}
