import { isAccountUrl, type LoginOptions } from "../../../../../../vpn/engine/login";
import { sendMessageToBackground } from "../../tools/sendMessageToBackground";
export type RequestForkAction = "signup";
// The worker owns pending state across popup closure and suspension.
export const requestFork = async (options: LoginOptions): Promise<string> => {
	const result = await sendMessageToBackground<unknown>("beginLogin", options);
	// A warning reply is an error envelope, never tabs.create properties.
	if (result && typeof result === "object" && "error" in result && result.error)
		throw result.error;
	if (typeof result !== "string" || !isAccountUrl(result))
		throw new Error("VpnSignInInvalidResponse");
	const target = new URL(result);
	if (target.origin !== new URL(options.host).origin || target.pathname !== "/authorize")
		throw new Error("VpnSignInInvalidResponse");
	return result;
};
