import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const ColourSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="ColourSettings">
    <label>
      {t("Colour")}<input
        type="color"
        value={data.colour}
        onChange={(event) => setData({ colour: event.target.value })}
      />
    </label>
  </div>
);

export default ColourSettings;
