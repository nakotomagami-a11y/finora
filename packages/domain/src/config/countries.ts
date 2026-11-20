export const COUNTRIES = ["lt", "lv", "ee", "us"] as const;
export type Country = (typeof COUNTRIES)[number];
export const isCountry = (value: unknown): value is Country =>
  typeof value === "string" && (COUNTRIES as readonly string[]).includes(value);
