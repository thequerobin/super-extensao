import { privacyFault, getCurrentStateIfDefined } from "../state";
import { WebRTCState } from "../webrtc/state";
import { predictionIsProtected } from "../../../../../vpn/engine/chromium-prediction";
let initialized = false;
export function initPrivacyWatchers(): void {
	if (initialized) return;
	initialized = true;
	chrome.webRequest?.onErrorOccurred?.addListener(
		(details) => {
			if (
				/ERR_(PROXY|TUNNEL|NO_SUPPORTED_PROXIES|MANDATORY_PROXY|INTERNET_DISCONNECTED|NETWORK_CHANGED|INVALID_AUTH_CREDENTIALS)/.test(
					details.error,
				) &&
				getCurrentStateIfDefined()?.name === "on"
			)
				privacyFault();
		},
		{ urls: ["<all_urls>"] },
	);
	chrome.privacy?.network?.networkPredictionEnabled?.onChange.addListener(
		(details) => {
			if (
				getCurrentStateIfDefined()?.name === "on" &&
				!predictionIsProtected(details)
			)
				privacyFault();
		},
	);
	chrome.proxy?.onProxyError?.addListener(() => {
		if (getCurrentStateIfDefined()?.name === "on") privacyFault();
	});
	chrome.privacy?.network?.webRTCIPHandlingPolicy?.onChange.addListener(
		(details) => {
			if (
				details.levelOfControl === "controlled_by_this_extension" &&
				details.value === WebRTCState.DISABLED
			)
				return;
			if (getCurrentStateIfDefined()?.name === "on") privacyFault();
		},
	);
}
