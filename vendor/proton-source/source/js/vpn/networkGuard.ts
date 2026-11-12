import { NetworkGuard } from "../../../../../vpn/engine/network-guard";
const blockId = 880001,
	allowId = 880002,
	transportId = 880003,
	pageId = 880004;
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
// Never rely on an empty exclusion list: Chromium's default resource mask
// omits main_frame, so an apparently installed allowance can lose to redirect.
const resourceTypes: NonNullable<
	chrome.declarativeNetRequest.RuleCondition["resourceTypes"]
> = [
	"main_frame",
	"sub_frame",
	"stylesheet",
	"script",
	"image",
	"font",
	"object",
	"xmlhttprequest",
	"ping",
	"csp_report",
	"media",
	"websocket",
	"webtransport",
	"webbundle",
	"other",
];
const condition: chrome.declarativeNetRequest.RuleCondition = {
	regexFilter: "^(https?|wss?)://",
	excludedInitiatorDomains: [chrome.runtime.id],
	excludedRequestDomains: ["account.proton.me", "account.protonvpn.com"],
	resourceTypes,
};
const rule = (
	id: number,
	priority: number,
	type: "allow" | "block",
): chrome.declarativeNetRequest.Rule => ({
	id,
	priority,
	action: { type },
	condition:
		type === "allow"
			? { ...condition, excludedInitiatorDomains: [] }
			: condition,
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
			JSON.stringify(
				type === "allow" ? [] : condition.excludedInitiatorDomains,
			) &&
		JSON.stringify([...(c.excludedRequestDomains || [])].sort()) ===
			JSON.stringify([...(condition.excludedRequestDomains || [])].sort()) &&
		Array.isArray(c.resourceTypes) &&
		JSON.stringify([...c.resourceTypes].sort()) ===
			JSON.stringify([...resourceTypes].sort()) &&
		!c.excludedResourceTypes &&
		Object.keys(c).every((key) =>
			[
				"regexFilter",
				"excludedInitiatorDomains",
				"excludedRequestDomains",
				"resourceTypes",
				"isUrlFilterCaseSensitive",
			].includes(key),
		)
	);
};
const pageRule: chrome.declarativeNetRequest.Rule = {
	id: pageId,
	priority: 10002,
	action: {
		type: "redirect",
		redirect: { extensionPath: "/vpn-blocked.html" },
	},
	condition: {
		regexFilter: "^https?://",
		excludedRequestDomains: condition.excludedRequestDomains,
		resourceTypes: ["main_frame"],
	},
};
const samePage = (item: chrome.declarativeNetRequest.Rule) => {
	const c = item.condition;
	return (
		item.id === pageId &&
		item.priority === 10002 &&
		item.action.type === "redirect" &&
		Object.keys(item.action).length === 2 &&
		item.action.redirect?.extensionPath === "/vpn-blocked.html" &&
		Object.keys(item.action.redirect).length === 1 &&
		c.regexFilter === pageRule.condition.regexFilter &&
		c.resourceTypes?.join(",") === "main_frame" &&
		!c.excludedInitiatorDomains &&
		JSON.stringify([...(c.excludedRequestDomains || [])].sort()) ===
			JSON.stringify([...(condition.excludedRequestDomains || [])].sort()) &&
		Object.keys(c).every((key) =>
			[
				"regexFilter",
				"excludedInitiatorDomains",
				"excludedRequestDomains",
				"resourceTypes",
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
			dynamic.some(samePage) &&
			dynamic.some(
				(item) =>
					item.id === transportId &&
					item.priority === 11000 &&
					item.action.type === "block" &&
					Object.keys(item.condition).length === 1 &&
					item.condition.resourceTypes?.join(",") === "webtransport",
			);
		const allowed = session.some((item) => same(item, allowId, 10003, "allow"));
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
				removeRuleIds: [blockId, transportId, pageId],
				addRules: [rule(blockId, 10000, "block"), transportRule, pageRule],
			});
		} catch {
			throw new Error("VpnTrafficGuardFailed");
		}
	},
	async removeBlock() {
		await api().updateDynamicRules({
			removeRuleIds: [blockId, transportId, pageId],
		});
	},
	async allow() {
		await api().updateSessionRules({
			removeRuleIds: [allowId],
			addRules: [rule(allowId, 10003, "allow")],
		});
	},
	async revoke() {
		await api().updateSessionRules({ removeRuleIds: [allowId] });
	},
	status: read,
});

/** Upgrade legacy durable rules before any restoration; never retain an old allowance. */
export async function bootstrapNetworkGuard(): Promise<void> {
	const dynamic = await api().getDynamicRules();
	if (dynamic.some((item) => [blockId, transportId, pageId].includes(item.id)))
		await networkGuard.block();
}
