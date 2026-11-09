import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Search from "./Search";
import SearchSettings from "./SearchSettings";

const config: Config = {
  key: "widget/search",
  get name() { return t("Search Box"); },
  get description() { return t("Move your URL bar."); },
  dashboardComponent: Search,
  settingsComponent: SearchSettings,
};

export default config;
