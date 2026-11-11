import { ProviderAccess } from "../shared/ProviderAccess";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";
import { DebounceInput } from "../../shared";

const GiphySettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="GiphySettings">
    <ProviderAccess provider="giphy" />
    <label>
      {t("Tag")}<DebounceInput
        type="text"
        value={data.tag}
        onChange={(value) => setData({ ...data, tag: value })}
        wait={500}
      />
    </label>
    <p className="info">{t("Separate multiple tags with a comma")}</p>

    <label>
      <input
        type="checkbox"
        checked={data.expand}
        onChange={(event) => setData({ ...data, expand: !data.expand })}
      />{" "}
      {t("Stretch to fill screen")}</label>

    <label>
      <input
        type="checkbox"
        checked={!data.nsfw}
        onChange={(event) => setData({ ...data, nsfw: !data.nsfw })}
      />{" "}
      {t("Safe Search")}</label>
  </div>
);

export default GiphySettings;
