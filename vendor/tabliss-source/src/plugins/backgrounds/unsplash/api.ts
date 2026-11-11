import { Data, Image } from "./types";
import { readProviderKey, request, json, httpsUrl, ProviderError } from "../shared/provider";

export const officialCollection = 1053828;

type Config = Pick<
  Data,
  "by" | "collections" | "featured" | "search" | "topics"
>;

export const fetchImages = async ({
  by,
  collections,
  topics,
  featured,
  search,
}: Config): Promise<Image[]> => {
  const url = "https://api.unsplash.com/photos/random";
  const params = new URLSearchParams();
  const headers = new Headers({ Authorization: `Client-ID ${await readProviderKey("unsplash")}` });

  params.set("count", "10");

  switch (by) {
    case "collections":
      params.set("collections", collections);
      break;

    case "topics":
      params.set("topics", topics);
      params.set("orientation", "landscape");
      break;

    case "search":
      params.set("orientation", "landscape");
      if (featured) params.set("featured", "true");
      if (search) params.set("query", search);
      break;

    default:
      params.set("collections", String(officialCollection));
  }

  const body = await request(`${url}?${params}`, json, { headers, cache: "no-cache", redirect: "error" });
  if (!Array.isArray(body)) throw new ProviderError("response");
  if (!body.length) throw new ProviderError("empty");
  return body.map((item: any) => {
    if (!item || typeof item.user?.name !== "string") throw new ProviderError("response");
    return {
      src: httpsUrl(item.urls?.raw),
      credit: {
        imageLink: httpsUrl(item.links?.html),
        location: typeof item.location?.title === "string" ? item.location.title : undefined,
        userName: item.user.name,
        userLink: httpsUrl(item.user.links?.html),
      },
    };
  });
};

/**
 * Build image link from raw
 * TODO: allow quality to be adjustable, possibly in combination with size
 */
export const buildLink = (src: string): string => {
  const url = new URL(src);
  url.searchParams.set("q", "85");
  url.searchParams.set(
    "w",
    String(calculateWidth(window.innerWidth, window.devicePixelRatio)),
  );
  return String(url);
};

/**
 * Calculate width to fetch image, tuned for Unsplash cache performance.
 */
export function calculateWidth(screenWidth = 1920, pixelRatio = 1): number {
  // Consider a minimum resolution too
  screenWidth = screenWidth * pixelRatio; // Find true resolution
  screenWidth = Math.max(screenWidth, 1920); // Lower limit at 1920
  screenWidth = Math.min(screenWidth, 3840); // Upper limit at 4K
  screenWidth = Math.ceil(screenWidth / 240) * 240; // Snap up to nearest 240px for improved caching
  return screenWidth;
}
