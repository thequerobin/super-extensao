import type { LoginOptions } from "../../../../../../vpn/engine/login";
import { sendMessageToBackground } from "../../tools/sendMessageToBackground";
export type RequestForkAction = "signup";
// The worker owns pending state across popup closure and suspension.
export const requestFork = (options: LoginOptions): Promise<string> =>
	sendMessageToBackground<string>("beginLogin", options);
