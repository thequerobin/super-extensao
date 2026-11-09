import { t } from "../../../locales/ui";
import { Config } from "../../types";
import GitHubCalendarWidget from "./GitHub";
import GitHubSettings from "./GitHubSettings";

const config: Config = {
  key: "widget/github",
  get name() { return t("GitHub Calendar"); },
  get description() { return t("Get motivated by green squares."); },
  dashboardComponent: GitHubCalendarWidget,
  settingsComponent: GitHubSettings,
};

export default config;
