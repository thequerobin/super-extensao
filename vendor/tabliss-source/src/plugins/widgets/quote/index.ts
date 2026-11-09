import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Quote from "./Quote";
import QuoteSettings from "./QuoteSettings";

const config: Config = {
  key: "widget/quote",
  get name() { return t("Quotes"); },
  get description() { return t("Be inspired (or not, there's categories)."); },
  dashboardComponent: Quote,
  settingsComponent: QuoteSettings,
};

export default config;
