'use popup';
import {start} from './popup-starter';
import {accountURL} from './config';
import {triggerPromise} from './tools/triggerPromise';
import {handleError} from './tools/sentry';
import {readSession} from './account/readSession';

((body) => {
	if (!body) return;
	let started = false;
	const startOnce = () => {
		if (started) return;
		started = true;
		triggerPromise(start(body));
	};
	if (body === document.body || !body.closest('[hidden]')) {
		startOnce();
	} else {
		body.addEventListener('super-vpn:show', startOnce, {once: true});
		triggerPromise(readSession().then((session) => {
			if (session?.uid && session.refreshToken) startOnce();
		}));
	}

	window.addEventListener(
		'message',
		(event: MessageEvent<string>) => {
			if (!event.origin.startsWith(accountURL)) {
				return;
			}

			if (event.data === 'endFork') {
				const accountFrame =
					body.querySelector<HTMLIFrameElement>('#account-frame');

				if (accountFrame) {
					accountFrame.style.display = 'none';
				}

				body.querySelectorAll<HTMLDivElement>('.main-area').forEach((area) => {
					area.style.display = 'block';
				});
			}
		},
		false,
	);

	if (body === document.body) {
		window.addEventListener('unhandledrejection', handleError);
		window.addEventListener('error', handleError);
	}
})(document.getElementById('vpnPanel') ?? document.body);
