"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** The gallery honours `?theme=dark|light` so a state can be linked in either theme. */
export function ThemeFromQuery() {
  const theme = useSearchParams().get("theme");
  useEffect(() => {
    if (theme === "dark" || theme === "light") document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return null;
}
