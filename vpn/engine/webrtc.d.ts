export declare enum WebRTCState {
    CLEAR = "clear",
    DEFAULT = "default",
    DISABLED = "disable_non_proxied_udp"
}
export interface PrivacyDetails {
    value?: string;
    levelOfControl?: string;
}
export interface PrivacyPorts {
    available(): boolean;
    read(): Promise<PrivacyDetails>;
    write(value: WebRTCState.DEFAULT | WebRTCState.DISABLED): Promise<void>;
    clear(): Promise<void>;
}
/** A single worker serializes protection and restoration, including UI requests. */
export declare class WebRTCProtection {
    private readonly ports;
    private queue;
    constructor(ports: PrivacyPorts);
    apply(state: WebRTCState): Promise<boolean>;
}
