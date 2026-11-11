import { UiField, UiInput } from "../../ui";
import { t } from "../../locales/ui";
import React from "react";
import { WidgetDisplay as WidgetDisplayType } from "../../db/state";
import PositionInput from "./PositionInput";
import "./WidgetDisplay.css";

type Props = {
  display: WidgetDisplayType;
  onChange: (display: Partial<WidgetDisplayType>) => void;
};

const WidgetDisplay: React.FC<Props> = ({ display, onChange }) => {
  return (
    <div className="WidgetDisplay">
      <PositionInput
        value={display.position}
        onChange={(position) => onChange({ position })}
      />

      <UiField>
        {t("Size")}<br />
        <UiInput
          type="range"
          value={display.fontSize}
          min="2"
          max="100"
          step="2"
          onChange={(event) =>
            onChange({ fontSize: Number(event.target.value) })
          }
        />
      </UiField>
    </div>
  );
};

export default WidgetDisplay;
