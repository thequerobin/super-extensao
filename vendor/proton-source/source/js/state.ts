import {assertServerAccess} from './vpn/assertServerAccess';
// TODO: Remove this when VPNBEX-238 is done.
/* eslint-disable @typescript-eslint/no-use-before-define */
('use background');
import type {
	ConnectionState,
	ConnectionStateSwitch,
	ErrorDump,
	ProxyServer,
	SplitTunnelingConfig,
} from './vpn/ConnectionState';
import {asConnectionStateSwitch} from './vpn/ConnectionState';
import {
	type ApiError,
	fetchApi,
	isExcludedFromProxy,
	isIncludedIntoProxy,
} from './api';
import type {ProxyInfo} from './proxy';
import {forgetCredentials} from './account/credentials/removeCredentials';
import {
	cancelNextCredentialFetch,
	getCredentials,
	getSynchronousCredentials,
	loadCachedCredentials,
	loadCredentials,
} from './account/credentials/getConnectionCredentials';
import type {Credentials} from './account/credentials/Credentials';
import {getCountryAndCoordinates} from './account/getLocation';
import {setButton} from './tools/browserAction';
import {
	clearProxy,
	hasProxy,
	proxyToServer,
	invalidateProxyOperations,
} from './tools/proxy';
import {ConnectionLifecycle} from '../../../../vpn/engine/lifecycle';
import {connectionView} from '../../../../vpn/engine/presentation';
import {
	authCheck,
	excludeApiFromProxy,
	proxyHost,
	proxyLocalNetworkExclusion,
	proxyPort,
	proxySecureCorePort,
	scheme,
	singleProxyPort,
} from './config';
import type {WithIdentifiableRequest} from './tools/proxyAuth';
import {isPending, markAsPending} from './tools/proxyAuth';
import type {ProxyAuthentication} from './vpn/ProxyAuthentication';
import {milliSeconds} from './tools/milliSeconds';
import type {Logical} from './vpn/Logical';
import {
	forgetLogicals,
	getLogicalById,
	getSortedLogicals,
	shouldStayOnLogical,
} from './vpn/getLogicals';
import {c} from './tools/translate';
import {Feature} from './vpn/Feature';
import {SplitTunneling} from './vpn/features/SplitTunneling';
import {SecureCore} from './vpn/features/SecureCore';
import {AutoConnect} from './vpn/features/AutoConnect';
import {emitNotification} from './notifications/emitNotification';
import {checkNetwork} from './vpn/checkNetwork';
import {getAlternativeServer} from './vpn/getAlternatives';
import {triggerPromise} from './tools/triggerPromise';
import {readSession} from './account/readSession';
import {sessionStore} from './account/sessionStore';
import {
	forgetLastChoice,
	getLastChoice,
	getLogicalsFilteredByChoice,
} from './vpn/lastChoice';
import {getUser} from './account/user/getUser';
import {getUserMaxTier} from './account/user/getUserMaxTier';
import {forgetUser} from './account/user/forgetUser';
import {notifyStateChange} from './tools/notifyStateChange';
import {requireBestLogical} from './vpn/getLogical';
import {getErrorAsString} from './tools/getErrorMessage';
import {connectedServer} from './vpn/connectedServer';
import type {Server} from './vpn/Server';
import {SettingChange} from './messaging/MessageType';
import {getSplitTunnelingConfig} from './vpn/getSplitTunnelingConfig';
import {bind, debug as debug_, info as info_, warn as warn_} from './log/log';
import {getBasicAuth} from './vpn/getBasicAuth';
import {getAccessToken} from './account/getAccessToken';
import {pickServerInLogical} from './vpn/pickServerInLogical';
import {getSecureCorePredicate} from './vpn/getSecureCorePredicate';
import {
	getActivityCheckInterval,
	getLogicalCheckUpRefreshInterval,
} from './intervals';
import {delay} from './tools/delay';
import {handleError} from './tools/sentry';
import {updateLastActivityTime} from './tools/activity';
import {guessTierFromCredentials} from './account/credentials/guessTierFromCredentials';
import {mayReplaceCredentials} from './account/credentials/mayReplaceCredentials';
import {forgetClientConfig} from './account/user/clientconfig/forgetClientConfig';
import {transmitCredentialsToProxy} from './vpn/transmitCredentialsToProxy';
import {
	setReviewInfoStateLastSeenConnected,
	setReviewInfoStateOnFailedConnection,
} from './vpn/reviewInfo';
import {getBypassList} from './vpn/getBypassList';
import {getIncludeOnlyList} from './vpn/getIncludeOnlyList';
import OnAuthRequiredDetails = chrome.webRequest.OnAuthRequiredDetails;
import OnRequestDetails = browser.proxy._OnRequestDetails;

