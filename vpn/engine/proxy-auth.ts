import type {ProxyDetails} from './controller';

/** Identify our configured endpoint; never infer ownership from a provider suffix. */
export function ownsAuthEndpoint(
  details: ProxyDetails,
  challenger: {host: string; port: number},
): boolean {
  if (details.levelOfControl !== 'controlled_by_this_extension') return false;
  const {host, port} = challenger;
  if (!/^(?:[a-z0-9._-]+|\[[a-f0-9:]+\])$/i.test(host) ||
      !Number.isInteger(port) || port < 1 || port > 65535) return false;
  const config = details.value;
  if (config?.mode === 'fixed_servers') {
    const endpoint = config.rules?.singleProxy;
    return endpoint?.host.toLowerCase() === host.toLowerCase() && endpoint.port === port;
  }
  if (config?.mode === 'pac_script') {
    // Our PAC contains an exact JSON string, not a host substring or remote script.
    const data = config.pacScript?.data?.toLowerCase();
    return Boolean(data && ['HTTPS', 'PROXY'].some(scheme =>
      data.includes(JSON.stringify(`${scheme} ${host}:${port}`).toLowerCase())));
  }
  return false;
}
