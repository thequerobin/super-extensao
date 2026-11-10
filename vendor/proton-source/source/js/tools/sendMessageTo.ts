import {getRuntime} from './getRuntime';

export const sendMessageTo = async <K>(type: string, data?: any): Promise<K> => {
	const response = await getRuntime().sendMessage({channel: 'super-vpn', type, data});
	if (!response?.received) {
		throw new Error('The VPN background did not answer the request.');
	}

	const result = response.result;
	if (result?.error && !result.error.Warning) {
		throw result.error;
	}

	return result;
};
