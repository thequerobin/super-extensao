import type { CredentialCache } from "../../../../../../vpn/engine/credentials";
import type { Credentials } from "./Credentials";
export type CredentialsCacheItem = CredentialCache<Credentials>;
const key = "superVpn:credentials";
function call<T>(operation: (done: (value: T) => void) => void): Promise<T> {
	return new Promise((resolve, reject) => {
		try {
			operation((value) => {
				if (chrome.runtime.lastError)
					reject(new Error("VpnCredentialStorageFailed"));
				else resolve(value);
			});
		} catch {
			reject(new Error("VpnCredentialStorageFailed"));
		}
	});
}
// IO adapter only. The own manager validates ownership, expiry and ordered writes.
export const storedCredentials = {
	async load(): Promise<CredentialsCacheItem> {
		const data = await call<Record<string, CredentialsCacheItem>>((done) =>
			chrome.storage.local.get(key, done),
		);
		if (data[key]) return data[key];
		if (chrome.storage.session) {
			const legacy = await call<Record<string, CredentialsCacheItem>>((done) =>
				chrome.storage.session.get(key, done),
			);
			return legacy[key] || {};
		}
		return {};
	},
	set: (value: CredentialsCacheItem) =>
		call<void>((done) => chrome.storage.local.set({ [key]: value }, done)),
	async remove(): Promise<void> {
		await call<void>((done) => chrome.storage.local.remove(key, done));
		if (chrome.storage.session)
			await call<void>((done) => chrome.storage.session.remove(key, done));
	},
};
