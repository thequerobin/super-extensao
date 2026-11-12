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
export class SessionStore<T extends SessionRecord> {
  private generation = 0;
  private writes: Promise<unknown> = Promise.resolve();
  private pending?: { generation: number; promise: Promise<T> };
  constructor(private readonly ports: SessionPorts<T>) {}
  private enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const task = this.writes.then(operation);
    this.writes = task.catch(() => undefined);
    return task;
  }
  capture(): number {
    return this.generation;
  }
  async saveIfCurrent(value: T, generation: number): Promise<boolean> {
    if (generation !== this.generation) return false;
    const saved = this.save(value);
    const nextGeneration = this.generation;
    await saved;
    return nextGeneration === this.generation;
  }
  async read(): Promise<T> {
    await this.writes;
    return this.ports.read();
  }
  save(value: T): Promise<void> {
    this.generation++;
    const next = { ...value };
    return this.enqueue(async () => {
      const previous = await this.ports.read();
      await this.ports.write(next);
      if (previous.uid !== next.uid) await this.ports.changed();
    });
  }
  /** Invalidation is immediate, while removal and later saves remain ordered. */
  clear(): Promise<T> {
    this.generation++;
    return this.enqueue(async () => {
      // A failed read must never suppress the queued logout removal.
      const previous = await this.ports.read().catch(() => ({}) as T);
      try {
        await this.ports.remove();
      } finally {
        await this.ports.changed();
      }
      return previous;
    });
  }
  refresh(request: (session: T) => Promise<T>, expected?: T): Promise<T> {
    const generation = this.generation;
    if (this.pending?.generation === generation) return this.pending.promise;
    const promise = (async () => {
      const original = await this.read();
      const matches = (value: T) =>
        value.uid === original.uid &&
        value.accessToken === original.accessToken &&
        value.refreshToken === original.refreshToken;
      if (generation !== this.generation || (expected && !matches(expected)))
        return this.read();
      if (!original.uid || !original.refreshToken)
        throw new Error("VpnSessionUnavailable");
      let next: T;
      try {
        next = await request({ ...original });
      } catch (error) {
        const latest = await this.read();
        if (generation !== this.generation || !matches(latest)) return latest;
        throw error;
      }
      return this.enqueue(async () => {
        const latest = await this.ports.read();
        if (generation !== this.generation || !matches(latest)) return latest;
        if (
          next.uid !== original.uid ||
          !next.accessToken ||
          !next.refreshToken
        )
          throw new Error("VpnInvalidSessionResponse");
        delete next.expiresAt;
        await this.ports.write(next);
        return next;
      });
    })();
    const task = { generation, promise };
    this.pending = task;
    // finally() creates another rejected promise; handle both outcomes explicitly.
    void promise.then(
      () => {
        if (this.pending === task) this.pending = undefined;
      },
      () => {
        if (this.pending === task) this.pending = undefined;
      },
    );
    return promise;
  }
}
