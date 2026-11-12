// Compatibility entry point. Retry intent and throttling belong to the own engine;
// alarms can continue the retry after the MV3 worker has been suspended.
import { requestConnectionRecovery } from "../state";
import { triggerPromise } from "./triggerPromise";
export const retryCredentials = (_disconnectOnFailure = false): void => {
	triggerPromise(requestConnectionRecovery());
};
