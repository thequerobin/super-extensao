export enum StateChange {
	SIGN_OUT = "signOut",
	SWITCH_ACCOUNT = "switchAccount",
	DISCONNECT = "disconnect",
	CONNECT = "connect",
	CONNECTING = "connecting",
}

export enum SettingChange {
	BYPASS_LIST = "bypassList",
}

export enum PermissionGrant {
	PROXY = "proxy",
}

export enum BackgroundAction {
	FORK = "fork",
	BEGIN_LOGIN = "beginLogin",
	PROTECTION_STATUS = "protectionStatus",
	RETRY_PROTECTION = "retryProtection",
	SET_WEBRTC = "setWebRTC",
	FORGET_ERROR = "forgetError",
	LOG = "log",
}

export enum BackgroundData {
	USER = "user",
	PM_USER = "pmUser",
	STATE = "state",
	CONNECTION_STATE = "connectionState",
	LOCALE = "locale",
}

export type BackgroundExtraData = {
	[BackgroundData.PM_USER]: object;
};

export type BackgroundMessage =
	| BackgroundAction
	| BackgroundData
	| StateChange
	| SettingChange
	| PermissionGrant;
