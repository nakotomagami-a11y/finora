import type { Metadata } from "next";
import { DEFAULT_LOCALE, isLocale } from "@finora/i18n";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: isLocale(locale) ? locale : DEFAULT_LOCALE, namespace: "crash" });
  return { title: t("title") };
}

export default async function CrashMonitor({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("crash");

  return (
    <>
      <h1 tabIndex={-1} className="font-serif text-h1 text-ink outline-none">
        {t("title")}
      </h1>
      <p className="mt-3 max-w-[60ch] text-ink-2">{t("placeholder")}</p>
    </>
  );
}
