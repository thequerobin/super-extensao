import {
	HttpTransport,
	HttpError,
	type HttpCooldown,
} from "../../../../vpn/engine/http";
import type { Session } from "./account/Session";
import { sessionStore } from "./account/sessionStore";
import { readSession } from "./account/readSession";
import { refreshToken } from "./account/refreshToken";
import { getAuthHeaders } from "./account/getAuthHeaders";
import { getRegisteredLocale } from "./account/user/getRegisteredLocale";
import { getLocale } from "./tools/locale";
import { getBrowserSubType } from "./tools/getBrowserSubType";
import {
	baseAPIURL,
	getFullAppVersion,
	routes,
	incompatibleSoftware,
} from "./config";
import { c } from "./tools/translate";

interface RequestSession extends Session {
	generation?: number;
	identityRevision?: number;
}
const prefix = "superVpn:httpCooldown:";
let identityRevision = 0;
chrome.storage.onChanged?.addListener((changes, area) => {
	const change = changes["superVpn:session"];
	if (
		area === "local" &&
		change &&
		(change.oldValue as { uid?: string } | undefined)?.uid !==
			(change.newValue as { uid?: string } | undefined)?.uid
	)
		identityRevision++;
});
function storageCall<T>(
	operation: (done: (result: T) => void) => void,
): Promise<T> {
	return new Promise((resolve, reject) => {
		try {
			operation((value) => {
				if (chrome.runtime.lastError)
					reject(new HttpError("VpnHttpCooldownStorageFailed"));
				else resolve(value);
			});
		} catch {
			reject(new HttpError("VpnHttpCooldownStorageFailed"));
		}
	});
}
const cooldownArea = () => chrome.storage.session || chrome.storage.local;
export const httpClient: HttpTransport<RequestSession> =
	new HttpTransport<RequestSession>({
		baseUrl: baseAPIURL,
		fetch: (url, init) => fetch(url, init),
		async session() {
			const generation = sessionStore.capture(),
				revision = identityRevision;
			const value = await readSession();
			if (
				generation !== sessionStore.capture() ||
				revision !== identityRevision
			)
				throw new HttpError("VpnHttpSessionChanged");
			return { ...value, generation, identityRevision: revision };
		},
		current: (session) =>
			session.generation === sessionStore.capture() &&
			session.identityRevision === identityRevision,
		async refresh(session) {
			const value = await refreshToken(session);
			return { ...value, generation: sessionStore.capture(), identityRevision };
		},
		async headers(session) {
			const values: Record<string, string> = {
				"x-pm-appversion": getFullAppVersion(),
				"x-pm-browser-type": await getBrowserSubType(),
			};
			if (session.uid && session.accessToken)
				values["x-pm-locale"] = (await getRegisteredLocale()) || getLocale();
			return values;
		},
		authorization: (session) =>
			!session.expiresAt && session.uid && session.accessToken
				? getAuthHeaders(session.uid, session.accessToken)
				: {},
		routes: [...routes, "auth/sessions/forks/{selector}"],
		cooldown: {
			async get(route) {
				const key = prefix + encodeURIComponent(route);
				const data = await storageCall<Record<string, HttpCooldown>>((done) =>
					cooldownArea().get(key, done),
				);
				return data[key];
			},
			async set(route, value) {
				const key = prefix + encodeURIComponent(route),
					area = cooldownArea();
				const data = await storageCall<Record<string, HttpCooldown>>((done) =>
					area.get(key, done),
				);
				if ((data[key]?.until || 0) >= value.until) return;
				await storageCall<void>((done) => area.set({ [key]: value }, done));
			},
		},
		blocked(html) {
			const software = incompatibleSoftware.find((blocker) =>
				html.includes(blocker),
			);
			return software
				? new Error(
						c("Info")
							.t`VPN blocked by external software: ${software}.\n\nSome tools, like anti-viruses or proxies, can interfere with Proton VPN. You can try disabling it to confirm.`,
					)
				: new Error(
						c("Info")
							.t`VPN blocked by external software.\n\nSome tools, like anti-viruses or proxies, can interfere with Proton VPN. Disable them and retry.`,
					);
		},
	});
export const presentHttpError = (error: unknown): unknown => {
	if (error instanceof HttpError && error.code !== "VpnHttpRejected") {
		const text =
			error.code === "VpnHttpCancelled" ||
			error.code === "VpnHttpSessionChanged"
				? c("Error").t`Request cancelled`
				: c("Error").t`Service temporarily unavailable`;
		error.message = text;
		error.Error = text;
	}
	return error;
};
