import type { UserContext } from "../account/user/UserContext";
import { getSortedLogicals, isLogicalUp } from "./getLogicals";
import { pickServerInLogical } from "./pickServerInLogical";
import { alternativeCandidate } from "../../../../../vpn/engine/selection";
export const getAlternativeServer = async (
	id: string | number,
	userContext: UserContext,
) => {
	const logical = alternativeCandidate(
		await getSortedLogicals(),
		id,
		userContext.tier,
		(item) => isLogicalUp(item, userContext.country, userContext.location),
	);
	return { logical, server: pickServerInLogical(logical) };
};
