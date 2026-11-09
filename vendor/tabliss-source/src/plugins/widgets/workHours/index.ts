import { t } from "../../../locales/ui";
import { Config } from "../../types";
import WorkHours from "./WorkHours";
import WorkHoursSettings from "./WorkHoursSettings";

const config: Config = {
  key: "widget/workHours",
  get name() { return t("Work Hours"); },
  get description() { return t("Count down the working hours."); },
  dashboardComponent: WorkHours,
  settingsComponent: WorkHoursSettings,
};

export default config;
