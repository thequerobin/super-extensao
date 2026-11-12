import type { CredentialCache } from "../../../../../../vpn/engine/credentials";
import type { Credentials } from "./Credentials";
import { nativeStorage } from "../../tools/nativeStorage";
export type CredentialsCacheItem = CredentialCache<Credentials>;
const key = "superVpn:credentials";
export const storedCredentials = {
	async load(): Promise<CredentialsCacheItem> {
		const data = await nativeStorage.get<Record<string, CredentialsCacheItem>>(
			"local",
			key,
		);
		if (data[key]) return data[key];
		if (chrome.storage.session)
			return (
				(
					await nativeStorage.get<Record<string, CredentialsCacheItem>>(
						"session",
						key,
					)
				)[key] || {}
			);
		return {};
	},
	set: (value: CredentialsCacheItem) =>
		nativeStorage.set("local", { [key]: value }),
	async remove(): Promise<void> {
		await Promise.all([
			nativeStorage.remove("local", key),
			...(chrome.storage.session ? [nativeStorage.remove("session", key)] : []),
		]);
	},
};
