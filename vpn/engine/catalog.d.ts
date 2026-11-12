export interface CatalogCache<T> {
    value: T[];
    time: number;
    lastModified: string | null;
    statusId?: string;
    lastLoadUpdate?: number;
    owner?: string;
}
export interface CatalogContext {
    owner: string;
    revision: string;
}
export interface CatalogLease {
    context: CatalogContext;
    generation: number;
}
export interface CatalogPorts<T> {
    context(): Promise<CatalogContext>;
    current(context: CatalogContext): boolean;
    read(): Promise<CatalogCache<T> | undefined>;
    write(value: CatalogCache<T>): Promise<void>;
    remove(): Promise<void>;
    fetch(cache?: CatalogCache<T>): Promise<CatalogCache<T>>;
    refresh(cache: CatalogCache<T>): Promise<CatalogCache<T>>;
    notModified(error: unknown): boolean;
    transient(error: unknown): boolean;
    freshness(): Promise<number>;
    blockingTTL(): number;
    loadTTL(): Promise<number>;
    compatible(cache: CatalogCache<T>): Promise<boolean>;
    now?(): number;
}
/** Own cache policy: awaited writes, shared refresh, bounded stale data, invalidation guards. */
export declare class ServerCatalog<T> {
    private readonly ports;
    private generation;
    private mutation;
    private mutate;
    private pending;
    constructor(ports: CatalogPorts<T>);
    private now;
    private check;
    private valid;
    private update;
    get(loads?: boolean): Promise<T[]>;
    capture(): Promise<CatalogLease>;
    remember(item: T, id: (value: T) => string, lease: CatalogLease): Promise<void>;
    forget(): Promise<void>;
}
