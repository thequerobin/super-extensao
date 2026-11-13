import {Notification} from '../vpn/features/Notification';

type NotificationOptions = chrome.notifications.NotificationOptions;
type NotificationCreateOptions = chrome.notifications.NotificationCreateOptions;

export function emitNotification(
	notificationId: string,
	options:
		| string
		| (Omit<NotificationOptions, 'type' | 'title' | 'iconUrl'> &
				Partial<NotificationOptions>),
	callback?: (notificationId: string) => void,
): void {
	Notification.create()
		.then((notification) => notification.getConfig())
		.then(({value: enabled}) => {
			if (!enabled) {
				return;
			}

			if (typeof options === 'string') {
				options = {message: options};
			}

			const notificationOptions = {
				type: 'basic',
				title: 'Super Extensão — VPN',
				iconUrl: '/icons/icon128.png',
				...options,
			} as NotificationCreateOptions;

			if (!notificationOptions.message) {
				return;
			}

			chrome?.notifications?.create(
				'proton-vpn-' + notificationId,
				notificationOptions,
				callback || (() => {}),
			);
		});
}
