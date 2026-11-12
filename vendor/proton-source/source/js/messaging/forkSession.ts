import {consumeFork} from '../account/fork/consumeFork';
import {sessionStore} from '../account/sessionStore';
import type {ForkMessage} from './Message';
import {appId} from '../config';
import {triggerPromise} from '../tools/triggerPromise';
import {getFreshUser} from '../account/user/getUser';
import {error} from '../log/log';
import {c} from '../tools/translate';
import type {ForkResponse} from './ForkResponse';
import {getErrorAsString} from '../tools/getErrorMessage';

export const forkSession = async (
	message: any,
): Promise<ForkResponse | undefined> => {
	if (!message || typeof message !== 'object') {
		return;
	}

	const {payload, extension, token} = message as ForkMessage;

	if (extension && extension !== appId) {
		// ignore the message
		return;
	}

	const baseResponse = token ? {token} : {};

	if (!payload || typeof payload !== 'object') {
		return {
			...baseResponse,
			type: 'error',
		};
	}

	const {
		selector,
		// keyPassword,
		persistent,
		//trusted,
		state,
	} = payload;

	const generation = sessionStore.capture();
	try {
		const {session, forkState} = await consumeFork({state, selector});
		session.persistent = persistent;
		session.partnerId = forkState.partnerId || undefined;

		if (!(await sessionStore.saveIfCurrent(session, generation)))
			throw new Error('VpnSignInSuperseded');

		triggerPromise(getFreshUser());

		return {
			...baseResponse,
			type: 'success',
			partnerId: session.partnerId,
			payload: {
				title: c('Info').t`You're signed in`,
				message: c('Info').t`Open the Proton VPN browser extension to continue`,
			},
		};
	} catch (e) {
		error(e);

		const message = getErrorAsString(e);

		return {
			...baseResponse,
			type: 'error',
			...(message ? {payload: {message}} : {}),
		};
	}
};
