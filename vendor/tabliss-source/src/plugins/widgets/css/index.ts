import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Css from "./Css";
import CssSettings from "./CssSettings";

const config: Config = {
  key: "widget/css",
  get name() { return t("Custom CSS"); },
  get description() { return t("Make your new tab more style-ish (advanced users)."); },
  dashboardComponent: Css,
  settingsComponent: CssSettings,
};

export default config;
