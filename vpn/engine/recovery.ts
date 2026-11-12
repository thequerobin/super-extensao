/** MV3 wake-ups must use alarms; in-memory intervals do not wake a suspended worker. */
export class RecoveryLoop {
  private installed = false;
  private pending?: Promise<void>;
  constructor(
    private readonly ports: {
      listen(wake: () => void): void;
      arm(): Promise<unknown>;
      recover(): Promise<void>;
      failed(error: unknown): void;
    },
  ) {}
  start(): void {
    if (this.installed) return;
    this.installed = true;
    this.ports.listen(() => {
      void this.wake().catch((error) => this.ports.failed(error));
    });
    void this.ports.arm().catch((error) => this.ports.failed(error));
  }
  wake(): Promise<void> {
    if (this.pending) return this.pending;
    const task = Promise.resolve().then(() => this.ports.recover());
    this.pending = task;
    void task.then(
      () => {
        if (this.pending === task) this.pending = undefined;
      },
      () => {
        if (this.pending === task) this.pending = undefined;
      },
    );
    return task;
  }
}
