import { fetchJson } from "../../api";
import { getPmUserTTL } from "../../intervals";
import type { PmUser, PmUserResult } from "./PmUser";
import { isPmUserResult } from "./PmUser";
import { storedPmUser } from "./storedPmUser";
import { createAccountProfile } from "./accountProfile";
import type { AccountCache } from "../../../../../../vpn/engine/account";

export const loadPmCachedUser = async (): Promise<AccountCache<PmUser>> => {
	const cache = await storedPmUser.load();
	return {
		...cache,
		user: isPmUserResult(cache.user) ? cache.user.User : cache.user,
	};
};
export const pmAccountProfile = createAccountProfile<PmUser>({
	read: loadPmCachedUser,
	write: (cache) => storedPmUser.set(cache),
	remove: () => storedPmUser.remove(),
	async request() {
		const result = await fetchJson<PmUser | PmUserResult | undefined>(
			"core/v4/users?Locale=1",
		);
		return isPmUserResult(result) ? result.User : result;
	},
	freshness: async () => getPmUserTTL(),
	forceAllowed: () => false,
});
export const fetchPmUser = (): Promise<PmUser | undefined> =>
	pmAccountProfile.fetch();
export const loadPmUser = (): Promise<PmUser | undefined> =>
	pmAccountProfile.load();
export const getPmUser = (
	tryReAuthentication = false,
): Promise<PmUser | undefined> => pmAccountProfile.get(tryReAuthentication);
