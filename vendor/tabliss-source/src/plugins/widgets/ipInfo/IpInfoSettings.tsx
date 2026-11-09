import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const IpInfoSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="IpInfoSettings">
    <label>
      <input
        type="checkbox"
        checked={data.displayCity}
        onChange={() => setData({ ...data, displayCity: !data.displayCity })}
      />
      {t("Display City")}</label>

    <label>
      <input
        type="checkbox"
        checked={data.displayCountry}
        onChange={() =>
          setData({ ...data, displayCountry: !data.displayCountry })
        }
      />
      {t("Display Country")}</label>

    <label>
      {t("Refresh interval (minutes)")}<input
        type="number"
        value={data.refreshInterval}
        onChange={(event) =>
          setData({ ...data, refreshInterval: Number(event.target.value) })
        }
        min={1}
        max={60}
      />
    </label>
  </div>
);

export default IpInfoSettings;
