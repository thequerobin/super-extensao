import { WebRTCProtection } from "../../../../../vpn/engine/webrtc";
import { chromiumPrivacy } from "../../../../../vpn/engine/chromium-privacy";
export const privacyController = new WebRTCProtection(chromiumPrivacy(chrome));
