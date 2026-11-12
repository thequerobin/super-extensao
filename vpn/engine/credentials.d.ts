import { type CredentialPair } from "./credential-data";
export interface TemporaryCredential extends CredentialPair {
    Code: number;
    Expire: number;
}
export interface CredentialSession {
    uid: string;
    generation: number;
}
export interface CredentialCache<C> {
    time?: number;
    credentials?: C;
    sessionUid?: string;
    halfLife?: number;
    renewAt?: number;
}
export type CredentialFailure = "network" | "retryable" | "invalid-token" | "unauthorized" | "logout" | "forbidden" | "fatal";
export interface CredentialPorts<C extends TemporaryCredential> {
    session(): Promise<CredentialSession | undefined>;
    current(session: CredentialSession): boolean;
    read(): Promise<CredentialCache<C>>;
    write(cache: CredentialCache<C>): Promise<void>;
    remove(): Promise<void>;
    authorize(): Promise<unknown>;
    refreshSession(): Promise<unknown>;
    request(attempt: number, signal: AbortSignal): Promise<C | undefined>;
    classify(error: unknown): CredentialFailure;
    updated(credentials: C, current: () => boolean): Promise<void>;
    failed(error: unknown, kind: CredentialFailure): void;
    now?(): number;
    requestTimeoutMs?: number;
}
export declare class CredentialError extends Error {
    readonly code: string;
    constructor(code: string);
}
/** Own cache, expiry, single-flight requests and renewal policy; IO is injected. */
export declare class CredentialManager<C extends TemporaryCredential> {
    private readonly ports;
    private generation;
    private ignoreDisk;
    private writes;
    private memory?;
    private pending?;
    private retry?;
    constructor(ports: CredentialPorts<C>);
    private now;
    private same;
    private current;
    private enqueue;
    cancel(): void;
    clear(): Promise<void>;
    private validCredential;
    private normalized;
    private cachedFor;
    cached(): Promise<CredentialCache<C>>;
    last(): CredentialCache<C> | undefined;
    synchronous(): C | undefined;
    get(allowRefresh?: boolean): Promise<C | undefined>;
    wake(): Promise<void>;
    private renewCurrent;
    private renew;
    private synchronousWithoutRenew;
    private request;
    private fetch;
}
