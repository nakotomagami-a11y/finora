import type { Locale } from "./index.ts";

/** English dates read day first (`19 Nov 2026`, DESIGN.md §4), so `en` formats as British English. */
const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", lt: "lt", lv: "lv", et: "et" };

/** What a date that cannot be read shows: a dash. A bad string from the server must never throw inside a render. */
export const NO_DATE = "—";

/** The date for an ISO string, or null when it is not a date (`new Date` of a bad string is an invalid date, not an error). */
function toDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A register date such as `2026-11-19`, shown as `19 Nov 2026` in the active locale. Dates are UTC. */
export function formatDate(locale: Locale, iso: string): string {
  const date = toDate(iso);
  if (!date) return NO_DATE;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}

/** A moment such as `2026-11-20T06:10:00Z`, shown as `20 Nov 2026, 06:10` in the active locale. `timeZone` defaults to the machine's. */
export function formatDateTime(locale: Locale, iso: string, timeZone?: string): string {
  const date = toDate(iso);
  if (!date) return NO_DATE;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/** The time of day, `14:00`, 24-hour in every locale. */
export function formatTime(locale: Locale, iso: string, timeZone?: string): string {
  const date = toDate(iso);
  if (!date) return NO_DATE;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...(timeZone ? { timeZone } : {}) }).format(date);
}

/** How long ago (or how long until) a moment is, in whole units: `2 minutes ago`, `in 3 hours`. */
export function formatRelative(locale: Locale, iso: string, now: Date): string {
  const date = toDate(iso);
  if (!date || Number.isNaN(now.getTime())) return NO_DATE;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return formatter.format(Math.trunc(seconds / size), unit);
  return formatter.format(seconds, "second");
}
