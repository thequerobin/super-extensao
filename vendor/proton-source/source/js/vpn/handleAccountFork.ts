import { loginFlow } from "../account/loginFlow";
import { forkPayload } from "../../../../../vpn/engine/login";
import { appId } from "../config";
import { forkSession } from "../messaging/forkSession";
export const handleAccountFork = async (message: unknown) => {
	const input = forkPayload(message, appId);
	if (!input || !(await loginFlow.owns(input.state))) return { handled: false };
	return { handled: true, response: await forkSession(message) };
};
