import { t } from "../../../locales/ui";
import { Config } from "../../types";
import IpInfo from "./IpInfo";
import IpInfoSettings from "./IpInfoSettings";

const config: Config = {
  key: "widget/ipInfo",
  get name() { return t("IP Info"); },
  get description() { return t("Displays data on your IP and location"); },
  dashboardComponent: IpInfo,
  settingsComponent: IpInfoSettings,
};

export default config;
