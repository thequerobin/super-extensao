import {getRuntime} from './getRuntime';

export const allWatchers: Record<string, (...args: any[]) => void>[] = [];

export const watchBroadcastMessages = (
	watchers: Record<string, (...args: any[]) => void>,
) => {
	allWatchers.push(watchers);

	return () => {
		allWatchers.splice(allWatchers.indexOf(watchers), 1);
	};
};

export const messageListener = (request: any) => {
	if (request?.channel !== 'super-vpn' || request.respondTo !== 'none') return false;
	allWatchers.forEach((watchers) => {
		const type = request.type;
		const watcher = type ? watchers[type] : undefined;

		if (typeof watcher === 'function') {
			watcher(request.data);

			return;
		}

		if (watchers['error'] && (request as any).error) {
			watchers['error']((request as any).error);
		}
	});

	return false;
};

getRuntime()?.onMessage.addListener(messageListener);
