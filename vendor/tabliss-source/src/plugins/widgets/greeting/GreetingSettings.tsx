import { UiField, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const GreetingSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="GreetingSettings">
    <UiField>
      {t("Name")}<UiInput
        type="text"
        value={data.name}
        onChange={(event) => setData({ name: event.target.value })}
      />
    </UiField>
  </div>
);

export default GreetingSettings;
