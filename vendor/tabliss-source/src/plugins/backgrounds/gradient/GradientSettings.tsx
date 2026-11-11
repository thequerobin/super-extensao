import { UiField, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const GradientSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="GradientSettings">
    <UiField>
      {t("From Colour")}<UiInput
        type="color"
        value={data.from}
        onChange={(event) => setData({ ...data, from: event.target.value })}
      />
    </UiField>

    <UiField>
      {t("To Colour")}<UiInput
        type="color"
        value={data.to}
        onChange={(event) => setData({ ...data, to: event.target.value })}
      />
    </UiField>

    <UiField>
      {t("Angle (0-360)")}<UiInput
        type="number"
        value={data.angle}
        onChange={(event) =>
          setData({ ...data, angle: Number(event.target.value) })
        }
      />
    </UiField>
  </div>
);

export default GradientSettings;
