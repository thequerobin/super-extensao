import type {User} from '../account/user/User';
import {canAccessServer} from '../../../../../vpn/engine/account';
import type {Logical} from './Logical';

/** Keep account restrictions even when using the complete server picker. */
export const assertServerAccess = (user: User | undefined, logical: Logical): void => {
	if (!canAccessServer(user, logical.Tier)) {
		throw new Error('This server is not available on your Proton VPN plan.');
	}
};
