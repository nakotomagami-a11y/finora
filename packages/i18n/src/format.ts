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

/** A moment such as `2026-11-20T06:10:00Z`, shown as `20 Nov 2026, 06:10` in the active locale. `timeZone` defaults to the machine's. */
export function formatDateTime(locale: Locale, iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

/** The time of day, `14:00`, 24-hour in every locale. */
export function formatTime(locale: Locale, iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
}

/** How long ago (or how long until) a moment is, in whole units: `2 minutes ago`, `in 3 hours`. */
export function formatRelative(locale: Locale, iso: string, now: Date): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return formatter.format(Math.trunc(seconds / size), unit);
  return formatter.format(seconds, "second");
}
