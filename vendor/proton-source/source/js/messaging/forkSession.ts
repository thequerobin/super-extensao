import { consumeFork } from "../account/fork/consumeFork";
import { forkPayload } from "../../../../../vpn/engine/login";
import { appId } from "../config";
import { triggerPromise } from "../tools/triggerPromise";
import { getFreshUser } from "../account/user/getUser";
import { error } from "../log/log";
import { c } from "../tools/translate";
import type { ForkResponse } from "./ForkResponse";
import { getErrorAsString } from "../tools/getErrorMessage";

export const forkSession = async (
	message: any,
): Promise<ForkResponse | undefined> => {
	if (!message || typeof message !== "object") {
		return;
	}

	const input = forkPayload(message, appId);
	const token =
		typeof message.token === "string" && message.token.length <= 4096
			? message.token
			: undefined;
	const baseResponse = token ? { token } : {};
	if (!input) return { ...baseResponse, type: "error" };
	try {
		const { session } = await consumeFork(input);

		triggerPromise(getFreshUser());

		return {
			...baseResponse,
			type: "success",
			partnerId: session.partnerId,
			payload: {
				title: c("Info").t`You're signed in`,
				message: c("Info").t`Open the Proton VPN browser extension to continue`,
			},
		};
	} catch (e) {
		error(e);

		const message = getErrorAsString(e);

		return {
			...baseResponse,
			type: "error",
			...(message ? { payload: { message } } : {}),
		};
	}
};
