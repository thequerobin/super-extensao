import { messages } from "./messages";
const words = {
  brand: ["Super Extensão · VPN", "Super Extensão · VPN"],
  checking: ["Verificando a proteção…", "Checking protection…"],
  blocked: ["Navegação pausada pela VPN", "Browsing paused by VPN"],
  blockedHelp: [
    "A conexão protegida ainda não foi confirmada. Novas navegações e pedidos dos sites foram interrompidos pelo bloqueio de segurança, inclusive nos sites excluídos da VPN.",
    "The protected connection is not confirmed. Safety blocking has stopped new navigations and site requests, including sites excluded from the VPN.",
  ],
  connected: ["Conexão VPN confirmada", "VPN connection confirmed"],
  connectedHelp: [
    "A conexão foi verificada e o bloqueio de emergência foi retirado. As regras de sites da VPN voltaram a valer. Você pode abrir o site novamente.",
    "The connection was verified and emergency blocking was lifted. VPN site rules apply again. You can open the site again.",
  ],
  released: ["Navegação liberada sem VPN", "Browsing released without VPN"],
  releasedHelp: [
    "O bloqueio de segurança não está ativo e a VPN está desconectada. Sua conexão normal será usada ao navegar.",
    "Safety blocking is inactive and the VPN is disconnected. Browsing will use your normal connection.",
  ],
  unconfirmed: ["Estado não confirmado", "State unconfirmed"],
  unconfirmedHelp: [
    "Não foi possível confirmar a proteção. Esta página não liberou a rede. Consulte novamente ou abra a extensão.",
    "Protection could not be confirmed. This page has not released networking. Check again or open the extension.",
  ],
  retry: ["Tentar reconectar", "Try reconnecting"],
  retrying: [
    "Tentando recuperar a conexão. O bloqueio permanece até a confirmação.",
    "Trying to recover the connection. Blocking remains until confirmation.",
  ],
  waiting: [
    "A conexão ainda não foi confirmada. O bloqueio permanece; o motor continuará as tentativas de recuperação.",
    "The connection is still unconfirmed. Blocking remains; the engine will continue recovery attempts.",
  ],
  unavailable: [
    "Abra a extensão para entrar na conta ou escolher um servidor. Nenhuma conexão antiga será restaurada por esta página.",
    "Open the extension to sign in or choose a server. This page will not restore an old connection.",
  ],
  refresh: ["Consultar estado", "Check state"],
  open: ["Abrir extensão", "Open extension"],
  release: ["Liberar navegação sem VPN", "Release browsing without VPN"],
  confirmTitle: [
    "Continuar sem a proteção da VPN?",
    "Continue without VPN protection?",
  ],
  confirmHelp: [
    "Isso desconecta a VPN e remove o bloqueio de segurança de todos os sites. O tráfego usará sua conexão normal e poderá expor seu IP.",
    "This disconnects the VPN and removes safety blocking for all sites. Traffic will use your normal connection and may expose your IP.",
  ],
  confirm: ["Confirmar liberação sem VPN", "Confirm release without VPN"],
  cancel: ["Manter bloqueio", "Keep blocking"],
  note: [
    "Após recuperar ou liberar a rede, abra o endereço desejado novamente. Esta página não repete navegações, envios de formulário ou pagamentos.",
    "After recovery or release, open the desired address again. This page does not replay navigations, form submissions or payments.",
  ],
  failed: [
    "A ação não foi confirmada. Consulte o estado antes de repetir.",
    "The action was not confirmed. Check state before repeating.",
  ],
};
export function mountProtection(
  root,
  request,
  preferences,
  timing = globalThis,
) {
  let locale = "pt-BR",
    snapshot,
    busy = false,
    checking = false,
    disposed = false,
    revision = 0,
    notice = "",
    error = "",
    confirm = false;
  const t = (key) => words[key]?.[locale === "en" ? 1 : 0] || key;
  const find = (id) => root.querySelector("#" + id);
  root.innerHTML =
    '<p class="brand" id="brand"></p><h1 id="title"></h1><p id="help"></p><p id="reason" class="muted"></p><p id="notice" role="status"></p><p id="error" class="error" role="alert"></p><div class="actions"><button type="button" class="ui-button ui-button-primary" id="retry"></button><button type="button" class="ui-button" id="refresh"></button><a class="ui-button" id="open" target="_blank" rel="noopener"></a></div><div class="actions"><button type="button" class="ui-button ui-button-danger" id="release"></button></div><section class="confirmation" id="confirmation" hidden><h2 id="confirmTitle"></h2><p id="confirmHelp"></p><div class="actions"><button type="button" class="ui-button ui-button-danger" id="confirm"></button><button type="button" class="ui-button" id="cancel"></button></div></section><p class="muted" id="note"></p>';
  find("open").href = chrome.runtime.getURL("popup.html") + "#vpn";
  function render() {
    if (disposed) return;
    const status = snapshot?.status || "unconfirmed";
    root.dataset.status = status;
    for (const id of [
      "brand",
      "retry",
      "refresh",
      "open",
      "release",
      "confirmTitle",
      "confirmHelp",
      "confirm",
      "cancel",
      "note",
    ])
      find(id).textContent = t(id);
    find("title").textContent = t(!snapshot && checking ? "checking" : status);
    find("help").textContent = t(status + "Help");
    const reason =
      snapshot?.status === "blocked" ? messages[snapshot.reason] : undefined;
    find("reason").textContent = reason ? reason[locale] || reason.en : "";
    find("notice").textContent = notice
      ? t(notice)
      : status === "blocked"
        ? t(snapshot.retryAvailable ? "waiting" : "unavailable")
        : "";
    find("error").textContent = error
      ? messages[error]?.[locale] || messages[error]?.en || t("failed")
      : "";
    find("retry").hidden = status !== "blocked" || !snapshot.retryAvailable;
    find("retry").disabled = busy || checking;
    find("refresh").disabled = busy || checking;
    find("release").hidden = status === "connected" || status === "released";
    find("release").disabled = busy || checking;
    find("confirmation").hidden = !confirm;
    find("confirm").disabled = busy;
    find("cancel").disabled = busy;
    root.setAttribute("aria-busy", String(busy || checking));
    root.ownerDocument.documentElement.lang = locale;
    root.ownerDocument.title = t("brand") + " — " + t(status);
  }
  function accept(value) {
    if (
      !value ||
      !["blocked", "connected", "released", "unconfirmed"].includes(
        value.status,
      ) ||
      typeof value.retryAvailable !== "boolean"
    )
      throw Error("VpnWorkerUnavailable");
    snapshot = value;
    if (value.status !== "blocked") notice = "";
    if (value.status === "connected" || value.status === "released")
      confirm = false;
  }
  async function refresh() {
    if (disposed || busy || checking) return;
    const current = revision;
    checking = true;
    render();
    try {
      const value = await request("protectionStatus");
      if (disposed || current !== revision) return;
      accept(value);
      error = "";
    } catch (failure) {
      if (!disposed && current === revision) {
        snapshot = undefined;
        error = failure?.message || "failed";
      }
    } finally {
      if (!disposed && current === revision) {
        checking = false;
        render();
      }
    }
  }
  async function act(type) {
    if (disposed || busy) return;
    // Invalidate any observer predating this explicit action.
    revision++;
    checking = false;
    busy = true;
    error = "";
    confirm = false;
    notice = type === "retryProtection" ? "retrying" : "";
    render();
    try {
      const result = await request(type);
      if (disposed) return;
      if (type === "retryProtection") {
        accept(result);
        notice = result.status === "blocked" ? "waiting" : "";
      } else {
        snapshot = undefined;
      }
    } catch (failure) {
      if (!disposed) {
        snapshot = undefined;
        error = failure?.message || "failed";
      }
    } finally {
      if (!disposed) {
        busy = false;
        render();
      }
    }
    // Releasing is only reported after independent worker/DNR confirmation.
    if (!disposed) await refresh();
  }
  find("retry").addEventListener("click", () => void act("retryProtection"));
  find("refresh").addEventListener("click", () => void refresh());
  find("release").addEventListener("click", () => {
    confirm = true;
    render();
    find("confirm").focus();
  });
  find("cancel").addEventListener("click", () => {
    confirm = false;
    render();
    find("release").focus();
  });
  find("confirm").addEventListener("click", () => {
    if (confirm) void act("disconnect");
  });
  const untheme =
    preferences?.bindTheme(root.ownerDocument.documentElement) || (() => {});
  const unlocale =
    preferences?.locale.watch((value) => {
      locale = value === "en" ? "en" : "pt-BR";
      render();
    }) || (() => {});
  const interval = timing.setInterval(() => void refresh(), 3000);
  render();
  void refresh();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    revision++;
    timing.clearInterval(interval);
    untheme();
    unlocale();
  };
  return { refresh, dispose };
}
