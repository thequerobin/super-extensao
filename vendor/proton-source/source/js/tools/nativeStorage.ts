import {
	StorageLane,
	VpnIOError,
	isVpnIOError,
} from "../../../../../vpn/engine/io";
type Area = "local" | "session" | "sync" | "managed";
export const storageTimeouts = { read: 5000, managed: 1500, write: 8000 };
const lanes = new Map<Area, StorageLane>();
function lane(area: Area): StorageLane {
	let result = lanes.get(area);
	if (!result) {
		result = new StorageLane();
		lanes.set(area, result);
	}
	return result;
}
const failures = new Set<(error: VpnIOError) => void>();
function failed(error: unknown): never {
	const value = isVpnIOError(error)
		? error
		: new VpnIOError("VpnStorageFailed");
	if (value.code !== "VpnManagedStorageUnavailable")
		for (const report of failures) {
			try {
				report(value);
			} catch {
				/* Failure reporting must not hide the IO error. */
			}
		}
	throw value;
}
function invoke<T>(
	area: Area,
	mutation: boolean,
	run: (done: (value: T) => void) => unknown,
): Promise<T> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (value: T, error?: unknown) => {
			if (settled) return;
			settled = true;
			if (error) reject(error);
			else resolve(value);
		};
		const nativeError = (message?: string) =>
			new VpnIOError(
				area === "managed" &&
					/managed storage manifest not found|managed storage.*not available|no managed storage/i.test(
						message || "",
					)
					? "VpnManagedStorageUnavailable"
					: "VpnStorageFailed",
				mutation,
			);
		try {
			const result = run((value) => {
				const error = chrome.runtime?.lastError;
				finish(value, error ? nativeError(error.message) : undefined);
			});
			if (result && typeof (result as Promise<T>).then === "function")
				void (result as Promise<T>).then(
					(value) => finish(value),
					() => finish(undefined as T, nativeError()),
				);
		} catch (error) {
			finish(undefined as T, isVpnIOError(error) ? error : nativeError());
		}
	});
}
const api = (area: Area): chrome.storage.StorageArea => {
	const value = chrome.storage?.[area];
	if (!value)
		throw new VpnIOError(
			area === "managed" ? "VpnManagedStorageUnavailable" : "VpnStorageFailed",
		);
	return value as chrome.storage.StorageArea;
};
export const nativeStorage = {
	watchFailures(report: (error: VpnIOError) => void) {
		failures.add(report);
		return () => failures.delete(report);
	},
	async get<T extends object>(area: Area, key: string): Promise<T> {
		try {
			return await lane(area).read(
				() =>
					invoke<T>(area, false, (done) =>
						api(area).get<Record<string, unknown>>(
							key,
							done as (items: Record<string, unknown>) => void,
						),
					),
				area === "managed" ? storageTimeouts.managed : storageTimeouts.read,
			);
		} catch (error) {
			return failed(error);
		}
	},
	async set(area: Area, values: Record<string, unknown>): Promise<void> {
		try {
			const snapshot = JSON.parse(JSON.stringify(values)) as Record<
				string,
				unknown
			>;
			await lane(area).mutate(
				() => invoke<void>(area, true, (done) => api(area).set(snapshot, done)),
				storageTimeouts.write,
			);
		} catch (error) {
			failed(error);
		}
	},
	async remove(area: Area, key: string): Promise<void> {
		try {
			await lane(area).mutate(
				() => invoke<void>(area, true, (done) => api(area).remove(key, done)),
				storageTimeouts.write,
			);
		} catch (error) {
			failed(error);
		}
	},
};
