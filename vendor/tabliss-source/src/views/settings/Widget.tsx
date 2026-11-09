import { t } from "../../locales/ui";
import React from "react";
import { setWidgetDisplay } from "../../db/action";
import { WidgetState } from "../../db/state";
import { useToggle } from "../../hooks";
import { getConfig } from "../../plugins";
import { DownIcon, Icon, IconButton, RemoveIcon, UpIcon } from "../shared";
import PluginContainer from "../shared/Plugin";
import ToggleSection from "../shared/ToggleSection";
import "./Widget.sass";
import WidgetDisplay from "./WidgetDisplay";

interface Props {
  plugin: WidgetState;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
}

const Widget: React.FC<Props> = ({
  plugin,
  onMoveDown,
  onMoveUp,
  onRemove,
}) => {
  const [isOpen, toggleIsOpen] = useToggle(onRemove === undefined);

  const { description, name, settingsComponent } = getConfig(plugin.key);

  const setDisplay = setWidgetDisplay.bind(null, plugin.id);

  return (
    <fieldset className="Widget">
      <div className="title--buttons">
        <IconButton onClick={onRemove} title={t("Remove widget")}>
          <RemoveIcon />
        </IconButton>

        <IconButton
          onClick={toggleIsOpen}
          title={t(isOpen ? "Close widget settings" : "Edit widget settings")}
        >
          <Icon name="settings" />
        </IconButton>

        {onMoveDown && (
          <IconButton onClick={onMoveDown} title={t("Move widget down")}>
            <DownIcon />
          </IconButton>
        )}

        {onMoveUp && (
          <IconButton onClick={onMoveUp} title={t("Move widget up")}>
            <UpIcon />
          </IconButton>
        )}

        <h4 onClick={toggleIsOpen}>{name}</h4>
        {!isOpen && <p>{description}</p>}
      </div>

      {isOpen && (
        <div>
          {settingsComponent && (
            <div className="settings">
              <PluginContainer id={plugin.id} component={settingsComponent} />
            </div>
          )}

          <ToggleSection name={t("Display Settings")}>
            <WidgetDisplay display={plugin.display} onChange={setDisplay} />
          </ToggleSection>

          <ToggleSection name={t("Font Settings")}>
            <>
              <label>
                {t("Font")}<input
                  type="text"
                  value={plugin.display.fontFamily}
                  onChange={(event) =>
                    setDisplay({ fontFamily: event.target.value })
                  }
                />
              </label>

              <label>
                {t("Weight")}<select
                  value={plugin.display.fontWeight}
                  onChange={(event) =>
                    setDisplay({
                      fontWeight: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    })
                  }
                >
                  <option value="">{t("Default")}</option>
                  <option value="100">{t("Thin")}</option>
                  <option value="300">{t("Light")}</option>
                  <option value="400">{t("Regular")}</option>
                  <option value="500">{t("Medium")}</option>
                  <option value="700">{t("Bold")}</option>
                  <option value="900">{t("Black")}</option>
                </select>
              </label>

              <label>
                {t("Colour")}<input
                  type="color"
                  value={plugin.display.colour ?? "#ffffff"}
                  onChange={(event) =>
                    setDisplay({ colour: event.target.value })
                  }
                />
              </label>
            </>
          </ToggleSection>
        </div>
      )}
    </fieldset>
  );
};

export default Widget;
