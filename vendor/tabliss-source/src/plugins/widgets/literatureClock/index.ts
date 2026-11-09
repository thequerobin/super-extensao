import { t } from "../../../locales/ui";
/**
 * Literature Clock Widget for Tabliss
 * Forked by Ngoc L.B. <contact@ngoclb.com>
 * ===
 * Clock using time quotes from the literature, based on work and idea by Jaap Meijers (E-reader clock).
 * @url http://jenevoldsen.com/literature-clock/
 * @url https://github.com/JohannesNE/literature-clock
 */
import { Config } from "../../types";
import LiteratureClock from "./LiteratureClock";
import LiteratureClockSettings from "./LiteratureClockSettings";

const config: Config = {
  key: "widget/literature-clock",
  get name() { return t("Literature Clock"); },
  get description() { return t("Check the time, with sophistication."); },
  dashboardComponent: LiteratureClock,
  settingsComponent: LiteratureClockSettings,
};

export default config;
