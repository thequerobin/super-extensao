import {getServersCount} from '../../vpn/getServersCount';
import {c} from '../../tools/translate';
import {openForkTab} from '../../account/openForkTab';
import {triggerPromise} from '../../tools/triggerPromise';
import {proxyPermission} from '../../vpn/proxyPermission';
import {sendMessageToBackground} from '../../tools/sendMessageToBackground';
import {PermissionGrant} from '../../messaging/MessageType';
import {getServerCountsDisplayTTL} from '../../intervals';
import {getUpdateError} from '../../tools/update';
import {openTab} from '../../tools/openTab';
import {getBrowser} from '../../tools/getBrowser';
import type {Counts} from '../../vpn/Counts';
import {getErrorAsString} from '../../tools/getErrorMessage';
import {handleError} from '../../tools/sentry';
import {setDisplayStyle} from '../../tools/setDisplayStyle';
import {
	getServerCountLastCheck,
	setServerCount,
} from './initializeInlineParagraph';
import type {ApiError} from '../../api';

export const prepareSigningView = (): Promise<Counts> | undefined => {
	const age = Date.now() - getServerCountLastCheck();

	if (age > getServerCountsDisplayTTL()) {
		return getServersCount().then((counts) => {
			setServerCount(counts.Servers);

			return counts;
		});
	}

	return undefined;
};

export const showSigningViewAndWaitForItToBeLoaded = async (
	signInView: HTMLElement | null,
	loggedView: HTMLElement | null,
	spinner: HTMLElement | null,
	proxySupported?: boolean,
): Promise<void> => {
	if (!signInView || !loggedView) {
		return openForkTab();
	}

	const signIn = signInView.querySelector<HTMLButtonElement>('button.sign-in-button');
	const paragraph = signInView.querySelector<HTMLParagraphElement>('p');
	if (!signIn || !paragraph) {
		return;
	}

	const hasProxyPermission = !!(chrome.proxy && proxySupported !== false);
	signInView.style.display = 'block';
	loggedView.style.display = 'none';
	setDisplayStyle(spinner, 'none');
	signIn.classList.remove('update-extension');
	signIn.textContent = c('Action').t`Sign in with Proton`;
	paragraph.textContent = c('Info').t`Sign in with your Proton Account to use the VPN.`;

	signIn.onclick = async () => {
		if (signIn.classList.contains('update-extension')) {
			triggerPromise(openTab(getBrowser().pluginsUrl));
			window?.close();
			return;
		}

		if (signIn.disabled) {
			return;
		}
		signIn.disabled = true;
		try {
			// Request synchronously from the click, using only declared permissions.
			if (!(await browser.permissions.request(proxyPermission))) {
				paragraph.textContent = c('Info').t`VPN permission was not granted. Try again to continue.`;
				return;
			}
			if (!hasProxyPermission) {
				await sendMessageToBackground(PermissionGrant.PROXY);
			}
			await openForkTab();
			window?.close();
		} catch (error) {
			paragraph.textContent = c('Info').t`Unable to open Proton sign-in. Please try again.` + ' ' + getErrorAsString(error);
			handleError(error);
		} finally {
			signIn.disabled = false;
		}

	};

	getUpdateError().then((error: unknown) => {
		if (!error) {
			return;
		}
		signIn.classList.add('update-extension');
		signIn.textContent = c('Action').t`Update`;
		paragraph.textContent = (error as ApiError)?.Error || getErrorAsString(error);
		handleError(error);
	});
};

export const showSigningView = (
	signInView: HTMLElement | null,
	loggedView: HTMLElement | null,
	spinner: HTMLElement | null,
	proxySupported?: boolean,
): void => {
	triggerPromise(
		showSigningViewAndWaitForItToBeLoaded(
			signInView,
			loggedView,
			spinner,
			proxySupported,
		),
	);
};
