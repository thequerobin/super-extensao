import {
	connectionLifecycle,
	getConnectionSnapshot,
	getCurrentState,
	requestConnectionRecovery,
} from "../state";
import { networkGuard } from "./networkGuard";

/** Only a closed vocabulary crosses this boundary, never a service response or credential. */
const reasons = new Set([
	"VpnTrafficBlocked",
	"VpnTrafficGuardFailed",
	"VpnTrafficGuardUnavailable",
	"VpnTrafficGuardProbeBypassed",
	"VpnNetworkPredictionFailed",
	"VpnWebRTCSettingsFailed",
	"VpnStorageReadTimedOut",
	"VpnStorageWriteTimedOut",
	"VpnStorageFailed",
]);
export async function getProtectionStatus() {
	const generation = connectionLifecycle.capture();
	const snapshot = await getConnectionSnapshot();
	const guard = await networkGuard.status();
	if (!connectionLifecycle.isCurrent(generation))
		throw new Error("VpnOperationCancelled");
	const current = getCurrentState();
	const reason = (current.data?.error as { message?: string })?.message;
	const active = current.name === "on";
	const status = guard.blocked
		? "blocked"
		: snapshot.state.state === "connected" && guard.armed
			? "connected"
			: !active && !guard.armed
				? "released"
				: "unconfirmed";
	return {
		status,
		retryAvailable: active && guard.blocked,
		signedIn: snapshot.signedIn,
		reason: reason && reasons.has(reason) ? reason : "VpnTrafficBlocked",
	};
}
export async function retryProtection() {
	// Never reconstruct an old intent after explicit disconnect/logout.
	if (getCurrentState().name !== "on")
		throw new Error("VpnRecoveryUnavailable");
	await requestConnectionRecovery();
	return getProtectionStatus();
}
