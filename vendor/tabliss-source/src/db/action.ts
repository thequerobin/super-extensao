import { settings, createId } from "../../../../newtab/engine/settings";
import { db, cache } from "./state";
export { createId };
export const {
  setBackground,
  addWidget,
  removeWidget,
  reorderWidget,
  setWidgetDisplay,
  toggleFocus,
  importStore,
  exportStore,
  resetStore,
} = settings(db, cache);
