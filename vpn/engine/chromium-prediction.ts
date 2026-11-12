/** Disable speculative DNS/preconnect while the browser proxy is armed. */
export function chromiumPrediction(api: typeof chrome) {
  const setting = () => api.privacy?.network?.networkPredictionEnabled;
  function call<T>(run: (done: (value: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        run((value) => {
          if (api.runtime.lastError)
            reject(new Error("VpnNetworkPredictionFailed"));
          else resolve(value);
        });
      } catch {
        reject(new Error("VpnNetworkPredictionFailed"));
      }
    });
  }
  return {
    async protect(): Promise<void> {
      if (!setting()) throw new Error("VpnNetworkPredictionFailed");
      const before = await call<chrome.types.ChromeSettingGetResult<boolean>>(
        (done) => setting()!.get({ incognito: false }, done),
      );
      if (
        ![
          "controllable_by_this_extension",
          "controlled_by_this_extension",
        ].includes(before.levelOfControl)
      )
        throw new Error("VpnNetworkPredictionFailed");
      await call<void>((done) =>
        setting()!.set({ value: false, scope: "regular" }, done),
      );
      const after = await call<chrome.types.ChromeSettingGetResult<boolean>>(
        (done) => setting()!.get({ incognito: false }, done),
      );
      if (
        after.value !== false ||
        after.levelOfControl !== "controlled_by_this_extension"
      )
        throw new Error("VpnNetworkPredictionFailed");
    },
    async restore(): Promise<void> {
      if (!setting()) return;
      await call<void>((done) => setting()!.clear({ scope: "regular" }, done));
    },
  };
}
