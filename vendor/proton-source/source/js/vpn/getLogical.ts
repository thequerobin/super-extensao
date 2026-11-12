import {
	bestCandidate,
	randomCandidate,
} from "../../../../../vpn/engine/selection";
import type { Logical } from "./Logical";
import type { CountryItem } from "../components/countryList";
import type { UserContext } from "../account/user/UserContext";
import { isLogicalUp } from "./getLogicals";
import { c } from "../tools/translate";

export const getAllLogicals = (group: CountryItem | undefined): Logical[] =>
	Object.values(group?.groups || {}).reduce(
		(logicals, subGroup) => logicals.concat(...getAllLogicals(subGroup)),
		group?.logicals || [],
	);

export const getBestLogical = (
	logicals: Logical[] | null | undefined,
	userContext: UserContext,
): Logical | undefined =>
	bestCandidate(logicals || [], userContext.tier, (logical) =>
		isLogicalUp(logical, userContext.country, userContext.location),
	);
export const getRandomLogical = (
	logicals: Logical[] | null | undefined,
	userContext: UserContext,
): Logical | undefined =>
	randomCandidate(logicals || [], userContext.tier, (logical) =>
		isLogicalUp(logical, userContext.country, userContext.location),
	);

export const requireBestLogical = (
	logicals: Logical[] | null | undefined,
	userContext: UserContext,
	errorPreHandler?: (error: Error) => void,
): Logical => {
	const bestServer = getBestLogical(logicals, userContext);

	if (!bestServer) {
		errorPreHandler?.(
			new Error(
				c("Error")
					.t`Unable to find appropriate server, try to logout and login again if it persists.`,
			),
		);

		throw new Error("Misconfigured server. Cannot find the best one.");
	}

	return bestServer;
};

export const requireRandomLogical = (
	logicals: Logical[] | null | undefined,
	userContext: UserContext,
	errorPreHandler?: (error: Error) => void,
): Logical => {
	const randomServer = getRandomLogical(logicals, userContext);

	if (!randomServer) {
		errorPreHandler?.(
			new Error(
				c("Error")
					.t`Unable to find appropriate server, try to logout and login again if it persists.`,
			),
		);

		throw new Error("Misconfigured server. Cannot find a suitable one.");
	}

	return randomServer;
};
