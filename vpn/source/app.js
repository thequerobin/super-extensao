import {normalizeBookmarkDomain} from "./bookmarks";
import {confirmAction, cancelConfirmation} from "../../ui/confirmation.js";
import {createServerViews} from "./screens/servers";
import {createConnectionView} from "./screens/connection";
import {createFeaturesView} from "./screens/features";
import {createAccountView} from "./screens/account";
import { renderUi } from "../../ui/render.cjs";
/* SPDX-License-Identifier: GPL-3.0-only */
import { createBookmarkImporter } from "../../ui/bookmark-importer.js";
import { bindDomainEditor } from "../../ui/domain-editor.js";
import { renderDomainList } from "../../ui/domain-list.js";
import { messages } from "./messages";
import {
  pages,
  restorePage,
  countryName,
  normalizeDomain,
  domainRules,
  escapeHtml as e,
} from "./model";

export async function mountVpn(root, engine, preferences, browser = globalThis.chrome) {
  const hostNavigation = document.getElementById("vpnSubmenu");
  const model = {
    page: "connection",
    locale: await preferences.locale.get(),
    snapshot: { signedIn: false },
    loading: true,
    networkBlocked: false,
    connectionUncertain: false,
    serversLoading: false,
    serversError: "",
    busy: false,
    error: "",
    state: { state: "disconnected" },
    query: "",
    filter: "available",
    limits: {},
    draft: { enabled: false, mode: "exclude", value: [] },
    dirty: false,
    domain: "",
    subdomains: true,
    saved: false,
  };
  let hydrated = false;
  let disposed = false,
    started = false,
    loadingPromise,
    stateRevision = 0,
    connectionTimer,
    scrollTimer,
    attemptTime = 0,
    initialScroll;
  const openCountries = new Set();
  let disposeDomainEditor;
  let bookmarkImporter;
  const t = (key) => messages[key]?.[model.locale] || messages[key]?.en || key;
  const button = (label, action, extra = "", kind = "") =>
    `<ui-button type="button" class="vpn-button ui-button ${kind} ${kind === "vpn-primary" ? "ui-button-primary" : kind === "vpn-danger" ? "ui-button-danger" : ""}" data-action="${action}" ${model.busy || ((model.serversLoading || model.serversError) && ["fastest", "random", "connect", "recent"].includes(action)) ? "disabled" : ""} ${extra}>${e(label)}</ui-button>`;
  const errorText = (error) =>
    messages[error?.message]
      ? t(error.message)
      : error?.Error || error?.message || t("requestFailed");
  const uncertainError = (error) =>
    /^Vpn(Storage|Worker|OperationPending)/.test(error?.message || "");
  const blockedError = (error) =>
    /^Vpn(Traffic(Blocked|Guard)|ConnectionTimedOut|NetworkPrediction)/.test(error?.message || "");
  const country = (code) => countryName(code, model.locale);
  const status = () =>
    model.connectionUncertain
      ? "unconfirmed"
      : ["connected", "connecting", "blocked"].includes(model.state.state)
        ? model.state.state
        : "disconnected";
  const active = () => status() !== "disconnected";
  const saveView = () =>
    engine
      .saveView({ page: model.page, scrollTop: root.scrollTop })
      .catch(() => {});
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const restoreRules = () => {
    model.draft = {
      enabled: true,
      mode: "exclude",
      value: [],
      ...clone(model.snapshot.split || {}),
    };
    model.dirty = false;
    model.saved = false;
  };
  const createImporter = () => createBookmarkImporter({
    browser, locale: () => model.locale, scope: () => model.draft.mode,
    disabled: () => disposed || model.busy || !model.snapshot.signedIn || !model.snapshot.splitControllable || model.snapshot.featuresReady === false,
    normalize: normalizeBookmarkDomain,
    existing: mode => domainRules(model.draft, mode).map(rule => rule.domain),
    import(domains, mode) {
      model.draft.value.push(...domains.map(domain => ({domain, withSubDomains: model.subdomains, mode})));
      model.dirty = true; model.saved = false; model.error = ""; render();
    },
  });
  bookmarkImporter = createImporter();
  const resetImporter = () => {bookmarkImporter.dispose(); bookmarkImporter = createImporter();};
  const {serverMarkup, serversStatus, listMarkup} = createServerViews({model, t, country, button, openCountries});
  const connectionMarkup = createConnectionView({model, t, status, active, country, button, serversStatus, listMarkup});
  const featuresMarkup = createFeaturesView({model, t});
  const accountMarkup = createAccountView({model, t, button, hasLanguage: () => Boolean(document.getElementById("language"))});
  function navigationMarkup() {
    if (!model.snapshot.signedIn) return "";
    return `<nav class="${hostNavigation ? "sub-nav ui-submenu" : "vpn-navigation"}" aria-label="VPN">${pages.map((page) => `<ui-button type="button" data-action="navigate" data-page="${page}" class="${hostNavigation ? "tab " : ""}${model.page === page ? "active" : ""}" ${model.page === page ? 'aria-current="page"' : ""}>${e(t(page))}</ui-button>`).join("")}</nav>`;
  }
  function render() {
    if (!hydrated || disposed) return;
    if (disposed) return;
    const oldScroll = root.scrollTop;
    const domainListScroll = root.querySelector("[data-domain-list]")?.scrollTop || 0;
    const focusedNavigation = hostNavigation?.contains(document.activeElement)
      ? document.activeElement.dataset.page
      : null;
    const focused = root.contains(document.activeElement)
      ? document.activeElement
      : null;
    const focusKey = focused?.getAttribute("data-field");
    const selection =
      focused && "selectionStart" in focused
        ? [focused.selectionStart, focused.selectionEnd]
        : null;
    const focusGroup =
      focused?.tagName === "SUMMARY"
        ? focused.parentElement.dataset.countryGroup
        : null;
    const freeOpen = Boolean(root.querySelector("[data-free]")?.open);
    root.lang = model.locale;
    root.innerHTML = renderUi(
      `<div class="vpn-app">${hostNavigation ? "" : navigationMarkup()}<p class="vpn-error ui-notice ui-notice-error" role="alert" ${model.error ? "" : "hidden"}>${e(model.error)}</p>${model.loading ? `<p class="vpn-empty" role="status">${e(t("loading"))}</p>` : !model.snapshot.signedIn ? `<ui-card as="section" class="vpn-card ui-card vpn-welcome"><div class="vpn-shield" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/></svg></div><h2>${e(t("loginTitle"))}</h2><p>${e(t("loginHelp"))}</p>${button(t("login"), "login", "", "vpn-primary")}${button(t("reloadLogin"), "refresh")}</ui-card>` : { connection: connectionMarkup, servers: serverMarkup, features: featuresMarkup, account: accountMarkup }[model.page]()}${model.networkBlocked ? `<ui-card as="section" class="vpn-card ui-card"><p>${e(t("blockedHelp"))}</p><a class="vpn-button ui-button" href="vpn-blocked.html" target="_blank" rel="noopener">${e(t("protectionDetails"))}</a>${button(t("releaseNetwork"), "disconnect", "", "vpn-danger")}</ui-card>` : ""}<footer class="vpn-provider-note ui-footer-note">${e(t("provider"))}</footer></div>`,
    );
    const domainList = root.querySelector("[data-domain-list]");
    if (domainList) {
      renderDomainList(domainList, domainRules(model.draft, model.draft.mode).map(rule => ({
        domain: rule.domain, detail: rule.withSubDomains ? t("subdomains") : "",
      })), {
        removeLabel: domain => t("remove") + " " + domain,
        action: "remove-domain",
        disabled: model.busy || !model.snapshot.splitControllable || model.snapshot.featuresReady === false,
      });
      domainList.scrollTop = domainListScroll;
    }
    const editor = root.querySelector("[data-domain-editor]");
    disposeDomainEditor?.();
    if (editor) {
      editor.querySelector("[data-domain-empty]").hidden = Boolean(domainRules(model.draft, model.draft.mode).length);
      disposeDomainEditor = bindDomainEditor(editor, {
        normalize: normalizeDomain,
        onAdd: domain => addDomain(domain),
        onError() {model.error = t("invalidDomain"); render();},
      });
    }
    const importerHost = root.querySelector("[data-bookmark-importer]");
    if (importerHost) { bookmarkImporter.attach(importerHost); void bookmarkImporter.refresh().catch(() => {}); }
    if (hostNavigation) {
      hostNavigation.innerHTML = renderUi(navigationMarkup());
      if (focusedNavigation)
        hostNavigation
          .querySelector(`[data-page="${focusedNavigation}"]`)
          ?.focus({ preventScroll: true });
    }
    const freeDetails = root.querySelector("[data-free]");
    if (freeDetails) freeDetails.open = freeOpen;
    root.scrollTop = oldScroll;
    if (focusGroup) {
      [...root.querySelectorAll("[data-country-group]")]
        .find((node) => node.dataset.countryGroup === focusGroup)
        ?.querySelector("summary")
        .focus({ preventScroll: true });
    }
    if (focusKey) {
      const element = [...root.querySelectorAll("[data-field]")].find(
        (input) => input.dataset.field === focusKey,
      );
      element?.focus({ preventScroll: true });
      if (selection && element?.type === "search")
        element.setSelectionRange(...selection);
    }
  }
  function stopChecking() {
    clearInterval(connectionTimer);
    connectionTimer = undefined;
  }
  function startChecking() {
    if (connectionTimer) return;
    attemptTime = Date.now();
    const check = () =>
      engine.checkConnection(attemptTime).catch((error) => {
        model.connectionUncertain ||= uncertainError(error);
        model.error = errorText(error);
        render();
      });
    connectionTimer = setInterval(check, 3000);
    void check();
  }
  async function refresh() {
    if (loadingPromise) return loadingPromise;
    const revision = stateRevision;
    model.loading = !model.snapshot.signedIn;
    model.serversLoading = true;
    model.serversError = "";
    render();
    loadingPromise = (async () => {
      try {
        const snapshot = await engine.load((partial) => {
          if (
            disposed ||
            (stateRevision !== revision && model.state.state === "logged-out")
          )
            return;
          model.snapshot = { ...model.snapshot, ...partial };
          model.loading = false;
          if (stateRevision === revision && partial.state) {
            model.state = partial.state;
            model.connectionUncertain = uncertainError(partial.state.error);
            model.networkBlocked = blockedError(partial.state.error);
            model.error = partial.state.error
              ? errorText(partial.state.error)
              : "";
          }
          if (!model.dirty) restoreRules();
          render();
        });
        if (disposed) return;
        if (stateRevision !== revision && model.state.state === "logged-out") {
          model.snapshot = { signedIn: false };
          restoreRules();
          return;
        }
        model.snapshot = snapshot;
        if (stateRevision === revision) {
          model.state = snapshot.state || { state: "disconnected" };
          model.connectionUncertain = uncertainError(snapshot.state?.error);
          model.networkBlocked = blockedError(snapshot.state?.error);
          model.error = snapshot.state?.error
            ? errorText(snapshot.state.error)
            : "";
        }
        if (!model.dirty) restoreRules();
        if (model.state.state === "connecting") startChecking();
      } catch (error) {
        model.connectionUncertain ||= uncertainError(error);
        if (model.snapshot.signedIn) model.serversError = errorText(error);
        else model.error = errorText(error);
      } finally {
        model.serversLoading = false;
        model.loading = false;
        loadingPromise = undefined;
        render();
        if (initialScroll !== undefined) {
          root.scrollTop = initialScroll;
          initialScroll = undefined;
        }
      }
    })();
    return loadingPromise;
  }
  async function run(action) {
    if (model.busy) return;
    model.busy = true;
    model.error = "";
    render();
    try {
      await action();
    } catch (error) {
      model.connectionUncertain ||= uncertainError(error);
      model.networkBlocked ||= blockedError(error);
      model.error = errorText(error);
    } finally {
      model.busy = false;
      render();
    }
  }
  async function navigate(page) {
    if (!pages.includes(page)) return;
    if (
      model.dirty &&
      page !== "features" &&
      !await confirmAction(root.ownerDocument, t("confirmLeave"), {locale: model.locale})
    )
      return;
    if (disposed) return;
    if (model.dirty && page !== "features") restoreRules();
    initialScroll = undefined;
    model.page = page;
    root.scrollTop = 0;
    render();
    await saveView();
  }
  function addDomain(domain = normalizeDomain(model.domain)) {
    try {
      const rules = model.draft.value;
      const existing = rules.find(
        (rule) =>
          rule.domain === domain &&
          (rule.mode || "exclude") === model.draft.mode,
      );
      if (existing) existing.withSubDomains = model.subdomains;
      else
        rules.push({
          domain,
          withSubDomains: model.subdomains,
          mode: model.draft.mode,
        });
      model.domain = "";
      model.dirty = true;
      model.saved = false;
      model.error = "";
      render();
    } catch {
      model.error = t("invalidDomain");
      render();
    }
  }
  const click = async (event) => {
    const button = event.target.closest("[data-action]");
    if (
      !button ||
      (!root.contains(button) && !hostNavigation?.contains(button)) ||
      button.disabled
    )
      return;
    const action = button.dataset.action;
    if (action === "navigate") {
      void navigate(button.dataset.page);
      return;
    }
    if (action === "servers") {
      void navigate("servers");
      return;
    }
    if (action === "more") {
      model.limits[button.dataset.list] =
        (model.limits[button.dataset.list] || 50) + 50;
      render();
      return;
    }
    if (action === "remove-domain") {
      model.draft.value = model.draft.value.filter(
        (rule) =>
          !(
            rule.domain === button.dataset.domain &&
            (rule.mode || "exclude") === model.draft.mode
          ),
      );
      model.dirty = true;
      model.saved = false;
      render();
      return;
    }
    if (action === "confirm-signout") {
      const revision = stateRevision;
      if (model.busy || !await confirmAction(root.ownerDocument, t("confirmSignOut"), {
        locale: model.locale, confirmLabel: t("signOut"), cancelLabel: t("keepAccount"),
        confirmAction: "signout", cancelAction: "cancel-signout",
      }) || disposed || revision !== stateRevision) return;
      void run(async () => {
        await engine.signOut();
        if (disposed) return;
        model.snapshot = {signedIn: false}; resetImporter(); model.state = {state: "disconnected"}; model.dirty = false; stopChecking();
      });
      return;
    }
    if (action === "refresh") {
      void refresh();
      return;
    }
    if (action === "disconnect" && model.networkBlocked) {
      const revision = stateRevision;
      if (!await confirmAction(root.ownerDocument, t("confirmRelease"), {locale: model.locale}) || revision !== stateRevision) return;
    }
    if (disposed) return;
    void run(async () => {
      if (action === "retry-connection") {
        await engine.retryConnection();
      }
      if (action === "login") {
        await engine.signIn();
      }
      if (["fastest", "random", "connect", "recent"].includes(action)) {
        // Pending text is a local action state; connection status comes from worker broadcasts.
        const revision = stateRevision;
        if (action === "recent")
          await engine.connectRecent(
            model.snapshot.recents[Number(button.dataset.index)],
          );
        else
          await engine.connect(
            button.dataset.server,
            action === "random" ? "random" : "fastest",
          );
        if (
          revision === stateRevision &&
          !["connected", "connecting", "blocked"].includes(model.state.state)
        ) {
          model.state = { state: "connecting" };
          startChecking();
        }
      }
      if (action === "disconnect") {
        await engine.disconnect();
        model.networkBlocked = false;
        model.error = "";
      }
    });
  };
  const input = (event) => {
    const field = event.target.dataset.field;
    if (field === "search") {
      model.query = event.target.value;
      model.limits.servers = 50;
      render();
    }
    if (field === "domain") model.domain = event.target.value;
  };
  const change = (event) => {
    const field = event.target.dataset.field;
    if (field === "server-filter") {
      model.filter = event.target.value;
      model.limits.servers = 50;
      render();
    }
    if (field === "locale") {
      void run(() => preferences.locale.set(event.target.value));
    }
    if (field === "split-mode") {
      model.draft.mode = event.target.value;
      model.dirty = true;
      model.saved = false;
      render();
    }
    if (field === "split-enabled") {
      model.draft.enabled = event.target.checked;
      model.dirty = true;
      model.saved = false;
      render();
    }
    if (field === "subdomains") model.subdomains = event.target.checked;
    const feature = event.target.dataset.feature;
    if (feature)
      void run(async () => {
        model.snapshot.features = await engine.setToggle(
          feature,
          event.target.checked,
        );
      });
  };
  const submit = (event) => {
    if (!event.target.matches("[data-split]")) return;
    event.preventDefault();
    if (
      model.draft.enabled &&
      model.draft.mode === "include" &&
      !domainRules(model.draft, "include").length
    ) {
      model.error = t("includeEmpty");
      render();
      return;
    }
    void run(async () => {
      const config = clone(model.draft);
      await engine.saveSplit(config);
      model.snapshot.split = config;
      model.dirty = false;
      model.saved = true;
    });
  };
  const scroll = () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      void saveView();
    }, 150);
  };
  const unsubscribe = engine.subscribe((type, data) => {
    if (disposed) return;
    if (type === "servers" && Array.isArray(data)) {
      model.snapshot.servers = data;
      render();
      return;
    }
    if (
      type === "changeState" &&
      ["connected", "connecting", "blocked", "disconnected", "logged-out"].includes(
        data?.state,
      )
    ) {
      stateRevision++;
      model.state = { state: data.state, server: data.server };
      model.connectionUncertain = uncertainError(data.error);
      model.networkBlocked = blockedError(data.error);
      model.error = data.error ? errorText(data.error) : "";
      if (data.state === "connecting") startChecking();
      else stopChecking();
      if (data.state === "logged-out") {
        model.snapshot = { signedIn: false };
        resetImporter();
        model.dirty = false;
      } else if (!model.snapshot.signedIn && started) {
        void refresh();
      }
      render();
    }
  });
  const stopLocale = preferences.locale.watch((locale) => {
    model.locale = locale;
    render();
  });
  const stopTheme = preferences.bindTheme(root, (_theme, resolved) => {
    if (root.parentElement === document.body)
      document.documentElement.dataset.superTheme = resolved;
  });
  const toggleCountry = (event) => {
    const details = event.target;
    const key = details.dataset?.countryGroup;
    if (
      !key ||
      !root.contains(details) ||
      openCountries.has(key) === details.open
    )
      return;
    if (details.open) openCountries.add(key);
    else openCountries.delete(key);
    render();
  };
  root.addEventListener("toggle", toggleCountry, true);
  root.addEventListener("click", click);
  hostNavigation?.addEventListener("click", click);
  root.addEventListener("input", input);
  root.addEventListener("change", change);
  root.addEventListener("submit", submit);
  root.addEventListener("scroll", scroll, { passive: true });
  const show = () => {
    if (!started) {
      started = true;
      void refresh();
    }
  };
  root.addEventListener("super-vpn:show", show);
  const initialRevision = stateRevision;
  const [saved, connection] = await Promise.all([
    engine.readView().catch(() => undefined),
    engine.readConnection?.().catch(() => undefined),
  ]);
  if (!disposed) {
    model.page = restorePage(saved?.page);
    initialScroll = Math.max(0, Number(saved?.scrollTop) || 0);
    if (connection && initialRevision === stateRevision) {
      model.snapshot = { ...model.snapshot, ...connection };
      model.state = connection.state;
      model.loading = false;
      model.networkBlocked = blockedError(connection.state?.error);
      model.connectionUncertain = uncertainError(connection.state?.error);
      if (connection.state?.error)
        model.error = errorText(connection.state.error);
    } else if (stateRevision !== initialRevision) {
      model.snapshot.signedIn = model.state.state !== "logged-out";
      model.loading = false;
    }
    hydrated = true;
    render();
    if (model.state.state === "connecting") startChecking();
  }
  if (!root.closest("[hidden]")) show();
  const dispose = () => {
    disposed = true;
    bookmarkImporter.dispose(); disposeDomainEditor?.(); cancelConfirmation(root.ownerDocument);
    stopChecking();
    clearTimeout(scrollTimer);
    unsubscribe();
    stopLocale();
    stopTheme();
    root.removeEventListener("toggle", toggleCountry, true);
    root.removeEventListener("click", click);
    hostNavigation?.removeEventListener("click", click);
    hostNavigation?.replaceChildren();
    root.removeEventListener("input", input);
    root.removeEventListener("change", change);
    root.removeEventListener("submit", submit);
    root.removeEventListener("scroll", scroll);
    root.removeEventListener("super-vpn:show", show);
  };
  window.addEventListener("unload", dispose, { once: true });
  return { refresh, navigate, dispose };
}
