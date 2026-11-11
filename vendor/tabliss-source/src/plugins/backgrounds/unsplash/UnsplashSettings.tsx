import { UiCheck, UiField, UiInput, UiSelect } from "../../../ui";
import { ProviderAccess } from "../shared/ProviderAccess";
import { t } from "../../../locales/ui";
import React from "react";
import { DebounceInput } from "../../shared";
import topics from "./topics.json";
import { defaultData, Props } from "./types";

const UnsplashSettings: React.FC<Props> = ({ data = defaultData, setData }) => (
  <div className="UnsplashSettings">
    <ProviderAccess provider="unsplash" />
    <UiField>
      {t("Show a new photo")}<UiSelect
        value={data.timeout}
        onChange={(event) =>
          setData({ ...data, timeout: Number(event.target.value) })
        }
      >
        <option value="0">{t("Every new tab")}</option>
        <option value="300">{t("Every 5 minutes")}</option>
        <option value="900">{t("Every 15 minutes")}</option>
        <option value="3600">{t("Every hour")}</option>
        <option value="86400">{t("Every day")}</option>
        <option value="604800">{t("Every week")}</option>
      </UiSelect>
    </UiField>

    <UiCheck>
      <UiInput
        type="radio"
        checked={data.by === "official"}
        onChange={() => setData({ ...data, by: "official" })}
      />{" "}
      {t("Official Collection")}</UiCheck>

    <UiCheck>
      <UiInput
        type="radio"
        checked={data.by === "topics"}
        onChange={() => setData({ ...data, by: "topics" })}
      />{" "}
      {t("Topic")}</UiCheck>

    <UiCheck>
      <UiInput
        type="radio"
        checked={data.by === "search"}
        onChange={() => setData({ ...data, by: "search" })}
      />{" "}
      {t("Search")}</UiCheck>

    <UiCheck>
      <UiInput
        type="radio"
        checked={data.by === "collections"}
        onChange={() => setData({ ...data, by: "collections" })}
      />{" "}
      {t("Collection")}</UiCheck>

    {data.by === "topics" && (
      <UiField>
        {t("Topic")}<UiSelect
          value={data.topics}
          onChange={(event) => setData({ ...data, topics: event.target.value })}
        >
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {t(topic.title)}
            </option>
          ))}
        </UiSelect>
      </UiField>
    )}

    {data.by === "search" && (
      <>
        <UiField>
          {t("Tags")}<DebounceInput
            type="text"
            value={data.search}
            placeholder={t("Try landscapes or animals...")}
            onChange={(value) => setData({ ...data, search: value })}
            wait={500}
          />
        </UiField>

        <UiCheck>
          <UiInput
            type="checkbox"
            checked={data.featured}
            onChange={(event) => setData({ ...data, featured: !data.featured })}
          />{" "}
          {t("Only featured images")}</UiCheck>
      </>
    )}

    {data.by === "collections" && (
      <UiField>
        {t("Collection")}<DebounceInput
          type="text"
          value={data.collections}
          placeholder={t("Collection ID number")}
          onChange={(value) => setData({ ...data, collections: value })}
          wait={500}
        />
      </UiField>
    )}
  </div>
);

export default UnsplashSettings;
