import type { Locale } from "./index.ts";

/** English dates read day first (`19 Nov 2026`, DESIGN.md §4), so `en` formats as British English. */
const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", lt: "lt", lv: "lv", et: "et" };

/** A register date such as `2026-11-19`, shown as `19 Nov 2026` in the active locale. Dates are UTC. */
export function formatDate(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}
