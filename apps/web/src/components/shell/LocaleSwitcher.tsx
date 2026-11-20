"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LOCALES, LOCALE_NAMES } from "@finora/i18n";
import { Link, usePathname } from "../../i18n/navigation.ts";

/** Switches language and keeps the path and the query. */
export function LocaleSwitcher() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <nav aria-label={t("language")}>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
        {LOCALES.map((code) => (
          <li key={code}>
            <Link
              href={href}
              locale={code}
              lang={code}
              hrefLang={code}
              aria-current={code === locale ? "true" : undefined}
              className="text-small text-muted aria-[current=true]:text-ink aria-[current=true]:underline"
            >
              {LOCALE_NAMES[code]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
