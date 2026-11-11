import { UiCheck, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const LiteratureClockSettings: FC<Props> = ({
  data = defaultData,
  setData,
}) => (
  <div className="LiteratureClockSettings">
    <UiCheck>
      <UiInput
        type="checkbox"
        checked={data.showBookAndAuthor}
        onChange={() =>
          setData({ ...data, showBookAndAuthor: !data.showBookAndAuthor })
        }
      />{" "}
      {t("Display book and author")}</UiCheck>

    <UiCheck>
      <UiInput
        type="checkbox"
        checked={data.centerText}
        onChange={() => setData({ ...data, centerText: !data.centerText })}
      />{" "}
      {t("Align text at center")}</UiCheck>
  </div>
);

export default LiteratureClockSettings;
