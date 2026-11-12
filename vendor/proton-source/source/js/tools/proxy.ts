'use background';
import {
	createFixedConfig,
	createPacScript,
} from '../../../../../vpn/engine/routing';
import {setWebRTCState} from '../webrtc/setWebRTCState';
import {WebRTCState} from '../webrtc/state';
import {preventLeak} from '../webrtc/preventLeak';
import {setupHandleProxyRequest} from './setupHandleProxyRequest';
import {
	clearAuthInterceptor,
	initAuthInterceptor,
} from '../vpn/initAuthInterceptor';
import {ErrorCode, getErrorCode} from '../tools/getErrorCode';
import {retryCredentials} from './retryCredentials';
import {
	apiDomainsExclusion,
	excludeApiFromProxy,
	proxyLocalNetworkExclusion,
	scheme,
} from '../config';
import type {ProxyServer, SplitTunnelingConfig} from '../vpn/ConnectionState';

interface PacScript {
	mode: 'pac_script';
	pacScript: {data: string};
}
interface FixedServersProxy {
	mode: 'fixed_servers';
	rules: {
		singleProxy: {scheme: 'http' | 'https'; host: string; port: number};
		includeOnly?: string[];
		bypassList: string[];
	};
}

// Browser/auth/WebRTC adapters; the controller owns ordering and confirmation.
import {ProxyController} from '../../../../../vpn/engine/controller';
import {chromiumProxy} from '../../../../../vpn/engine/chromium';
let controller: ProxyController | undefined;
let proxyErrorWatched = false;
const getController = () =>
	controller ||
	(controller = new ProxyController({
		...chromiumProxy(chrome),
		prepare() {
			if (!setupHandleProxyRequest()) throw new Error('VpnProxyUnavailable');
			if (!proxyErrorWatched) {
				proxyErrorWatched = true;
				chrome.proxy.onProxyError?.addListener?.((event) => {
					if (
						[
							ErrorCode.TIMED_OUT,
							ErrorCode.TUNNEL_CONNECTION_FAILED,
							ErrorCode.PROXY_CONNECTION_FAILED,
						].includes(getErrorCode(event.error))
					) {
						void hasProxy()
							.then((active) => {
								if (active) retryCredentials(true);
							})
							.catch(() => undefined);
					}
				});
			}
		},
		protect: () => preventLeak(),
		restore: () => setWebRTCState(WebRTCState.CLEAR),
		attachAuth: () => initAuthInterceptor(),
		detachAuth: () => clearAuthInterceptor(),
		flush: async () => {
			await browser?.webRequest?.handlerBehaviorChanged?.();
		},
	}));

export const invalidateProxyOperations = () => controller?.invalidate();
export const hasProxy = (): Promise<boolean> => getController().isApplied();
export const getPacScript = (proxy: FixedServersProxy): PacScript => ({
	mode: 'pac_script',
	pacScript: createPacScript(proxy, proxyLocalNetworkExclusion).pacScript,
});

export const getFixedServerConfig = (
	host: string,
	port: number,
	splitTunneling: SplitTunnelingConfig = {},
): FixedServersProxy => ({
	...createFixedConfig(host, port, splitTunneling, {
		scheme,
		excludeApi: excludeApiFromProxy,
		apiExclusions: apiDomainsExclusion,
		localExclusions: proxyLocalNetworkExclusion,
	}),
	mode: 'fixed_servers',
});

export const proxyToServer = async (
	server: ProxyServer,
	splitTunneling: SplitTunnelingConfig = {},
	guard: () => boolean = () => true,
) => {
	const config = getFixedServerConfig(
		server.proxyHost,
		server.proxyPort,
		splitTunneling,
	);

	return await getController().apply(
		typeof config.rules.includeOnly === 'undefined'
			? config
			: getPacScript(config),
		guard,
	);
};

export const setProxyToWaiterHost = async (
	guard: () => boolean = () => true,
): Promise<boolean> =>
	getController().apply(getFixedServerConfig('localhost', 9), guard);

export const clearProxy = (): Promise<boolean> => getController().disconnect();
