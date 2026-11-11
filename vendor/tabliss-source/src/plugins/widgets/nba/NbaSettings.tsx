import { UiCheck, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const NbaSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="NbaSettings">
    <UiCheck>
      <UiInput
        type="checkbox"
        checked={data.displayLogo}
        onChange={() => setData({ ...data, displayLogo: !data.displayLogo })}
      />{" "}
      {t("Display team logo")}</UiCheck>
  </div>
);

export default NbaSettings;
