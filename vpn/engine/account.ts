/** Account cache and access policy. No dependency on the provider or browser. */
export interface AccountPlan {
  VPN?: { MaxTier?: number };
}
export function accountTier(user: AccountPlan | undefined): number {
  const tier = user?.VPN?.MaxTier;
  return typeof tier === "number" && Number.isFinite(tier) && tier >= 0
    ? tier
    : 0;
}
export function hasPaidAccess(user: AccountPlan | undefined): boolean {
  return accountTier(user) > 0;
}
export function canAccessServer(
  user: AccountPlan | undefined,
  tier: number,
): boolean {
  return (
    !!user && Number.isFinite(tier) && tier >= 0 && tier <= accountTier(user)
  );
}
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
export class AccountProfile<T> {
  private revision = 0;
  private writes: Promise<unknown> = Promise.resolve();
  private pending?: { key: string; promise: Promise<T | undefined> };
  private forced: number[] = [];
  constructor(private readonly ports: AccountPorts<T>) {}
  private serial<R>(run: () => Promise<R>): Promise<R> {
    const task = this.writes.then(run);
    this.writes = task.catch(() => undefined);
    return task;
  }
  private async current(
    context: AccountContext,
    revision: number,
  ): Promise<void> {
    const next = await this.ports.context();
    if (
      revision !== this.revision ||
      !context.owner ||
      next.owner !== context.owner ||
      next.revision !== context.revision
    )
      throw new Error("VpnAccountChanged");
  }
  private async capture(): Promise<{
    context: AccountContext;
    revision: number;
  }> {
    const revision = this.revision;
    const context = await this.ports.context();
    await this.current(context, revision);
    return { context, revision };
  }
  /** Coalesce only requests from the same login, not merely the same UID. */
  async fetch(): Promise<T | undefined> {
    const { context, revision } = await this.capture();
    const key = JSON.stringify([context.owner, context.revision, revision]);
    if (this.pending?.key === key) return this.pending.promise;
    const promise = (async () => {
      const user = await this.ports.request();
      await this.current(context, revision);
      if (user !== undefined) {
        await this.serial(async () => {
          await this.current(context, revision);
          await this.ports.write({
            user,
            time: this.ports.now(),
            owner: context.owner,
          });
        });
        await this.current(context, revision);
        this.ports.updated?.(user);
      }
      return user;
    })();
    const pending = { key, promise };
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
  private async cached(
    context: AccountContext,
    revision: number,
  ): Promise<AccountCache<T>> {
    await this.writes;
    const cache = await this.ports.read();
    await this.current(context, revision);
    // Legacy records have no owner; logout still invalidates and removes them.
    return cache.owner && cache.owner !== context.owner ? {} : cache;
  }
  private age(cache: AccountCache<T>): number {
    return typeof cache.time === "number" &&
      Number.isFinite(cache.time) &&
      cache.time <= this.ports.now()
      ? this.ports.now() - cache.time
      : Infinity;
  }
  private async background(
    context: AccountContext,
    revision: number,
  ): Promise<void> {
    try {
      await this.ports.access();
      await this.current(context, revision);
      try {
        await this.fetch();
      } catch (error) {
        await this.current(context, revision);
        if (!this.ports.unauthorized(error) || !this.ports.canRefresh(error))
          throw error;
        await this.ports.refresh();
        await this.current(context, revision);
        await this.fetch();
      }
    } catch (error) {
      this.ports.backgroundError(error);
    }
  }
  async load(force = false): Promise<T | undefined> {
    const { context, revision } = await this.capture();
    const cache = await this.cached(context, revision);
    const ttl = await this.ports.freshness();
    await this.current(context, revision);
    const now = this.ports.now();
    this.forced = this.forced.filter((time) => time > now - ttl);
    const refresh =
      force && this.ports.forceAllowed(cache.user) && this.forced.length < 20;
    const age = this.age(cache);
    if (cache.user !== undefined && age < (refresh ? 1000 : ttl))
      return cache.user;
    if (
      !refresh &&
      cache.user !== undefined &&
      age < this.ports.blockingTTL()
    ) {
      void this.background(context, revision);
      return cache.user;
    }
    if (refresh) this.forced.push(now);
    try {
      const user = await this.fetch();
      await this.current(context, revision);
      return user;
    } catch (error) {
      await this.current(context, revision);
      // Authentication failures must reach get() so it can refresh or report them.
      if (cache.user !== undefined && !this.ports.unauthorized(error))
        return cache.user;
      throw error;
    }
  }
  async get(reauthenticate = false, force = false): Promise<T | undefined> {
    const revision = this.revision;
    const context = await this.ports.context();
    if (!context.owner) return undefined;
    await this.current(context, revision);
    await this.ports.access();
    await this.current(context, revision);
    try {
      const user = await this.load(force);
      await this.current(context, revision);
      if (user !== undefined || !reauthenticate) return user;
    } catch (error) {
      await this.current(context, revision);
      if (
        !reauthenticate ||
        !this.ports.unauthorized(error) ||
        !this.ports.canRefresh(error)
      )
        throw error;
    }
    await this.ports.refresh();
    await this.current(context, revision);
    const user = await this.load();
    await this.current(context, revision);
    return user;
  }
  /** Invalidate immediately and order removal after any in-flight cache write. */
  forget(): Promise<void> {
    this.revision++;
    this.forced = [];
    return this.serial(() => this.ports.remove());
  }
}
