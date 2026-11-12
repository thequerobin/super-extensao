import { SessionStore } from "../../../../../vpn/engine/session";
import type { Session } from "./Session";
import { removeCredentials } from "./credentials/removeCredentials";

import { nativeStorage } from "../tools/nativeStorage";
const key = "superVpn:session";
// The existing session already lives in local storage. Do not copy tokens to new keys.
export const sessionStore = new SessionStore<Session>({
	async read() {
		const data = await nativeStorage.get<Record<string, Session>>("local", key);
		return data[key] || {};
	},
	write: (value) => nativeStorage.set("local", { [key]: value }),
	remove: () => nativeStorage.remove("local", key),
	changed: () => removeCredentials(),
});
