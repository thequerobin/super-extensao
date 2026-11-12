import {PreventWebrtcLeak} from '../vpn/features/PreventWebrtcLeak';
import {setWebRTCState} from './setWebRTCState';
import {WebRTCState} from './state';

export const preventLeak = async (protectionEnabled?: boolean) => {
	const protectedAgainstWebRtcLeak =
		typeof protectionEnabled === 'boolean'
			? protectionEnabled
			: (await (await PreventWebrtcLeak.create()).getConfig()).value;

	const applied = await (protectedAgainstWebRtcLeak
		? setWebRTCState(WebRTCState.DISABLED)
		: setWebRTCState(WebRTCState.CLEAR));
	if (protectedAgainstWebRtcLeak && !applied)
		throw new Error('VpnWebRTCProtectionUnavailable');
};
