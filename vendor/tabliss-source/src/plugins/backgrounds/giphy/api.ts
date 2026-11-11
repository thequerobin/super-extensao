import { API } from "../../types";
import { Gif } from "./types";
import { readProviderKey, request, json, httpsUrl, ProviderError } from "../shared/provider";

type Config = {
  tag: string;
  nsfw: boolean;
};

export async function getGif(
  { tag, nsfw }: Config,
  loader: API["loader"],
): Promise<Gif> {
  const tags = tag.split(",").map((t) => t.trim());
  const randomTag = tags[Math.floor(Math.random() * tags.length)];

  const key = await readProviderKey("giphy");
  const apiRequest = new Request(
    "https://api.giphy.com/v1/gifs/random" +
      `?api_key=${encodeURIComponent(key)}` +
      "&rating=" +
      (nsfw ? "r" : "g") +
      (randomTag ? `&tag=${encodeURIComponent(randomTag)}` : ""),
  );

  loader.push();
  try {
    const body = await request(apiRequest, json, { redirect: "error" });
    if (body?.meta?.status && body.meta.status !== 200) throw new ProviderError("http", body.meta.status);
    const item = body?.data;
    if (!item || Array.isArray(item)) throw new ProviderError("empty");
    const image = httpsUrl(item.images?.original?.webp || item.images?.original?.url);
    const link = httpsUrl(item.url);
    const data = await request(image, async response => {
      const blob = await response.blob();
      if (!blob.size || !blob.type.startsWith("image/")) throw new ProviderError("image");
      return blob;
    });
    return { data, link };
  } finally { loader.pop(); }
}
