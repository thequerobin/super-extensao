import {
	privacyFault,
	getCurrentStateIfDefined,
	connectionLifecycle,
} from "../state";
import { hasProxy } from "../tools/proxy";
import OnChangeDetails = browser.types._OnChangeDetails;

const proxySettingsWatcher = async (event: OnChangeDetails) => {
	const state = getCurrentStateIfDefined();
	if (state?.name !== "on") return;
	if (event.levelOfControl !== "controlled_by_this_extension") {
		privacyFault();
		return;
	}
	if (!state.proxyEnabled) return; // Our pending write is not confirmed yet.
	const current = connectionLifecycle.guard();
	try {
		if (!(await hasProxy()) && current()) privacyFault();
	} catch {
		if (current()) privacyFault();
	}
};

let proxySettingsWatcherInitialized = false;

export const removeProxySettingsWatcher = () => {
	if (!proxySettingsWatcherInitialized || !browser.proxy) {
		return;
	}

	proxySettingsWatcherInitialized = false;
	browser.proxy.settings.onChange.removeListener(proxySettingsWatcher);
};

export const initProxySettingsWatcher = (): void => {
	if (proxySettingsWatcherInitialized || !browser.proxy) {
		return;
	}

	proxySettingsWatcherInitialized = true;
	browser.proxy.settings.onChange.addListener(proxySettingsWatcher);
};
