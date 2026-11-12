export type ServerHealth = "up" | "down" | "unknown";
export interface HealthRecord {
    Enabled?: boolean | number;
    Visible?: boolean;
    Status?: number;
    ServicesDown?: number | null;
    Servers?: HealthRecord[];
}
/** Missing API fields and list visibility are not evidence of a failed endpoint. */
export declare function serverHealth(logical: HealthRecord | undefined): ServerHealth;
