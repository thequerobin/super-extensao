export interface HttpSession {
    uid?: string;
    accessToken?: string;
    expiresAt?: number;
    generation?: number;
}
export interface HttpCooldown {
    until: number;
    status: number;
}
export interface HttpPorts<S extends HttpSession> {
    baseUrl: string;
    fetch(url: string, init: RequestInit): Promise<Response>;
    session(): Promise<S>;
    current(session: S): boolean;
    refresh(session: S): Promise<S>;
    headers(session: S): Promise<HeadersInit>;
    authorization(session: S): HeadersInit;
    routes?: string[];
    cooldown?: {
        get(key: string): Promise<HttpCooldown | undefined>;
        set(key: string, value: HttpCooldown): Promise<void>;
    };
    blocked?(html: string): Error;
    timeoutMs?: number;
    now?(): number;
}
export declare class HttpError extends Error {
    readonly code: string;
    httpStatus: number;
    Code: number;
    Error: string;
    Details?: unknown;
    response?: Response;
    authRetried?: boolean;
    retryAt?: number;
    constructor(code: string, status?: number, message?: string, apiCode?: number);
}
export declare function retryAfter(response: Response, now: number): number;
/** HTTP execution independent of Proton/Chromium. No requests, bodies or tokens are logged. */
export declare class HttpTransport<S extends HttpSession> {
    private readonly ports;
    private readonly limits;
    private readonly routes;
    constructor(ports: HttpPorts<S>);
    private now;
    private target;
    private route;
    private scope;
    private limited;
    private remember;
    private throttled;
    private execute;
    private check;
    private buffer;
    private send;
    raw(path: string, init?: RequestInit, base?: string, explicitSession?: S): Promise<Response>;
    private failure;
    json<T, D = unknown>(path: string, init?: RequestInit, base?: string, builder?: (response: Response, data: D) => T): Promise<T>;
}
