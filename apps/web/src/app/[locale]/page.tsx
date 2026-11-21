import type { Metadata } from "next";
import { DEFAULT_LOCALE, isLocale } from "@finora/i18n";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const [shell, common] = await Promise.all([getTranslations({ locale: resolved, namespace: "shell" }), getTranslations({ locale: resolved, namespace: "common" })]);
  // The home page sits in the same segment as the layout, so the layout's title template does not reach it.
  return { title: { absolute: `${shell("tools.explorer")} · ${common("appName")}` } };
}

export default async function ExplorerHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("explorer");

  return (
    <>
      <h1 tabIndex={-1} className="font-serif text-h1 text-ink outline-none">
        {t("title")}
      </h1>
      <p className="mt-3 max-w-[60ch] text-ink-2">{t("placeholder")}</p>
    </>
  );
}
