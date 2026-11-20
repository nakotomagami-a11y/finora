import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getAbout } from "@finora/server/render";
import { Link } from "../../i18n/navigation.ts";
import { LocaleSwitcher } from "./LocaleSwitcher.tsx";

/** Every page carries the source-code link (R18, AGPL-3.0 section 13) and the terms link (P7). */
export async function Footer() {
  const t = await getTranslations("footer");
  const about = getAbout();

  return (
    <footer aria-label={t("label")} className="border-t border-line px-6 py-6 text-small text-muted">
      <div className="mx-auto flex max-w-[var(--content-max)] flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-1 p-0">
          <li>
            <a href={about.sourceUrl} rel="noopener noreferrer" data-testid="source-link">
              {t("sourceCode")}
            </a>
          </li>
          <li>
            <Link href="/terms" data-testid="terms-link">
              {t("terms")}
            </Link>
          </li>
          <li>{t("licence")}</li>
        </ul>
        <Suspense fallback={null}>
          <LocaleSwitcher />
        </Suspense>
      </div>
    </footer>
  );
}
