/** A credential-free HTTPS probe while website requests remain blocked. Not an IP attestation. */
export async function verifyTunnel(
  fetcher: typeof fetch,
  current: () => boolean,
  timeoutMs = 10000,
): Promise<boolean> {
  if (!current()) return false;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(false);
    }, timeoutMs);
  });
  const request = (async () => {
    try {
      const response = await fetcher("https://protonvpn.com/", {
        method: "HEAD",
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
      void response.body?.cancel().catch(() => {});
      return (
        current() &&
        response.ok &&
        (!response.url ||
          new URL(response.url).origin === "https://protonvpn.com")
      );
    } catch {
      return false;
    }
  })();
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
