import type { LogicalServersCache } from "./logicalServers";
import { getLoads } from "./getLoads";
import { getCountryAndCoordinates } from "../account/getLocation";
import { mergeLoadsIntoLogicals } from "./mergeLoadsIntoLogicals";
export const refreshLogicalLoadsV2 = async (
	cache: LogicalServersCache,
): Promise<LogicalServersCache> => {
	if (!cache.statusId) throw new Error("VpnCatalogMissingStatus");
	const { loads, time } = await getLoads(cache.statusId);
	const { coordinates, country } = await getCountryAndCoordinates();
	const value = cache.value.map((item) => ({ ...item }));
	mergeLoadsIntoLogicals(value, loads, coordinates, country);
	return { ...cache, value, lastLoadUpdate: time };
};
