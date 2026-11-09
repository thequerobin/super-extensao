import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Time from "./Time";
import TimeSettings from "./TimeSettings";

const config: Config = {
  key: "widget/time",
  get name() { return t("Time"); },
  get description() { return t("Be on time."); },
  dashboardComponent: Time,
  settingsComponent: TimeSettings,
};

export default config;
