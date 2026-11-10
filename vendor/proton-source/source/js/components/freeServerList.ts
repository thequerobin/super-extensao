import type {CountryItem, CountryList} from './countryList';
import type {UserContext} from '../account/user/UserContext';
import type {Logical} from '../vpn/Logical';
import {Feature} from '../vpn/Feature';
import {c} from '../tools/translate';
import {serverList} from './serverList';

// Walk every subgroup: free servers can also be grouped under a city.
export const getFreeServers = (countries: CountryList): Logical[] => {
	const servers = new Map<Logical['ID'], Logical>();
	const visit = (group: CountryItem) => {
		for (const logical of group.logicals || []) {
			if (logical.Tier === 0 && !(logical.Features & Feature.SECURE_CORE)) {
				servers.set(logical.ID, logical);
			}
		}
		Object.values(group.groups || {}).forEach(visit);
	};
	Object.values(countries).forEach(visit);
	return [...servers.values()];
};

export const freeServerList = (
	countries: CountryList,
	userContext: UserContext,
): string => {
	const logicals = getFreeServers(countries);
	const count = logicals.length;
	if (!count) {
		return '';
	}
	const title = c('Label').t`Free servers (${count})`;
	return `
		<details class="free-servers country-block">
			<summary class="free-servers-summary list-item-box">
				<span class="flex-1">${title}</span>
				<svg class="free-servers-chevron" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<use xlink:href="img/icons.svg#expand-button"></use>
				</svg>
			</summary>
			<div class="server-items servers-list">
				${serverList(userContext, logicals, title, false, false, {}, true)}
			</div>
		</details>
	`;
};
