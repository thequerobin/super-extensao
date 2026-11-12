import { runtimeRequest } from "./runtimeRequest";
export const relayMessagesToExtension = (
	source: Window,
	runtime: typeof browser.runtime,
) => {
	const origins = [
		"https://account.proton.me",
		"https://account.protonvpn.com",
	];
	source.addEventListener("message", (event) => {
		if (event.source !== source || !origins.includes(event.origin)) return;
		const data = event.data;
		const bridge =
			data?.channel === "super-vpn-auth" &&
			data.direction === "request" &&
			typeof data.id === "string";
		const message = bridge ? data.message : data;
		if (
			!message ||
			message.type !== "fork" ||
			typeof message.payload?.state !== "string" ||
			typeof message.payload?.selector !== "string"
		)
			return;
		const { state, selector, persistent } = message.payload;
		void runtimeRequest<{ handled?: boolean; response?: unknown }>(runtime, {
			channel: "super-vpn",
			type: "fork",
			token: typeof message.token === "string" ? message.token : undefined,
			payload: { state, selector, persistent: persistent === true },
		})
			.then((result) => {
				if (bridge) {
					source.postMessage(
						{
							channel: "super-vpn-auth",
							direction: "response",
							id: data.id,
							result,
						},
						event.origin,
					);
				} else if (result?.handled) {
					source.postMessage(result.response, event.origin);
				}
			})
			.catch(() => {
				if (bridge)
					source.postMessage(
						{
							channel: "super-vpn-auth",
							direction: "response",
							id: data.id,
							result: {
								handled: true,
								response: {
									type: "error",
									payload: { message: "VpnOperationPending" },
								},
							},
						},
						event.origin,
					);
			});
	});
};
