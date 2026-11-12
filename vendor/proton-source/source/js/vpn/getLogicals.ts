import { serverCatalog } from "./serverCatalog";
import { sortCatalog } from "../../../../../vpn/engine/selection";
import { serverHealth } from "../../../../../vpn/engine/health";
import { getLoads } from "./getLoads";
import { mergeLoadsIntoLogicals } from "./mergeLoadsIntoLogicals";
import type { Logical } from "./Logical";
import type { Coordinates } from "../tools/Coordinates";
import { triggerPromise } from "../tools/triggerPromise";
import { type CacheWrappedValue, Storage, storage } from "../tools/storage";
import type { BroadcastMessage } from "../tools/broadcastMessage";
import { fetchWithUserInfo } from "../account/fetchWithUserInfo";
import { getLogicalCheckUpRefreshInterval } from "../intervals";
import { logicalServers } from "./logicalServers";
import { isLogicalConnectable } from "./isLogicalConnectable";
import { calculateLogicalScoreAndUpStatus } from "./calculateLogicalScoreAndUpStatus";
import { calculateLogicalUp } from "./calculateLogicalUp";
import { useLogicalsV2 } from "./useLogicalsV2";

export const lookups = storage.item<CacheWrappedValue<Record<string, number>>>(
	"lookups",
	Storage.LOCAL,
);

export const lookupsNotFound = storage.item<
	CacheWrappedValue<Record<string, number>>
>("lookups-not-found", Storage.LOCAL);

const map = new Map<string, Logical>();

export const recordLogicalInMap = (logical: Logical) => {
	map.set(String(logical.ID), logical);
};

export const forgetLogicals = () => {
	map.clear();
	triggerPromise(serverCatalog.forget());
};

export interface BroadcastLogicals extends BroadcastMessage<"logicalUpdate"> {
	data: Logical[];
}

export const loadLoads = (): Promise<Logical[]> => serverCatalog.get(true);

export const getSortedLogicals = async (): Promise<Logical[]> => {
	const logicals = sortCatalog(
		(await serverCatalog.get()).filter(isLogicalConnectable),
	);
	map.clear();

	logicals.forEach(recordLogicalInMap);

	return logicals;
};

export const getLogicalById = (id: Logical["ID"]): Logical | undefined =>
	map.get(String(id));

const isLogicalV2WithServerCapacity = (logical: Logical) =>
	"StatusReference" in logical && "ServerCapacity" in logical;

export const isLogicalUp = (
	logical: Logical,
	userCountry: string,
	userLocation?: Partial<Coordinates>,
): boolean => {
	if (typeof logical._up === "undefined") {
		const updateUp = isLogicalV2WithServerCapacity(logical)
			? (logical: Logical) =>
					calculateLogicalScoreAndUpStatus(logical, userCountry, userLocation) // for logicals v2
			: calculateLogicalUp; // for logicals v1

		updateUp(logical);
	}

	return logical._up as boolean;
};

/**
 * Check from recent API data if a logical is still good to stay connected on it.
 */
export const shouldStayOnLogical = async (
	id: Logical["ID"],
	country: string,
	coordinates: Partial<Coordinates>,
): Promise<boolean> => {
	const useV2 = await useLogicalsV2();

	if (useV2) {
		const cache = await logicalServers.get();
		const loadAge = Date.now() - (cache?.lastLoadUpdate ?? 0);

		if (loadAge <= getLogicalCheckUpRefreshInterval()) {
			const logical = cache?.value?.find((l) => String(l.ID) === String(id));

			if (logical) {
				return serverHealth(logical) !== "down";
			}
		}
	}

	const version = useV2 ? 2 : 1;
	const encodedId = encodeURIComponent(id);
	const { LogicalServers: logicals, StatusID: statusId } =
		await fetchWithUserInfo<{
			LogicalServers: Logical[];
			StatusID?: string;
		}>(`vpn/v${version}/logicals?ID[]=${encodedId}&IncludeID[]=${encodedId}`);

	// v2 logical metadata does not contain health flags until its status data is
	// merged. Do not run the v1 Status test on that incomplete response.
	if (useV2 && statusId) {
		const { loads } = await getLoads(statusId);
		mergeLoadsIntoLogicals(logicals, loads, coordinates, country);
	}
	const logical = logicals.find((item) => String(item.ID) === String(id));
	return serverHealth(logical) !== "down";
};
