import type {Timed} from '../../tools/storage';
import {sessionDataStorageType, storage} from '../../tools/storage';
import type {Credentials} from './Credentials';

export type CredentialsCacheItem = Partial<
	Timed<{credentials?: Credentials; sessionUid?: string}>
>;

export const storedCredentials = storage.selfItem<CredentialsCacheItem>(
	'credentials',
	sessionDataStorageType,
);
