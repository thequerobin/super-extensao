import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Weather from "./Weather";
import WeatherSettings from "./WeatherSettings";

const config: Config = {
  key: "widget/weather",
  get name() { return t("Weather"); },
  get description() { return t("Add a window to see outside."); },
  dashboardComponent: Weather,
  settingsComponent: WeatherSettings,
};

export default config;
