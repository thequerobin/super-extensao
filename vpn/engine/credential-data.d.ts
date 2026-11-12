export interface CredentialPair {
    Username: string;
    Password: string;
}
export declare function credentialData(credentials?: Partial<CredentialPair>): {
    expiration: number;
    groups: string[];
    sessionId: string | null;
};
export declare function credentialMayReplace(previous?: Partial<CredentialPair>, next?: Partial<CredentialPair>): boolean;
