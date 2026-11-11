'use background';
import {setupHandleProxyRequest} from './tools/setupHandleProxyRequest';
import {fetchTranslations} from './tools/translate';
import {triggerPromise} from './tools/triggerPromise';
import {initPostInstallationHook} from './vpn/initPostInstallationHook';
import {initMessaging} from './vpn/initMessaging';
import {initState} from './vpn/initState';
import {initFocusWatcher} from './vpn/initFocusWatcher';
import {initProxySettingsWatcher} from './vpn/initProxySettingsWatcher';
import {initIdleWatcher} from './vpn/initIdleWatcher';
import {initAuthInterceptor} from './vpn/initAuthInterceptor';
import {initSentry} from './tools/sentry';
import {setProxyToWaiterHost} from './tools/proxy';
import {connectedServer} from './vpn/connectedServer';


initSentry();
initAuthInterceptor();
initMessaging();
triggerPromise((async () => {
	if ((await connectedServer.get())?.value) await setProxyToWaiterHost();
	await initState();
})());
setupHandleProxyRequest();
triggerPromise(fetchTranslations());
initPostInstallationHook();
initFocusWatcher();
initProxySettingsWatcher();
initIdleWatcher();

// Share only effective routing rules and confirmed state with the host icon.
import {getCurrentStateIfDefined, isCurrentStateConnected} from './state';
import {getFixedServerConfig} from './tools/proxy';
(globalThis as any).SuperVpnIndicator?.attach(() => {
  const split = getCurrentStateIfDefined()?.data?.server?.splitTunneling;
  const {bypassList, includeOnly} = getFixedServerConfig('', 0, split).rules;
  return {connected: isCurrentStateConnected(), bypassList, includeOnly};
});
