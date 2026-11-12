import { sendMessageTo } from "@vpn-engine/tools/sendMessageTo";
import { mountProtection } from "./blocked";
// The redirect target is web accessible. Embedded copies must stay inert.
if (window.top === window.self) {
  const page = mountProtection(
    document.getElementById("protection"),
    sendMessageTo,
    globalThis.SuperPreferences,
  );
  window.addEventListener("pagehide", () => page.dispose(), { once: true });
}
