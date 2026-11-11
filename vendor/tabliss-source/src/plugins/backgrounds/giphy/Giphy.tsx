import { ProviderStatus, useProviderRevision } from "../shared/ProviderAccess";
import React from "react";
import { useObjectUrl } from "../../../hooks";
import Backdrop from "../../../views/shared/Backdrop";
import { getGif } from "./api";
import Credit from "./Credit";
import "./Giphy.sass";
import { defaultData, Props } from "./types";

const Giphy: React.FC<Props> = ({
  cache,
  data = defaultData,
  setCache,
  loader,
}) => {
  const [gif, setGif] = React.useState(cache);
  const [error, setError] = React.useState<unknown>(null);
  const [retry, setRetry] = React.useState(0);
  const revision = useProviderRevision();
  React.useEffect(() => {
    const config = { tag: data.tag, nsfw: data.nsfw };
    let active = true;
    setError(null);
    getGif(config, loader).then(next => {
      if (active) { setCache(next); setGif(next); }
    }).catch(error => { if (active) setError(error); });
    return () => { active = false; };
  }, [data.tag, data.nsfw, revision, retry]);

  const url = useObjectUrl(gif && gif.data);

  if (!gif || !url) return <ProviderStatus error={error} retry={() => setRetry(value => value + 1)} />;

  return (
    <div className="Giphy fullscreen">
      <Backdrop
        className="gif fullscreen"
        style={{
          backgroundImage: `url(${url})`,
          backgroundSize: data.expand ? "cover" : undefined,
        }}
      />
      <Credit link={gif.link} />
      <ProviderStatus error={error} retry={() => setRetry(value => value + 1)} />
    </div>
  );
};

export default Giphy;
