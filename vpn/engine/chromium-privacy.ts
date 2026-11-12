import type { PrivacyDetails, PrivacyPorts } from "./webrtc";
/** Native callback errors are consumed before runtime.lastError expires. */
export function chromiumPrivacy(api: typeof chrome): PrivacyPorts {
  const setting = () => api.privacy?.network?.webRTCIPHandlingPolicy;
  function call<T>(run: (done: (value: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        run((value) => {
          if (api.runtime.lastError)
            reject(new Error("VpnWebRTCSettingsFailed"));
          else resolve(value);
        });
      } catch {
        reject(new Error("VpnWebRTCSettingsFailed"));
      }
    });
  }
  return {
    available: () => !!setting(),
    read: () =>
      call<PrivacyDetails>((done) =>
        setting()!.get({ incognito: false }, done),
      ),
    write: (value) =>
      call<void>((done) => setting()!.set({ value, scope: "regular" }, done)),
    clear: () =>
      call<void>((done) => setting()!.clear({ scope: "regular" }, done)),
  };
}
