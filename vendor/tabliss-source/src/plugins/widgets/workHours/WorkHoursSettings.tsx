import { UiCheck, UiField, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const daysList = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WorkHoursSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="WorkHoursSettings">
    <UiField>
      {t("Start time")}<UiInput
        type="time"
        value={data.startTime}
        onChange={(event) =>
          setData({ ...data, startTime: event.target.value })
        }
      />
    </UiField>
    <UiField>
      {t("End time")}<UiInput
        type="time"
        value={data.endTime}
        onChange={(event) => setData({ ...data, endTime: event.target.value })}
      />
    </UiField>
    {daysList.map((day, index) => (
      <div key={day}>
        <UiCheck>
          <UiInput
            type="checkbox"
            checked={data.days.includes(index)}
            onChange={(event) =>
              setData({
                ...data,
                days: event.target.checked
                  ? [...data.days, index]
                  : data.days.filter((day) => day !== index),
              })
            }
          />
          {t(day)}
        </UiCheck>
      </div>
    ))}
  </div>
);

export default WorkHoursSettings;
