import { credentialData, type CredentialPair } from "./credential-data";
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
export type CredentialFailure =
  | "network"
  | "retryable"
  | "invalid-token"
  | "unauthorized"
  | "logout"
  | "forbidden"
  | "fatal";
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
export class CredentialError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CredentialError";
  }
}
/** Own cache, expiry, single-flight requests and renewal policy; IO is injected. */
export class CredentialManager<C extends TemporaryCredential> {
  private generation = 0;
  private ignoreDisk = false;
  private writes: Promise<unknown> = Promise.resolve();
  private memory?: {
    session: CredentialSession;
    generation: number;
    cache: CredentialCache<C>;
  };
  private pending?: {
    session: CredentialSession;
    generation: number;
    promise: Promise<C | undefined>;
    abort: AbortController;
  };
  private retry?: {
    session: CredentialSession;
    generation: number;
    at: number;
    count: number;
    kind: CredentialFailure;
    error: unknown;
  };
  constructor(private readonly ports: CredentialPorts<C>) {}
  private now(): number {
    return this.ports.now?.() ?? Date.now();
  }
  private same(a: CredentialSession, b: CredentialSession): boolean {
    return a.uid === b.uid && a.generation === b.generation;
  }
  private current(session: CredentialSession, generation: number): boolean {
    return generation === this.generation && this.ports.current(session);
  }
  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const result = this.writes.then(run);
    this.writes = result.catch(() => undefined);
    return result;
  }
  cancel(): void {
    this.generation++;
    this.memory = undefined;
    this.retry = undefined;
    this.pending?.abort.abort();
    this.pending = undefined;
  }
  clear(): Promise<void> {
    this.cancel();
    this.ignoreDisk = true;
    // Never wait for the session port here: account writes may be awaiting clear.
    return this.enqueue(() => this.ports.remove());
  }
  private validCredential(value: C | undefined): value is C {
    return (
      !!value &&
      value.Code === 1000 &&
      typeof value.Username === "string" &&
      !!value.Username &&
      typeof value.Password === "string" &&
      !!value.Password &&
      Number.isFinite(value.Expire) &&
      value.Expire > 0
    );
  }
  private normalized(
    cache: CredentialCache<C>,
    uid: string,
  ): CredentialCache<C> {
    if (
      cache.sessionUid !== uid ||
      !this.validCredential(cache.credentials) ||
      typeof cache.time !== "number" ||
      !Number.isFinite(cache.time)
    )
      return {};
    const expiration = credentialData(cache.credentials).expiration * 1000;
    const time = Math.min(cache.time, expiration || Infinity);
    if (time <= this.now()) return {};
    const margin = cache.credentials.Expire * 100;
    // Legacy records have no renewAt. Their persisted time remains authoritative.
    const renewAt = Number.isFinite(cache.renewAt)
      ? Math.min(cache.renewAt!, time)
      : time - margin;
    return { ...cache, credentials: { ...cache.credentials }, time, renewAt };
  }
  private async cachedFor(
    session: CredentialSession,
    generation: number,
  ): Promise<CredentialCache<C>> {
    if (!this.current(session, generation)) return {};
    if (
      this.memory &&
      this.memory.generation === generation &&
      this.same(this.memory.session, session)
    ) {
      const value = this.normalized(this.memory.cache, session.uid);
      if (value.credentials) return value;
    }
    await this.writes;
    if (!this.current(session, generation)) return {};
    if (this.ignoreDisk) return {};
    const value = this.normalized(await this.ports.read(), session.uid);
    if (!this.current(session, generation)) return {};
    if (value.credentials) this.memory = { session, generation, cache: value };
    return value;
  }
  async cached(): Promise<CredentialCache<C>> {
    const generation = this.generation,
      session = await this.ports.session();
    return session ? this.cachedFor(session, generation) : {};
  }
  last(): CredentialCache<C> | undefined {
    if (
      !this.memory ||
      !this.current(this.memory.session, this.memory.generation)
    )
      return undefined;
    const cache = this.normalized(this.memory.cache, this.memory.session.uid);
    return cache.credentials ? cache : undefined;
  }
  synchronous(): C | undefined {
    const cache = this.last();
    if (!cache?.credentials) return undefined;
    if (this.now() >= cache.renewAt!) void this.renewCurrent().catch(() => {});
    return { ...cache.credentials };
  }
  async get(allowRefresh = false): Promise<C | undefined> {
    const generation = this.generation,
      session = await this.ports.session();
    if (!session || !this.current(session, generation)) return undefined;
    const cache = await this.cachedFor(session, generation);
    if (!this.current(session, generation)) return undefined;
    if (cache.credentials) {
      if (this.now() >= cache.renewAt!)
        void this.renew(session, generation, allowRefresh).catch(() => {});
      return { ...cache.credentials };
    }
    return this.renew(session, generation, allowRefresh);
  }
  async wake(): Promise<void> {
    const generation = this.generation,
      session = await this.ports.session();
    if (!session || !this.current(session, generation)) return;
    const cache = await this.cachedFor(session, generation);
    if (
      !this.current(session, generation) ||
      (cache.credentials && this.now() < cache.renewAt!)
    )
      return;
    await this.renew(session, generation, true);
  }
  private async renewCurrent(): Promise<C | undefined> {
    const generation = this.generation,
      session = await this.ports.session();
    if (!session || !this.current(session, generation)) return undefined;
    return this.renew(session, generation, true);
  }
  private renew(
    session: CredentialSession,
    generation: number,
    allowRefresh: boolean,
  ): Promise<C | undefined> {
    if (!this.current(session, generation)) return Promise.resolve(undefined);
    if (
      this.pending?.generation === generation &&
      this.same(this.pending.session, session)
    )
      return this.pending.promise;
    if (
      this.retry &&
      this.retry.generation === generation &&
      this.same(this.retry.session, session) &&
      this.now() < this.retry.at
    ) {
      if (this.retry.kind === "network" || this.retry.kind === "retryable")
        return Promise.resolve(this.synchronousWithoutRenew());
      return Promise.reject(this.retry.error);
    }
    const abort = new AbortController();
    const promise = this.fetch(session, generation, allowRefresh, abort);
    const pending = { session, generation, promise, abort };
    this.pending = pending;
    void promise.then(
      () => {
        if (this.pending === pending) this.pending = undefined;
      },
      () => {
        if (this.pending === pending) this.pending = undefined;
      },
    );
    return promise;
  }
  private synchronousWithoutRenew(): C | undefined {
    const value = this.last()?.credentials;
    return value ? { ...value } : undefined;
  }
  private request(
    attempt: number,
    abort: AbortController,
  ): Promise<C | undefined> {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (value?: C, error?: unknown) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        abort.signal.removeEventListener("abort", cancelled);
        if (error) reject(error);
        else resolve(value);
      };
      const cancelled = () =>
        finish(undefined, new CredentialError("VpnCredentialCancelled"));
      const timer = setTimeout(() => {
        finish(undefined, new CredentialError("VpnCredentialRequestTimedOut"));
        abort.abort();
      }, this.ports.requestTimeoutMs ?? 20000);
      abort.signal.addEventListener("abort", cancelled, { once: true });
      if (abort.signal.aborted) {
        cancelled();
        return;
      }
      Promise.resolve()
        .then(() =>
          abort.signal.aborted
            ? undefined
            : this.ports.request(attempt, abort.signal),
        )
        .then(
          (value) => finish(value),
          (error) => finish(undefined, error),
        );
    });
  }
  private async fetch(
    session: CredentialSession,
    generation: number,
    allowRefresh: boolean,
    abort: AbortController,
  ): Promise<C | undefined> {
    const current = () => this.current(session, generation);
    const count =
      this.retry && this.same(this.retry.session, session)
        ? this.retry.count + 1
        : 1;
    try {
      await this.ports.authorize();
      if (!current()) return undefined;
      let credentials: C | undefined;
      try {
        credentials = await this.request(count, abort);
      } catch (error) {
        if (!current()) return undefined;
        const kind = this.ports.classify(error);
        if (
          kind !== "invalid-token" &&
          !(allowRefresh && kind === "unauthorized")
        )
          throw error;
        await this.ports.refreshSession();
        if (!current()) return undefined;
        // Exactly one auth refresh/retry; never clear a valid session to retry.
        credentials = await this.request(count, abort);
      }
      if (!current()) return undefined;
      if (!this.validCredential(credentials))
        throw new CredentialError("VpnInvalidCredentials");
      const now = this.now();
      const expiration = credentialData(credentials).expiration * 1000;
      const time = Math.min(
        now + credentials.Expire * 1000,
        expiration || Infinity,
      );
      if (!Number.isFinite(time) || time <= now)
        throw new CredentialError("VpnExpiredCredentials");
      const cache: CredentialCache<C> = {
        credentials: { ...credentials },
        sessionUid: session.uid,
        time,
        halfLife: now + (time - now) / 2,
        renewAt: now + (time - now) * 0.9,
      };
      const committed = await this.enqueue(async () => {
        if (!current()) return false;
        await this.ports.write(cache);
        if (!current()) return false;
        this.ignoreDisk = false;
        this.memory = { session, generation, cache };
        return true;
      });
      if (!committed || !current()) return undefined;
      this.retry = undefined;
      // Notify only after storage confirms the cache; a late callback is guarded too.
      await this.ports.updated({ ...credentials }, current);
      return current() ? { ...credentials } : undefined;
    } catch (error) {
      if (!current()) return undefined;
      const kind =
        error instanceof CredentialError
          ? error.code === "VpnCredentialRequestTimedOut"
            ? "network"
            : "fatal"
          : this.ports.classify(error);
      this.retry = {
        session,
        generation,
        at: this.now() + Math.min(60000, 1000 * 2 ** Math.min(count - 1, 6)),
        count,
        kind,
        error,
      };
      this.ports.failed(error, kind);
      if (kind === "network" || kind === "retryable")
        return this.synchronousWithoutRenew();
      throw error;
    }
  }
}
