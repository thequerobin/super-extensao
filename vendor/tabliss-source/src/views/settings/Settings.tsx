import {confirmAction} from "../../../../../ui/confirmation";
import { t } from "../../locales/ui";
import React from "react";
import { UiContext } from "../../contexts/ui";
import { exportStore, importStore, resetStore } from "../../db/action";
import { useKeyPress } from "../../hooks";
import Logo from "../shared/Logo";
import Background from "./Background";
import "./Settings.sass";
import System from "./System";
import Widgets from "./Widgets";

const Settings: React.FC = () => {
  const { toggleSettings } = React.useContext(UiContext);

  const handleReset = async () => {
    if (
      await confirmAction(document,
        t("Are you sure you want to delete all of your Tabliss settings? This cannot be undone."),
      )
    )
      resetStore();
  };

  const handleExport = () => {
    const json = exportStore();
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );

    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    a.href = url;
    a.download = "tabliss.json";
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.style.display = "none";
    input.type = "file";
    input.addEventListener("change", function () {
      if (this.files) {
        const file = this.files[0];
        const reader = new FileReader();
        reader.addEventListener("load", (event) => {
          if (event.target && event.target.result) {
            try {
              const state = JSON.parse(event.target.result as string);
              importStore(state);
            } catch (error) {
              alert(
                (t("Invalid import file: ") + String(error instanceof Error ? error.message : "Uknown error") + ""),
              );
            }
          }
        });
        reader.readAsText(file);
      }
      document.body.removeChild(input);
    });
    input.click();
  };

  useKeyPress(toggleSettings, ["Escape"]);

  return (
    <div className="Settings">
      <a onClick={toggleSettings} className="fullscreen" />

      <div className="plane">
        <Logo />

        <Background />

        <Widgets />

        <System />

        <p style={{ marginBottom: "2rem" }}>
          <a onClick={handleImport}>{t("Import")}</a>,{" "}
          <a onClick={handleExport}>{t("export")}</a> {t(" or")}{" "}
          <a onClick={handleReset}>{t("reset")}</a> {t(" your settings")}</p>

      </div>
    </div>
  );
};

export default React.memo(Settings);
