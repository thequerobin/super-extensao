/** Public worker snapshot. No tokens, proxy credentials or internal endpoint. */
export declare function connectionView(current: {
    name?: string;
    data?: {
        server?: Record<string, unknown>;
        error?: unknown;
        blocked?: boolean;
    };
}, confirmed: boolean, errorMessage?: string): {
    signedIn: boolean;
    state: {
        error?: {
            message: string;
        } | undefined;
        state: string;
        server: {
            [k: string]: unknown;
        } | undefined;
    };
};
