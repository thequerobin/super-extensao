import { getLocale } from "../../tools/locale";
import { storedPreventWebrtcLeak } from "../../webrtc/storedPreventWebrtcLeak";
import { ToggleFeature } from "./ToggleFeature";
import { getFeatureConfig } from "./getFeatureConfig";

export class PreventWebrtcLeak extends ToggleFeature {
	public static override async create() {
		return new PreventWebrtcLeak(await getFeatureConfig("prevent-webrtc-leak"));
	}

	override async getConfig() {
		return { value: true };
	}
	override isControllable() {
		return false;
	}
	override getControlMessage() {
		return getLocale().toLowerCase().startsWith("pt")
			? "Obrigatória para proteger a conexão VPN."
			: "Required to protect the VPN connection.";
	}
	override getDefault() {
		return { value: true };
	}

	override getCacheItem() {
		return storedPreventWebrtcLeak;
	}
}
