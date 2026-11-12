/** A command invalidates previous async work synchronously, before its first await. */
export declare class ConnectionLifecycle {
    private generation;
    capture(): number;
    advance(): number;
    isCurrent(generation: number): boolean;
    guard(generation?: number): () => boolean;
}
