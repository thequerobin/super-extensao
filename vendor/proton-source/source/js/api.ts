import { apiDomainsExclusion } from "./config";
import type { Session } from "./account/Session";
import { matchDomainList } from "./tools/matchDomainList";
import type { ExtensionUpdate } from "./tools/broadcastMessage";
import { broadcastMessage } from "./tools/broadcastMessage";
import { getUpdateError, setUpdateError } from "./tools/update";
import { httpClient, presentHttpError } from "./httpClient";
import OnRequestDetails = browser.proxy._OnRequestDetails;

export enum ErrorActionCode {
	UPGRADE = "Upgrade",
	SIGN_OUT = "SignOut",
	REFRESH = "Refresh",
}

export enum ErrorActionCategory {
	MAIN_ACTION = "main_action",
	SECONDARY_ACTION = "secondary_action",
	LINK = "link",
}

export interface ErrorAction {
	Code: ErrorActionCode;
	Category: ErrorActionCategory;
	Name: string;
	URL: string;
}

export interface DeviceLimitErrorDetails {
	Type: "DeviceLimit";
	Title?: string;
	Body?:
		| string
		| Array<{
				Component: string;
				Icon: string;
				Text: string;
		  }>;
	Hint?: string;
	Actions?: ErrorAction[];
}

type DataResult = Record<string, unknown>;

export interface ApiError<
	T = DataResult | DeviceLimitErrorDetails,
	S extends number = number,
	C extends number = number,
> {
	httpStatus: S;
	Code: C;
	Error: string;
	Details?: T;
	Warning?: boolean;
	_id?: string;
	authRetried?: boolean;
	retryAt?: number;
}

export type UnauthorizedError<
	T = DataResult,
	C extends number = number,
> = ApiError<T, 401, C>;

export type ForbiddenError<
	T = DataResult,
	C extends number = number,
> = ApiError<T, 403, C>;

export type InvalidTokenError<T = DataResult> = UnauthorizedError<T, 401>;

export type ResponseResult = DataResult | ArrayBuffer;

const isObject = (value: unknown) =>
	typeof value === "object" && value !== null;

export const isSuccessfulResponse = (response: Response): boolean =>
	response.status >= 200 && response.status < 300;

export const isNetworkError = (error: unknown): boolean =>
	isObject(error) &&
	((error as { name?: string }).name === "NetworkError" ||
		/^(NetworkError |(TypeError: )?Failed to fetch)/.test(
			(error as { message?: string }).message || "",
		));

export const hasErrorHttpStatus = (
	error: unknown,
	httpStatus: number,
): error is ApiError =>
	isObject(error) &&
	(error as { httpStatus?: number }).httpStatus === httpStatus;

export const isNotModified = (
	response: unknown,
): response is ApiError<unknown, 304, number> | { status: 304 } =>
	(response as { status?: number })?.status === 304 ||
	hasErrorHttpStatus(response, 304);

export const isNotFoundError = (error: unknown): error is UnauthorizedError =>
	hasErrorHttpStatus(error, 404);

export const isUnauthorizedError = (
	error: unknown,
): error is UnauthorizedError => hasErrorHttpStatus(error, 401);

export const isInvalidTokenError = (
	error: unknown,
): error is InvalidTokenError =>
	isUnauthorizedError(error) && error.Code === 401;

export const isForbiddenError = (error: unknown): error is ForbiddenError =>
	hasErrorHttpStatus(error, 403);

export const isDeviceLimitError = (
	error: unknown,
): error is ApiError<DeviceLimitErrorDetails> =>
	((error as ApiError)?.Details as { Type?: string })?.Type === "DeviceLimit";

export const needsLogout = (error: unknown): error is ApiError =>
	isObject(error) &&
	((error as { Code?: number }).Code === 2028 ||
		(error as { Code?: number }).Code === 2027);

export const needsUpdate = (error: unknown): error is ApiError =>
	isObject(error) && (error as { Code?: number }).Code === 5003;

export const isRetriableResponse = (response: Response): boolean =>
	response.status === 429 || response.status === 503;

export const isRetriableError = (error: unknown): error is ApiError =>
	isObject(error) &&
	((error as { Code?: number }).Code === 429 ||
		(error as { Code?: number }).Code === 503);

export const jsonRequest = (
	method: string,
	body: unknown,
	headers: Record<string, string> = {},
) => ({
	method,
	headers: {
		Accept: "application/json",
		"Content-Type": "application/json",
		...headers,
	},
	body: JSON.stringify(body),
});

// Compatibility facade. Execution, decoding, cooldowns and safe auth retry are own.
export const fetchApi = async (
	url: string,
	init?: RequestInit,
	baseUrl?: string,
	inputSession?: Session,
	_tryUntil?: number,
): Promise<Response> => {
	try {
		return await httpClient.raw(url, init, baseUrl, inputSession);
	} catch (error) {
		throw presentHttpError(error);
	}
};
export const fetchJson = async <T, D extends ResponseResult = ResponseResult>(
	url: string,
	init?: RequestInit,
	baseUrl?: string,
	resultBuilder?: (response: Response, data: D) => T,
): Promise<T> => {
	const upgradeError = await getUpdateError();
	if (upgradeError) {
		broadcastMessage<ExtensionUpdate>("updateExtension", {
			error: upgradeError,
		});
		throw upgradeError;
	}
	try {
		const result = await httpClient.json<T, D>(
			url,
			init,
			baseUrl,
			resultBuilder,
		);
		setUpdateError(undefined);
		return result;
	} catch (error) {
		if (needsUpdate(error)) {
			broadcastMessage<ExtensionUpdate>("updateExtension", {
				error: error as ApiError,
			});
			setUpdateError(error);
		} else setUpdateError(undefined);
		throw presentHttpError(error);
	}
};

const isUrlExcluded = (url: URL, apiExclusion: boolean) =>
	apiDomainsExclusion.includes(url.hostname) &&
	(apiExclusion || /^\/?(api\/)?vpn\/location(\?.*)?$/.test(url.pathname));

export const isExcludedFromProxy = (
	requestInfo: OnRequestDetails,
	apiExclusion: boolean,
	bypassList?: string[] | undefined,
): boolean => {
	const url = new URL(requestInfo.url);

	if (isUrlExcluded(url, apiExclusion)) {
		return true;
	}

	return matchDomainList(bypassList || [], requestInfo, url.hostname);
};

export const isIncludedIntoProxy = (
	requestInfo: OnRequestDetails,
	apiExclusion: boolean,
	includeOnlyList?: string[] | undefined,
): boolean => {
	const url = new URL(requestInfo.url);

	if (isUrlExcluded(url, apiExclusion)) {
		return false;
	}

	if (typeof includeOnlyList === "undefined") {
		return true;
	}

	return matchDomainList(includeOnlyList, requestInfo, url.hostname);
};
