import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Colour from "./Colour";
import ColourSettings from "./ColourSettings";

const config: Config = {
  key: "background/colour",
  get name() { return t("Solid Colour"); },
  get description() { return t("Add a splash of colour."); },
  dashboardComponent: Colour,
  settingsComponent: ColourSettings,
};

export default config;
