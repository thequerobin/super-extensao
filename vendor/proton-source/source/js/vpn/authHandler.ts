import {milliSeconds} from '../tools/milliSeconds';
import {requestMaxAge} from '../config';
import {
	getAuthCredentials,
	getCurrentStateIfDefined,
	isProxyKnownHost,
} from '../state';
import {isPending} from '../tools/proxyAuth';
import {getCredentials} from '../account/credentials/getConnectionCredentials';
import BlockingResponse = chrome.webRequest.BlockingResponse;
import OnAuthRequiredDetails = chrome.webRequest.OnAuthRequiredDetails;

export const authHandler = (
	request: OnAuthRequiredDetails,
	callback?: (response: BlockingResponse) => void,
): undefined => {
	if (!callback) return undefined;
	let completed = false;
	const finish = (response: BlockingResponse) => {
		if (completed) return;
		completed = true;
		clearTimeout(timeout);
		callback(response);
	};
	const timeout = setTimeout(
		() => finish({cancel: true}),
		milliSeconds.fromSeconds(Math.min(20, requestMaxAge)),
	);
	const state = getCurrentStateIfDefined();
	// Site authentication and a different proxy must never receive VPN credentials.
	if (
		!request.isProxy ||
		!isProxyKnownHost(request.challenger.host) ||
		request.challenger.port !== state?.data.server?.proxyPort
	) {
		finish({});
		return undefined;
	}
	if (isPending(request)) {
		finish({cancel: true});
		return undefined;
	}
	void getCredentials().then(
		(credentials) => {
			if (completed) return;
			if (
				state !== getCurrentStateIfDefined() ||
				!isProxyKnownHost(request.challenger.host)
			) {
				finish({cancel: true});
				return;
			}
			finish(
				(credentials && getAuthCredentials(credentials, request)) || {
					cancel: true,
				},
			);
		},
		() => finish({cancel: true}),
	);
	return undefined;
};
