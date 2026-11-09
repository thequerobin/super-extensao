import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Message from "./Message";
import MessageSettings from "./MessageSettings";

const config: Config = {
  key: "widget/message",
  get name() { return t("Message"); },
  get description() { return t("Add your own text."); },
  dashboardComponent: Message,
  settingsComponent: MessageSettings,
};

export default config;
