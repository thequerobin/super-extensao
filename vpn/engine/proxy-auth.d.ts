import type { ProxyDetails } from './controller';
/** Identify our configured endpoint; never infer ownership from a provider suffix. */
export declare function ownsAuthEndpoint(details: ProxyDetails, challenger: {
    host: string;
    port: number;
}): boolean;
