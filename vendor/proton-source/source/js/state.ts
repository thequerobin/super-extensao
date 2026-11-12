import { assertServerAccess } from "./vpn/assertServerAccess";
// TODO: Remove this when VPNBEX-238 is done.
/* eslint-disable @typescript-eslint/no-use-before-define */
("use background");
import type {
	ConnectionState,
	ErrorDump,
	ProxyServer,
	SplitTunnelingConfig,
} from "./vpn/ConnectionState";
import {
	type ApiError,
	fetchApi,
	isNetworkError,
	isExcludedFromProxy,
	isIncludedIntoProxy,
} from "./api";
import type { ProxyInfo } from "./proxy";
import { forgetCredentials } from "./account/credentials/removeCredentials";
import {
	cancelNextCredentialFetch,
	getCredentials,
	getSynchronousCredentials,
	loadCachedCredentials,
	loadCredentials,
} from "./account/credentials/getConnectionCredentials";
import type { Credentials } from "./account/credentials/Credentials";
import { getCountryAndCoordinates } from "./account/getLocation";
import { setButton } from "./tools/browserAction";
import {
	clearProxy,
	hasProxy,
	proxyToServer,
	invalidateProxyOperations,
} from "./tools/proxy";
import {
	ConnectionMachine,
	type MachineState,
	type ConnectionPhase,
} from "../../../../vpn/engine/state";
import { connectionView } from "../../../../vpn/engine/presentation";
import {
	authCheck,
	excludeApiFromProxy,
	proxyHost,
	proxyLocalNetworkExclusion,
	proxyPort,
	proxySecureCorePort,
	scheme,
	singleProxyPort,
} from "./config";
import type { WithIdentifiableRequest } from "./tools/proxyAuth";
import { isPending, markAsPending } from "./tools/proxyAuth";
import type { ProxyAuthentication } from "./vpn/ProxyAuthentication";
import type { Logical } from "./vpn/Logical";
import {
	forgetLogicals,
	getLogicalById,
	getSortedLogicals,
	shouldStayOnLogical,
} from "./vpn/getLogicals";
import { c } from "./tools/translate";
import { Feature } from "./vpn/Feature";
import { SplitTunneling } from "./vpn/features/SplitTunneling";
import { SecureCore } from "./vpn/features/SecureCore";
import { AutoConnect } from "./vpn/features/AutoConnect";
import { emitNotification } from "./notifications/emitNotification";
import { getAlternativeServer } from "./vpn/getAlternatives";
import { triggerPromise } from "./tools/triggerPromise";
import { readSession } from "./account/readSession";
import { sessionStore } from "./account/sessionStore";
import {
	forgetLastChoice,
	getLastChoice,
	getLogicalsFilteredByChoice,
} from "./vpn/lastChoice";
import { getUser } from "./account/user/getUser";
import { getUserMaxTier } from "./account/user/getUserMaxTier";
import { forgetUser } from "./account/user/forgetUser";
import { notifyStateChange } from "./tools/notifyStateChange";
import { requireBestLogical } from "./vpn/getLogical";
import { getErrorAsString } from "./tools/getErrorMessage";
import { connectedServer } from "./vpn/connectedServer";
import type { Server } from "./vpn/Server";
import { SettingChange } from "./messaging/MessageType";
import { getSplitTunnelingConfig } from "./vpn/getSplitTunnelingConfig";
import { bind, info as info_, warn as warn_ } from "./log/log";
import { getBasicAuth } from "./vpn/getBasicAuth";
import { getAccessToken } from "./account/getAccessToken";
import { pickServerInLogical } from "./vpn/pickServerInLogical";
import { getSecureCorePredicate } from "./vpn/getSecureCorePredicate";
import {
	getActivityCheckInterval,
	getLogicalCheckUpRefreshInterval,
} from "./intervals";
import { delay } from "./tools/delay";
import { handleError } from "./tools/sentry";
import { updateLastActivityTime } from "./tools/activity";
import { guessTierFromCredentials } from "./account/credentials/guessTierFromCredentials";
import { mayReplaceCredentials } from "./account/credentials/mayReplaceCredentials";
import { forgetClientConfig } from "./account/user/clientconfig/forgetClientConfig";
import { transmitCredentialsToProxy } from "./vpn/transmitCredentialsToProxy";
import {
	setReviewInfoStateLastSeenConnected,
	setReviewInfoStateOnFailedConnection,
} from "./vpn/reviewInfo";
import { getBypassList } from "./vpn/getBypassList";
import { getIncludeOnlyList } from "./vpn/getIncludeOnlyList";
import OnAuthRequiredDetails = chrome.webRequest.OnAuthRequiredDetails;
import OnRequestDetails = browser.proxy._OnRequestDetails;

