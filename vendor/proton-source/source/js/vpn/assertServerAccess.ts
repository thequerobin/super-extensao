import type {User} from '../account/user/User';
import {getUserMaxTier} from '../account/user/getUserMaxTier';
import type {Logical} from './Logical';

/** Keep account restrictions even when using the complete server picker. */
export const assertServerAccess = (user: User | undefined, logical: Logical): void => {
	if (!user || !Number.isFinite(logical.Tier) || logical.Tier > getUserMaxTier(user)) {
		throw new Error('This server is not available on your Proton VPN plan.');
	}
};