const debug = bind(debug_, '[state]');
const info = bind(info_, '[state]');
const warn = bind(warn_, '[state]');

let currentState: ConnectionState;
export const connectionLifecycle = new ConnectionLifecycle();
let serverPersistence: Promise<unknown> = Promise.resolve();
const persistServer = (server: ProxyServer | undefined) => {
	serverPersistence = serverPersistence
		.catch(() => undefined)
		.then(() => connectedServer.setValue(server));
	triggerPromise(serverPersistence);
};

let lastLogicalCheck = 0;

const hasWarning = () => !!(currentState?.data?.error as ApiError)?.Warning;

export const isProxyKnownHost = (host: string): boolean =>
	currentState?.name === 'on' && host === currentState.data.server?.proxyHost;

export function getAuthCredentials(
	credentials: Credentials | undefined,
	requestDetails?: WithIdentifiableRequest,
): ProxyAuthentication | undefined {
	if (currentState?.name !== 'on') return undefined;
	const data = currentState.data;

	if (
		credentials &&
		(data.credsData?.Username !== credentials.Username ||
			data.credsData?.Password !== credentials.Password)
	) {
		Object.assign(data, {
			credsTry: 0,
			credsData: credentials,
		});
	}

	if (data.credsData) {
		if (!authCheck) {
			return {
				authCredentials: {
					username: data.credsData.Username,
					password: data.credsData.Password,
				},
			};
		}

		data.credsTry = (data.credsTry || 0) + 1;
		// Do not try more than 10 times

		if (data.credsTry < 10) {
			if (requestDetails) {
				markAsPending(requestDetails);
			}

			return {
				authCredentials: {
					username: data.credsData.Username,
					password: data.credsData.Password,
				},
			};
		}

		warn(data.credsTry + ' consecutive failures');
	}

	return undefined;
}

