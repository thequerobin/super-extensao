import {sendMessageToBackground} from '../tools/sendMessageToBackground';
import {triggerPromise} from '../tools/triggerPromise';
import {getErrorAsString} from '../tools/getErrorMessage';
import {StateChange} from '../messaging/MessageType';
import {readSession} from './readSession';
import {fetchJson, jsonRequest} from '../api';
import type {Session} from './Session';
import {RefreshTokenError} from './RefreshTokenError';
import {sessionStore} from './sessionStore';

export const hasRefreshToken = async (session?: Session): Promise<boolean> =>
	Boolean((session || (await readSession())).refreshToken);

// The service adapter supplies only the official token exchange. The own store
// groups requests, serializes writes and prevents refresh completion after logout.
export const refreshToken = (expected?: Session): Promise<Session> =>
	sessionStore
		.refresh(async (session) => {
			try {
				const auth = await fetchJson<{
					RefreshToken: string;
					AccessToken: string;
				}>(
					'auth/refresh',
					jsonRequest(
						'POST',
						{
							UID: session.uid,
							ResponseType: 'token',
							GrantType: 'refresh_token',
							RefreshToken: session.refreshToken,
							RedirectURI: session.redirectURI || 'https://protonvpn.com',
						},
						{'x-pm-uid': session.uid!},
					),
				);
				return {
					...session,
					refreshToken: auth.RefreshToken,
					accessToken: auth.AccessToken,
				};
			} catch (error) {
				// Only a failure belonging to the current session may sign it out.
				const latest = await readSession();
				if (
					latest.uid === session.uid &&
					latest.refreshToken === session.refreshToken &&
					(error as any).Code === 10013
				) {
					triggerPromise(sendMessageToBackground(StateChange.SIGN_OUT));
					throw new RefreshTokenError(getErrorAsString(error));
				}
				throw error;
			}
		}, expected)
		.catch((error) => {
			if (error instanceof Error && error.message === 'VpnSessionUnavailable')
				throw new RefreshTokenError();
			throw error;
		});
