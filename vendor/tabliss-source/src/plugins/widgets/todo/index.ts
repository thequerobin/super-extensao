import { t } from "../../../locales/ui";
import { Config } from "../../types";
import Todo from "./Todo";
import TodoSettings from "./TodoSettings";

const config: Config = {
  key: "widget/todo",
  get name() { return t("Todos"); },
  get description() { return t("Add reminders to procrastinate."); },
  dashboardComponent: Todo,
  settingsComponent: TodoSettings,
};

export default config;