// **** Logged in and connected ****
const onState = asConnectionStateSwitch({
	name: 'on',
	initializedAt: 0,
	proxyEnabled: false as boolean,
	refreshingState: false,
	connectionNotified: false,
	proxyTask: undefined as
		| {generation: number; promise: Promise<boolean>}
		| undefined,

	init(oldState?: ConnectionState): void {
		this.proxyEnabled = false;
		currentState.data = {
			credsData: undefined,
			...oldState?.data,
			...currentState.data,
			starting: true,
		};

		if (typeof currentState.data.server === 'undefined') {
			return switchState(offState);
		}
	},

	async connectCurrentServer(): Promise<boolean> {
		if (this !== currentState) return false;
		const generation = connectionLifecycle.capture();
		if (this.proxyTask?.generation === generation)
			return this.proxyTask.promise;
		const server = currentState.data.server;
		if (!server) return false;
		const task = {
			generation,
			promise: this.setProxy(server, server.splitTunneling || {}),
		};
		this.proxyTask = task;
		try {
			return await task.promise;
		} finally {
			if (this.proxyTask === task) this.proxyTask = undefined;
		}
	},

	async setOption(type: SettingChange, data: any): Promise<void> {
		if (this !== currentState) return;
		switch (type) {
			case SettingChange.BYPASS_LIST:
				if (currentState?.data?.server) {
					connectionLifecycle.advance();
					invalidateProxyOperations();
					currentState.data.server.splitTunneling = data;
					this.proxyEnabled = false;
					await this.setConnected();
				}

				break;
		}
	},

	async setProxy(
		server: ProxyServer,
		splitTunneling: SplitTunnelingConfig = {},
	): Promise<boolean> {
		const state = currentState;
		const current = connectionLifecycle.guard();
		if (this !== state) return false;
		if (state.data?.starting) {
			delete state.data.starting;
		}

		const credentials = await getCredentials();
		if (!current()) return false;
		const cached = await loadCachedCredentials();
		if (!current()) return false;

		if (!credentials || (cached?.time || 0) < Date.now()) {
			warn(credentials ? 'Expired token' : 'No token');

			return false;
		}

		if (!(await proxyToServer(server, splitTunneling, current)) || !current()) {
			return false;
		}

		this.proxyEnabled = true;
		triggerPromise(this.checkLogicalIsUp(credentials));

		setReviewInfoStateLastSeenConnected();

		return true;
	},

	async setConnected(): Promise<void> {
		const current = connectionLifecycle.guard();
		if (this !== currentState) return;
		if (!currentState?.data?.server) {
			disconnect(new Error(c('Error').t`Server not found`));

			return;
		}

		const time = Date.now();
		const initialState = currentState;
		const server = currentState.data.server;
		const name = currentState.data.server.name;
		lastLogicalCheck = time;

		let applied: boolean;
		try {
			applied = await this.connectCurrentServer();
		} catch (error) {
			if (initialState === currentState && current())
				disconnect(error as Error);
			return;
		}
		if (initialState !== currentState || !current()) return;
		if (!applied) {
			disconnect(
				new Error(
					c('Error')
						.t`Not able to control the browser network settings, possibly a permission is missing`,
				),
			);

			return;
		}

		if (!this.connectionNotified) {
			this.connectionNotified = true;
			const city = server.exitCity;
			emitNotification(
				'connected-server',
				city
					? c('Info').t`Connected to ${name} in ${city}`
					: c('Info').t`Connected to ${name}`,
			);
		}
		const host = currentState.data.server?.proxyHost;

		if (host) {
			const credsData = currentState?.data?.credsData;
			transmitCredentialsToProxy(
				host,
				credsData?.Username,
				credsData?.Password,
			);
		}

		setTimeout(
			() => {
				if (
					initialState !== currentState ||
					!current() ||
					currentState.data.server?.name !== name
				) {
					return;
				}

				notifyStateChange('connected', {
					server,
					error: currentState.data.error,
				});

				const serverName = name || '';

				setButton('on', `${c('Label').t`Protected`} - ${serverName}`);
			},
			Math.max(1, 200 - Date.now() + time),
		);
	},

	setCredentials(credentials: Credentials | undefined): void {
		if (this !== currentState) return;
		const userName = credentials?.Username;
		const password = credentials?.Password;

		if (!userName || !password) {
			return;
		}

		const credsData = currentState?.data?.credsData;

		if (userName === credsData?.Username && password === credsData?.Password) {
			if (currentState.data?.starting || !this.proxyEnabled) {
				triggerPromise(this.setConnected());
			}

			return;
		}

		if (!mayReplaceCredentials(credsData, credentials)) {
			return;
		}

		Object.assign(currentState.data, {
			credsTry: 0,
			credsData: {
				Username: userName,
				Password: password,
			},
		});

		triggerPromise(this.setConnected());
	},

	async checkLogicalIsUp(credentials?: Credentials): Promise<void> {
		const state = currentState;
		if (this !== state) return;
		const time = Date.now();
		const id = currentState?.data?.server?.id;

		if (!id || time - lastLogicalCheck < getLogicalCheckUpRefreshInterval()) {
			return;
		}

		lastLogicalCheck = time;

		try {
			await delay(500);

			if (
				state !== currentState ||
				!this.proxyEnabled ||
				!isCurrentStateConnected()
			) {
				return;
			}

			const {country, coordinates} = await getCountryAndCoordinates();

			if (!(await shouldStayOnLogical(id, country, coordinates))) {
				const currentCredentials = credentials || (await getCredentials(true));

				// No need to switch server before getting valid credentials, and if we don't get valid credentials
				// soon, it will disconnect anyway
				if (currentCredentials) {
					const {server, logical} = await getAlternativeServer(id, {
						country,
						location: coordinates,
						tier: guessTierFromCredentials(currentCredentials),
					});

					if (logical && server && state === currentState) {
						await connectLogical(
							logical,
							server,
							currentState?.data?.server?.splitTunneling,
						);
					}
				}
			}
		} catch (e) {
			if (state !== currentState) return;
			checkNetwork(e);
		}
	},

	async refreshState(): Promise<void> {
		const state = currentState;
		if (this !== state) return;
		if (this.refreshingState) {
			return;
		}

		this.refreshingState = true;

		try {
			triggerPromise(this.checkLogicalIsUp());

			const applied = await hasProxy();
			if (state !== currentState) return;
			if (!applied) this.proxyEnabled = false;
			if (!state.data?.starting && applied) {
				return;
			}

			try {
				let credentials = await loadCredentials();
				if (state !== currentState) return;

				if (credentials) {
					this.proxyEnabled = false;
					this.setCredentials(credentials);

					return;
				}

				if (hasWarning()) {
					return;
				}

				const server = currentState?.data?.server;
				const serverName = server?.name || '';

				notifyStateChange('connecting', {server});

				setButton(
					'connecting',
					/* translator: connection in progress to the server, for instance "Connecting to Paris #12" */
					c('Status').t`Connecting to ${serverName}`,
				);

				credentials = await getCredentials(true);
				if (state !== currentState) return;

				if (
					!hasWarning() &&
					(!credentials?.Username || !credentials?.Password)
				) {
					switchState(offState);

					return;
				}

				this.setCredentials(credentials);

				if (!currentState?.data?.server) {
					throw new Error('No server');
				}

				await this.connectCurrentServer();
			} catch (e) {
				if (state !== currentState) return;
				disconnect(e as ApiError);
				handleError(e);
			}
		} finally {
			this.refreshingState = false;
		}
	},

	handleProxyRequest(
		requestDetails: OnRequestDetails,
	): ProxyInfo | Promise<ProxyInfo> {
		const current = connectionLifecycle.guard();
		// This is only to avoid proxy for localhost, but we might actually want to access the API via the proxy in normal cases
		// We should extend this to prevent proxying for LAN addresses
		const splitTunneling = currentState?.data?.server?.splitTunneling;
		const bypassList = [
			...proxyLocalNetworkExclusion,
			...getBypassList(splitTunneling),
		];

		if (isExcludedFromProxy(requestDetails, excludeApiFromProxy, bypassList)) {
			return {type: 'direct'};
		}

		const includeOnly = getIncludeOnlyList(splitTunneling);

		if (
			!isIncludedIntoProxy(requestDetails, excludeApiFromProxy, includeOnly)
		) {
			return {type: 'direct'};
		}

		const formatOutput = (newCredentials: Credentials | undefined) => {
			if (!current()) return {type: 'direct'} as ProxyInfo;
			const config = {
				type: scheme,
				host: currentState?.data?.server?.proxyHost,
				port: currentState?.data?.server?.proxyPort,
				...getAuthCredentials(newCredentials, requestDetails)?.authCredentials,
			} as ProxyInfo;

			if (config.username && config.password) {
				config.proxyAuthorizationHeader = getBasicAuth(
					config.username,
					config.password,
				);
			}

			return config;
		};
		const cachedCredentials = getSynchronousCredentials();

		if (cachedCredentials) {
			return formatOutput(cachedCredentials);
		}

		const tryCredentials = (retry: number): Promise<ProxyInfo> =>
			getCredentials(true).then((credentials) => {
				if (credentials) {
					return formatOutput(credentials);
				}

				return readSession().then((session) => {
					if (!current()) return {type: 'direct'} as ProxyInfo;
					if (retry > 0) {
						return delay(400).then(() => tryCredentials(retry - 1));
					}

					if (session?.uid) {
						disconnect(new Error(c('Error').t`Server not found`));
					} else {
						logOut(true);
					}

					return {type: 'direct'};
				});
			});

		return tryCredentials(3);
	},

	async handleProxyAuthentication(
		requestDetails: OnAuthRequiredDetails,
	): Promise<ProxyAuthentication | undefined> {
		const state = currentState;
		if (this !== state) return undefined;
		if (requestDetails.isProxy) {
			if (isPending(requestDetails)) {
				return {cancel: true};
			}

			const host = requestDetails.challenger.host;

			if (
				host === state.data.server?.proxyHost &&
				requestDetails.challenger.port === state.data.server.proxyPort
			) {
				const credentials = await getCredentials();
				if (state !== currentState) return {cancel: true};

				return (
					(credentials && getAuthCredentials(credentials, requestDetails)) || {
						cancel: true,
					}
				);
			}
		}

		return undefined;
	},

	checkConnectingState(time: number): void {
		if (this.proxyEnabled) {
			const server = currentState?.data?.server;
			const serverName = server?.name || '';

			notifyStateChange('connected', {
				server,
				error: currentState.data.error,
			});

			setButton('on', `${c('Label').t`Protected`} - ${serverName}`);
		} else if (Date.now() - time > milliSeconds.fromSeconds(30)) {
			disconnect(currentState.data?.error || new Error('Connection timeout'));
		}
	},
});

