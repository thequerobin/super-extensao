export enum WebRTCState {
  CLEAR = "clear",
  DEFAULT = "default",
  DISABLED = "disable_non_proxied_udp",
}
export interface PrivacyDetails {
  value?: string;
  levelOfControl?: string;
}
export interface PrivacyPorts {
  available(): boolean;
  read(): Promise<PrivacyDetails>;
  write(value: WebRTCState.DEFAULT | WebRTCState.DISABLED): Promise<void>;
  clear(): Promise<void>;
}
/** A single worker serializes protection and restoration, including UI requests. */
export class WebRTCProtection {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly ports: PrivacyPorts) {}
  apply(state: WebRTCState): Promise<boolean> {
    if (!Object.values(WebRTCState).includes(state))
      return Promise.reject(new Error("VpnWebRTCInvalidState"));
    const run = async () => {
      if (!this.ports.available()) return false;
      const before = await this.ports.read();
      if (state === WebRTCState.CLEAR) {
        // clear only removes our regular-scope preference, never another extension's.
        await this.ports.clear();
        const after = await this.ports.read();
        if (after.levelOfControl === "controlled_by_this_extension")
          throw new Error("VpnWebRTCRestoreFailed");
        return true;
      }
      if (
        ![
          "controllable_by_this_extension",
          "controlled_by_this_extension",
        ].includes(before.levelOfControl || "")
      )
        throw new Error("VpnWebRTCProtectionUnavailable");
      await this.ports.write(state);
      const after = await this.ports.read();
      if (
        after.levelOfControl !== "controlled_by_this_extension" ||
        after.value !== state
      )
        throw new Error("VpnWebRTCProtectionUnavailable");
      return true;
    };
    const task = this.queue.then(run);
    this.queue = task.catch(() => {});
    return task;
  }
}
