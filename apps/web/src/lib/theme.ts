export const THEME_COOKIE = "finora-theme";

export type ThemeChoice = "system" | "dark" | "light";

/** A stored cookie value as a choice. Anything else, or no cookie, means "system". */
export function themeFromCookie(value: string | undefined): ThemeChoice {
  return value === "dark" || value === "light" ? value : "system";
}