// The adapter supplies Proton protocol, authentication and server-selection ports.
// All connection intent, transitions, startup and recovery live in vpn/engine/state.
let currentState: ConnectionState;
const warn = bind(warn_, "[state-adapter]");
const info = bind(info_, "[state-adapter]");
const protocolHandlers = {
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
			return { type: "direct" };
		}

		const includeOnly = getIncludeOnlyList(splitTunneling);

		if (
			!isIncludedIntoProxy(requestDetails, excludeApiFromProxy, includeOnly)
		) {
			return { type: "direct" };
		}

		const formatOutput = (newCredentials: Credentials | undefined) => {
			if (!current()) return { type: "direct" } as ProxyInfo;
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
					if (!current()) return { type: "direct" } as ProxyInfo;
					if (retry > 0) {
						return delay(400).then(() => tryCredentials(retry - 1));
					}

					if (session?.uid) {
						disconnect(new Error(c("Error").t`Server not found`));
					} else {
						logOut(true);
					}

					return { type: "direct" };
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
				return { cancel: true };
			}

			const host = requestDetails.challenger.host;

			if (
				host === state.data.server?.proxyHost &&
				requestDetails.challenger.port === state.data.server.proxyPort
			) {
				const credentials = await getCredentials();
				if (state !== currentState) return { cancel: true };

				return (
					(credentials && getAuthCredentials(credentials, requestDetails)) || {
						cancel: true,
					}
				);
			}
		}

		return undefined;
	},
};

function present(
	phase: ConnectionPhase,
	state: MachineState<ProxyServer>,
): void {
	const error = state.data.error as ApiError | Error | ErrorDump | undefined;
	const server = state.data.server;
	notifyStateChange(phase, { server, error });
	if (phase === "logged-out") setButton("loggedOut");
	else if (phase === "disconnected")
		setButton(error ? "error" : "off", error && getErrorAsString(error));
	else if ((error as ApiError)?.Warning) setButton("warning");
	else if (phase === "connected")
		setButton("on", `${c("Label").t`Protected`} - ${server?.name || ""}`);
	else
		setButton("connecting", c("Status").t`Connecting to ${server?.name || ""}`);
}

async function probeServer(
	server: ProxyServer,
	current: () => boolean,
): Promise<void> {
	const { country, coordinates } = await getCountryAndCoordinates();
	if (!current()) return;
	const stay = await shouldStayOnLogical(
		server.id,
		country,
		coordinates,
	);
	if (!current() || stay) return;
	const credentials = await getCredentials(true);
	if (!current() || !credentials) return;
	const alternative = await getAlternativeServer(server.id, {
		country,
		location: coordinates,
		tier: guessTierFromCredentials(credentials),
	});
	if (current() && alternative.logical && alternative.server)
		await connectLogical(
			alternative.logical,
			alternative.server,
			server.splitTunneling,
		);
}

