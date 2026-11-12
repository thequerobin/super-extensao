export interface GuardPorts {
  installBlock(): Promise<void>;
  removeBlock(): Promise<void>;
  allow(): Promise<void>;
  revoke(): Promise<void>;
  status(): Promise<{ armed: boolean; blocked: boolean }>;
}
/** Durable block + session-only allowance. Browser restart drops the allowance. */
export class NetworkGuard {
  private revision = 0;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly ports: GuardPorts) {}
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const task = this.queue.then(run);
    this.queue = task.catch(() => {});
    return task;
  }
  block(): Promise<void> {
    this.revision++;
    return this.serial(async () => {
      // Try revocation even if install/readback failed: an old allow must not survive.
      try {
        await this.ports.installBlock();
      } finally {
        await this.ports.revoke();
      }
      const state = await this.ports.status();
      if (!state.armed || !state.blocked)
        throw new Error("VpnTrafficGuardFailed");
    });
  }
  open(valid: () => Promise<boolean>): Promise<boolean> {
    const revision = this.revision;
    return this.serial(async () => {
      if (revision !== this.revision || !(await valid())) return false;
      const before = await this.ports.status();
      if (!before.armed) throw new Error("VpnTrafficGuardFailed");
      if (revision !== this.revision || !(await valid())) return false;
      try {
        await this.ports.allow();
        if (revision !== this.revision || !(await valid())) {
          await this.ports.revoke();
          return false;
        }
        const after = await this.ports.status();
        if (!after.armed || after.blocked)
          throw new Error("VpnTrafficGuardFailed");
        return true;
      } catch (error) {
        await this.ports.revoke();
        throw error;
      }
    });
  }
  disarm(current: () => boolean): Promise<void> {
    this.revision++;
    return this.serial(async () => {
      if (!current()) return;
      await this.ports.revoke();
      if (!current()) return;
      await this.ports.removeBlock();
      if ((await this.ports.status()).armed)
        throw new Error("VpnTrafficGuardFailed");
    });
  }
  async bootstrap(): Promise<void> {
    if ((await this.ports.status()).armed) await this.block();
  }
  status() {
    return this.ports.status();
  }
}
