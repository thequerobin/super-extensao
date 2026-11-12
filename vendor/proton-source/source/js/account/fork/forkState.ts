import type { PendingLogin } from "../../../../../../vpn/engine/login";
export type ForkState = Pick<PendingLogin, "independent" | "partnerId">;
