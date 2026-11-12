export interface CredentialPair {
  Username: string;
  Password: string;
}
export function credentialData(credentials?: Partial<CredentialPair>) {
  let data: Record<string, unknown> = {};
  try {
    const segment = credentials?.Username?.split(".")[1];
    if (segment) {
      const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
      const parsed: unknown = JSON.parse(
        atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
      );
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        data = parsed as Record<string, unknown>;
    }
  } catch {
    /* Opaque usernames are supported; the response TTL still applies. */
  }
  return {
    expiration:
      typeof data["exp"] === "number" &&
      Number.isFinite(data["exp"]) &&
      data["exp"] > 0
        ? data["exp"]
        : 0,
    groups:
      typeof data["grp"] === "string"
        ? data["grp"].split(",").filter(Boolean)
        : [],
    sessionId: typeof data["sid"] === "string" ? data["sid"] : null,
  };
}
export function credentialMayReplace(
  previous?: Partial<CredentialPair>,
  next?: Partial<CredentialPair>,
): boolean {
  if (!previous || !next) return true;
  const old = credentialData(previous),
    fresh = credentialData(next);
  if (old.sessionId !== fresh.sessionId) return true;
  if (old.expiration && fresh.expiration)
    return fresh.expiration > old.expiration;
  return (
    previous.Username !== next.Username || previous.Password !== next.Password
  );
}
