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
export class HttpError extends Error {
  httpStatus: number;
  Code: number;
  Error: string;
  Details?: unknown;
  response?: Response;
  authRetried?: boolean;
  retryAt?: number;
  constructor(
    public readonly code: string,
    status = 0,
    message = code,
    apiCode = status,
  ) {
    super(message);
    this.name =
      code === "VpnHttpNetworkFailed" || code === "VpnHttpTimedOut"
        ? "NetworkError"
        : code === "VpnHttpCancelled" || code === "VpnHttpSessionChanged"
          ? "AbortError"
          : "HttpError";
    this.httpStatus = status;
    this.Code = apiCode;
    this.Error = message;
  }
}
export function retryAfter(response: Response, now: number): number {
  const header = response.headers.get("Retry-After")?.trim();
  const maximum = now + 7 * 86400000;
  if (header && /^\d+$/.test(header))
    return Math.min(maximum, now + Math.max(10, Number(header)) * 1000);
  const date = header && !/^-?\d/.test(header) ? Date.parse(header) : NaN;
  return Number.isFinite(date)
    ? Math.max(now, Math.min(maximum, date))
    : now + 10000;
}
/** HTTP execution independent of Proton/Chromium. No requests, bodies or tokens are logged. */
export class HttpTransport<S extends HttpSession> {
  private readonly limits = new Map<string, HttpCooldown>();
  private readonly routes: { template: string; pattern: RegExp }[];
  constructor(private readonly ports: HttpPorts<S>) {
    this.routes = (ports.routes || []).map((template) => ({
      template,
      pattern: new RegExp(
        "^" +
          template
            .split(/(\{[^}]+\})/)
            .map((part) =>
              part.startsWith("{")
                ? "[^/]+"
                : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            )
            .join("") +
          "$",
      ),
    }));
  }
  private now(): number {
    return this.ports.now?.() ?? Date.now();
  }
  private target(path: string, base?: string): URL {
    try {
      const root = new URL(this.ports.baseUrl),
        url = new URL(path.replace(/^\/(?!\/)/, ""), base || root.href);
      if (
        url.origin !== root.origin ||
        url.protocol !== "https:" ||
        url.username ||
        url.password
      )
        throw Error();
      return url;
    } catch {
      throw new HttpError("VpnHttpInvalidUrl");
    }
  }
  private route(url: URL, method: string): string {
    const root = new URL(this.ports.baseUrl);
    const path = url.pathname.startsWith(root.pathname)
      ? url.pathname.slice(root.pathname.length)
      : url.pathname;
    return (
      method +
      " " +
      url.origin +
      " " +
      (this.routes.find((route) => route.pattern.test(path))?.template || path)
    );
  }
  private scope(session: S, url: URL, method: string): string {
    return JSON.stringify([session.uid || "", this.route(url, method)]);
  }
  private async limited(key: string): Promise<HttpCooldown | undefined> {
    const saved = await this.ports.cooldown?.get(key),
      memory = this.limits.get(key);
    const result =
      saved && (!memory || saved.until > memory.until) ? saved : memory;
    if (
      result &&
      [429, 503].includes(result.status) &&
      Number.isFinite(result.until) &&
      result.until > this.now() &&
      result.until <= this.now() + 7 * 86400000
    )
      return result;
    this.limits.delete(key);
    return undefined;
  }
  private async remember(key: string, response: Response): Promise<void> {
    if (response.status !== 429 && response.status !== 503) return;
    const value = {
      until: retryAfter(response, this.now()),
      status: response.status,
    };
    const previous = this.limits.get(key);
    if (previous && previous.until > value.until) return;
    this.limits.set(key, value);
    if (this.limits.size > 128)
      this.limits.delete(this.limits.keys().next().value!);
    await this.ports.cooldown?.set(key, value);
  }
  private throttled(value: HttpCooldown): Response {
    return new Response(
      JSON.stringify({
        Code: value.status,
        Error: "Service temporarily unavailable",
      }),
      {
        status: value.status,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(
            Math.max(0, Math.ceil((value.until - this.now()) / 1000)),
          ),
        },
      },
    );
  }
  private async execute<T>(
    init: RequestInit | undefined,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const abort = new AbortController();
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (value?: T, error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        init?.signal?.removeEventListener("abort", cancelled);
        if (error) reject(error);
        else resolve(value as T);
      };
      const cancelled = () => {
        finish(undefined, new HttpError("VpnHttpCancelled"));
        abort.abort();
      };
      const timer = setTimeout(() => {
        finish(undefined, new HttpError("VpnHttpTimedOut"));
        abort.abort();
      }, this.ports.timeoutMs ?? 20000);
      init?.signal?.addEventListener("abort", cancelled, { once: true });
      if (init?.signal?.aborted) {
        cancelled();
        return;
      }
      Promise.resolve()
        .then(() => run(abort.signal))
        .then(
          (value) => finish(value),
          (error) => finish(undefined, error),
        );
    });
  }
  private check(session: S, signal: AbortSignal, explicit: boolean): void {
    if (signal.aborted) throw new HttpError("VpnHttpCancelled");
    if (!explicit && !this.ports.current(session))
      throw new HttpError("VpnHttpSessionChanged");
  }
  private async buffer(
    response: Response,
    session: S,
    signal: AbortSignal,
    explicit: boolean,
  ): Promise<ArrayBuffer> {
    if (!response.body) return response.arrayBuffer();
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let length = 0;
    const cancel = () => {
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      while (true) {
        this.check(session, signal, explicit);
        const part = await reader.read();
        this.check(session, signal, explicit);
        if (part.done) break;
        chunks.push(part.value);
        length += part.value.length;
      }
    } finally {
      signal.removeEventListener("abort", cancel);
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes.buffer;
  }
  private async send(
    url: URL,
    init: RequestInit,
    session: S,
    signal: AbortSignal,
    explicit: boolean,
  ): Promise<Response> {
    this.check(session, signal, explicit);
    const method = (init.method || "GET").toUpperCase(),
      key = this.scope(session, url, method);
    const limit = await this.limited(key);
    this.check(session, signal, explicit);
    if (limit) return this.throttled(limit);
    const headers = new Headers(await this.ports.headers(session));
    this.check(session, signal, explicit);
    const custom = new Headers(init.headers);
    if (
      !explicit &&
      custom.has("x-pm-uid") &&
      custom.get("x-pm-uid") !== session.uid
    )
      throw new HttpError("VpnHttpSessionChanged");
    custom.forEach((value, name) => headers.set(name, value));
    if (!headers.has("x-pm-uid") && !headers.has("authorization"))
      new Headers(this.ports.authorization(session)).forEach((value, name) =>
        headers.set(name, value),
      );
    let response: Response;
    try {
      response = await this.ports.fetch(url.href, {
        ...init,
        method,
        headers,
        signal,
        mode: "cors",
        credentials: "include",
        redirect: "error",
      });
      this.check(session, signal, explicit);
      if (response.url && new URL(response.url).origin !== url.origin)
        throw new HttpError("VpnHttpInvalidUrl");
      // Buffer within the deadline, so a stalled body cannot outlive request timeout.
      const bytes = await this.buffer(response, session, signal, explicit);
      this.check(session, signal, explicit);
      const copy = new Response(
        [204, 205, 304].includes(response.status) ? null : bytes,
        {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        },
      );
      Object.defineProperty(copy, "url", { value: response.url || url.href });
      await this.remember(key, copy);
      this.check(session, signal, explicit);
      return copy;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (signal.aborted) throw new HttpError("VpnHttpCancelled");
      throw new HttpError("VpnHttpNetworkFailed");
    }
  }
  raw(
    path: string,
    init: RequestInit = {},
    base?: string,
    explicitSession?: S,
  ): Promise<Response> {
    init = { ...init, headers: new Headers(init.headers) };
    const url = this.target(path, base);
    return this.execute(init, async (signal) => {
      const session = explicitSession || (await this.ports.session());
      return this.send(url, init, session, signal, !!explicitSession);
    });
  }
  private async failure(response: Response): Promise<HttpError> {
    let data: { Code?: unknown; Error?: unknown; Details?: unknown } = {};
    const text = await response.clone().text();
    if (/^\s*</.test(text) && this.ports.blocked)
      throw this.ports.blocked(text);
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        data = parsed;
    } catch {
      /* Do not expose unknown response bodies. */
    }
    const error = new HttpError(
      "VpnHttpRejected",
      response.status,
      typeof data.Error === "string"
        ? data.Error
        : "Service temporarily unavailable",
      typeof data.Code === "number" && Number.isFinite(data.Code)
        ? data.Code
        : response.status,
    );
    error.Details = data.Details;
    error.response = response;
    if (response.status === 429 || response.status === 503)
      error.retryAt = retryAfter(response, this.now());
    return error;
  }
  json<T, D = unknown>(
    path: string,
    init: RequestInit = {},
    base?: string,
    builder?: (response: Response, data: D) => T,
  ): Promise<T> {
    init = { ...init, headers: new Headers(init.headers) };
    const url = this.target(path, base);
    return this.execute(init, async (signal) => {
      let session = await this.ports.session();
      this.check(session, signal, false);
      const method = (init.method || "GET").toUpperCase(),
        custom = new Headers(init.headers);
      const root = new URL(this.ports.baseUrl),
        relative = url.pathname.startsWith(root.pathname)
          ? url.pathname.slice(root.pathname.length)
          : url.pathname;
      const mayRetry =
        ["GET", "HEAD"].includes(method) &&
        !/^\/?auth(?:\/|$)/.test(relative) &&
        !custom.has("authorization") &&
        !custom.has("x-pm-uid");
      let retried = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await this.send(url, init, session, signal, false);
        if (response.status < 200 || response.status >= 300) {
          const error = await this.failure(response);
          this.check(session, signal, false);
          error.authRetried = retried;
          if (
            attempt === 0 &&
            mayRetry &&
            error.httpStatus === 401 &&
            error.Code === 401 &&
            session.uid &&
            session.accessToken
          ) {
            const original = session;
            let next: S;
            try {
              next = await this.ports.refresh(original);
            } catch (refreshError) {
              this.check(original, signal, false);
              if (refreshError && typeof refreshError === "object") {
                (refreshError as { authRetried?: boolean }).authRetried = true;
                throw refreshError;
              }
              const failure = new HttpError(
                "VpnHttpRejected",
                401,
                "Service temporarily unavailable",
                401,
              );
              failure.authRetried = true;
              throw failure;
            }
            this.check(original, signal, false);
            retried = true;
            if (next.uid !== original.uid)
              throw new HttpError("VpnHttpSessionChanged");
            if (next.accessToken && next.accessToken !== original.accessToken) {
              session = next;
              continue;
            }
            error.authRetried = true;
          }
          throw error;
        }
        let data: unknown;
        const type = response.headers
          .get("Content-Type")
          ?.split(";")[0]
          ?.trim()
          .toLowerCase();
        if (type === "application/octet-stream")
          data = await response.clone().arrayBuffer();
        else {
          const text = await response.clone().text();
          if (/^\s*</.test(text) && this.ports.blocked)
            throw this.ports.blocked(text);
          if (!text && [204, 205].includes(response.status)) data = undefined;
          else {
            try {
              data = JSON.parse(text);
            } catch {
              throw new HttpError(
                "VpnHttpInvalidResponse",
                response.status,
                "Service temporarily unavailable",
                503,
              );
            }
          }
        }
        this.check(session, signal, false);
        return builder ? builder(response, data as D) : (data as T);
      }
      throw new HttpError("VpnHttpRejected");
    });
  }
}
