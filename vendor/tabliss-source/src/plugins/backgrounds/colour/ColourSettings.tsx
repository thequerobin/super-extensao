import { UiField, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const ColourSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="ColourSettings">
    <UiField>
      {t("Colour")}<UiInput
        type="color"
        value={data.colour}
        onChange={(event) => setData({ colour: event.target.value })}
      />
    </UiField>
  </div>
);

export default ColourSettings;
