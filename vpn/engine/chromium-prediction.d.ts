/** Disable speculative DNS/preconnect while the browser proxy is armed. */
export declare function predictionIsProtected(details: {
    value?: unknown;
    levelOfControl?: string;
}): boolean;
export declare function chromiumPrediction(api: typeof chrome): {
    protect(): Promise<void>;
    restore(): Promise<void>;
};
