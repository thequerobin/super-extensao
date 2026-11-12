import type { LogicalServersCache } from "./logicalServers";
import type { Logical } from "./Logical";
import { fetchWithUserInfo } from "../account/fetchWithUserInfo";
import { calculateLogicalUp } from "./calculateLogicalUp";
export const refreshLogicalLoadsV1 = async (
	cache: LogicalServersCache,
): Promise<LogicalServersCache> => {
	const { LogicalServers: updates } = await fetchWithUserInfo<{
		LogicalServers: Logical[];
	}>("vpn/v1/loads");
	if (!Array.isArray(updates)) throw new Error("VpnCatalogInvalidResponse");
	const byId = new Map(updates.map((item) => [String(item.ID), item]));
	const value = cache.value.map((item) => {
		const update = byId.get(String(item.ID));
		if (!update) return { ...item };
		const next = { ...item, ...update };
		calculateLogicalUp(next);
		return next;
	});
	return { ...cache, value, lastLoadUpdate: Date.now() };
};
