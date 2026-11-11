'use background';
import {createFixedConfig, createPacScript} from '../../../../../vpn/engine/routing';
import {triggerPromise} from './triggerPromise';
import {setWebRTCState} from '../webrtc/setWebRTCState';
import {WebRTCState} from '../webrtc/state';
import {preventLeak} from '../webrtc/preventLeak';
import {isConnected} from '../vpn/connectedServer';
import {setupHandleProxyRequest} from './setupHandleProxyRequest';
import {
	clearAuthInterceptor,
	initAuthInterceptor,
} from '../vpn/initAuthInterceptor';
import {timeoutAfter} from '../tools/delay';
import {milliSeconds} from '../tools/milliSeconds';
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

interface SystemProxy {
	mode: 'system';
}

interface FixedServersProxy {
	mode: 'fixed_servers';
	rules: {
		singleProxy: {
			scheme: 'http' | 'https'; // https is the only protocol authorized in production
			host: string;
			port: number;
		};
		includeOnly?: string[];
		bypassList: string[];
	};
}

const isFixedServersProxy = (value: any): value is FixedServersProxy =>
	value.mode === 'fixed_servers' || value.mode === 'pac_script';

let proxySet = false;

let proxyErrorWatched = false;

export const hasProxy = async (): Promise<boolean> =>
	await timeoutAfter(
		new Promise((resolve) => {
			if (!chrome.proxy) {
				resolve(false);

				return;
			}

			chrome.proxy.settings.get({}, async (details) => {
				resolve(
					details?.levelOfControl === 'controlled_by_this_extension' ||
						(details?.value?.mode
							? isFixedServersProxy(details?.value)
							: details?.levelOfControl === 'controllable_by_this_extension' &&
								(await isConnected())),
				);
			});
		}),
		milliSeconds.fromSeconds(5),
		'Unable to check proxy settings',
	);

// Super Extensão owns rule compilation; session and browser writes remain here.
export const getPacScript = (proxy: FixedServersProxy): PacScript =>
  createPacScript(proxy, proxyLocalNetworkExclusion);

const setProxy = (
	value: FixedServersProxy | SystemProxy | PacScript,
): Promise<boolean> =>
	new Promise((resolve) => {
		if (!chrome.proxy || !setupHandleProxyRequest()) {
			resolve(false);

			return;
		}

		proxySet = true;
		initAuthInterceptor();
		chrome.proxy.settings.set(
			{
				value,
				scope: 'regular',
			},
			() => {
				hasProxy()
					.then((result) => {
						const promise = browser?.webRequest?.handlerBehaviorChanged?.();

						if (!promise) {
							return result;
						}

						return promise.then(() => result);
					})
					.then((result) => {
						if (!proxyErrorWatched) {
							proxyErrorWatched = true;
							chrome.proxy.onProxyError?.addListener?.(async (event) => {
								switch (getErrorCode(event.error)) {
									case ErrorCode.TIMED_OUT:
									case ErrorCode.TUNNEL_CONNECTION_FAILED:
									case ErrorCode.PROXY_CONNECTION_FAILED:
										retryCredentials(true);
										break;
								}
							});
						}

						resolve(result);
					});
			},
		);

		triggerPromise(
			isFixedServersProxy(value)
				? preventLeak()
				: setWebRTCState(WebRTCState.CLEAR),
		);
	});

export const getFixedServerConfig = (
  host: string,
  port: number,
  splitTunneling: SplitTunnelingConfig = {},
): FixedServersProxy => createFixedConfig(host, port, splitTunneling, {
  scheme, excludeApi: excludeApiFromProxy, apiExclusions: apiDomainsExclusion,
  localExclusions: proxyLocalNetworkExclusion,
});

export const proxyToServer = async (
	server: ProxyServer,
	splitTunneling: SplitTunnelingConfig = {},
) => {
	const config = getFixedServerConfig(
		server.proxyHost,
		server.proxyPort,
		splitTunneling,
	);

	return await setProxy(
		typeof config.rules.includeOnly === 'undefined'
			? config
			: getPacScript(config),
	);
};

export const setProxyToWaiterHost = async (): Promise<boolean> =>
	await setProxy(
		getFixedServerConfig(
			'localhost', // 127.0.0.1
			9,
		),
	);

export const clearProxy = (): Promise<boolean> =>
	new Promise<boolean>((resolve) => {
		if (!chrome.proxy) {
			resolve(false);

			return;
		}

		proxySet = false;
		chrome.proxy.settings.clear({}, (success: boolean | void) => {
			if (!proxySet) {
				clearAuthInterceptor();
				triggerPromise(setWebRTCState(WebRTCState.CLEAR));
			}

			resolve(Boolean(success));
		});
	});
