import { widgets } from "../../../../newtab/engine/settings";
import { db } from "./state";
export const selectWidgets = () => widgets(db);
