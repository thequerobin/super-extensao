import type {Session} from './Session';
import {sessionStore} from './sessionStore';
export const saveSession = (session: Session): Promise<void> =>
	sessionStore.save(session);
