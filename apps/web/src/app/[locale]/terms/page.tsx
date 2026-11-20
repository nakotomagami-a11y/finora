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
      <p className="mt-6 text-ink">{t("disclaimer")}</p>
      <p className="mt-6 text-small text-muted">{t("draft")}</p>
    </article>
  );
}
