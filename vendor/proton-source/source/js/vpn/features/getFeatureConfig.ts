import {
	observe,
	VpnIOError,
	isVpnIOError,
} from "../../../../../../vpn/engine/io";
import { storage, Storage } from "../../tools/storage";

const managedConfig = storage.selfItem("config", Storage.MANAGED);

export interface FeatureConfig<T extends object = object> {
	controllable: boolean;
	controlMessage?: string;
	config?: T;
}

export const config = (() => {
	let config: Record<string, FeatureConfig> | undefined = undefined;

	return {
		get: () => config,
		set(value: Record<string, FeatureConfig> | undefined) {
			config = value;
		},
	};
})();

const loadConfig = async () => {
	let managed: Record<string, FeatureConfig> | undefined;
	try {
		managed = (await managedConfig.get()) as
			| Record<string, FeatureConfig>
			| undefined;
	} catch (error) {
		if (!isVpnIOError(error) || error.code !== "VpnManagedStorageUnavailable")
			throw error;
	}
	if (managed) return managed;
	try {
		return await observe(
			(async () => {
				const response = await fetch("/config.json");
				return response.ok ? await response.json() : {};
			})(),
			5000,
			new VpnIOError("VpnStorageReadTimedOut"),
		);
	} catch (error) {
		if (isVpnIOError(error)) throw error;
		return {};
	}
};
let pending: Promise<Record<string, FeatureConfig>> | undefined;
const getConfig = async () => {
	if (config.get()) return config.get()!;
	if (!pending) {
		const task = loadConfig().then((value) => {
			config.set(value);
			return value;
		});
		pending = task;
		void task.then(
			() => {
				if (pending === task) pending = undefined;
			},
			() => {
				if (pending === task) pending = undefined;
			},
		);
	}
	return pending;
};

export const getFeatureConfig = async <T extends object = object>(
	name: string,
) =>
	({
		controllable: true,
		...(await getConfig())[name],
	}) as FeatureConfig<T>;
