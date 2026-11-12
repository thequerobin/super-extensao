import { renderUi } from "../../ui/render.cjs";
/* SPDX-License-Identifier: GPL-3.0-only */
import { messages } from "./messages";
import {
  pages,
  restorePage,
  countryName,
  flag,
  filterServers,
  normalizeDomain,
  domainRules,
  escapeHtml as e,
} from "./model";

export async function mountVpn(root, engine, preferences) {
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
    confirmSignOut: false,
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
    /^Vpn(Traffic(Blocked|Guard)|NetworkPrediction)/.test(error?.message || "");
  const country = (code) => countryName(code, model.locale);
  const status = () =>
    model.connectionUncertain
      ? "unconfirmed"
      : ["connected", "connecting"].includes(model.state.state)
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
  const serversStatus = () =>
    model.serversLoading
      ? `<p class="vpn-empty" role="status">${e(t("loadingServers"))}</p>`
      : model.serversError
        ? `<div class="vpn-empty ui-notice ui-notice-error" role="alert"><p>${e(model.serversError)}</p>${button(t("retry"), "refresh")}</div>`
        : "";
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
    return `<ui-card as="section" class="vpn-card ui-card vpn-status-card" data-status="${status()}"><span class="vpn-status-dot" aria-hidden="true"></span><p class="vpn-status" role="status">${e(t(status()))}</p><h2>${e(active() ? server?.name || t("connecting") : t("fastest"))}</h2><p>${e(active() ? [server?.exitCity, country(server?.exitCountry)].filter(Boolean).join(" · ") : t("fastestHelp"))}</p>${status() === "connected" && server?.exitIp ? `<p class="vpn-ip">${e(t("exitIp"))}: <strong>${e(server.exitIp)}</strong></p>` : ""}<ui-actions class="vpn-action-row">${active() ? button(t(status() === "connecting" ? "cancel" : "disconnect"), "disconnect", "", "vpn-primary") : button(t("connect"), "fastest", "", "vpn-primary")}${model.connectionUncertain ? button(t("retry"), "refresh") : ""}${button(t("choose"), "servers")}</ui-actions></ui-card>
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
  function serverMarkup() {
    const servers = filterServers(
      model.snapshot.servers || [],
      model.query,
      model.filter,
      model.locale,
    );
    return `<section><div class="vpn-section-heading"><h2>${e(t("servers"))} <span class="vpn-count ui-count">${servers.length}</span></h2>${button(t("refresh"), "refresh")}</div><ui-field class="vpn-field vpn-search ui-search ui-focus-within"><span class="vpn-sr-only">${e(t("search"))}</span><ui-control type="search" data-field="search" placeholder="${e(t("search"))}" value="${e(model.query)}" class="ui-control" /></ui-field><ui-field class="vpn-field"><span class="vpn-sr-only">${e(t("servers"))}</span><ui-control as="select" data-field="server-filter" class="ui-control">${["available", "free", "all", "secureCore"].map((filter) => `<option value="${filter}" ${model.filter === filter ? "selected" : ""}>${e(t(filter))}</option>`).join("")}</ui-control></ui-field>${serversStatus() || listMarkup(servers, "servers")}</section>`;
  }
  function featuresMarkup() {
    const features = model.snapshot.features || {};
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
        return `<ui-toggle class="vpn-toggle"><span><strong>${e(t(key))}</strong><small>${e(!config.controllable ? (key === "secureCore" && model.snapshot.account?.tier === 0 ? t("paid") : t("managed")) : t(key + "Help"))}</small></span><input type="checkbox" role="switch" data-feature="${key}" ${config.enabled ? "checked" : ""} ${model.busy || !config.controllable ? "disabled" : ""} class="ui-switch"></ui-toggle>`;
      })
      .join("");
    const config = model.draft;
    const rules = domainRules(config, config.mode);
    const disabled = model.busy || !model.snapshot.splitControllable;
    return `<ui-card as="section" class="vpn-card ui-card vpn-toggles"><h2>${e(t("features"))}</h2>${toggles}</ui-card><ui-card as="section" class="vpn-card ui-card"><h2>${e(t("split"))}</h2><p class="vpn-note">${e(t("splitHelp"))}</p><form data-split><fieldset ${disabled ? "disabled" : ""}><ui-toggle class="vpn-toggle"><span>${e(t("enableSplit"))}</span><input type="checkbox" role="switch" data-field="split-enabled" ${config.enabled ? "checked" : ""} class="ui-switch"></ui-toggle><ui-field class="vpn-field"><ui-control as="select" data-field="split-mode" aria-label="${e(t("split"))}" class="ui-control"><option value="exclude" ${config.mode === "exclude" ? "selected" : ""}>${e(t("exclude"))}</option><option value="include" ${config.mode === "include" ? "selected" : ""}>${e(t("include"))}</option></ui-control></ui-field><ui-field class="vpn-field">${e(t("domain"))}<ui-actions class="vpn-domain-row"><ui-control type="text" data-field="domain" value="${e(model.domain)}" placeholder="example.com" autocomplete="off" spellcheck="false" class="ui-control" /><ui-button type="button" class="vpn-button ui-button" data-action="add-domain">${e(t("add"))}</ui-button></ui-actions></ui-field><ui-check class="vpn-check"><input type="checkbox" data-field="subdomains" ${model.subdomains ? "checked" : ""}> ${e(t("subdomains"))}</ui-check><ul class="vpn-domains">${rules.map((rule) => `<li><span>${e(rule.domain)}${rule.withSubDomains ? `<small>${e(t("subdomains"))}</small>` : ""}</span><ui-button type="button" class="vpn-button ui-button" data-action="remove-domain" data-domain="${e(rule.domain)}" aria-label="${e(t("remove") + " " + rule.domain)}">${e(t("remove"))}</ui-button></li>`).join("")}</ul>${!rules.length ? `<p class="vpn-note">${e(t("noDomains"))}</p>` : ""}${config.mode === "include" && config.enabled && !rules.length ? `<p class="vpn-notice ui-notice ui-notice-warning">${e(t("includeEmpty"))}</p>` : ""}<ui-actions class="vpn-save-row"><span role="status" class="ui-inline-status" data-pending="${model.dirty}">${e(model.saved ? t("saved") : model.dirty ? t("unsaved") : "")}</span><ui-button type="submit" class="vpn-button vpn-primary ui-button ui-button-primary" ${!model.dirty ? "disabled" : ""}>${e(t("save"))}</ui-button></ui-actions></fieldset></form>${!model.snapshot.splitControllable ? `<p class="vpn-note">${e(t("managed"))}</p>` : ""}</ui-card>`;
  }
  function accountMarkup() {
    const account = model.snapshot.account || {};
    return `<ui-card as="section" class="vpn-card ui-card"><p class="vpn-eyebrow">PROTON</p><h2>${e(account.name || t("account"))}</h2><p class="vpn-note">${e(t("plan"))}: ${e(account.plan || t("loadingAccount"))}</p>${document.getElementById("language") ? "" : `<ui-field class="vpn-field">${e(t("language"))}<ui-control as="select" data-field="locale" class="ui-control"><option value="pt-BR" ${model.locale === "pt-BR" ? "selected" : ""}>Português do Brasil</option><option value="en" ${model.locale === "en" ? "selected" : ""}>English</option></ui-control></ui-field>`}<div class="vpn-account-links"><a href="https://account.proton.me/vpn/dashboard" target="_blank" rel="noopener noreferrer">${e(t("manage"))} <span class="ui-icon ui-icon-external" aria-hidden="true"></span></a><a href="https://protonvpn.com/support/browser-extensions" target="_blank" rel="noopener noreferrer">${e(t("help"))} <span class="ui-icon ui-icon-external" aria-hidden="true"></span></a></div></ui-card><ui-card as="section" class="vpn-card ui-card"><h2>${e(t("signOut"))}</h2><p class="vpn-note">${e(t("signOutHelp"))}</p>${model.confirmSignOut ? `<div class="vpn-signout-confirm" role="alertdialog" aria-labelledby="vpnSignoutTitle"><p id="vpnSignoutTitle">${e(t("confirmSignOut"))}</p><ui-actions class="vpn-action-row">${button(t("keepAccount"), "cancel-signout")}${button(t("signOut"), "signout", "", "vpn-danger")}</ui-actions></div>` : button(t("signOut"), "confirm-signout", "", "vpn-danger")}</ui-card>`;
  }
  function navigationMarkup() {
    if (!model.snapshot.signedIn) return "";
    return `<nav class="${hostNavigation ? "sub-nav ui-submenu" : "vpn-navigation"}" aria-label="VPN">${pages.map((page) => `<ui-button type="button" data-action="navigate" data-page="${page}" class="${hostNavigation ? "tab " : ""}${model.page === page ? "active" : ""}" ${model.page === page ? 'aria-current="page"' : ""}>${e(t(page))}</ui-button>`).join("")}</nav>`;
  }
  function render() {
    if (!hydrated || disposed) return;
    if (disposed) return;
    const oldScroll = root.scrollTop;
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
      !window.confirm(t("confirmLeave"))
    )
      return;
    if (model.dirty && page !== "features") restoreRules();
    initialScroll = undefined;
    model.page = page;
    model.confirmSignOut = false;
    root.scrollTop = 0;
    render();
    await saveView();
  }
  function addDomain() {
    try {
      const domain = normalizeDomain(model.domain);
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
  const click = (event) => {
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
    if (action === "add-domain") {
      addDomain();
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
    if (action === "confirm-signout" || action === "cancel-signout") {
      model.confirmSignOut = action === "confirm-signout";
      render();
      return;
    }
    if (action === "refresh") {
      void refresh();
      return;
    }
    if (
      action === "disconnect" &&
      model.networkBlocked &&
      !window.confirm(t("confirmRelease"))
    )
      return;
    void run(async () => {
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
          !["connected", "connecting"].includes(model.state.state)
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
      if (action === "signout") {
        await engine.signOut();
        model.snapshot = { signedIn: false };
        model.state = { state: "disconnected" };
        model.dirty = false;
        model.confirmSignOut = false;
        stopChecking();
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
  const keydown = (event) => {
    if (event.key === "Enter" && event.target.dataset.field === "domain") {
      event.preventDefault();
      addDomain();
    }
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
      ["connected", "connecting", "disconnected", "logged-out"].includes(
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
  root.addEventListener("keydown", keydown);
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
    root.removeEventListener("keydown", keydown);
    root.removeEventListener("scroll", scroll);
    root.removeEventListener("super-vpn:show", show);
  };
  window.addEventListener("unload", dispose, { once: true });
  return { refresh, navigate, dispose };
}
