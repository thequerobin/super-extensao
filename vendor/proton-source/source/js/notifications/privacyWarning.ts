import { getLocale } from "../tools/locale";
let last = 0;
/** Privacy failures bypass the optional connection-notification preference. */
export function emitPrivacyWarning(): void {
	if (Date.now() - last < 10000) return;
	last = Date.now();
	const pt = getLocale().toLowerCase().startsWith("pt");
	try {
		chrome.notifications.create(
			"super-vpn-privacy",
			{
				type: "basic",
				title: "Super Extensão — VPN",
				iconUrl: "/vpn/img/icon-512.png",
				priority: 2,
				requireInteraction: true,
				message: pt
					? "VPN interrompida. Bloqueio de segurança acionado; verifique a proteção antes de navegar. Clique neste aviso para reconectar ou liberar a rede sem VPN."
					: "VPN interrupted. Safety blocking triggered; verify protection before browsing. Click this warning to reconnect or explicitly release networking without VPN.",
			},
			() => {
				void chrome.runtime.lastError;
			},
		);
	} catch {
		/* The persistent panel warning remains visible if OS notifications fail. */
	}
}
