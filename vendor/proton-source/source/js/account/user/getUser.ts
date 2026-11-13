import { observe, VpnIOError } from "../../../../../../vpn/engine/io";
import { hasPaidAccess } from "../../../../../../vpn/engine/account";
import type { User, UserResult } from "./User";
import { isUserResult } from "./User";
import { fetchJson } from "../../api";
import { getElapsedMillisecondsSinceLastActivity } from "../../tools/activity";
import { getRuntime } from "../../tools/getRuntime";
import { catchPromise } from "../../tools/triggerPromise";
import { storedUser } from "./storedUser";
import { loadCachedUser } from "./loadCachedUser";
import { getIdleThreshold, getUserTTL } from "../../intervals";
import { BackgroundData } from "../../messaging/MessageType";
import { createAccountProfile } from "./accountProfile";

export const accountProfile = createAccountProfile<User>({
	read: loadCachedUser,
	write: (cache) => storedUser.set(cache),
	remove: () => storedUser.remove(),
	async request() {
		const result = await fetchJson<User | UserResult | undefined>("vpn/v2");
		return isUserResult(result) ? result.User : result;
	},
	async freshness() {
		const idle = await getElapsedMillisecondsSinceLastActivity();
		return getUserTTL() * (idle > getIdleThreshold() ? 4 : 1);
	},
	forceAllowed: (user) => !hasPaidAccess(user),
});
export const loadUser = (forceRefresh = false): Promise<User | undefined> =>
	accountProfile.load(forceRefresh);
export const getUser = async (
	tryReAuthentication = false,
	fresh = false,
): Promise<User | undefined> => {
	const user = await accountProfile.get(tryReAuthentication, fresh);
	catchPromise(
		observe(
			getRuntime().sendMessage({ event: BackgroundData.USER, user }),
			5000,
			new VpnIOError("VpnWorkerTimedOut"),
		),
	);
	return user;
};
export const getFreshUser = (): Promise<User | undefined> =>
	getUser(true, true);
