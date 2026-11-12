/** Super Extensão proxy controller. All browser writes share one queue. */
export interface ProxyConfig {
  mode: string;
  rules?: {
    singleProxy: {scheme: string; host: string; port: number};
    bypassList: string[];
  };
  pacScript?: {data: string};
}
export interface ProxyDetails {
  levelOfControl?: string;
  value?: ProxyConfig;
}
export interface ProxyPorts {
  read(): Promise<ProxyDetails>;
  write(value: ProxyConfig): Promise<void>;
  clear(): Promise<void>;
  prepare(): void;
  protect(): Promise<unknown>;
  restore(): Promise<unknown>;
  attachAuth(): void;
  detachAuth(): void;
  flush(): Promise<unknown>;
}
export class ProxyControlError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ProxyControlError';
  }
}
const owns = (details: ProxyDetails) =>
  details.levelOfControl === 'controlled_by_this_extension';
function equalConfig(
  actual: ProxyConfig | undefined,
  expected: ProxyConfig,
): boolean {
  if (actual?.mode !== expected.mode) return false;
  if (expected.mode === 'pac_script')
    return actual.pacScript?.data === expected.pacScript?.data;
  const a = actual.rules?.singleProxy,
    b = expected.rules?.singleProxy;
  return (
    !!a &&
    !!b &&
    a.host === b.host &&
    a.port === b.port &&
    a.scheme === b.scheme &&
    JSON.stringify([...(actual.rules?.bypassList || [])].sort()) ===
      JSON.stringify([...(expected.rules?.bypassList || [])].sort())
  );
}
export function validateProxyConfig(value: ProxyConfig): void {
  if (value.mode === 'pac_script' && value.pacScript?.data) return;
  const proxy = value.rules?.singleProxy;
  if (
    value.mode !== 'fixed_servers' ||
    !proxy ||
    !['http', 'https'].includes(proxy.scheme) ||
    !/^(?:[a-z\d](?:[a-z\d.-]*[a-z\d])?|\[[a-f\d:]+\])$/i.test(proxy.host) ||
    !Number.isInteger(proxy.port) ||
    proxy.port < 1 ||
    proxy.port > 65535
  ) {
    throw new ProxyControlError('VpnInvalidProxyEndpoint');
  }
}
export class ProxyController {
  private queue: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private effective?: ProxyConfig;
  constructor(private readonly ports: ProxyPorts) {}
  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const task = this.queue.then(run);
    this.queue = task.catch(() => undefined);
    return task;
  }
  /** Also cancels callers still waiting for credentials, through their own guard. */
  invalidate(): void {
    this.generation++;
  }
  private async cleanup(): Promise<void> {
    this.effective = undefined;
    // Do not release auth/WebRTC before the extension's proxy has been removed.
    await this.ports.clear();
    const details = await this.ports.read();
    if (owns(details)) throw new ProxyControlError('VpnProxyClearFailed');
    this.ports.detachAuth();
    await this.ports.restore();
    await this.ports.flush();
  }
  apply(
    value: ProxyConfig,
    guard: () => boolean = () => true,
  ): Promise<boolean> {
    // Capture mutable rule lists before waiting behind an earlier write.
    const config: ProxyConfig = JSON.parse(JSON.stringify(value));
    validateProxyConfig(config);
    const generation = ++this.generation;
    const current = () => generation === this.generation && guard();
    return this.enqueue(async () => {
      if (!current()) return false;
      let touched = false;
      try {
        const details = await this.ports.read();
        if (!current()) return false;
        if (
          ![
            'controllable_by_this_extension',
            'controlled_by_this_extension',
          ].includes(details.levelOfControl || '')
        ) {
          throw new ProxyControlError('VpnProxyControlledElsewhere');
        }
        this.ports.prepare();
        touched = true;
        this.ports.attachAuth();
        await this.ports.protect();
        if (!current()) {
          await this.cleanup();
          return false;
        }
        await this.ports.write(config);
        const applied = await this.ports.read();
        if (!current()) {
          await this.cleanup();
          return false;
        }
        if (!owns(applied) || !equalConfig(applied.value, config))
          throw new ProxyControlError('VpnProxyNotApplied');
        await this.ports.flush();
        if (!current()) {
          await this.cleanup();
          return false;
        }
        this.effective = config;
        return true;
      } catch (error) {
        // Roll back only our setting, never install a system-wide/direct override.
        if (touched) await this.cleanup();
        throw error;
      }
    });
  }
  disconnect(): Promise<boolean> {
    this.invalidate();
    return this.enqueue(async () => {
      await this.cleanup();
      return true;
    });
  }
  async isApplied(): Promise<boolean> {
    const expected = this.effective;
    if (!expected) return false;
    const details = await this.ports.read();
    return (
      this.effective === expected &&
      owns(details) &&
      equalConfig(details.value, expected)
    );
  }
}
