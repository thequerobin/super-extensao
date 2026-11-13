import { ConnectionLifecycle } from "./lifecycle";
import type { ConnectionStage, DiagnosticOutcome } from "./diagnostics";
export interface CredentialPair {
    Username: string;
    Password: string;
}
export interface StateServer {
    name: string;
}
export interface ConnectionData<S> {
    server?: S;
    error?: unknown;
    credsData?: CredentialPair;
    credsTry?: number;
    starting?: boolean;
    blocked?: boolean;
}
export interface MachineState<S> {
    name: "on" | "off" | "loggedout";
    initializedAt: number;
    proxyEnabled: boolean;
    data: ConnectionData<S>;
}
export type ConnectionPhase = "connecting" | "blocked" | "connected" | "disconnected" | "logged-out";
export interface StatePorts<S extends StateServer, C extends CredentialPair> {
    readServer(): Promise<S | undefined>;
    saveServer(server?: S): Promise<unknown>;
    signedIn(): Promise<boolean>;
    autoConnect(): Promise<void>;
    invalidate(): void;
    cancelCredentials(): void;
    loadCredentials(): Promise<C | undefined>;
    getCredentials(): Promise<C | undefined>;
    credentialsValid(): Promise<boolean>;
    mayReplace(previous: CredentialPair | undefined, next: C): boolean;
    apply(server: S, current: () => boolean): Promise<boolean>;
    hold?(): Promise<void>;
    resume?(current: () => boolean): Promise<boolean>;
    privacyWarning?(error: unknown): void;
    hasProxy(): Promise<boolean>;
    clearProxy(): Promise<unknown>;
    probe(server: S, current: () => boolean): Promise<void>;
    probeInterval(): number;
    activity(): Promise<unknown>;
    activityInterval(): number;
    isNetworkError(error: unknown): boolean;
    networkWarning(): unknown;
    error(code: "missing-server" | "proxy-unavailable" | "timeout"): unknown;
    changed(state: MachineState<S>): void;
    present(phase: ConnectionPhase, state: MachineState<S>): void;
    connected(server: S, notify: boolean): void;
    disconnected(error?: unknown): void;
    failed(error: unknown): void;
    now?(): number;
    diagnostic?(stage: ConnectionStage, outcome: DiagnosticOutcome, error?: unknown): void;
    timing?: {
        set(run: () => void, ms: number): unknown;
        clear(timer: unknown): void;
    };
}
/** Own connection intent, transitions and recovery. Service and browser IO are ports. */
export declare class ConnectionMachine<S extends StateServer, C extends CredentialPair> {
    private readonly ports;
    readonly lifecycle: ConnectionLifecycle;
    private state?;
    private boot?;
    private persistence;
    private attempt?;
    private recovery?;
    private probing?;
    private cleanupNeeded?;
    private cleanup?;
    private lastProbe;
    private lastActivity;
    private notified;
    private retryRequested;
    private lastRetry;
    private retryNotBefore;
    private connectingAt?;
    private pending;
    private stage;
    constructor(ports: StatePorts<S, C>);
    private now;
    private enter;
    private valid;
    private invalidate;
    private bounded;
    peek(): MachineState<S> | undefined;
    get(): MachineState<S>;
    ready(): Promise<void>;
    private restore;
    private transition;
    private clearDisconnected;
    logIn(): void;
    logOut(): void;
    disconnect(error?: unknown): void;
    connect(data: ConnectionData<S>, previousName?: string): Promise<void>;
    private activate;
    reconfigure(update: (server: S) => S): Promise<void>;
    setCredentials(credentials?: C): void;
    connectCurrentServer(): Promise<boolean>;
    private apply;
    refresh(): Promise<void>;
    private recover;
    private probe;
    private connectionFailed;
    networkFailed(error: unknown, warning?: unknown): void;
    retryConnection(): Promise<void>;
    checkConnectingState(): void;
}
