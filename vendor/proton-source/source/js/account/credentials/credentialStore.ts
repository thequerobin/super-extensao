import { CredentialManager } from "../../../../../../vpn/engine/credentials";
import type { Credentials } from "./Credentials";
import { storedCredentials } from "./storedCredentials";
import { attachCredentialInvalidation } from "./credentialInvalidation";
import { sessionStore } from "../sessionStore";
import { readSession } from "../readSession";
import { getAccessToken } from "../getAccessToken";
import { refreshToken } from "../refreshToken";
import { fetchWithUserInfo } from "../fetchWithUserInfo";
import { tokenDuration } from "../../config";
import {
	isNetworkError,
	isInvalidTokenError,
	isUnauthorizedError,
	needsLogout,
	isForbiddenError,
	isRetriableError,
} from "../../api";
import {
	getCurrentState,
	disconnect,
	logOut,
	reportNetworkFailure,
	requestConnectionRecovery,
} from "../../state";
import { initAuthInterceptor } from "../../vpn/initAuthInterceptor";
import { getErrorAsString } from "../../tools/getErrorMessage";
import { handleError } from "../../tools/sentry";
import { triggerPromise } from "../../tools/triggerPromise";

export const credentialManager: CredentialManager<Credentials> =
	new CredentialManager<Credentials>({
		async session() {
			const generation = sessionStore.capture();
			const session = await readSession();
			return session.uid && generation === sessionStore.capture()
				? { uid: session.uid, generation }
				: undefined;
		},
		current: (session) => session.generation === sessionStore.capture(),
		read: () => storedCredentials.load(),
		write: (cache) => storedCredentials.set(cache),
		remove: () => storedCredentials.remove(),
		authorize: () => getAccessToken(),
		refreshSession: () => refreshToken(),
		request: (attempt, signal) =>
			fetchWithUserInfo<Credentials>(
				"vpn/v1/browser/token?Duration=" + tokenDuration,
				{ signal, headers: { "x-pm-try-number": String(attempt) } },
			),
		classify(error) {
			if (isNetworkError(error)) return "network";
			if (isInvalidTokenError(error)) return "invalid-token";
			if (needsLogout(error)) return "logout";
			if (isUnauthorizedError(error)) return "unauthorized";
			if (isForbiddenError(error)) return "forbidden";
			if (isRetriableError(error)) return "retryable";
			return "fatal";
		},
		async updated(credentials, current) {
			await chrome.webRequest?.handlerBehaviorChanged?.();
			if (!current()) return;
			const state = getCurrentState();
			if (state.proxyEnabled) {
				initAuthInterceptor();
				if (current()) state.setCredentials?.(credentials);
			}
		},
		failed(error, kind) {
			if (kind === "network") reportNetworkFailure(error);
			else if (kind === "retryable")
				reportNetworkFailure(error, {
					Code: -1,
					httpStatus: -1,
					Warning: true,
					Error: getErrorAsString(error),
				});
			else {
				if (kind === "logout") logOut(true);
				else disconnect(error as Error);
				handleError(error);
			}
			if (
				(kind === "network" || kind === "retryable") &&
				!credentialManager.last()?.credentials
			)
				triggerPromise(requestConnectionRecovery());
		},
	});
// Account mutations in another extension page must invalidate in-flight work too.
chrome.storage.onChanged.addListener((changes, area) => {
	const change = changes["superVpn:session"];
	if (
		area === "local" &&
		change &&
		(change.oldValue as { uid?: string } | undefined)?.uid !==
			(change.newValue as { uid?: string } | undefined)?.uid
	)
		credentialManager.cancel();
});

attachCredentialInvalidation(() => credentialManager.clear());
