export interface GuardPorts {
    installBlock(): Promise<void>;
    removeBlock(): Promise<void>;
    allow(): Promise<void>;
    revoke(): Promise<void>;
    status(): Promise<{
        armed: boolean;
        blocked: boolean;
    }>;
}
/** Durable block + session-only allowance. Browser restart drops the allowance. */
export declare class NetworkGuard {
    private readonly ports;
    private revision;
    private queue;
    constructor(ports: GuardPorts);
    private serial;
    block(): Promise<void>;
    open(valid: () => Promise<boolean>): Promise<boolean>;
    disarm(current: () => boolean): Promise<void>;
    bootstrap(): Promise<void>;
    status(): Promise<{
        armed: boolean;
        blocked: boolean;
    }>;
}
