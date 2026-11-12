import type { SessionRecord } from "./session";
export interface LoginOptions {
    host: string;
    action?: "signup";
    partnerId?: string;
    independent?: boolean;
}
export interface PendingLogin {
    state: string;
    createdAt: number;
    expiresAt: number;
    claimed?: boolean;
    partnerId?: string;
    independent?: boolean;
}
export interface LoginSession extends SessionRecord {
    persistent?: boolean;
    partnerId?: string;
}
export interface LoginPorts<S extends LoginSession> {
    read(): Promise<PendingLogin | undefined>;
    write(value: PendingLogin): Promise<void>;
    remove(): Promise<void>;
    nonce(): string;
    authorize(state: string, options: LoginOptions): string;
    exchange(selector: string): Promise<S>;
    capture(): number;
    save(session: S, generation: number): Promise<boolean>;
    now?(): number;
}
export declare const accountOrigins: string[];
export declare function isAccountUrl(value: unknown): boolean;
export declare function forkPayload(message: unknown, appId: string): {
    state: string;
    selector: string;
    persistent: boolean;
} | undefined;
/** One worker owns durable login intent, single-use claiming and guarded session commit. */
export declare class LoginFlow<S extends LoginSession> {
    private readonly ports;
    private generation;
    private queue;
    constructor(ports: LoginPorts<S>);
    private serial;
    private now;
    private check;
    private valid;
    begin(options: LoginOptions): Promise<string>;
    owns(state: string): Promise<boolean>;
    complete(input: {
        state: string;
        selector: string;
        persistent?: boolean;
    }): Promise<{
        session: S;
        forkState: PendingLogin;
    }>;
    invalidate(): Promise<void>;
}
