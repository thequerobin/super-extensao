import { WebRTCState } from "./state";
import { privacyController } from "./privacyController";
import { sendMessageToBackground } from "../tools/sendMessageToBackground";
export const setWebRTCState = (state: WebRTCState): Promise<boolean> =>
	typeof document === "undefined"
		? privacyController.apply(state)
		: sendMessageToBackground<boolean>("setWebRTC", state);
