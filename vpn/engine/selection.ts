import { serverHealth, type HealthRecord } from "./health";

/** Provider data at the boundary; the policy has no browser or network dependencies. */
export interface Endpoint extends HealthRecord {
  ID?: string | number;
  Domain: string;
  EntryIP?: string;
  ExitIP?: string;
}
export interface Candidate extends HealthRecord {
  ID: string | number;
  Name: string;
  Tier: number;
  Features: number;
  ExitCountry: string;
  EntryCountry: string;
  City?: string | null;
  Score?: number;
  SearchScore?: number;
  AutoConnectable?: boolean;
  Servers?: Endpoint[];
}
export interface ServerChoice {
  logicalId?: string | number;
  pick?: "fastest" | "random" | "closest";
  entryCountry?: string;
  exitCountry?: string;
  city?: string | null;
  tier?: number;
  requiredFeatures?: number;
  excludedFeatures?: number;
  filter?: "other";
}
const SECURE_CORE = 1,
  TOR = 2,
  RESTRICTED = 32,
  PARTNER = 64;
const compare = (a: string | number, b: string | number) =>
  a < b ? -1 : a > b ? 1 : 0;
const sameId = (a: string | number, b: string | number) =>
  String(a) === String(b);
export function filterByChoice<L extends Candidate>(
  list: L[],
  choice: ServerChoice,
): L[] {
  return list.filter((item) => {
    if (choice.logicalId !== undefined)
      return sameId(item.ID, choice.logicalId);
    return (
      !(item.Features & (TOR | RESTRICTED | PARTNER)) &&
      !(choice.filter === "other" && (item.Tier > 0 || item.City)) &&
      (choice.tier === undefined || item.Tier === choice.tier) &&
      (!choice.excludedFeatures ||
        !(item.Features & choice.excludedFeatures)) &&
      (!choice.requiredFeatures ||
        (item.Features & choice.requiredFeatures) ===
          choice.requiredFeatures) &&
      (!choice.exitCountry || item.ExitCountry === choice.exitCountry) &&
      (!choice.entryCountry || item.EntryCountry === choice.entryCountry) &&
      (!choice.city || item.City === choice.city)
    );
  });
}
export function sortCatalog<L extends Candidate>(list: L[]): L[] {
  return [...list].sort((a, b) => {
    const score =
      (Number.isFinite(b.SearchScore) ? b.SearchScore! : 0) -
      (Number.isFinite(a.SearchScore) ? a.SearchScore! : 0);
    if (score) return score;
    if (a.ExitCountry !== b.ExitCountry)
      return compare(a.ExitCountry, b.ExitCountry);
    const [ap = "", an = "0"] = a.Name.split("#", 2),
      [bp = "", bn = "0"] = b.Name.split("#", 2);
    return (
      compare(ap, bp) ||
      (/^\d+$/.test(an) && /^\d+$/.test(bn)
        ? compare(Number(an), Number(bn))
        : compare(an, bn)) ||
      compare(String(a.ID), String(b.ID))
    );
  });
}
function eligible<L extends Candidate>(
  item: L,
  tier: number,
  up: (item: L) => boolean,
): boolean {
  return (
    item.Tier <= tier &&
    item.AutoConnectable !== false &&
    serverHealth(item) !== "down" &&
    up(item)
  );
}
export function bestCandidate<L extends Candidate>(
  list: L[],
  tier: number,
  up: (item: L) => boolean,
): L | undefined {
  return list
    .filter((item) => eligible(item, tier, up) && Number.isFinite(item.Score))
    .sort(
      (a, b) => a.Score! - b.Score! || compare(String(a.ID), String(b.ID)),
    )[0];
}
function randomItem<T>(list: T[], random: () => number): T | undefined {
  if (!list.length) return undefined;
  const value = random();
  return list[
    Math.min(
      list.length - 1,
      Math.max(
        0,
        Math.floor((Number.isFinite(value) ? value : 0) * list.length),
      ),
    )
  ];
}
export function randomCandidate<L extends Candidate>(
  list: L[],
  tier: number,
  up: (item: L) => boolean,
  random = Math.random,
): L | undefined {
  return randomItem(
    sortCatalog(list.filter((item) => eligible(item, tier, up))),
    random,
  );
}
/** Manual choices bypass AutoConnectable, but never bypass health or tier checks. */
export function restoreChoice<L extends Candidate>(
  list: L[],
  choice: ServerChoice,
  tier: number,
  up: (item: L) => boolean,
  random = Math.random,
): L | undefined {
  const candidates = filterByChoice(list, choice);
  if (choice.logicalId !== undefined) {
    const selected = candidates[0];
    return selected &&
      selected.Tier <= tier &&
      serverHealth(selected) !== "down" &&
      up(selected)
      ? selected
      : undefined;
  }
  return choice.pick === "random"
    ? randomCandidate(candidates, tier, up, random)
    : bestCandidate(candidates, tier, up);
}
export function pickEndpoint<S extends Endpoint>(
  list: S[],
  random = Math.random,
): S | undefined {
  // Incomplete status can be tried; confirmed-down endpoints cannot.
  const usable = list.filter(
    (item) =>
      !!item.Domain &&
      serverHealth(item) !== "down" &&
      !((item.ServicesDown || 0) & 3),
  );
  const up = usable.filter(
    (item) =>
      (typeof item.Status === "number" && item.Status > 0) ||
      item.Enabled === true ||
      item.Enabled === 1,
  );
  return randomItem(up.length ? up : usable, random);
}
export function permitsAutomaticSwitch(choice: ServerChoice): boolean {
  return choice.logicalId === undefined || !!choice.pick;
}
export function alternativeCandidate<L extends Candidate>(
  list: L[],
  id: string | number,
  tier: number,
  up: (item: L) => boolean,
): L | undefined {
  const current = list.find((item) => sameId(item.ID, id));
  if (!current) return undefined;
  const base = list.filter(
    (item) =>
      !sameId(item.ID, id) &&
      item.Tier <= current.Tier &&
      (item.Features & SECURE_CORE) === (current.Features & SECURE_CORE),
  );
  return (
    bestCandidate(
      base.filter(
        (item) =>
          item.ExitCountry === current.ExitCountry &&
          item.Features === (current.Features & ~RESTRICTED),
      ),
      tier,
      up,
    ) ||
    bestCandidate(
      base.filter((item) => item.ExitCountry === current.ExitCountry),
      tier,
      up,
    ) ||
    bestCandidate(base, tier, up)
  );
}

