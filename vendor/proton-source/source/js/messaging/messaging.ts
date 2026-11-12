"use background";
import { getProtectionStatus, retryProtection } from "../vpn/protectionPage";
import { loginFlow } from "../account/loginFlow";
import type { LoginOptions } from "../../../../../vpn/engine/login";
import { privacyController } from "../webrtc/privacyController";
import { WebRTCState } from "../webrtc/state";
import { PreventWebrtcLeak } from "../vpn/features/PreventWebrtcLeak";
import { connectionLifecycle } from "../state";
import { readSession } from "../account/readSession";
import { getFreshUser } from "../account/user/getUser";
import { getPmUser } from "../account/user/getPmUser";
import {
	connectLogical,
	disconnect,
	getCurrentState,
	getConnectionSnapshot,
	logOut,
} from "../state";
import { createSession } from "../account/createSession";
import {
	BackgroundAction,
	BackgroundData,
	type BackgroundExtraData,
	type BackgroundMessage,
	PermissionGrant,
	SettingChange,
	StateChange,
} from "./MessageType";
import { sendForkResponse } from "../tools/openTabs";
import { setupHandleProxyRequest } from "../tools/setupHandleProxyRequest";
import { record } from "../log/record";
import { forkSession } from "./forkSession";
import type { Logical } from "../vpn/Logical";
import type { Server } from "../vpn/Server";
import type { SplitTunnelingConfig } from "../vpn/ConnectionState";

export const routeMessage = async <T extends BackgroundMessage>(message: {
	type: T;
	data: T extends keyof BackgroundExtraData
		? BackgroundExtraData[T] | undefined
		: unknown;
}): Promise<any> => {
	const { type, data } = message;

	switch (type) {
		case BackgroundAction.PROTECTION_STATUS:
			return getProtectionStatus();
		case BackgroundAction.RETRY_PROTECTION:
			return retryProtection();
		case BackgroundAction.BEGIN_LOGIN:
			return loginFlow.begin(data as LoginOptions);
		case BackgroundAction.SET_WEBRTC: {
			if (!Object.values(WebRTCState).includes(data as WebRTCState))
				throw new Error("VpnWebRTCInvalidState");
			const current = connectionLifecycle.guard();
			let target = data as WebRTCState;
			if (getCurrentState().name === "on") {
				await (await PreventWebrtcLeak.create()).getConfig();
				target = WebRTCState.DISABLED;
			} else target = WebRTCState.CLEAR;
			if (!current()) return false;
			return privacyController.apply(target);
		}

		case BackgroundAction.FORK:
			await sendForkResponse(
				(message as { tabId?: number }).tabId,
				await forkSession(message),
			);

			return null;

		case BackgroundData.USER:
			if (!(await readSession())?.uid) {
				throw new Error("No session");
			}

			return await getFreshUser();

		case BackgroundData.PM_USER: {
			if (!(await readSession())?.uid) {
				throw new Error("No session");
			}

			return await getPmUser(true);
		}

		case StateChange.SIGN_OUT:
			logOut(true);
			await createSession();
			break;

		case StateChange.SWITCH_ACCOUNT:
			logOut(false);
			await createSession();
			break;

		case BackgroundData.CONNECTION_STATE:
			return await getConnectionSnapshot();

		case BackgroundData.STATE:
			return getCurrentState().data;

		case StateChange.DISCONNECT:
			await disconnect();
			break;

		case StateChange.CONNECTING:
			getCurrentState().checkConnectingState?.(
				(data as { connectionAttemptTime: number }).connectionAttemptTime,
			);
			break;

		case StateChange.CONNECT:
			await (({ logical, server, splitTunneling }) =>
				connectLogical(logical, server, splitTunneling))(
				data as {
					logical: Logical;
					server: Server;
					splitTunneling?: SplitTunnelingConfig;
				},
			);
			break;

		case BackgroundAction.FORGET_ERROR:
			delete getCurrentState().data.error;
			break;

		case BackgroundAction.LOG:
			record(data);
			break;

		case PermissionGrant.PROXY:
			setupHandleProxyRequest();
			break;

		case SettingChange.BYPASS_LIST:
			getCurrentState().setOption?.(type, data);
			break;
	}

	return undefined;
};
