import {WebRTCState} from './state';
import {getControlledValue} from '../tools/getControlledValue';

export const setWebRTCState = (state: WebRTCState): Promise<boolean> =>
	new Promise((resolve, reject) => {
		const setting = chrome.privacy?.network?.webRTCIPHandlingPolicy;
		if (!setting) {
			resolve(false);
			return;
		}
		const fail = () => {
			if (chrome.runtime.lastError) {
				reject(new Error('VpnWebRTCSettingsFailed'));
				return true;
			}
			return false;
		};
		if (state === WebRTCState.CLEAR) {
			setting.clear({}, () => {
				if (!fail()) resolve(true);
			});
			return;
		}
		setting.set({value: state}, () => {
			if (fail()) return;
			setting.get({}, (details) => {
				if (!fail()) resolve(getControlledValue(details) === state);
			});
		});
	});
