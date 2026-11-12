import { ServerCatalog } from "../../../../../vpn/engine/catalog";
import { sessionStore } from "../account/sessionStore";
import { readSession } from "../account/readSession";
import { loadCachedUser } from "../account/user/loadCachedUser";
import { getElapsedMillisecondsSinceLastActivity } from "../tools/activity";
import { storage } from "../tools/storage";
import { isNotModified, isNetworkError } from "../api";
import { getLogicalsTTL, getLogicalsBlockingUpdateTTL } from "../intervals";
import { logicalServers } from "./logicalServers";
import type { Logical } from "./Logical";
import { useLogicalsV2 } from "./useLogicalsV2";
import { fetchLogicalsV1 } from "./fetchLogicalsV1";
import { fetchLogicalsV2 } from "./fetchLogicalsV2";
import { refreshLogicalLoadsV1 } from "./refreshLogicalLoadsV1";
import { refreshLogicalLoadsV2 } from "./refreshLogicalLoadsV2";
import { getLoadsMaxAge } from "./getLoadsMaxAge";
function accessFingerprint(value: unknown): string {
	const data = value as
		| {
				user?: {
					User?: { VPN?: { MaxTier?: number; Groups?: string[] } };
					VPN?: { MaxTier?: number; Groups?: string[] };
				};
		  }
		| undefined;
	const vpn = data?.user?.VPN || data?.user?.User?.VPN;
	return JSON.stringify([vpn?.MaxTier, [...(vpn?.Groups || [])].sort()]);
}
let revision = 0;
chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "local") return;
	const session = changes["superVpn:session"] as
		| { oldValue?: { uid?: string }; newValue?: { uid?: string } }
		| undefined;
	const user = changes["superVpn:user"] as
		| {
				oldValue?: { user?: { VPN?: unknown } };
				newValue?: { user?: { VPN?: unknown } };
		  }
		| undefined;
	if (
		(session && session.oldValue?.uid !== session.newValue?.uid) ||
		(user &&
			accessFingerprint(user.oldValue) !== accessFingerprint(user.newValue))
	)
		revision++;
});
const currentRevision = () => `${sessionStore.capture()}:${revision}`;
async function lookupIds(): Promise<string[]> {
	const cache = await storage.getItem<{ value: Record<string, number> }>(
		"lookups",
	);
	return Object.entries(cache?.value || {})
		.filter(
			([, time]) =>
				Number.isFinite(time) && time >= Date.now() - 100 * 86400000,
		)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 1000)
		.map(([id]) => id);
}
export const serverCatalog = new ServerCatalog<Logical>({
	async context() {
		const captured = currentRevision();
		const [session, cache] = await Promise.all([
			readSession(),
			loadCachedUser(),
		]);
		const vpn = cache?.user?.VPN;
		if (
			captured !== currentRevision() ||
			!session.uid ||
			!vpn ||
			typeof vpn.MaxTier !== "number"
		)
			throw new Error("VpnCatalogChanged");
		return {
			owner: JSON.stringify([
				session.uid,
				vpn.MaxTier,
				[...(vpn.Groups || [])].sort(),
			]),
			revision: captured,
		};
	},
	current: (context) => context.revision === currentRevision(),
	read: () => logicalServers.get(),
	write: (value) => logicalServers.set(value),
	remove: () => logicalServers.remove(),
	async fetch(cache) {
		const ids = await lookupIds();
		return (await useLogicalsV2())
			? fetchLogicalsV2(cache, ids)
			: fetchLogicalsV1(cache, ids);
	},
	async refresh(cache) {
		return (await useLogicalsV2())
			? refreshLogicalLoadsV2(cache)
			: refreshLogicalLoadsV1(cache);
	},
	notModified: (error) => isNotModified(error),
	transient: (error) => {
		const e = error as { httpStatus?: number; Code?: number };
		return (
			e?.Code !== 5003 &&
			(isNetworkError(error) ||
				e?.httpStatus === 429 ||
				(e?.httpStatus || 0) >= 500)
		);
	},
	freshness: async () =>
		getLogicalsTTL() *
		((await getElapsedMillisecondsSinceLastActivity()) > 86400000 ? 2 : 1),
	blockingTTL: getLogicalsBlockingUpdateTTL,
	loadTTL: getLoadsMaxAge,
	compatible: async (cache) => !!cache.statusId === (await useLogicalsV2()),
});
