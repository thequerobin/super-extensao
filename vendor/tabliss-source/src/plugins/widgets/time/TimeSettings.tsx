import { UiCheck, UiField, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";
import TimeZoneInput from "../../../views/shared/timeZone/TimeZoneInput";

const TimeSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="TimeSettings">
    <UiField>
      {t("Name")}<UiInput
        type="text"
        value={data.name}
        placeholder={t("Optional name")}
        onChange={(event) => setData({ ...data, name: event.target.value })}
      />
    </UiField>

    <UiField>
      {t("Time Zone")}<TimeZoneInput
        timeZone={data.timeZone}
        onChange={(timeZone) => setData({ ...data, timeZone })}
      />
    </UiField>

    <UiCheck>
      <UiInput
        type="radio"
        checked={data.mode === "analogue"}
        onChange={() => setData({ ...data, mode: "analogue" })}
      />{" "}
      {t("Analogue")}</UiCheck>

    <UiCheck>
      <UiInput
        type="radio"
        checked={data.mode === "digital" && data.hour12}
        onChange={() => setData({ ...data, mode: "digital", hour12: true })}
      />{" "}
      {t("12-hour digital")}</UiCheck>

    <UiCheck>
      <UiInput
        type="radio"
        checked={data.mode === "digital" && !data.hour12}
        onChange={() => setData({ ...data, mode: "digital", hour12: false })}
      />{" "}
      {t("24-hour digital")}</UiCheck>

    <UiCheck>
      <UiInput
        type="checkbox"
        checked={data.showSeconds}
        onChange={() => setData({ ...data, showSeconds: !data.showSeconds })}
      />{" "}
      {t("Display seconds")}</UiCheck>

    <UiCheck>
      <UiInput
        type="checkbox"
        checked={data.showMinutes}
        onChange={() => setData({ ...data, showMinutes: !data.showMinutes })}
      />{" "}
      {t("Display minutes")}</UiCheck>

    {data.mode === "digital" && data.hour12 && (
      <UiCheck>
        <UiInput
          type="checkbox"
          checked={data.showDayPeriod}
          onChange={() =>
            setData({ ...data, showDayPeriod: !data.showDayPeriod })
          }
        />{" "}
        {t("Display day period")}</UiCheck>
    )}

    <UiCheck>
      <UiInput
        type="checkbox"
        checked={data.showDate}
        onChange={() => setData({ ...data, showDate: !data.showDate })}
      />{" "}
      {t("Display date")}</UiCheck>
  </div>
);

export default TimeSettings;
