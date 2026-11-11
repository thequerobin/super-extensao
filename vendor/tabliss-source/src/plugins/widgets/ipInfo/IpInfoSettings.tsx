import { UiCheck, UiField, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const IpInfoSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="IpInfoSettings">
    <UiCheck>
      <UiInput
        type="checkbox"
        checked={data.displayCity}
        onChange={() => setData({ ...data, displayCity: !data.displayCity })}
      />
      {t("Display City")}</UiCheck>

    <UiCheck>
      <UiInput
        type="checkbox"
        checked={data.displayCountry}
        onChange={() =>
          setData({ ...data, displayCountry: !data.displayCountry })
        }
      />
      {t("Display Country")}</UiCheck>

    <UiField>
      {t("Refresh interval (minutes)")}<UiInput
        type="number"
        value={data.refreshInterval}
        onChange={(event) =>
          setData({ ...data, refreshInterval: Number(event.target.value) })
        }
        min={1}
        max={60}
      />
    </UiField>
  </div>
);

export default IpInfoSettings;
