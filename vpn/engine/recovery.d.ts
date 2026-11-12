/** MV3 wake-ups must use alarms; in-memory intervals do not wake a suspended worker. */
export declare class RecoveryLoop {
    private readonly ports;
    private installed;
    private pending?;
    constructor(ports: {
        listen(wake: () => void): void;
        arm(): Promise<unknown>;
        recover(): Promise<void>;
        failed(error: unknown): void;
    });
    start(): void;
    wake(): Promise<void>;
}
