import { ConfiguredFeature } from "../../../../../../vpn/engine/features";
import { c } from "../../tools/translate";

/** Compatibility class: provider translation only; precedence is owned by the core. */
export abstract class FeatureWrapper<
	T extends object = object,
> extends ConfiguredFeature<T> {
	override getDefaultControlMessage(): string {
		return c("Info").t`This option cannot be changed on this device`;
	}
}
