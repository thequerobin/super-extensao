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
        <label>
          {t("Name")}<input
            type="text"
            value={data.name || ""}
            placeholder={t("Optional name")}
            onChange={(event) =>
              setData({ ...data, name: event.target.value || undefined })
            }
          />
        </label>

        <hr />

        <label>
          <input
            type="checkbox"
            checked={data.showDetails}
            onChange={() =>
              setData({ ...data, showDetails: !data.showDetails })
            }
          />{" "}
          {t("Show extended details")}</label>

        <label>
          <input
            type="radio"
            checked={data.units === "si"}
            onChange={() => setData({ ...data, units: "si" })}
          />{" "}
          {t("Metric units")}</label>

        <label>
          <input
            type="radio"
            checked={data.units === "us"}
            onChange={() => setData({ ...data, units: "us" })}
          />{" "}
          {t("Imperial units")}</label>

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
