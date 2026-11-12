import { type HealthRecord } from "./health";
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
export declare function filterByChoice<L extends Candidate>(list: L[], choice: ServerChoice): L[];
export declare function sortCatalog<L extends Candidate>(list: L[]): L[];
export declare function bestCandidate<L extends Candidate>(list: L[], tier: number, up: (item: L) => boolean): L | undefined;
export declare function randomCandidate<L extends Candidate>(list: L[], tier: number, up: (item: L) => boolean, random?: () => number): L | undefined;
/** Manual choices bypass AutoConnectable, but never bypass health or tier checks. */
export declare function restoreChoice<L extends Candidate>(list: L[], choice: ServerChoice, tier: number, up: (item: L) => boolean, random?: () => number): L | undefined;
export declare function pickEndpoint<S extends Endpoint>(list: S[], random?: () => number): S | undefined;
export declare function permitsAutomaticSwitch(choice: ServerChoice): boolean;
export declare function alternativeCandidate<L extends Candidate>(list: L[], id: string | number, tier: number, up: (item: L) => boolean): L | undefined;
export interface Location {
    Latitude: number;
    Longitude: number;
}
/** Compatible distance/capacity/country ranking with a stable tie break instead of random jitter. */
export declare function rankServer(visible: boolean, enabled: boolean, capacity: number, cost: number, penalty: number, serverCountry: string, entry: Location, exit: Location, user: Partial<Location>, userCountry: string): number;
