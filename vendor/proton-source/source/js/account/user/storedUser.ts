import type {Timed} from '../../tools/storage';
import {sessionDataStorageType, storage} from '../../tools/storage';
import type {User, UserResult} from './User';

export const storedUser = storage.selfItem<
	Partial<Timed<{user?: User | UserResult}>> & {owner?: string}
>('user', sessionDataStorageType);
