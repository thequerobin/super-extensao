import React from "react";
import { defineMessages } from "react-intl";
import { ErrorContext } from "../../contexts/error";
import { UiContext } from "../../contexts/ui";
import { toggleFocus } from "../../db/action";
import { db } from "../../db/state";
import { useFormatMessages, useFullscreen, useKeyPress } from "../../hooks";
import { useValue } from "../../lib/db/react";
import { Icon } from "../shared";
import { UiActions, UiButton } from "../../ui";
import "./Overlay.sass";

const messages = defineMessages({
  settingsHint: {
    id: "dashboard.settingsHint",
    defaultMessage: "Customise Tabliss",
    description: "Hover hint text for the settings icon",
  },
  focusHint: {
    id: "dashboard.focusHint",
    defaultMessage: "Toggle widgets",
    description: "Hover hint text for the widgets toggle",
  },
  fullscreenHint: {
    id: "dashboard.fullscreenHint",
    defaultMessage: "Toggle fullscreen",
    description: "Hover hint text for the fullscreen toggle",
  },
  loadingHint: {
    id: "dashboard.loadingHint",
    defaultMessage: "Loading new content",
    description:
      "Hover hint text for the loading indicator icon (the lightning bolt)",
  },
  errorHint: {
    id: "dashboard.errorHint",
    defaultMessage: "Show errors",
    description: "Hover hint text for the error indicator icon",
  },
});

const Overlay: React.FC = () => {
  const translated = useFormatMessages(messages);
  const focus = useValue(db, "focus");
  const { errors } = React.useContext(ErrorContext);
  const { pending, toggleErrors, toggleSettings } = React.useContext(UiContext);

  useKeyPress(toggleFocus, ["w"]);
  useKeyPress(toggleSettings, ["s"]);

  // Hooks inside a condition? Works because the condition always resolves the same
  const [isFullscreen, handleToggleFullscreen] = useFullscreen();
  if (handleToggleFullscreen) useKeyPress(handleToggleFullscreen, ["f"]);

  return (
    <UiActions className="Overlay" role="group" aria-label={translated.settingsHint}>
      <UiButton onClick={toggleSettings} title={`${translated.settingsHint} (S)`} aria-label={translated.settingsHint}>
        <span aria-hidden="true"><Icon name="settings" /></span>
      </UiButton>

      {errors.length > 0 ? (
        <UiButton className="ui-button-danger" onClick={toggleErrors} title={translated.errorHint} aria-label={translated.errorHint}>
          <span aria-hidden="true"><Icon name="alert-triangle" /></span>
        </UiButton>
      ) : null}

      {pending > 0 ? (
        <span className="overlay-loading" role="status" title={translated.loadingHint} aria-label={translated.loadingHint}>
          <span aria-hidden="true"><Icon name="zap" /></span>
        </span>
      ) : null}

      <UiButton
        onClick={toggleFocus}
        title={`${translated.focusHint} (W)`}
        aria-label={translated.focusHint}
        aria-pressed={!focus}
      >
        <span aria-hidden="true"><Icon name={focus ? "eye-off" : "eye"} /></span>
      </UiButton>

      {handleToggleFullscreen ? (
        <UiButton
          onClick={handleToggleFullscreen}
          title={`${translated.fullscreenHint} (F)`}
          aria-label={translated.fullscreenHint}
          aria-pressed={isFullscreen}
        >
          <span aria-hidden="true"><Icon name={isFullscreen ? "minimize-2" : "maximize-2"} /></span>
        </UiButton>
      ) : null}
    </UiActions>
  );
};

export default Overlay;
