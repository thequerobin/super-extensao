import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Gradient from "./Gradient";
import GradientSettings from "./GradientSettings";

const config: Config = {
  key: "background/gradient",
  get name() { return t("Colour Gradient"); },
  get description() { return t("Add more splashes of colour."); },
  dashboardComponent: Gradient,
  settingsComponent: GradientSettings,
};

export default config;
