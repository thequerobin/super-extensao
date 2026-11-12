import { RequestChannel, VpnIOError } from "../../../../../vpn/engine/io";
const channel = new RequestChannel();
export const requestTimeouts = {
	state: 5000,
	account: 30000,
	command: 15000,
	fork: 40000,
};
export function runtimeRequest<T>(
	runtime: Pick<typeof browser.runtime, "sendMessage">,
	message: { type?: string; event?: string; [key: string]: unknown },
): Promise<T> {
	const type = message.type || message.event || "notification";
	const ms =
		type === "fork"
			? requestTimeouts.fork
			: ["user", "pmUser"].includes(type)
				? requestTimeouts.account
				: ["connectionState", "protectionStatus", "state", "locale"].includes(
							type,
					  )
					? requestTimeouts.state
					: requestTimeouts.command;
	return channel.send(
		type,
		async () => {
			try {
				return (await runtime.sendMessage(message)) as T;
			} catch {
				throw new VpnIOError(
					"VpnWorkerUnavailable",
					![
						"connectionState",
						"protectionStatus",
						"state",
						"user",
						"pmUser",
						"locale",
					].includes(type),
				);
			}
		},
		ms,
	);
}
