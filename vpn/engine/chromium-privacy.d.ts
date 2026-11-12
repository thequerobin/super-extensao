import type { PrivacyPorts } from "./webrtc";
/** Native callback errors are consumed before runtime.lastError expires. */
export declare function chromiumPrivacy(api: typeof chrome): PrivacyPorts;
