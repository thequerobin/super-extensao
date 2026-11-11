import { UiField, UiTextarea } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const CssSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="CssSettings">
    <UiField>
      {t("CSS Snippet")}<UiTextarea
        rows={3}
        style={{ fontFamily: "monospace" }}
        value={data.input}
        onChange={(event) => setData({ input: event.target.value })}
      />
    </UiField>

    <p className="info">
      {t("Warning: this functionality is intended for advanced users. Custom styles may break at any time.")}</p>
  </div>
);

export default CssSettings;
