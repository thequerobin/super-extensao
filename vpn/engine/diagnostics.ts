export type ConnectionStage =
  | "proxy-read"
  | "network-block"
  | "credentials"
  | "credentials-validation"
  | "proxy-apply"
  | "tunnel-verification"
  | "connected";
export type DiagnosticOutcome = "started" | "succeeded" | "failed";
const reasons = new Set([
  "VpnConnectionTimedOut", "VpnTunnelVerificationFailed", "VpnProxyNotApplied",
  "VpnProxyControlledElsewhere", "VpnProxyApiError", "VpnProxyUnavailable",
  "VpnInvalidProxyEndpoint", "VpnProxyClearFailed", "VpnTrafficGuardFailed",
  "VpnTrafficGuardUnavailable", "VpnTrafficGuardProbeBypassed",
  "VpnNetworkPredictionFailed", "VpnWebRTCSettingsFailed",
  "VpnWebRTCProtectionUnavailable", "VpnCredentialCancelled",
  "VpnCredentialRequestTimedOut", "VpnInvalidCredentials", "VpnExpiredCredentials",
  "VpnStorageReadTimedOut", "VpnStorageWriteTimedOut", "VpnStorageFailed",
]);
interface Entry {
  time: number;
  stage: ConnectionStage;
  outcome: DiagnosticOutcome;
  reason?: string;
}

/** Local, bounded and deliberately independent of verbose service logs. */
export function createConnectionDiagnostics(
  warn: (entry: Entry) => void,
  now = Date.now,
) {
  const entries: Entry[] = [];
  return {
    record(stage: ConnectionStage, outcome: DiagnosticOutcome, error?: unknown) {
      const message = (error as { message?: unknown } | undefined)?.message;
      const reason = typeof message === "string" && reasons.has(message)
        ? message
        : "VpnConnectionFailed";
      const entry: Entry = {
        time: now(), stage, outcome,
        ...(outcome === "failed" ? { reason } : {}),
      };
      entries.push(entry);
      if (entries.length > 50) entries.shift();
      // Never pass the original error, state, credentials or request to console.
      if (outcome === "failed") warn({ ...entry });
    },
    read: () => entries.map(entry => ({ ...entry })),
  };
}
