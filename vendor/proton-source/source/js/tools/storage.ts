import { nativeStorage } from "./nativeStorage";
import { isVpnIOError } from "../../../../../vpn/engine/io";
import { TransactionError } from "./TransactionError";
import { delay } from "./delay";

/** Browser Storage API https://developer.chrome.com/docs/extensions/reference/api/storage */
export enum Storage {
	/** Data is stored locally and cleared when the extension is removed. */
	LOCAL = "local",
	/** Holds data in memory while an extension is loaded. The storage is cleared if the extension is disabled, reloaded or updated and when the browser restarts. */
	SESSION = "session",
	/** If syncing is enabled, the data is synced to any Chrome browser that the user is logged into. If disabled, it behaves like **storage.local**. Chrome stores the data locally when the browser is offline and resumes syncing when it's back online. */
	SYNC = "sync",
	/** Businesses can customize feature default settings using the managed storage */
	MANAGED = "managed",
}

type CacheKey<T> = Exclude<keyof T, "time">;

type CacheValue<T> = T[CacheKey<T>];

const defaultStorage = Storage.LOCAL;

/**
 * Session related data (tokens, credentials, user, etc.) are stored in `Storage.LOCAL` for persistence across tabs and browser restarts.
 */
export const sessionDataStorageType = defaultStorage;

export const storagePrefix = "superVpn:";

export const storageConfig = { failureMeasureRatio: 0 }; // Legacy configuration surface.

export const storage = {
	async getItem<T extends object, D extends T | undefined = T | undefined>(
		key: string,
		defaultValue: D = undefined as D,
		area: Storage = defaultStorage,
	): Promise<T | D> {
		const name = storagePrefix + key;
		const data = await nativeStorage.get<Record<string, T>>(area, name);
		if (Object.prototype.hasOwnProperty.call(data, name)) return data[name]!;
		if (area === Storage.LOCAL && chrome.storage.session) {
			const legacy = await nativeStorage.get<Record<string, T>>(
				"session",
				name,
			);
			if (Object.prototype.hasOwnProperty.call(legacy, name))
				return legacy[name]!;
		}
		return defaultValue;
	},
	setItem(
		key: string,
		value: object,
		area: Storage = defaultStorage,
	): Promise<void> {
		return nativeStorage.set(area, { [storagePrefix + key]: value });
	},
	removeItem(key: string, area: Storage = defaultStorage): Promise<void> {
		return nativeStorage.remove(area, storagePrefix + key);
	},
	item<T extends object>(
		key: string,
		storage: Storage = defaultStorage,
		valueKey: string = "value",
	) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		let transactionStart: number | undefined = undefined;

		return {
			key,
			async get(
				defaultValue: T | undefined = undefined,
				concurrencyDelay = 0,
			): Promise<T | undefined> {
				if (concurrencyDelay > 0) {
					let cache = (await this.get(defaultValue)) as
						| (T & Partial<Fetching>)
						| undefined;

					const until = Date.now() + Math.min(5000, concurrencyDelay);
					while (
						Date.now() < until &&
						typeof cache?.fetching === "number" &&
						Date.now() - cache.fetching < 5_000
					) {
						await delay(200);
						cache = await this.get(defaultValue);
					}

					return cache;
				}

				return self.getItem<T>(key, defaultValue, storage);
			},
			getOnceNoLongerFetching(
				concurrencyDelay = 5_000,
				defaultValue: T | undefined = undefined,
			): Promise<T | undefined> {
				return this.get(defaultValue, concurrencyDelay);
			},
			async load(defaultValue: T | undefined = undefined): Promise<Partial<T>> {
				try {
					const value = await self.getItem<T>(key, defaultValue, storage);

					return typeof value === "object" ? value : {};
				} catch (error) {
					if (isVpnIOError(error)) throw error;
					return {};
				}
			},
			set(value: T): Promise<void> {
				return self.setItem(key, value, storage);
			},
			setValue(value: any, extraData: Record<string, any> = {}): Promise<void> {
				return this.set({
					time: Date.now(),
					[valueKey]: value,
					...extraData,
				} as T);
			},
			remove(): Promise<void> {
				return self.removeItem(key, storage);
			},
			async transaction<D extends T | undefined = T | undefined>(
				callback: (value: T | D) => T | D | undefined,
				defaultValue: D = undefined as D,
			): Promise<void> {
				if (transactionStart !== undefined) {
					throw new TransactionError();
				}

				transactionStart = Date.now();
				try {
					const result = callback(
						await self.getItem<T, D>(key, defaultValue, storage),
					);
					await (result === undefined
						? self.removeItem(key, storage)
						: self.setItem(key, result, storage));
				} finally {
					transactionStart = undefined;
				}
			},
			async transactionValue<
				D extends CacheValue<T> | undefined = CacheValue<T> | undefined,
			>(
				callback: (value: CacheValue<T> | D) => CacheValue<T> | D | undefined,
				defaultValue: D = undefined as D,
			): Promise<void> {
				return this.transaction(
					(cache) => {
						const newValue = callback(cache?.[valueKey as CacheKey<T>]);

						if (newValue !== undefined) {
							return {
								...cache,
								[valueKey]: newValue,
								time: Date.now(),
							} as T;
						}

						return undefined;
					},
					defaultValue === undefined
						? undefined
						: ({
								[valueKey]: defaultValue,
								time: Date.now(),
							} as T),
				);
			},
		};
	},
	selfItem<T extends object>(key: string, storage: Storage = defaultStorage) {
		return this.item<T>(key, storage, key);
	},
};

export type CacheItem<T extends object> = ReturnType<typeof storage.item<T>>;

export type Timed<T> = { time: number } & T;

export type Fetching = { fetching: null | number };

export type CacheWrappedValue<T> = Timed<{ value: T }>;
