import {getCurrentState, waitForReadyState} from '../state';
import {updateLocation} from './updateLocation';
import {updateLogicalLoad} from './updateLogicalLoad';
import {handleError} from '../tools/sentry';
import {RecoveryLoop} from '../../../../../vpn/engine/recovery';

const recoveryAlarm = 'superVpn:recovery';
const recovery = new RecoveryLoop({
	listen(wake) {
		chrome.alarms.onAlarm.addListener((alarm) => {
			if (alarm.name === recoveryAlarm) wake();
		});
	},
	arm: async () => {
		await chrome.alarms.create(recoveryAlarm, {periodInMinutes: 0.5});
	},
	async recover() {
		await waitForReadyState();
		await getCurrentState().refreshState?.();
	},
	failed: (error) => handleError(error),
});
// Register synchronously each time the service worker starts, before async boot.
export const initStateRecovery = () => recovery.start();

export const initState = async () => {
	// getCurrentState performs the one-time restore. A second recovery based on a
	// saved server could otherwise override a disconnect issued during startup.
	await waitForReadyState();
	await recovery.wake();
	updateLocation();
	updateLogicalLoad();
};
