/* SPDX-License-Identifier: GPL-3.0-only */
import { State, positions } from "./model";
const object = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function fail(): never {
  throw new TypeError("Unexpected format");
}
function safeJson(value: unknown, depth = 0): void {
  if (depth > 60) fail();
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => safeJson(entry, depth + 1));
    return;
  }
  if (!object(value)) fail();
  for (const [key, entry] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) fail();
    safeJson(entry, depth + 1);
  }
}
function identity(value: any, kind: "background" | "widget"): void {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 128 ||
    /[\/\0]/.test(value.id) ||
    typeof value.key !== "string" ||
    !value.key.startsWith(kind + "/") ||
    !object(value.display)
  )
    fail();
}
/** Validate and copy before any write; keep the public v3 export and v2 migration contract. */
export function decode(input: unknown): Partial<State> {
  if (!object(input)) fail();
  safeJson(input);
  if (JSON.stringify(input).length > 2 * 1024 * 1024) fail();
  const source = JSON.parse(JSON.stringify(input)) as Record<string, any>;
  let result: Record<string, any>;
  if ("backgrounds" in source) {
    if (
      !Array.isArray(source.backgrounds) ||
      !Array.isArray(source.widgets) ||
      !object(source.data)
    )
      fail();
    const background = source.backgrounds.find(
      (item: any) => object(item) && item.active,
    );
    if (!background) fail();
    result = {
      background,
      focus: false,
      timeZone: source.timeZone ?? null,
      "widget/default-time": null,
      "widget/default-greeting": null,
    };
    const ids = new Set<string>();
    source.widgets.forEach((widget: any, order: number) => {
      identity(widget, "widget");
      if (ids.has(widget.id)) fail();
      ids.add(widget.id);
      result["widget/" + widget.id] = { ...widget, order };
    });
    for (const [key, value] of Object.entries(source.data))
      result["data/" + key] = value;
    if (source.locale) result.locale = source.locale;
  } else {
    if (source.version > 3)
      throw new TypeError("Settings exported from an newer version of Tabliss");
    if (source.version !== 3) throw new TypeError("Unknown settings version");
    delete source.version;
    result = source;
  }
  identity(result.background, "background");
  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith("widget/")) {
      if (value === null) continue;
      identity(value, "widget");
      if (
        key !== "widget/" + value.id ||
        !Number.isInteger(value.order) ||
        value.order < 0 ||
        !positions.includes(value.display.position)
      )
        fail();
      for (const field of ["fontSize", "fontWeight"])
        if (
          value.display[field] !== undefined &&
          (typeof value.display[field] !== "number" ||
            !Number.isFinite(value.display[field]))
        )
          fail();
    } else if (key === "focus" && typeof value !== "boolean") fail();
    else if (
      key === "locale" &&
      (typeof value !== "string" || value.length > 64)
    )
      fail();
    else if (key === "timeZone" && value !== null && typeof value !== "string")
      fail();
    else if (
      !["background", "focus", "locale", "timeZone"].includes(key) &&
      !/^data\/[^/\0]+$/.test(key)
    )
      fail();
  }
  for (const field of ["blur", "luminosity"])
    if (
      result.background.display[field] !== undefined &&
      (typeof result.background.display[field] !== "number" ||
        !Number.isFinite(result.background.display[field]))
    )
      fail();
  return result as Partial<State>;
}
