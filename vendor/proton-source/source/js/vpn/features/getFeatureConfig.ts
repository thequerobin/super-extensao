import {
	observe,
	VpnIOError,
	isVpnIOError,
} from "../../../../../../vpn/engine/io";
import { FeatureConfigStore } from "../../../../../../vpn/engine/features";
import type { FeaturePolicies } from "../../../../../../vpn/engine/features";
import { storage, Storage } from "../../tools/storage";
export type { FeatureConfig } from "../../../../../../vpn/engine/features";

const managedConfig = storage.selfItem("config", Storage.MANAGED);
const store = new FeatureConfigStore({
	managed: () => managedConfig.get() as Promise<FeaturePolicies | undefined>,
	managedUnavailable: (error) =>
		isVpnIOError(error) && error.code === "VpnManagedStorageUnavailable",
	async bundled() {
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
	},
});
export const config = {
	get: () => store.peek(),
	set: (value: FeaturePolicies | undefined) => store.set(value),
};
export const getFeatureConfig = <T extends object = object>(name: string) =>
	store.get<T>(name);
