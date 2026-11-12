import { storedCredentials } from "./storedCredentials";
// Popup/account storage code must not import the background credential client.
let invalidate: () => Promise<void> = () => storedCredentials.remove();
export const attachCredentialInvalidation = (
	clear: () => Promise<void>,
): void => {
	invalidate = clear;
};
export const clearCredentials = (): Promise<void> => invalidate();
