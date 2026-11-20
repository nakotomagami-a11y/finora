import type en from "../messages/en.json";

export const LOCALES = ["en", "lt", "lv", "et"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Each language's name in that language, so a reader can find theirs. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  lt: "Lietuvių",
  lv: "Latviešu",
  et: "Eesti",
};

export type Messages = typeof en;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case "en":
      return (await import("../messages/en.json", { with: { type: "json" } })).default;
    case "lt":
      return (await import("../messages/lt.json", { with: { type: "json" } })).default;
    case "lv":
      return (await import("../messages/lv.json", { with: { type: "json" } })).default;
    case "et":
      return (await import("../messages/et.json", { with: { type: "json" } })).default;
  }
}

export { formatDate, formatNumber } from "./format.ts";
