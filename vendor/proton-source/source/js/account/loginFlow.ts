import { LoginFlow, type PendingLogin } from "../../../../../vpn/engine/login";
import type { Session } from "./Session";
import { sessionStore } from "./sessionStore";
import { fetchJson } from "../api";
import { getFullAppVersion } from "../config";
const key = "superVpn:loginFlow";
function call<T>(run: (done: (value: T) => void) => void): Promise<T> {
	return new Promise((resolve, reject) => {
		try {
			run((value) => {
				if (chrome.runtime.lastError)
					reject(new Error("VpnSignInStorageFailed"));
				else resolve(value);
			});
		} catch {
			reject(new Error("VpnSignInStorageFailed"));
		}
	});
}
// Only the worker instantiates this adapter. No tokens or selectors are stored here.
export const loginFlow = new LoginFlow<Session>({
	async read() {
		return (
			await call<Record<string, PendingLogin>>((done) =>
				chrome.storage.local.get(key, done),
			)
		)[key];
	},
	write: (value) =>
		call<void>((done) => chrome.storage.local.set({ [key]: value }, done)),
	remove: () => call<void>((done) => chrome.storage.local.remove(key, done)),
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
