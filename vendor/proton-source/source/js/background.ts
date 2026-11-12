"use background";
import { nativeStorage } from "./tools/nativeStorage";
import { networkGuard, networkBlocked } from "./vpn/networkGuard";
import { initPrivacyWatchers } from "./vpn/initPrivacyWatchers";
import { emitPrivacyWarning } from "./notifications/privacyWarning";
import { setupHandleProxyRequest } from "./tools/setupHandleProxyRequest";
import { fetchTranslations } from "./tools/translate";
import { triggerPromise } from "./tools/triggerPromise";
import { initPostInstallationHook } from "./vpn/initPostInstallationHook";
import { initMessaging } from "./vpn/initMessaging";
import { initState, initStateRecovery } from "./vpn/initState";
import { initFocusWatcher } from "./vpn/initFocusWatcher";
import { initProxySettingsWatcher } from "./vpn/initProxySettingsWatcher";
import { initIdleWatcher } from "./vpn/initIdleWatcher";
import { initAuthInterceptor } from "./vpn/initAuthInterceptor";
import { initSentry, handleError } from "./tools/sentry";
import { setProxyToWaiterHost } from "./tools/proxy";
import { connectedServer } from "./vpn/connectedServer";

initSentry();
initStateRecovery();
initAuthInterceptor();
initMessaging();
nativeStorage.watchFailures(() => privacyFault());
initPrivacyWatchers();
triggerPromise(
	(async () => {
		const current = connectionLifecycle.guard();
		try {
			await networkGuard.bootstrap();
			if ((await networkGuard.status()).blocked) emitPrivacyWarning();
			if ((await connectedServer.get())?.value && current())
				await setProxyToWaiterHost(current);
		} catch (error) {
			handleError(error);
			emitPrivacyWarning();
		}
		await initState();
	})(),
);
setupHandleProxyRequest();
triggerPromise(fetchTranslations());
initPostInstallationHook();
initFocusWatcher();
initProxySettingsWatcher();
initIdleWatcher();

// Share only effective routing rules and confirmed state with the host icon.
import {
	getCurrentStateIfDefined,
	privacyFault,
	isCurrentStateConnected,
	connectionLifecycle,
} from "./state";
import { getFixedServerConfig } from "./tools/proxy";
(globalThis as any).SuperVpnIndicator?.attach(() => {
	const split = getCurrentStateIfDefined()?.data?.server?.splitTunneling;
	const { bypassList, includeOnly } = getFixedServerConfig("", 0, split).rules;
	return {
		blocked: networkBlocked() || !!getCurrentStateIfDefined()?.data.blocked,
		connected: isCurrentStateConnected(),
		connectionRevision: connectionLifecycle.capture(),
		bypassList,
		includeOnly,
	};
});
