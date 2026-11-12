import { isNetworkError } from "../api";
import { reportNetworkFailure } from "../state";
import { handleError } from "../tools/sentry";

// Protocol errors are classified here; state and retry decisions are engine-owned.
export const checkNetwork = (error: unknown, rethrow = false): void => {
	if (isNetworkError(error)) {
		reportNetworkFailure(error);
		if (rethrow) throw error;
		return;
	}
	handleError(error);
};
