"use background";
import { credentialManager } from "./credentialStore";
import { getCurrentState } from "../../state";

// Compatibility names only; caching, requests and renewal are engine-owned.
export const getLastCredentials = () => credentialManager.last();
export const cancelNextCredentialFetch = () => credentialManager.cancel();
export const loadCachedCredentials = () => credentialManager.cached();
export const getCredentials = (tryReAuthentication = false) =>
	credentialManager.get(tryReAuthentication);
export const loadCredentials = () => credentialManager.get(true);
export const getSynchronousCredentials = () => credentialManager.synchronous();
export const checkCredentials = async (sessionUid: string): Promise<void> => {
	const cache = await credentialManager.cached();
	if (cache.sessionUid !== sessionUid || !cache.credentials)
		await credentialManager.get();
};
export const maintainConnectionCredentials = async (): Promise<void> => {
	if (getCurrentState().name === "on") await credentialManager.wake();
};
