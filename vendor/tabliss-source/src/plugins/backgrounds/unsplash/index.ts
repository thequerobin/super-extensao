import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Unsplash from "./Unsplash";
import UnsplashSettings from "./UnsplashSettings";

const config: Config = {
  key: "background/unsplash",
  name: "Unsplash",
  get description() { return t("Who has time to find their own images."); },
  dashboardComponent: Unsplash,
  settingsComponent: UnsplashSettings,
  supportsBackdrop: true,
};

export default config;
