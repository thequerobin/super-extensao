import { isNotFoundError } from "../api";
import { fetchWithUserInfo } from "../account/fetchWithUserInfo";
import { getCountryAndCoordinates } from "../account/getLocation";
import { warn } from "../log/log";
import { triggerPromise } from "../tools/triggerPromise";
import type { Coordinates } from "../tools/Coordinates";
import type { Logical } from "./Logical";
import { serverCatalog } from "./serverCatalog";
import type { CatalogLease } from "../../../../../vpn/engine/catalog";
import {
	getSortedLogicals,
	isLogicalUp,
	lookups,
	lookupsNotFound,
	recordLogicalInMap,
} from "./getLogicals";
import { Feature } from "./Feature";
import { getLatestCachedStatuses } from "./getLatestCachedStatuses";
import { calculateLogicalScoreAndUpStatus } from "./calculateLogicalScoreAndUpStatus";
import { useLogicalsV2 } from "./useLogicalsV2";

/**
 * Too much IDs stored would lead to longer loading and slower UI, so we cap it.
 */
const maxLookupIdsStored = 1_000;

const recordOnLookupStorage = (
	store: typeof lookupsNotFound | typeof lookups,
	id: string,
) => {
	triggerPromise(
		store.transaction(
			(cache) => {
				// If ID is not yet in cache
				if (!cache.value[id]) {
					const ids = Object.keys(cache.value);

					if (ids.length >= maxLookupIdsStored) {
						// Sort IDs from oldest to newest
						ids.sort((a, b) => cache.value[a]! - cache.value[b]!);
						// We remove older IDs so when we'll add the new ID, it's still exactly maxLookupIdsStored stored
						ids
							.slice(0, ids.length + 1 - maxLookupIdsStored)
							.forEach((oldId) => {
								delete cache.value[oldId];
							});
					}
				}

				cache.value[id] = Date.now();
				cache.time = Date.now();

				return cache;
			},
			{
				value: {} as Record<string, number>,
				time: Date.now(),
			},
		),
	);
};

const pushLogicalToCache = async (
	logical: Logical,
	country: string,
	coordinates: Partial<Coordinates>,
	lease: CatalogLease,
): Promise<void> => {
	isLogicalUp(logical, country, coordinates); // Set _up status
	await serverCatalog.remember(logical, (item) => String(item.ID), lease);
	recordLogicalInMap(logical);
	recordOnLookupStorage(lookups, `${logical.ID}`);
};

const fetchLogicalLookup = async (name: string, init?: RequestInit) => {
	const upperName = name.toUpperCase();
	const notFounds = await lookupsNotFound.get();

	if (notFounds?.value[upperName]) {
		return undefined;
	}

	const lease = await serverCatalog.capture();
	try {
		const { LogicalServer: logical } = await fetchWithUserInfo<{
			LogicalServer: Logical & { Status?: number };
		}>(`vpn/v1/logicals/lookup/${encodeURIComponent(name)}`, init);

		if (!logical) {
			return undefined;
		}

		const { country, coordinates } = await getCountryAndCoordinates();

		if (await useLogicalsV2()) {
			const enabled = Boolean(logical.Status);
			delete logical.Status;
			Object.assign(logical, {
				Visible: true,
				Enabled: enabled,
				AutoConnectable:
					enabled &&
					(logical.Features & (Feature.TOR | Feature.RESTRICTED)) === 0,
			});
			const index = logical.StatusReference.Index;

			if (typeof index === "number") {
				const loads = await getLatestCachedStatuses();

				if (loads[index]) {
					calculateLogicalScoreAndUpStatus(
						Object.assign(logical, loads[index]),
						country,
						coordinates,
					);
				}
			}
		}

		await pushLogicalToCache(logical, country, coordinates, lease);

		return logical;
	} catch (error) {
		if (!isNotFoundError(error)) {
			warn(error);

			throw error;
		}

		recordOnLookupStorage(lookupsNotFound, upperName);

		return undefined;
	}
};

export const lookupLogical = async (name: string, init?: RequestInit) => {
	const logicals = await getSortedLogicals();
	const upperName = name.toLocaleUpperCase();

	return (
		logicals.find(
			(logical) => logical.Name.toLocaleUpperCase() === upperName,
		) || fetchLogicalLookup(name, init)
	);
};