// **** Logged out state ****
const loggedoutState: ConnectionStateSwitch = {
	name: 'loggedout',
	initializedAt: 0,
	async init(): Promise<void> {
		cancelNextCredentialFetch();
		//Always start clean
		currentState.data = {};

		setButton('loggedOut');

		notifyStateChange('logged-out');

		await clearProxy();
	},
	checkConnectingState(time: number): void {
		if (Date.now() - time > milliSeconds.fromSeconds(5)) {
			notifyStateChange('logged-out');
		}
	},
};

// **** Logged in, but not connected ****
const offState: ConnectionStateSwitch = {
	name: 'off',
	initializedAt: 0,
	async init(config?: ConnectionState): Promise<void> {
		cancelNextCredentialFetch();
		currentState.data = {};
		const error = config?.data?.error;

		if (error) {
			currentState.data.error =
				error instanceof Error
					? {
							message: error.message,
							stack: error.stack,
						}
					: error;
		}

		notifyStateChange('disconnected', {error});

		setButton(error ? 'error' : 'off', error && getErrorAsString(error));

		await clearProxy();
	},
	async refreshState(): Promise<void> {
		if (
			currentState.data.server &&
			Date.now() - this.initializedAt! > milliSeconds.fromSeconds(3) &&
			(await hasProxy())
		) {
			await connect(currentState.data);
		}
	},
	checkConnectingState(time: number): void {
		if (Date.now() - time > milliSeconds.fromSeconds(5)) {
			notifyStateChange('disconnected', {
				error:
					currentState.data?.error ||
					new Error('Connection initialization timeout'),
			});
		}
	},
};

