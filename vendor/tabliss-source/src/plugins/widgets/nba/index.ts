import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Nba from "./Nba";
import NbaSettings from "./NbaSettings";

const config: Config = {
  key: "widget/nba",
  get name() { return t("NBA Scores"); },
  get description() { return t("Keep up to date with today's NBA games."); },
  dashboardComponent: Nba,
  settingsComponent: NbaSettings,
};

export default config;
