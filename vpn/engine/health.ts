export type ServerHealth = "up" | "down" | "unknown";
export interface HealthRecord {
  Enabled?: boolean | number;
  Visible?: boolean;
  Status?: number;
  ServicesDown?: number | null;
  Servers?: HealthRecord[];
}

/** Missing API fields and list visibility are not evidence of a failed endpoint. */
export function serverHealth(logical: HealthRecord | undefined): ServerHealth {
  if (!logical) return "unknown";
  if (
    logical.Enabled === false ||
    logical.Enabled === 0 ||
    logical.Status === 0
  )
    return "down";
  if (logical.Servers?.length) {
    const states = logical.Servers.map((server): ServerHealth => {
      if (
        server.Enabled === false ||
        server.Enabled === 0 ||
        server.Status === 0 ||
        (typeof server.ServicesDown === "number" &&
          (server.ServicesDown & 3) !== 0)
      )
        return "down";
      return typeof server.Status === "number" && server.Status > 0
        ? "up"
        : "unknown";
    });
    if (states.includes("up")) return "up";
    return states.every((state) => state === "down") ? "down" : "unknown";
  }
  if (logical.Enabled === true || logical.Enabled === 1) return "up";
  return "unknown";
}
