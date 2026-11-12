import { getCurrentState, waitForReadyState } from "../state";
import { setCurrentIdleState } from "../tools/idle";
import { getGlobalBrowser } from "../tools/getGlobalBrowser";
import { triggerPromise } from "../tools/triggerPromise";

export const initIdleWatcher = (): void => {
	getGlobalBrowser().idle.onStateChanged.addListener((newState) => {
		setCurrentIdleState(newState);
		if (newState !== "active") return;
		triggerPromise(
			waitForReadyState().then(() => getCurrentState().refreshState?.()),
		);
	});
};
