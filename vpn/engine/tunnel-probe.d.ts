/** A credential-free HTTPS probe while website requests remain blocked. Not an IP attestation. */
export declare function verifyTunnel(fetcher: typeof fetch, current: () => boolean, timeoutMs?: number): Promise<boolean>;
