/** Super Extensão proxy controller. All browser writes share one queue. */
export interface ProxyConfig {
    mode: string;
    rules?: {
        singleProxy: {
            scheme: string;
            host: string;
            port: number;
        };
        bypassList: string[];
    };
    pacScript?: {
        data: string;
    };
}
export interface ProxyDetails {
    levelOfControl?: string;
    value?: ProxyConfig;
}
export interface ProxyPorts {
    read(): Promise<ProxyDetails>;
    write(value: ProxyConfig): Promise<void>;
    clear(): Promise<void>;
    prepare(): void;
    protect(): Promise<unknown>;
    restore(): Promise<unknown>;
    attachAuth(): void;
    detachAuth(): void;
    flush(): Promise<unknown>;
}
export declare class ProxyControlError extends Error {
    readonly code: string;
    constructor(code: string);
}
export declare function validateProxyConfig(value: ProxyConfig): void;
export declare class ProxyController {
    private readonly ports;
    private queue;
    private generation;
    private effective?;
    constructor(ports: ProxyPorts);
    private enqueue;
    /** Also cancels callers still waiting for credentials, through their own guard. */
    invalidate(): void;
    private cleanup;
    apply(value: ProxyConfig, guard?: () => boolean): Promise<boolean>;
    disconnect(): Promise<boolean>;
    isApplied(): Promise<boolean>;
}
