/** Public worker snapshot. No tokens, proxy credentials or internal endpoint. */
export function connectionView(
  current: {
    name?: string;
    data?: {server?: Record<string, unknown>; error?: unknown};
  },
  confirmed: boolean,
  errorMessage?: string,
) {
  const signedIn = current.name === 'on' || current.name === 'off';
  const state = !signedIn
    ? 'logged-out'
    : current.name !== 'on'
      ? 'disconnected'
      : confirmed
        ? 'connected'
        : 'connecting';
  const source =
    signedIn && current.name === 'on' ? current.data?.server : undefined;
  const server =
    source &&
    Object.fromEntries(
      [
        'id',
        'name',
        'entryCountry',
        'exitIp',
        'exitCountry',
        'exitCity',
        'exitEnglishCity',
        'secureCore',
      ].map((key) => [key, source[key]]),
    );
  return {
    signedIn,
    state: {
      state,
      server,
      ...(errorMessage ? {error: {message: errorMessage}} : {}),
    },
  };
}
