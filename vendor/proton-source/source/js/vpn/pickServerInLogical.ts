import type { Logical } from "./Logical";
import { pickEndpoint } from "../../../../../vpn/engine/selection";
export const pickServerInLogical = (logical: Logical | undefined) =>
	pickEndpoint(logical?.Servers || []);