export function switchState(state: ConnectionStateSwitch) {
	connectionLifecycle.advance();
	invalidateProxyOperations();
	const oldState = currentState || undefined;
	currentState = Object.assign({data: {}}, state, {
		initializedAt: Date.now(),
	});
	info('Switch state to ' + currentState.name, currentState.data);
	const initial = currentState;
	triggerPromise(
		Promise.resolve(initial.init?.(oldState)).catch((error) => {
			if (initial !== currentState) return;
			initial.data.error = error;
			notifyStateChange(
				initial.name === 'loggedout' ? 'logged-out' : 'disconnected',
				{error},
			);
			setButton('error', getErrorAsString(error));
		}),
	);
	triggerPromise(Promise.resolve(initial.refreshState?.()));
	persistServer(currentState.data?.server);
}

export function logIn() {
	switchState(offState);
}

export function logOut(deleteSession: boolean) {
	switchState(loggedoutState);
	// Invalidate refresh synchronously, before the next login can save a session.
	const previousSession = sessionStore.clear();
	forgetUser();
	forgetCredentials();
	forgetLogicals();
	forgetLastChoice();
	forgetClientConfig();
	triggerPromise(
		previousSession.then((session) => {
			if (deleteSession && session?.uid)
				return fetchApi('auth', {method: 'DELETE'}, undefined, session);
			return undefined;
		}),
	);

	emitNotification('logged-out', c('Info').t`Logged out`);
	info('Logged out');
}

export function disconnect(error?: ApiError | Error | ErrorDump | undefined) {
	if (error) {
		setReviewInfoStateOnFailedConnection();
	}

	emitNotification(
		'connected-server',
		error ? `${getErrorAsString(error)}` : c('Info').t`Disconnected`,
	);

	getCurrentState().data.error = error;
	switchState(offState);
}

export async function connectLogical(
	logical: Logical,
	server: Server,
	splitTunneling?: SplitTunnelingConfig,
): Promise<void> {
	const generation = connectionLifecycle.advance();
	invalidateProxyOperations();
	const user = await getUser();
	if (!connectionLifecycle.isCurrent(generation)) return;
	assertServerAccess(user, logical);
	const secureCoreLogical = (logical.Features & Feature.SECURE_CORE) !== 0;
	const label = server.Label || '';

	await connect({
		server: {
			id: logical.ID,
			name: logical.Name,
			exitIp: server.ExitIP,
			entryCountry: logical.EntryCountry,
			exitCountry: logical.ExitCountry,
			exitCity: logical.Translations?.City || logical.City,
			exitEnglishCity: logical.City,
			secureCore: secureCoreLogical,
			proxyHost: proxyHost || server.Domain,
			proxyPort: secureCoreLogical
				? proxySecureCorePort || proxyPort
				: proxyPort +
					(!singleProxyPort && /^\d+$/.test(label) ? parseInt(label, 10) : 0),
			splitTunneling,
		},
	});
}

export async function connect(data: ConnectionState['data']): Promise<void> {
	const generation = connectionLifecycle.advance();
	invalidateProxyOperations();
	const previous = await connectedServer.get();
	if (!connectionLifecycle.isCurrent(generation)) return;
	return connectAfter(data, previous?.value?.name);
}

