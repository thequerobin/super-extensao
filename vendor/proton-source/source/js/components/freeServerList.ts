import type {CountryItem, CountryList} from './countryList';
import type {UserContext} from '../account/user/UserContext';
import type {Logical} from '../vpn/Logical';
import {Feature} from '../vpn/Feature';
import {getPrimaryLanguage} from '../tools/locale';
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
	const byCountry = new Map<string, Logical[]>();
	for (const logical of logicals) {
		const country = logical.ExitCountry;
		if (!byCountry.has(country)) byCountry.set(country, []);
		byCountry.get(country)!.push(logical);
	}
	const collator = new Intl.Collator(getPrimaryLanguage());
	const countryName = (code: string) => countries[code]?.name || code;
	const countryCodes = [...byCountry.keys()].sort(
		(a, b) => collator.compare(countryName(a), countryName(b)) || collator.compare(a, b),
	);
	const title = c('Label').t`Free servers (${count})`;
	return `
		<details class="free-servers country-block">
			<summary class="free-servers-summary list-item-box">
				<span class="flex-1">${title}</span>
				<svg class="free-servers-chevron" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<use xlink:href="/vpn/img/icons.svg#expand-button"></use>
				</svg>
			</summary>
			<div class="server-items servers-list">
				${countryCodes.map((code) =>
					serverList(userContext, byCountry.get(code)!, title, false, false, {}, true),
				).join('')}
			</div>
		</details>
	`;
};
