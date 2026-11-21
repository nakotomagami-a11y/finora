import type { Metadata } from "next";
import { DEFAULT_LOCALE, isLocale } from "@finora/i18n";
import { getTranslations, setRequestLocale } from "next-intl/server";

const BLOCKED_USES = [
  "blockedCredit",
  "blockedEmployment",
  "blockedInsurance",
  "blockedTenancy",
  "blockedLicensing",
  "blockedServicing",
] as const;

/** The blocked uses of data about natural persons and sole traders (P7), stated in the terms. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: isLocale(locale) ? locale : DEFAULT_LOCALE, namespace: "terms" });
  return { title: t("title") };
}

export default async function Terms({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");

  return (
    <article className="max-w-[68ch]">
      <h1 tabIndex={-1} className="font-serif text-h1 text-ink outline-none">
        {t("title")}
      </h1>
      <p className="mt-4 text-ink-2">{t("intro")}</p>
      <h2 className="mt-8 font-serif text-h2 text-ink">{t("blockedHeading")}</h2>
      <ul className="mt-3 list-disc pl-5 text-ink-2">
        {BLOCKED_USES.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <p className="mt-6 text-ink-2">{t("purposeLine")}</p>
      <p className="mt-3 text-ink-2">{t("objectionLine")}</p>
      <p className="mt-6 text-ink">{t("disclaimer")}</p>
      <p className="mt-6 text-small text-muted">{t("draft")}</p>
    </article>
  );
}
