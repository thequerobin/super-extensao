import type {ProxyConfig, ProxyDetails} from './controller';
import {ProxyControlError} from './controller';

/** Callback errors must be read inside the callback, before runtime.lastError expires. */
export function chromiumProxy(chromeApi: typeof chrome) {
  function call<T>(run: (done: (value: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        run((value) => {
          const error = chromeApi.runtime.lastError;
          if (error) reject(new ProxyControlError('VpnProxyApiError'));
          else resolve(value);
        });
      } catch {
        reject(new ProxyControlError('VpnProxyApiError'));
      }
    });
  }
  const settings = () => {
    if (!chromeApi.proxy?.settings)
      throw new ProxyControlError('VpnProxyUnavailable');
    return chromeApi.proxy.settings;
  };
  return {
    read: () =>
      call<ProxyDetails>((done) =>
        settings().get({incognito: false}, (details) =>
          done(details as unknown as ProxyDetails),
        ),
      ),
    write: (value: ProxyConfig) =>
      call<void>((done) =>
        settings().set(
          {value: value as chrome.proxy.ProxyConfig, scope: 'regular'},
          done,
        ),
      ),
    clear: () =>
      call<void>((done) => settings().clear({scope: 'regular'}, done)),
  };
}
