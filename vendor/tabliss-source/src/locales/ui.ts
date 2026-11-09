/* Super Extensão: static UI catalog, 2026-11-09. Runtime/user content is never
   inspected or replaced. This helper is used only at source literal sites. */
import portuguese from "./ui-pt-BR.json";
import iconNames from "./icons-pt-BR.json";

let currentLocale = "pt-BR";
export const normalizeLocale = (locale: string): "pt-BR" | "en" =>
  /^en(?:-|$)/i.test(locale || "") ? "en" : "pt-BR";
export function setUiLocale(locale: string) {
  currentLocale = normalizeLocale(locale);
}
export function t(message: string): string {
  if (currentLocale === "en") return message;
  const parts = /^(\s*)([\s\S]*?)(\s*)$/.exec(message)!;
  const translated = (portuguese as Record<string, string>)[parts[2]];
  return translated === undefined ? message : parts[1] + translated + parts[3];
}
export function iconLabel(name: string): string {
  return currentLocale === "en" ? name : (iconNames as Record<string, string>)[name] || name;
}
