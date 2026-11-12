export declare class VpnIOError extends Error {
    readonly code: string;
    readonly uncertain: boolean;
    constructor(code: string, uncertain?: boolean);
}
export declare const isVpnIOError: (value: unknown) => value is VpnIOError;
export interface IOClock {
    set(run: () => void, ms: number): unknown;
    clear(timer: unknown): void;
}
/** Bounds the observer, never claims to cancel the underlying native operation. */
export declare function observe<T>(operation: Promise<T>, ms: number, error: VpnIOError, timing?: IOClock): Promise<T>;
/** Mutation timeout rejects its caller but keeps the native lane until actual settlement. */
export declare class StorageLane {
    private readonly timing;
    private tail;
    constructor(timing?: IOClock);
    read<T>(run: () => Promise<T>, ms: number): Promise<T>;
    mutate(run: () => Promise<void>, ms: number): Promise<void>;
}
export declare const readRequests: Set<string>;
export declare class RequestChannel {
    private readonly timing;
    private reads;
    private mutations;
    constructor(timing?: IOClock);
    cancelReads(): void;
    send<T>(type: string, run: () => Promise<T>, ms: number): Promise<T>;
}
