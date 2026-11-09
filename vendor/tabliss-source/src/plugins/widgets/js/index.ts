import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Js from "./Js";
import JsSettings from "./JsSettings";

const config: Config = {
  key: "widget/js",
  get name() { return t("Custom JS"); },
  get description() { return t("Program in your program."); },
  dashboardComponent: Js,
  settingsComponent: JsSettings,
};

export default config;
