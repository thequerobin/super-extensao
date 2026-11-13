/** Device policy, user choice and defaults, independent of storage and UI. */
export interface FeatureConfig<T extends object = object> {
  controllable: boolean;
  controlMessage?: string;
  config?: T;
}
export type FeaturePolicies = Record<string, FeatureConfig>;
export interface FeatureConfigPorts {
  managed(): Promise<FeaturePolicies | undefined>;
  bundled(): Promise<FeaturePolicies>;
  managedUnavailable(error: unknown): boolean;
}
export class FeatureConfigStore {
  private value?: FeaturePolicies;
  private pending?: Promise<FeaturePolicies>;
  private revision = 0;
  constructor(private readonly ports: FeatureConfigPorts) {}
  peek(): FeaturePolicies | undefined {
    return this.value;
  }
  set(value: FeaturePolicies | undefined): void {
    this.revision++;
    this.value = value;
    this.pending = undefined;
  }
  private load(): Promise<FeaturePolicies> {
    if (this.value) return Promise.resolve(this.value);
    if (this.pending) return this.pending;
    const revision = this.revision;
    const task = (async () => {
      let managed: FeaturePolicies | undefined;
      try {
        managed = await this.ports.managed();
      } catch (error) {
        if (!this.ports.managedUnavailable(error)) throw error;
      }
      const value = managed ?? (await this.ports.bundled());
      if (revision !== this.revision) return this.load();
      this.value = value;
      return value;
    })();
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
  async get<T extends object = object>(
    name: string,
  ): Promise<FeatureConfig<T>> {
    return {
      controllable: true,
      ...(await this.load())[name],
    } as FeatureConfig<T>;
  }
}
export abstract class ConfiguredFeature<T extends object = object> {
  protected constructor(private readonly policy: FeatureConfig<T>) {}
  static create(): Promise<ConfiguredFeature> {
    throw new Error("Missing static async create() implementation");
  }
  isAvailable(): boolean {
    return true;
  }
  isControllable(): boolean {
    return this.policy.controllable;
  }
  getControlMessage(): string {
    return this.policy.controlMessage ?? this.getDefaultControlMessage();
  }
  abstract getDefaultControlMessage(): string;
  async getConfig(): Promise<T> {
    return (
      (this.isControllable() ? await this.getUserConfig() : undefined) ??
      this.policy.config ??
      this.getDefault()
    );
  }
  abstract getUserConfig(): Promise<T | undefined>;
  abstract getDefault(): T;
}
