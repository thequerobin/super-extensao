import { triggerPromise } from "../../tools/triggerPromise";
import { clearCredentials } from "./credentialInvalidation";
export const removeCredentials = (): Promise<void> => clearCredentials();
export const forgetCredentials = (): void =>
	triggerPromise(removeCredentials());
