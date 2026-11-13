import { AccountProfile } from "../../../../../../vpn/engine/account";
import type { AccountPorts } from "../../../../../../vpn/engine/account";
import { sessionStore } from "../sessionStore";
import { readSession } from "../readSession";
import { getAccessToken } from "../getAccessToken";
import { refreshToken } from "../refreshToken";
import { isUnauthorizedError } from "../../api";
import { getUserBlockingUpdateTTL } from "../../intervals";
import { checkNetwork } from "../../vpn/checkNetwork";
import { triggerPromise } from "../../tools/triggerPromise";
import { isLoggedIn, logIn } from "../../state";

/** Provider/browser IO only. Cache decisions and login guards live in the core. */
export function createAccountProfile<T>(
	ports: Pick<
		AccountPorts<T>,
		"read" | "write" | "remove" | "request" | "freshness" | "forceAllowed"
	>,
): AccountProfile<T> {
	return new AccountProfile<T>({
		...ports,
		async context() {
			const revision = sessionStore.capture();
			const session = await readSession();
			if (revision !== sessionStore.capture())
				throw new Error("VpnAccountChanged");
			return { owner: session.uid || "", revision };
		},
		access: () => getAccessToken(),
		refresh: () => refreshToken(),
		unauthorized: isUnauthorizedError,
		canRefresh: (error) => !isUnauthorizedError(error) || !error.authRetried,
		blockingTTL: getUserBlockingUpdateTTL,
		now: () => Date.now(),
		updated() {
			if (!isLoggedIn()) logIn();
		},
		backgroundError(error) {
			checkNetwork(error);
			triggerPromise(Promise.reject(error));
		},
	});
}
