export type ConnectionStage = "proxy-read" | "network-block" | "credentials" | "credentials-validation" | "proxy-apply" | "tunnel-verification" | "connected";
export type DiagnosticOutcome = "started" | "succeeded" | "failed";
interface Entry {
    time: number;
    stage: ConnectionStage;
    outcome: DiagnosticOutcome;
    reason?: string;
}
/** Local, bounded and deliberately independent of verbose service logs. */
export declare function createConnectionDiagnostics(warn: (entry: Entry) => void, now?: () => number): {
    record(stage: ConnectionStage, outcome: DiagnosticOutcome, error?: unknown): void;
    read: () => {
        time: number;
        stage: ConnectionStage;
        outcome: DiagnosticOutcome;
        reason?: string;
    }[];
};
export {};
