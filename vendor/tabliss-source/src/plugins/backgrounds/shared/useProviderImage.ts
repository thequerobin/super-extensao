import React from "react";
import { Loader } from "../../types";
import { ProviderError } from "./provider";

export function useProviderImage(src: string | null, loader: Loader, onError: (error: unknown) => void, refresh: unknown = 0) {
  const [ready, setReady] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!src) return;
    const image = new Image();
    let active = true, pending = true;
    const finish = () => { if (pending) { pending = false; loader.pop(); } };
    loader.push();
    image.onload = () => { finish(); if (active) setReady(src); };
    image.onerror = () => { finish(); if (active) onError(new ProviderError("image")); };
    image.src = src;
    return () => { active = false; image.onload = null; image.onerror = null; finish(); };
  }, [src, refresh]);
  return ready;
}