const machine = new ConnectionMachine<ProxyServer, Credentials>({
	readServer: async () => (await connectedServer.get())?.value,
	saveServer: (server) => connectedServer.setValue(server),
	signedIn: async () => !!(await getAccessToken()),
	autoConnect: () => checkAutoConnect(),
	invalidate: () => invalidateProxyOperations(),
	cancelCredentials: () => cancelNextCredentialFetch(),
	loadCredentials: () => loadCredentials(),
	getCredentials: () => getCredentials(true),
	credentialsValid: async () =>
		((await loadCachedCredentials())?.time || 0) >= Date.now(),
	mayReplace: (previous, next) => mayReplaceCredentials(previous, next),
	apply: (server, current) =>
		proxyToServer(server, server.splitTunneling || {}, current),
	hasProxy: () => hasProxy(),
	clearProxy: () => clearProxy(),
	probe: probeServer,
	probeInterval: () => getLogicalCheckUpRefreshInterval(),
	activity: () => updateLastActivityTime(),
	activityInterval: () => getActivityCheckInterval(),
	isNetworkError: (error) =>
		isNetworkError(error) || (error as ApiError)?.Code === -1,
	networkWarning: () => ({
		httpStatus: -1,
		Code: -1,
		Warning: true,
		Error: c("Error").t`Network is unreachable`,
	}),
	error: (code) =>
		new Error(
			code === "missing-server"
				? c("Error").t`Server not found`
				: code === "timeout"
					? "Connection timeout"
					: c("Error")
							.t`Not able to control the browser network settings, possibly a permission is missing`,
		),
	changed(state) {
		currentState = Object.assign(state, {
			...protocolHandlers,
			refreshState: () =>
				machine.peek() === state ? machine.refresh() : Promise.resolve(),
			connectCurrentServer: () =>
				machine.peek() === state
					? machine.connectCurrentServer()
					: Promise.resolve(false),
			setCredentials: (credentials: Credentials | undefined) => {
				if (machine.peek() === state) machine.setCredentials(credentials);
			},
			checkConnectingState: () => {
				if (machine.peek() === state) machine.checkConnectingState();
			},
			setOption: async (type: SettingChange, data: SplitTunnelingConfig) => {
				if (machine.peek() === state && type === SettingChange.BYPASS_LIST)
					await machine.reconfigure((server) => ({
						...server,
						splitTunneling: data,
					}));
			},
		}) as ConnectionState;
	},
	present,
	connected(server, notify) {
		setReviewInfoStateLastSeenConnected();
		if (notify) {
			const name = server.name,
				city = server.exitCity;
			emitNotification(
				"connected-server",
				city
					? c("Info").t`Connected to ${name} in ${city}`
					: c("Info").t`Connected to ${name}`,
			);
		}
		const credentials = currentState.data.credsData;
		transmitCredentialsToProxy(
			server.proxyHost,
			credentials?.Username,
			credentials?.Password,
		);
	},
	disconnected(error) {
		if (error) setReviewInfoStateOnFailedConnection();
		emitNotification(
			"connected-server",
			error ? getErrorAsString(error) : c("Info").t`Disconnected`,
		);
	},
	failed: (error) => handleError(error),
});
export const connectionLifecycle = machine.lifecycle;
export const isProxyKnownHost = (host: string): boolean =>
	currentState?.name === "on" && host === currentState.data.server?.proxyHost;

export function getAuthCredentials(
	credentials: Credentials | undefined,
	requestDetails?: WithIdentifiableRequest,
): ProxyAuthentication | undefined {
	if (currentState?.name !== "on") return undefined;
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

		warn(data.credsTry + " consecutive failures");
	}

	return undefined;
}

export function logIn(): void {
	machine.logIn();
}
export function logOut(deleteSession: boolean) {
	machine.logOut();
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
				return fetchApi("auth", { method: "DELETE" }, undefined, session);
			return undefined;
		}),
	);

	emitNotification("logged-out", c("Info").t`Logged out`);
	info("Logged out");
}

export function disconnect(error?: ApiError | Error | ErrorDump): void {
	machine.disconnect(error);
}
export function connect(data: ConnectionState["data"]): Promise<void> {
	return machine.connect(data);
}
export function connectAfter(
	data: ConnectionState["data"],
	previousName?: string,
): Promise<void> {
	return machine.connect(data, previousName);
}
export function isLoggedIn(): boolean {
	return !!currentState && currentState.name !== "loggedout";
}
export function isCurrentStateConnected(): boolean {
	return currentState?.name === "on" && !!currentState.proxyEnabled;
}
export function getCurrentStateIfDefined(): ConnectionState | undefined {
	return currentState;
}
export function getCurrentState(): ConnectionState {
	machine.get();
	return currentState;
}
export function waitForReadyState(): Promise<void> {
	return machine.ready();
}
export function reportNetworkFailure(error: unknown): void {
	machine.networkFailed(error);
}
export function requestConnectionRecovery(): Promise<void> {
	return machine.retryConnection();
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
	const label = server.Label || "";

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
		{ country, coordinates },
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
		const userContext = { country, location: coordinates, tier: userTier };
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
				(initialChoice.pick === "random"
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

/** Live presentation state; reading it never reconnects or reloads the server list. */
export async function getConnectionSnapshot() {
	await waitForReadyState();
	const initial = getCurrentState();
	const generation = connectionLifecycle.capture();
	const applied =
		initial.name === "on" && !!initial.proxyEnabled && (await hasProxy());
	const current = getCurrentState();
	const confirmed =
		initial === current && connectionLifecycle.isCurrent(generation) && applied;
	return connectionView(
		current as unknown as Parameters<typeof connectionView>[0],
		confirmed,
		current.data.error ? getErrorAsString(current.data.error) : undefined,
	);
}
