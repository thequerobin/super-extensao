/** Token persistence/rotation independent of Proton's transport and fork protocol. */
export interface SessionRecord {
    uid?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
}
export interface SessionPorts<T extends SessionRecord> {
    read(): Promise<T>;
    write(session: T): Promise<void>;
    remove(): Promise<void>;
    changed(): Promise<unknown>;
}
export declare class SessionStore<T extends SessionRecord> {
    private readonly ports;
    private generation;
    private writes;
    private pending?;
    constructor(ports: SessionPorts<T>);
    private enqueue;
    capture(): number;
    saveIfCurrent(value: T, generation: number): Promise<boolean>;
    read(): Promise<T>;
    save(value: T): Promise<void>;
    /** Invalidation is immediate, while removal and later saves remain ordered. */
    clear(): Promise<T>;
    refresh(request: (session: T) => Promise<T>, expected?: T): Promise<T>;
}
