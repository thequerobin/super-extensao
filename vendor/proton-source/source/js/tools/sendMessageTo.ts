import { getRuntime } from "./getRuntime";
import { runtimeRequest } from "./runtimeRequest";
import { VpnIOError } from "../../../../../vpn/engine/io";
export const sendMessageTo = async <K>(
	type: string,
	data?: any,
): Promise<K> => {
	const response = await runtimeRequest<{
		received?: boolean;
		result?: K & { error?: { Warning?: boolean } };
	}>(getRuntime(), { channel: "super-vpn", type, data });
	if (!response?.received)
		throw new VpnIOError(
			"VpnWorkerUnavailable",
			!["state", "connectionState", "user", "pmUser", "locale"].includes(type),
		);
	const result = response.result;
	if (result?.error && !result.error.Warning) throw result.error;
	return result as K;
};
