/** Account cache and access policy. No dependency on the provider or browser. */
export interface AccountPlan {
    VPN?: {
        MaxTier?: number;
    };
}
export declare function accountTier(user: AccountPlan | undefined): number;
export declare function hasPaidAccess(user: AccountPlan | undefined): boolean;
export declare function canAccessServer(user: AccountPlan | undefined, tier: number): boolean;
export interface AccountContext {
    owner: string;
    revision: number;
}
export interface AccountCache<T> {
    time?: number;
    user?: T;
    owner?: string;
}
export interface AccountPorts<T> {
    context(): Promise<AccountContext>;
    read(): Promise<AccountCache<T>>;
    write(cache: AccountCache<T>): Promise<void>;
    remove(): Promise<void>;
    request(): Promise<T | undefined>;
    access(): Promise<unknown>;
    refresh(): Promise<unknown>;
    unauthorized(error: unknown): boolean;
    canRefresh(error: unknown): boolean;
    freshness(): Promise<number>;
    blockingTTL(): number;
    forceAllowed(user: T | undefined): boolean;
    backgroundError(error: unknown): void;
    updated?(user: T): void;
    now(): number;
}
export declare class AccountProfile<T> {
    private readonly ports;
    private revision;
    private writes;
    private pending?;
    private forced;
    constructor(ports: AccountPorts<T>);
    private serial;
    private current;
    private capture;
    /** Coalesce only requests from the same login, not merely the same UID. */
    fetch(): Promise<T | undefined>;
    private cached;
    private age;
    private background;
    load(force?: boolean): Promise<T | undefined>;
    get(reauthenticate?: boolean, force?: boolean): Promise<T | undefined>;
    /** Invalidate immediately and order removal after any in-flight cache write. */
    forget(): Promise<void>;
}
