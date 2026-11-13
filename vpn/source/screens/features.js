/* SPDX-License-Identifier: GPL-3.0-only */
import {domainRules, escapeHtml as e} from "../model";
import {domainEditorMarkup} from "../../../ui/domain-editor.js";
import {bookmarkImporterMarkup} from "../../../ui/bookmark-importer.js";
import {asyncStateMarkup} from "../../../ui/async-state.js";
export function createFeaturesView({model, t}) {
  function bookmarkMarkup() {
    return bookmarkImporterMarkup({locale: model.locale}) + `<p class="vpn-note">${e(t("bookmarkHelp"))} ${e(t(model.draft.mode === "exclude" ? "bookmarkExclude" : "bookmarkInclude"))}</p>`;
  }
  function featuresMarkup() {
    const features = model.snapshot.features || {};
    const pending = model.snapshot.featuresReady === false || !model.snapshot.features;
    const resourceStatus = asyncStateMarkup({
      kind: pending ? model.serversError ? "error" : "loading" : "",
      text: t(model.serversError ? "featuresLoadFailed" : "featuresLoading"), detail: pending ? model.serversError : "",
      retry: pending && model.serversError ? t("retry") : "", action: "refresh", disabled: model.busy,
    });
    const toggles = [
      "autoConnect",
      "preventWebrtcLeak",
      "notification",
      "secureCore",
      "recents",
    ]
      .filter((key) => features[key]?.available)
      .map((key) => {
        const config = features[key];
        return `<ui-toggle class="vpn-toggle"><span><strong>${e(t(key))}</strong><small>${e(pending ? t("featuresLoading") : !config.controllable ? (key === "secureCore" && model.snapshot.account?.tier === 0 ? t("paid") : t("managed")) : t(key + "Help"))}</small></span><input type="checkbox" role="switch" data-feature="${key}" ${config.enabled ? "checked" : ""} ${pending || model.busy || !config.controllable ? "disabled" : ""} class="ui-switch"></ui-toggle>`;
      })
      .join("");
    const config = model.draft;
    const rules = domainRules(config, config.mode);
    const disabled = pending || model.busy || !model.snapshot.splitControllable;
    return `${resourceStatus}<ui-card as="section" class="vpn-card ui-card vpn-toggles"><h2>${e(t("features"))}</h2>${toggles}</ui-card><ui-card as="section" class="vpn-card ui-card"><h2>${e(t("split"))}</h2><p class="vpn-note">${e(t("splitHelp"))}</p><form data-split><fieldset ${disabled ? "disabled" : ""}><ui-toggle class="vpn-toggle"><span>${e(t("enableSplit"))}</span><input type="checkbox" role="switch" data-field="split-enabled" ${config.enabled ? "checked" : ""} class="ui-switch"></ui-toggle><ui-field class="vpn-field"><ui-control as="select" data-field="split-mode" aria-label="${e(t("split"))}" class="ui-control"><option value="exclude" ${config.mode === "exclude" ? "selected" : ""}>${e(t("exclude"))}</option><option value="include" ${config.mode === "include" ? "selected" : ""}>${e(t("include"))}</option></ui-control></ui-field>${domainEditorMarkup({value: model.domain, subdomains: model.subdomains, count: rules.length, labels: {domain: t("domain"), add: t("add"), subdomains: t("subdomains"), empty: t("noDomains"), count: `${rules.length} ${t("domainsLabel")}`}})}${bookmarkMarkup()}${config.mode === "include" && config.enabled && !rules.length ? `<p class="vpn-notice ui-notice ui-notice-warning">${e(t("includeEmpty"))}</p>` : ""}<ui-actions class="vpn-save-row"><span role="status" class="ui-inline-status" data-pending="${model.dirty}">${e(model.saved ? t("saved") : model.dirty ? t("unsaved") : "")}</span><ui-button type="submit" class="vpn-button vpn-primary ui-button ui-button-primary" ${!model.dirty ? "disabled" : ""}>${e(t("save"))}</ui-button></ui-actions></fieldset></form>${!pending && !model.snapshot.splitControllable ? `<p class="vpn-note">${e(t("managed"))}</p>` : ""}</ui-card>`;
  }
  return featuresMarkup;
}
