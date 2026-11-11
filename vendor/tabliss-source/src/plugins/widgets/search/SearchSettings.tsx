import { UiField, UiInput, UiSelect } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { engines } from "./engines";
import { Props, defaultData } from "./types";

const SearchSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="SearchSettings">
    <UiField>
      {t("Search Provider")}<UiSelect
        onChange={(event) =>
          setData({ ...data, searchEngine: event.target.value })
        }
        value={data.searchEngine}
      >
        {engines.map(({ key, name }) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </UiSelect>
    </UiField>

    {BUILD_TARGET === "web" && (
      <UiField>
        {t("Suggestions Provider")}<UiSelect
          onChange={(event) =>
            setData({ ...data, suggestionsEngine: event.target.value })
          }
          value={data.suggestionsEngine}
        >
          <option key="off" value="">
            {t("Off")}</option>
          {engines
            .filter(({ suggest_url }) => Boolean(suggest_url))
            .map(({ key, name }) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
        </UiSelect>
      </UiField>
    )}

    {data.suggestionsEngine && (
      <UiField>
        {t("Suggestion Quanitity")}<UiInput
          type="number"
          min="1"
          max="10"
          value={data.suggestionsQuantity}
          onChange={(event) =>
            setData({
              ...data,
              suggestionsQuantity: Number(event.target.value),
            })
          }
        />
      </UiField>
    )}
  </div>
);

export default SearchSettings;
