import { UiCheck, UiField, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";
import LocationInput from "./LocationInput";
import { defaultData, Props } from "./types";

const WeatherSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="WeatherSettings">
    <LocationInput
      latitude={data.latitude}
      longitude={data.longitude}
      onChange={(location) => setData({ ...data, ...location })}
    />

    {data.latitude && data.latitude ? (
      <>
        <UiField>
          {t("Name")}<UiInput
            type="text"
            value={data.name || ""}
            placeholder={t("Optional name")}
            onChange={(event) =>
              setData({ ...data, name: event.target.value || undefined })
            }
          />
        </UiField>

        <hr />

        <UiCheck>
          <UiInput
            type="checkbox"
            checked={data.showDetails}
            onChange={() =>
              setData({ ...data, showDetails: !data.showDetails })
            }
          />{" "}
          {t("Show extended details")}</UiCheck>

        <UiCheck>
          <UiInput
            type="radio"
            checked={data.units === "si"}
            onChange={() => setData({ ...data, units: "si" })}
          />{" "}
          {t("Metric units")}</UiCheck>

        <UiCheck>
          <UiInput
            type="radio"
            checked={data.units === "us"}
            onChange={() => setData({ ...data, units: "us" })}
          />{" "}
          {t("Imperial units")}</UiCheck>

        <p>
          <a
            href="https://open-meteo.com/"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("Weather data by Open-Meteo.com")}</a>
        </p>
      </>
    ) : null}
  </div>
);

export default WeatherSettings;
