import { useProviderImage } from "../shared/useProviderImage";
import { ProviderStatus, useProviderRevision } from "../shared/ProviderAccess";
import React from "react";
import { useRotatingCache } from "../../../hooks";
import Backdrop from "../../../views/shared/Backdrop";
import { buildLink, fetchImages } from "./api";
import { defaultData, Props, Image as UnsplashImage } from "./types";
import "./Unsplash.sass";
import UnsplashCredit from "./UnsplashCredit";

const Unsplash: React.FC<Props> = ({
  cache,
  data = defaultData,
  loader,
  setCache,
  setData,
}) => {
  const [error, setError] = React.useState<unknown>(null);
  const [retry, setRetry] = React.useState(0);
  const revision = useProviderRevision();
  // If legacy cache design, clear and let the new cache take over
  // Unfortunately, without the image src being stored, I cannot migrate the old cache
  if (cache && "now" in cache) {
    cache = undefined;
  }

  // Migrate old pause setting
  React.useEffect(() => {
    if (data.timeout === Number.MAX_SAFE_INTEGER) {
      setData({
        ...data,
        paused: true,
        timeout: defaultData.timeout,
      });
    }
  }, []);

  // Get current item from rotating cache
  const item = useRotatingCache(
    () => {
      setError(null);
      loader.push();
      return fetchImages(data).finally(() => loader.pop());
    },
    { cache, setCache },
    data.paused ? Number.MAX_SAFE_INTEGER : data.timeout * 1000,
    [data.by, data.collections, data.featured, data.search, data.topics, revision, retry],
    setError,
  );

  const source = item ? buildLink(item.src) : null;
  const url = useProviderImage(source, loader, setError, `${revision}:${retry}`);
  const [displayed, setDisplayed] = React.useState<UnsplashImage>();
  React.useEffect(() => { if (url && item && url === source) setDisplayed(item); }, [url, item]);

  const go = (amount: number) =>
    cache && cache.items[cache.cursor + amount]
      ? () =>
          setCache({
            ...cache!,
            cursor: cache!.cursor + amount,
            rotated: Date.now(),
          })
      : null;

  const handlePause = () => {
    setData({
      ...data,
      paused: !data.paused,
    });
  };

  return (
    <div className="Unsplash fullscreen">
      <Backdrop
        className="image fullscreen"
        ready={url !== null}
        style={{ backgroundImage: url ? `url(${url})` : undefined }}
      />

      <ProviderStatus error={error} retry={() => setRetry(value => value + 1)} />
      {displayed && url ? (
        <UnsplashCredit
          credit={displayed.credit}
          paused={data.paused ?? false}
          onPause={handlePause}
          onPrev={go(-1)}
          onNext={go(1)}
        />
      ) : null}
    </div>
  );
};

export default Unsplash;
