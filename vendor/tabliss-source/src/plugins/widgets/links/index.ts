import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Links from "./Links";
import LinksSettings from "./LinksSettings";

const config: Config = {
  key: "widget/links",
  get name() { return t("Quick Links"); },
  get description() { return t("I heard you like bookmarks."); },
  dashboardComponent: Links,
  settingsComponent: LinksSettings,
};

export default config;
