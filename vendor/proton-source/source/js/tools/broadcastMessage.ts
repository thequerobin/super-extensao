import { observe, VpnIOError } from "../../../../../vpn/engine/io";
import { getRuntime } from "./getRuntime";
import type { ApiError } from "../api";
import type { ProxyServer } from "../vpn/ConnectionState";
import { error } from "../log/log";

export interface BroadcastMessage<T extends string = string, K = any> {
	type: T;
	data: K;
}

export type ChangeStateMessage = BroadcastMessage<
	"changeState",
	{
		state: "connected" | "connecting" | "blocked" | "logged-out" | "disconnected";
		server?: ProxyServer;
		error?: ApiError;
	}
>;

export type ExtensionUpdate = BroadcastMessage<
	"updateExtension",
	{
		error?: ApiError;
	}
>;

export const broadcastMessage = <
	T extends BroadcastMessage = ChangeStateMessage,
>(
	type: T["type"],
	data: T["data"] | undefined = undefined,
): void => {
	if (type === "changeState")
		void (globalThis as any).SuperVpnIndicator?.refresh();
	const notification = { channel: "super-vpn", type, data, respondTo: "none" };
	void observe(
		getRuntime().sendMessage(notification),
		5000,
		new VpnIOError("VpnWorkerTimedOut"),
	).catch((e: any) => {
		const noListener =
			/receiving end does not exist|message port closed before a response/i;
		if (!noListener.test(String(e?.message ?? e))) {
			error(e);
		}
	});
};
