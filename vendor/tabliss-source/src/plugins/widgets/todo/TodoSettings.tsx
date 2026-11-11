import { UiField, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const TodoSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="SearchSettings">
    <UiField>
      {t("Tasks to show")}<UiInput
        type="number"
        min="0"
        onChange={(event) =>
          setData({ ...data, show: Number(event.target.value) })
        }
        placeholder={t("Number of todo items to show")}
        value={data.show}
      />
    </UiField>

    <UiField>
      {t("New task keybind")}<UiInput
        type="text"
        maxLength={1}
        onChange={(event) =>
          setData({ ...data, keyBind: event.target.value })
        }
        value={data.keyBind}
      />
    </UiField>
  </div>
);

export default TodoSettings;
