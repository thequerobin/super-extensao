import { milliSeconds } from "../tools/milliSeconds";
import { requestMaxAge } from "../config";
import {
	getAuthCredentials,
	privacyFault,
	getCurrentStateIfDefined,
	isProxyKnownHost,
} from "../state";
import { isPending } from "../tools/proxyAuth";
import { getCredentials } from "../account/credentials/getConnectionCredentials";
import { chromiumProxy } from "../../../../../vpn/engine/chromium";
import { ownsAuthEndpoint } from "../../../../../vpn/engine/proxy-auth";
import BlockingResponse = chrome.webRequest.BlockingResponse;
import OnAuthRequiredDetails = chrome.webRequest.OnAuthRequiredDetails;

export const authHandler = (
	request: OnAuthRequiredDetails,
	callback?: (response: BlockingResponse) => void,
): undefined => {
	if (!callback) return undefined;
	const state = getCurrentStateIfDefined();
	let completed = false;
	let ownedStartupEndpoint = false;
	const finish = (response: BlockingResponse) => {
		if (completed) return;
		completed = true;
		clearTimeout(timeout);
		if (
			response.cancel &&
			state === getCurrentStateIfDefined() &&
			request.isProxy &&
			(ownedStartupEndpoint ||
				(isProxyKnownHost(request.challenger.host) &&
					request.challenger.port === state?.data.server?.proxyPort))
		)
			privacyFault();
		callback(response);
	};
	const timeout = setTimeout(
		() => finish({ cancel: true }),
		milliSeconds.fromSeconds(Math.min(20, requestMaxAge)),
	);
	// Website authentication remains the website's responsibility.
	if (!request.isProxy) {
		finish({});
		return undefined;
	}
	if (
		!isProxyKnownHost(request.challenger.host) ||
		request.challenger.port !== state?.data.server?.proxyPort
	) {
		// A persisted proxy can challenge before startup restores currentState.
		// Cancel our exact configured endpoint instead of opening a password dialog.
		// Other extensions' proxies keep their normal authentication behavior.
		try {
			void chromiumProxy(chrome).read().then(
				(details) => {
					if (completed) return;
					ownedStartupEndpoint = ownsAuthEndpoint(details, request.challenger);
					finish(ownedStartupEndpoint ? {cancel: true} : {});
				},
				() => finish({}),
			);
		} catch {
			finish({});
		}
		return undefined;
	}
	if (isPending(request)) {
		finish({ cancel: true });
		return undefined;
	}
	void getCredentials().then(
		(credentials) => {
			if (completed) return;
			if (
				state !== getCurrentStateIfDefined() ||
				!isProxyKnownHost(request.challenger.host)
			) {
				finish({ cancel: true });
				return;
			}
			finish(
				(credentials && getAuthCredentials(credentials, request)) || {
					cancel: true,
				},
			);
		},
		() => finish({ cancel: true }),
	);
	return undefined;
};
