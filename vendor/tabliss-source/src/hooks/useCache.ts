import { EffectCallback, useEffect, useMemo, useRef } from "react";
import { Cache } from "../plugins";
import { useTime } from "./useTime";

/**
 * A cached effect that automatically reruns after the expires time or on deps change.
 */
export function useCachedEffect(
  effect: EffectCallback,
  expires: Date | number,
  deps: unknown[],
) {
  const time = useTime("absolute");
  const prevDeps = useRef(deps);
  const prevExpires = useRef<Date | number>();

  useEffect(() => {
    const depsChanged = !areDepsEqual(prevDeps.current, deps);
    const expired = time >= expires && expires !== prevExpires.current;

    if (depsChanged || expired) {
      prevDeps.current = deps;
      prevExpires.current = expires;
      return effect();
    }
  }, [...deps, expires, time]);
}

export type RotatingCache<Item> = {
  items: Item[];
  cursor: number;
  rotated: number;
  deps: unknown[];
};

/**
 * A cache which rotates through a list of items
 */
export function useRotatingCache<T>(
  fetch: () => Promise<T[]>,
  { cache, setCache }: Cache<RotatingCache<T>>,
  timeout: number,
  deps: unknown[],
  onError?: (error: unknown) => void,
): T | undefined {
  // Find cursor
  const time = useTime("absolute").getTime();
  const boot = useRef(true);
  const cursor = useMemo(() => {
    if (cache) {
      if (
        (timeout === 0 && boot.current) ||
        (timeout !== 0 && time > cache.rotated + timeout)
      ) {
        const cursor = cache.cursor + 1;
        setCache({ ...cache, cursor, rotated: Date.now() });
        boot.current = false;
        return cursor;
      }
      boot.current = false;
      return cache.cursor;
    }
    return 0;
  }, [cache, time, timeout]);

  // Fetch more when cursor reaches end
  useEffect(() => {
    let active = true;
    if (cache && areDepsEqual(deps, cache.deps) && cursor >= cache.items.length - 1) {
      fetch().then((items) => {
        if (!active) return;
        const retained = cache.items.slice(-10);
        setCache({ ...cache, items: [...retained, ...items], cursor: Math.max(0, retained.length - 1) });
      }).catch(error => { if (active) onError?.(error); });
    }
    return () => { active = false; };
  }, [cursor, ...deps]);

  // Refresh of deps change
  useEffect(() => {
    let active = true;
    if (!cache || !areDepsEqual(deps, cache.deps)) {
      fetch().then((items) => {
        if (active) setCache({ items, cursor: 0, rotated: Date.now(), deps });
      }).catch(error => { if (active) onError?.(error); });
    }
    return () => { active = false; };
  }, [...deps, cache]);

  // Keep the last valid image visible when a refresh fails or the queue runs out.
  return cache ? cache.items[Math.min(cursor, cache.items.length - 1)] : undefined;
}

/**
 * Implementation adapted from react's hook source.
 * Too bad they do not export it.
 */
function areDepsEqual(prevDeps: unknown[], nextDeps: unknown[]) {
  if (prevDeps.length !== nextDeps.length) return false;
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}
