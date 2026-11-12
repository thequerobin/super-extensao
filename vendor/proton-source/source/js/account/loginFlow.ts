import { nativeStorage } from "../tools/nativeStorage";
import { LoginFlow, type PendingLogin } from "../../../../../vpn/engine/login";
import type { Session } from "./Session";
import { sessionStore } from "./sessionStore";
import { fetchJson } from "../api";
import { getFullAppVersion } from "../config";
const key = "superVpn:loginFlow";
// Only the worker instantiates this adapter. No tokens or selectors are stored here.
export const loginFlow = new LoginFlow<Session>({
	async read() {
		return (
			await nativeStorage.get<Record<string, PendingLogin>>("local", key)
		)[key];
	},
	write: (value) => nativeStorage.set("local", { [key]: value }),
	remove: () => nativeStorage.remove("local", key),

	nonce() {
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	},
	authorize(state, options) {
		const params = new URLSearchParams({
			app: "proton-vpn-browser-extension",
			appVersion: getFullAppVersion(),
			state,
			t: options.action === "signup" ? "2" : "1",
			plan: "vpn2024",
		});
		if (options.partnerId) params.set("partnerId", options.partnerId);
		if (options.independent) params.set("independent", "1");
		return `${options.host}/authorize?${params}`;
	},
	async exchange(selector) {
		const data = await fetchJson<{
			UID: string;
			AccessToken: string;
			RefreshToken: string;
		}>(`auth/sessions/forks/${encodeURIComponent(selector)}`);
		return {
			uid: data.UID,
			accessToken: data.AccessToken,
			refreshToken: data.RefreshToken,
		};
	},
	capture: () => sessionStore.capture(),
	save: (session, generation) =>
		sessionStore.saveIfCurrent(session, generation),
});
