/* SPDX-License-Identifier: GPL-3.0-only */
import * as DB from "./database";
import { State, WidgetState, WidgetDisplay } from "./model";
import { decode } from "./formats";
export function createId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  return Array.from(bytes, (value) => alphabet[value & 63]).join("");
}
export const widgets = (db: DB.Database<State>): WidgetState[] =>
  Array.from(DB.prefix(db, "widget/"))
    .map(([, value]) => value)
    .filter((value): value is WidgetState => !!value)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
export function settings(
  db: DB.Database<State>,
  cache: DB.Database,
  id = createId,
) {
  return {
    setBackground(key: string) {
      const current = DB.get(db, "background");
      DB.atomic(db, (draft) => {
        DB.put(draft, "background", {
          id: id(),
          key,
          display: { blur: 0, luminosity: -0.2 },
        });
        DB.put(draft, `data/${current.id}`, undefined);
      });
      DB.del(cache, current.id);
    },
    addWidget(key: string) {
      const current = widgets(db),
        next = id();
      DB.put(db, `widget/${next}`, {
        id: next,
        key,
        order: current.length ? current[current.length - 1].order + 1 : 0,
        display: { position: "middleCentre" },
      });
    },
    removeWidget(value: string) {
      DB.atomic(db, (draft) => {
        DB.put(draft, `widget/${value}`, null);
        DB.put(draft, `data/${value}`, undefined);
      });
      DB.del(cache, value);
    },
    reorderWidget(from: number, to: number) {
      const current = widgets(db);
      if (
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 0 ||
        to < 0 ||
        from >= current.length ||
        to >= current.length
      )
        throw new RangeError("Invalid widget order");
      current.splice(to, 0, current.splice(from, 1)[0]);
      DB.atomic(db, (draft) =>
        current.forEach((widget, order) =>
          DB.put(draft, `widget/${widget.id}`, { ...widget, order }),
        ),
      );
    },
    setWidgetDisplay(value: string, display: Partial<WidgetDisplay>) {
      const current = DB.get(db, `widget/${value}`);
      if (!current) throw Error("Widget not found while");
      DB.put(db, `widget/${value}`, {
        ...current,
        display: { ...current.display, ...display },
      });
    },
    toggleFocus() {
      DB.put(db, "focus", !DB.get(db, "focus"));
    },
    importStore(input: unknown) {
      const validated = decode(input);
      DB.replace(db, Object.entries(validated));
      DB.replace(cache);
    },
    exportStore() {
      return JSON.stringify({
        ...Object.fromEntries(DB.prefix(db, "")),
        version: 3,
      });
    },
    resetStore() {
      DB.replace(db);
      DB.replace(cache);
    },
  };
}
