import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Giphy from "./Giphy";
import GiphySettings from "./GiphySettings";

const config: Config = {
  key: "background/giphy",
  name: "GIPHY",
  get description() { return t("Hurt your eyes in every new tab."); },
  dashboardComponent: Giphy,
  settingsComponent: GiphySettings,
  supportsBackdrop: true,
};

export default config;
