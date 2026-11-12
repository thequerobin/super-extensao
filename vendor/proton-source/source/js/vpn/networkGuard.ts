import { NetworkGuard } from "../../../../../vpn/engine/network-guard";
const blockId = 880001,
	allowId = 880002,
	transportId = 880003;
const transportRule: chrome.declarativeNetRequest.Rule = {
	id: transportId,
	priority: 11000,
	action: { type: "block" },
	condition: { resourceTypes: ["webtransport"] },
};
const api = () => {
	const value = chrome.declarativeNetRequest;
	if (!value) throw new Error("VpnTrafficGuardUnavailable");
	return value;
};
const condition: chrome.declarativeNetRequest.RuleCondition = {
	regexFilter: "^(https?|wss?)://",
	excludedInitiatorDomains: [chrome.runtime.id],
	excludedRequestDomains: ["account.proton.me", "account.protonvpn.com"],
	// Empty exclusion explicitly covers main_frame as well as subresources and sockets.
	excludedResourceTypes: [],
};
const rule = (
	id: number,
	priority: number,
	type: "allow" | "block",
): chrome.declarativeNetRequest.Rule => ({
	id,
	priority,
	action: { type },
	condition,
});
const same = (
	item: chrome.declarativeNetRequest.Rule,
	id: number,
	priority: number,
	type: string,
) => {
	const c = item.condition;
	return (
		item.id === id &&
		item.priority === priority &&
		item.action.type === type &&
		c.regexFilter === condition.regexFilter &&
		JSON.stringify([...(c.excludedInitiatorDomains || [])].sort()) ===
			JSON.stringify(condition.excludedInitiatorDomains) &&
		JSON.stringify([...(c.excludedRequestDomains || [])].sort()) ===
			JSON.stringify([...(condition.excludedRequestDomains || [])].sort()) &&
		Array.isArray(c.excludedResourceTypes) &&
		c.excludedResourceTypes.length === 0 &&
		Object.keys(c).every((key) =>
			[
				"regexFilter",
				"excludedInitiatorDomains",
				"excludedRequestDomains",
				"excludedResourceTypes",
				"isUrlFilterCaseSensitive",
			].includes(key),
		)
	);
};
let lastState = { armed: false, blocked: false };
export const networkBlocked = () => lastState.blocked;
const read = async () => {
	try {
		const [dynamic, session] = await Promise.all([
			api().getDynamicRules(),
			api().getSessionRules(),
		]);
		const armed =
			dynamic.some((item) => same(item, blockId, 10000, "block")) &&
			dynamic.some(
				(item) =>
					item.id === transportId &&
					item.priority === 11000 &&
					item.action.type === "block" &&
					Object.keys(item.condition).length === 1 &&
					item.condition.resourceTypes?.join(",") === "webtransport",
			);
		const allowed = session.some((item) => same(item, allowId, 10001, "allow"));
		lastState = { armed, blocked: armed && !allowed };
		return lastState;
	} catch {
		throw new Error("VpnTrafficGuardFailed");
	}
};
export const networkGuard = new NetworkGuard({
	async installBlock() {
		try {
			await api().updateDynamicRules({
				removeRuleIds: [blockId, transportId],
				addRules: [rule(blockId, 10000, "block"), transportRule],
			});
		} catch {
			throw new Error("VpnTrafficGuardFailed");
		}
	},
	async removeBlock() {
		await api().updateDynamicRules({ removeRuleIds: [blockId, transportId] });
	},
	async allow() {
		await api().updateSessionRules({
			removeRuleIds: [allowId],
			addRules: [rule(allowId, 10001, "allow")],
		});
	},
	async revoke() {
		await api().updateSessionRules({ removeRuleIds: [allowId] });
	},
	status: read,
});
