/* SPDX-License-Identifier: GPL-3.0-only */
import {escapeHtml as e} from "../model";
export function createAccountView({model, t, button, hasLanguage}) {
  function accountMarkup() {
    const account = model.snapshot.account || {};
    return `<ui-card as="section" class="vpn-card ui-card"><p class="vpn-eyebrow">PROTON</p><h2>${e(account.name || t("account"))}</h2><p class="vpn-note">${e(t("plan"))}: ${e(account.plan || t("loadingAccount"))}</p>${hasLanguage() ? "" : `<ui-field class="vpn-field">${e(t("language"))}<ui-control as="select" data-field="locale" class="ui-control"><option value="pt-BR" ${model.locale === "pt-BR" ? "selected" : ""}>Português do Brasil</option><option value="en" ${model.locale === "en" ? "selected" : ""}>English</option></ui-control></ui-field>`}<div class="vpn-account-links"><a href="https://account.proton.me/vpn/dashboard" target="_blank" rel="noopener noreferrer">${e(t("manage"))} <span class="ui-icon ui-icon-external" aria-hidden="true"></span></a><a href="https://protonvpn.com/support/browser-extensions" target="_blank" rel="noopener noreferrer">${e(t("help"))} <span class="ui-icon ui-icon-external" aria-hidden="true"></span></a></div></ui-card><ui-card as="section" class="vpn-card ui-card"><h2>${e(t("signOut"))}</h2><p class="vpn-note">${e(t("signOutHelp"))}</p>${button(t("signOut"), "confirm-signout", "", "vpn-danger")}</ui-card>`;
  }
  return accountMarkup;
}
