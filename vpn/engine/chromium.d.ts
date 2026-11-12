import type { ProxyConfig, ProxyDetails } from './controller';
/** Callback errors must be read inside the callback, before runtime.lastError expires. */
export declare function chromiumProxy(chromeApi: typeof chrome): {
    read: () => Promise<ProxyDetails>;
    write: (value: ProxyConfig) => Promise<void>;
    clear: () => Promise<void>;
};
