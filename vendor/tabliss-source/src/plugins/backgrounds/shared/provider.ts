import { t } from "../../../locales/ui";
export type Provider = "unsplash" | "giphy";
export const providerKey = "superNewtab:imageProviders";
export class ProviderError extends Error {
  constructor(public code: "key" | "http" | "response" | "empty" | "network" | "settings" | "image", public status?: number) {
    super("ImageProvider:" + code);
  }
}
export function errorMessage(error: unknown): string {
  if (!(error instanceof ProviderError)) return t("Unable to load this background. Try again.");
  switch (error.code) {
    case "key": return t("Configure an API key in this background's settings.");
    case "settings": return t("Unable to read or save the image provider settings.");
    case "http": return error.status === 401 || error.status === 403
      ? t("The image provider rejected the API key. Check this background's settings.")
      : error.status === 429 ? t("The image provider reached its request limit. Try again later.")
      : t("The image provider is temporarily unavailable.");
    case "empty": return t("No images found. Try another search.");
    case "response": return t("The image provider returned an invalid response.");
    default: return t("Unable to load this background. Check your connection and try again.");
  }
}
export async function storedKey(provider: Provider): Promise<string> {
  try {
    const values = BUILD_TARGET === "web" ? JSON.parse(localStorage.getItem(providerKey) || "{}")
      : (await browser.storage.local.get(providerKey))[providerKey] || {};
    return typeof values?.[provider] === "string" ? values[provider].trim() : "";
  } catch { throw new ProviderError("settings"); }
}
export async function readProviderKey(provider: Provider): Promise<string> {
  const local = await storedKey(provider);
  const builtIn = provider === "unsplash" ? UNSPLASH_API_KEY : GIPHY_API_KEY;
  const key = local || (typeof builtIn === "string" ? builtIn.trim() : "");
  if (!key || key === "undefined") throw new ProviderError("key");
  return key;
}
export async function saveProviderKey(provider: Provider, key: string): Promise<void> {
  try {
    if (BUILD_TARGET === "web") {
      const values = JSON.parse(localStorage.getItem(providerKey) || "{}");
      localStorage.setItem(providerKey, JSON.stringify({ ...values, [provider]: key.trim() }));
      window.dispatchEvent(new Event("image-provider-change"));
    } else {
      const values = (await browser.storage.local.get(providerKey))[providerKey] || {};
      await browser.storage.local.set({ [providerKey]: { ...values, [provider]: key.trim() } });
    }
  } catch { throw new ProviderError("settings"); }
}
export function watchProviderKeys(callback: () => void): () => void {
  if (BUILD_TARGET === "web") {
    const changed = (event: Event) => { if (!(event instanceof StorageEvent) || event.key === providerKey) callback(); };
    window.addEventListener("storage", changed); window.addEventListener("image-provider-change", changed);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("image-provider-change", changed); };
  }
  const changed = (changes: Record<string, unknown>, area: string) => { if (area === "local" && changes[providerKey]) callback(); };
  browser.storage.onChanged.addListener(changed);
  return () => browser.storage.onChanged.removeListener(changed);
}
export async function request<T>(url: string | Request, decode: (response: Response) => Promise<T>, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { credentials: "omit", ...options, signal: controller.signal });
    if (!response.ok) throw new ProviderError("http", response.status);
    return await decode(response);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("network");
  } finally { clearTimeout(timer); }
}
export async function json(response: Response): Promise<any> {
  try { return await response.json(); } catch { throw new ProviderError("response"); }
}
export function httpsUrl(value: unknown): string {
  if (typeof value !== "string") throw new ProviderError("response");
  try { if (new URL(value).protocol === "https:") return value; } catch { /* invalid URL */ }
  throw new ProviderError("response");
}