export async function connectAfter(
	data: ConnectionState['data'],
	previousName: string | undefined,
): Promise<void> {
	delete currentState.data.error;
	Object.assign(currentState.data, data);
	switchState(onState);

	(currentState as typeof onState).connectionNotified =
		previousName === data.server?.name;
	notifyStateChange('connecting', {server: data.server});
	setButton('connecting');
}

export function isLoggedIn(): boolean {
	return currentState && currentState.name !== 'loggedout';
}

export function isCurrentStateConnected(): boolean {
	return (
		currentState && currentState.name === 'on' && !!currentState.proxyEnabled
	);
}

export async function checkAutoConnect(): Promise<void> {
	const current = connectionLifecycle.guard();
	const user = await getUser();
	if (!current()) return;

	if (!user) {
		return;
	}

	const [
		initialChoice,
		logicals,
		autoConnect,
		splitTunneling,
		secureCore,
		{country, coordinates},
	] = await Promise.all([
		getLastChoice(),
		getSortedLogicals(),
		AutoConnect.create().then((feature) => feature.getConfig()),
		SplitTunneling.create().then((feature) => feature.getConfig()),
		SecureCore.create().then((feature) => feature.getConfig()),
		getCountryAndCoordinates(),
	]);

	if (!current()) return;
	if (initialChoice?.connected && autoConnect?.value) {
		// Quit auto-connect if there is no session
		if (!(await readSession())?.uid || !current()) {
			return;
		}

		const userTier = getUserMaxTier(user);
		const userContext = {country, location: coordinates, tier: userTier};
		const filteredList = getLogicalsFilteredByChoice(
			logicals
				.filter(getSecureCorePredicate(userTier, secureCore))
				.filter((logical) => userTier >= logical.Tier),
			initialChoice,
			(id) => {
				const logical = getLogicalById(id);

				return logical ? [logical] : [];
			},
		);

		if (filteredList[0]) {
			const logical =
				(initialChoice.pick === 'random'
					? filteredList[Math.floor(Math.random() * filteredList.length)]
					: requireBestLogical(filteredList, userContext)) || filteredList[0];
			const server = pickServerInLogical(logical);

			if (server?.Domain) {
				await connectLogical(
					logical,
					server,
					getSplitTunnelingConfig(userTier, splitTunneling),
				);
			}
		}
	}
}

export function getCurrentStateIfDefined(): ConnectionState | undefined {
	return currentState;
}

let ready = false;
let starters = [] as (() => void)[];

export function waitForReadyState(): Promise<void> {
	return new Promise<void>((resolve) => {
		if (ready) {
			resolve();

			return;
		}

		starters.push(resolve);
		getCurrentState();
	});
}

async function getDisconnectedState(): Promise<ConnectionStateSwitch> {
	try {
		return (await getAccessToken()) ? offState : loggedoutState;
	} catch {
		return loggedoutState;
	}
}

export function getCurrentState(): ConnectionState {
	if (!currentState) {
		info('New state creation');
		currentState = {
			data: {},
		} as ConnectionState;
		const initialState = currentState;
		const current = connectionLifecycle.guard();
		connectedServer
			.get()
			.then(async (data) => {
				if (!current() || initialState !== currentState) return;
				const server = data?.value;

				if (server) {
					await connectAfter({server}, server.name);

					return;
				}

				debug('[getCurrentState]', data?.value);
				const disconnected = await getDisconnectedState();
				if (!current() || initialState !== currentState) return;
				switchState(disconnected);
				await checkAutoConnect();
			})
			.finally(() => {
				ready = true;

				starters.forEach((resolve) => {
					resolve();
				});

				starters = [];
			});
	}

	return currentState;
}

setInterval(() => {
	if (isCurrentStateConnected()) {
		triggerPromise(updateLastActivityTime());
	}
}, getActivityCheckInterval());

/** Live presentation state; reading it never reconnects or reloads the server list. */
export async function getConnectionSnapshot() {
	await waitForReadyState();
	const initial = getCurrentState();
	const generation = connectionLifecycle.capture();
	const applied =
		initial.name === 'on' && !!initial.proxyEnabled && (await hasProxy());
	const current = getCurrentState();
	const confirmed =
		initial === current && connectionLifecycle.isCurrent(generation) && applied;
	return connectionView(
		current as unknown as Parameters<typeof connectionView>[0],
		confirmed,
		current.data.error ? getErrorAsString(current.data.error) : undefined,
	);
}
