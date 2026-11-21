import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, isLocale } from "@finora/i18n";
import { getTranslations } from "next-intl/server";

// Next.js does not apply the metadata of a `not-found` file to the page, so the title is set here, where the 404 starts.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: isLocale(locale) ? locale : DEFAULT_LOCALE, namespace: "errors" });
  return { title: t("notFoundTitle") };
}

/** Sends every unknown path under a locale to the localised not-found page. */
export default function CatchAll(): never {
  notFound();
}
