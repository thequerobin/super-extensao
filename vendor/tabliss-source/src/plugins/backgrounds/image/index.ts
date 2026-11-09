import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Image from "./Image";
import ImageSettings from "./ImageSettings";

const config: Config = {
  key: "background/image",
  get name() { return t("Upload Images"); },
  get description() { return t("See your own images."); },
  dashboardComponent: Image,
  settingsComponent: ImageSettings,
  supportsBackdrop: true,
};

export default config;
