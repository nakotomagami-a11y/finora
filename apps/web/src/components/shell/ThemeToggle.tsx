"use client";

import { SegmentedControl } from "@finora/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { THEME_COOKIE, type ThemeChoice } from "../../lib/theme.ts";

/** System, dark or light. The choice is a cookie, so the server renders the right theme on the first paint. */
export function ThemeToggle({ initial }: { initial: ThemeChoice }) {
  const t = useTranslations("shell.theme");
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  const choose = (next: ThemeChoice) => {
    setChoice(next);
    const root = document.documentElement;
    if (next === "system") {
      root.removeAttribute("data-theme");
      document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
    } else {
      root.setAttribute("data-theme", next);
      document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    }
  };

  return (
    <SegmentedControl
      label={t("label")}
      value={choice}
      onValueChange={choose}
      options={[
        { value: "system", icon: "monitor", label: <span className="max-lg:sr-only">{t("system")}</span>, text: t("system") },
        { value: "dark", icon: "moon", label: <span className="max-lg:sr-only">{t("dark")}</span>, text: t("dark") },
        { value: "light", icon: "sun", label: <span className="max-lg:sr-only">{t("light")}</span>, text: t("light") },
      ]}
    />
  );
}
