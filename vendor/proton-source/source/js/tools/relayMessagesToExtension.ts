export const relayMessagesToExtension = (
	source: Window,
	runtime: typeof browser.runtime,
) => {
	const origins = ['https://account.proton.me', 'https://account.protonvpn.com'];
	source.addEventListener('message', event => {
		if (event.source !== source || !origins.includes(event.origin)) return;
		const data = event.data;
		if (!data || data.type !== 'fork' || typeof data.payload?.state !== 'string' || typeof data.payload?.selector !== 'string') return;
		void runtime.sendMessage({...data, channel: 'super-vpn'});
	});
};
