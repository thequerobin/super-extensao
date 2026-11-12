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
export class ServerCatalog<T> {
  private generation = 0;
  private mutation: Promise<void> = Promise.resolve();
  private mutate(run: () => Promise<void>): Promise<void> {
    const task = this.mutation.then(run);
    this.mutation = task.catch(() => {});
    return task;
  }
  private pending = new Map<string, Promise<CatalogCache<T>>>();
  constructor(private readonly ports: CatalogPorts<T>) {}
  private now(): number {
    return this.ports.now?.() ?? Date.now();
  }
  private check(context: CatalogContext, generation: number): void {
    if (generation !== this.generation || !this.ports.current(context))
      throw new Error("VpnCatalogChanged");
  }
  private valid(
    cache: CatalogCache<T> | undefined,
    context: CatalogContext,
  ): cache is CatalogCache<T> {
    return (
      !!cache &&
      cache.owner === context.owner &&
      Array.isArray(cache.value) &&
      Number.isFinite(cache.time) &&
      cache.time <= this.now()
    );
  }
  private update(
    context: CatalogContext,
    generation: number,
    cache: CatalogCache<T> | undefined,
    loads: boolean,
  ): Promise<CatalogCache<T>> {
    const key = JSON.stringify([context.owner, context.revision, generation]);
    const active = this.pending.get(key);
    if (active) return active;
    const promise = (async () => {
      this.check(context, generation);
      let next: CatalogCache<T>;
      try {
        next =
          loads && cache
            ? await this.ports.refresh(cache)
            : await this.ports.fetch(cache);
      } catch (error) {
        this.check(context, generation);
        if (cache && !loads && this.ports.notModified(error))
          next = { ...cache, time: this.now() };
        else if (
          cache &&
          this.ports.transient(error) &&
          this.now() - cache.time <= this.ports.blockingTTL() + 86400000
        )
          return cache;
        else throw error;
      }
      this.check(context, generation);
      if (
        !next ||
        !Array.isArray(next.value) ||
        !Number.isFinite(next.time) ||
        next.time > this.now()
      )
        throw new Error("VpnCatalogInvalidResponse");
      const value = { ...next, owner: context.owner };
      await this.mutate(async () => {
        this.check(context, generation);
        await this.ports.write(value);
      });
      this.check(context, generation);
      return value;
    })();
    this.pending.set(key, promise);
    // Both handlers return normally so a background failure never becomes unhandled.
    void promise.then(
      () => {
        if (this.pending.get(key) === promise) this.pending.delete(key);
      },
      () => {
        if (this.pending.get(key) === promise) this.pending.delete(key);
      },
    );
    return promise;
  }
  async get(loads = false): Promise<T[]> {
    const generation = this.generation,
      context = await this.ports.context();
    this.check(context, generation);
    const saved = await this.ports.read();
    this.check(context, generation);
    const cache = this.valid(saved, context) ? saved : undefined;
    const compatible = cache && (await this.ports.compatible(cache));
    this.check(context, generation);
    if (!cache || !compatible)
      return (await this.update(context, generation, undefined, false)).value;
    const age = this.now() - cache.time;
    if (age >= this.ports.blockingTTL())
      return (await this.update(context, generation, cache, false)).value;
    const threshold = loads
      ? await this.ports.loadTTL()
      : await this.ports.freshness();
    this.check(context, generation);
    const loadTime =
      Number.isFinite(cache.lastLoadUpdate) &&
      cache.lastLoadUpdate! <= this.now()
        ? cache.lastLoadUpdate!
        : cache.time;
    const updateAge = loads ? this.now() - loadTime : age;
    if (updateAge >= threshold) {
      if (loads)
        return (await this.update(context, generation, cache, true)).value;
      void this.update(context, generation, cache, false).catch(() => {});
    }
    return cache.value;
  }
  async capture(): Promise<CatalogLease> {
    const generation = this.generation,
      context = await this.ports.context();
    this.check(context, generation);
    return { context, generation };
  }
  async remember(
    item: T,
    id: (value: T) => string,
    lease: CatalogLease,
  ): Promise<void> {
    const { context, generation } = lease;
    await this.mutate(async () => {
      this.check(context, generation);
      const cache = await this.ports.read();
      this.check(context, generation);
      if (!this.valid(cache, context)) return;
      const value = [
        ...cache.value.filter((value) => id(value) !== id(item)),
        item,
      ];
      await this.ports.write({ ...cache, value });
      this.check(context, generation);
    });
  }
  async forget(): Promise<void> {
    this.generation++;
    this.pending.clear();
    await this.mutate(() => this.ports.remove());
  }
}