export interface Location {
  Latitude: number;
  Longitude: number;
}
const countryCode = (country: string) =>
  country.toUpperCase() === "UK" ? "GB" : country.toUpperCase();
const located = (point: Partial<Location> | undefined): point is Location =>
  !!point &&
  Number.isFinite(point.Latitude) &&
  Number.isFinite(point.Longitude);
function distance(a: Location, b: Location): number {
  const rad = Math.PI / 180,
    lat = (a.Latitude - b.Latitude) * rad,
    lon = (a.Longitude - b.Longitude) * rad;
  const value =
    Math.sin(lat / 2) ** 2 +
    Math.cos(a.Latitude * rad) *
      Math.cos(b.Latitude * rad) *
      Math.sin(lon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
}
/** Compatible distance/capacity/country ranking with a stable tie break instead of random jitter. */
export function rankServer(
  visible: boolean,
  enabled: boolean,
  capacity: number,
  cost: number,
  penalty: number,
  serverCountry: string,
  entry: Location,
  exit: Location,
  user: Partial<Location>,
  userCountry: string,
): number {
  if (![capacity, cost, penalty].every(Number.isFinite)) return Infinity;
  const distanceScore =
    located(user) && located(entry) && located(exit)
      ? 1 - 1 / Math.max(1, distance(exit, entry) + distance(entry, user))
      : 0;
  const sameCountry = countryCode(serverCountry) === countryCode(userCountry);
  return (
    Math.min(1, Math.max(0, Math.max(distanceScore, capacity))) +
    penalty +
    (visible && enabled ? 0 : 1000) +
    (sameCountry && capacity < 0.99 ? 0 : 1) +
    (!sameCountry && cost >= 1 ? 3 : 0)
  );
}
