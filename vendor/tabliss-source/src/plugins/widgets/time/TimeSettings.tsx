import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";
import TimeZoneInput from "../../../views/shared/timeZone/TimeZoneInput";

const TimeSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="TimeSettings">
    <label>
      {t("Name")}<input
        type="text"
        value={data.name}
        placeholder={t("Optional name")}
        onChange={(event) => setData({ ...data, name: event.target.value })}
      />
    </label>

    <label>
      {t("Time Zone")}<TimeZoneInput
        timeZone={data.timeZone}
        onChange={(timeZone) => setData({ ...data, timeZone })}
      />
    </label>

    <label>
      <input
        type="radio"
        checked={data.mode === "analogue"}
        onChange={() => setData({ ...data, mode: "analogue" })}
      />{" "}
      {t("Analogue")}</label>

    <label>
      <input
        type="radio"
        checked={data.mode === "digital" && data.hour12}
        onChange={() => setData({ ...data, mode: "digital", hour12: true })}
      />{" "}
      {t("12-hour digital")}</label>

    <label>
      <input
        type="radio"
        checked={data.mode === "digital" && !data.hour12}
        onChange={() => setData({ ...data, mode: "digital", hour12: false })}
      />{" "}
      {t("24-hour digital")}</label>

    <label>
      <input
        type="checkbox"
        checked={data.showSeconds}
        onChange={() => setData({ ...data, showSeconds: !data.showSeconds })}
      />{" "}
      {t("Display seconds")}</label>

    <label>
      <input
        type="checkbox"
        checked={data.showMinutes}
        onChange={() => setData({ ...data, showMinutes: !data.showMinutes })}
      />{" "}
      {t("Display minutes")}</label>

    {data.mode === "digital" && data.hour12 && (
      <label>
        <input
          type="checkbox"
          checked={data.showDayPeriod}
          onChange={() =>
            setData({ ...data, showDayPeriod: !data.showDayPeriod })
          }
        />{" "}
        {t("Display day period")}</label>
    )}

    <label>
      <input
        type="checkbox"
        checked={data.showDate}
        onChange={() => setData({ ...data, showDate: !data.showDate })}
      />{" "}
      {t("Display date")}</label>
  </div>
);

export default TimeSettings;
