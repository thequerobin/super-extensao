import {SessionStore} from '../../../../../vpn/engine/session';
import type {Session} from './Session';
import {removeCredentials} from './credentials/removeCredentials';

const key = 'superVpn:session';
function call<T>(operation: (done: (value: T) => void) => void): Promise<T> {
	return new Promise((resolve, reject) => {
		try {
			operation((value) => {
				if (chrome.runtime.lastError)
					reject(new Error('VpnSessionStorageFailed'));
				else resolve(value);
			});
		} catch {
			reject(new Error('VpnSessionStorageFailed'));
		}
	});
}
// The existing session already lives in local storage. Do not copy tokens to new keys.
export const sessionStore = new SessionStore<Session>({
	async read() {
		const data = await call<Record<string, Session>>((done) =>
			chrome.storage.local.get(key, done),
		);
		return data[key] || {};
	},
	write: (value) =>
		call<void>((done) => chrome.storage.local.set({[key]: value}, done)),
	remove: () => call<void>((done) => chrome.storage.local.remove(key, done)),
	changed: () => removeCredentials(),
});
