import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Greeting from "./Greeting";
import GreetingSettings from "./GreetingSettings";

const config: Config = {
  key: "widget/greeting",
  get name() { return t("Greeting"); },
  get description() { return t("Be personally greeted all day."); },
  dashboardComponent: Greeting,
  settingsComponent: GreetingSettings,
};

export default config;
