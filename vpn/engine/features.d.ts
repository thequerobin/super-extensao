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
export declare class FeatureConfigStore {
    private readonly ports;
    private value?;
    private pending?;
    private revision;
    constructor(ports: FeatureConfigPorts);
    peek(): FeaturePolicies | undefined;
    set(value: FeaturePolicies | undefined): void;
    private load;
    get<T extends object = object>(name: string): Promise<FeatureConfig<T>>;
}
export declare abstract class ConfiguredFeature<T extends object = object> {
    private readonly policy;
    protected constructor(policy: FeatureConfig<T>);
    static create(): Promise<ConfiguredFeature>;
    isAvailable(): boolean;
    isControllable(): boolean;
    getControlMessage(): string;
    abstract getDefaultControlMessage(): string;
    getConfig(): Promise<T>;
    abstract getUserConfig(): Promise<T | undefined>;
    abstract getDefault(): T;
}
