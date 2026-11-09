import { t } from "../../../locales/ui";
import { Config } from "../../types";
import { Notes } from "./Notes";

const config: Config = {
  key: "widget/notes",
  get name() { return t("Notes"); },
  get description() { return t("Jot something down."); },
  dashboardComponent: Notes,
};

export default config;
