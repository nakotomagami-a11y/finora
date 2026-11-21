import { getTranslations } from "next-intl/server";
import { Link } from "../../i18n/navigation.ts";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <>
      <h1 tabIndex={-1} className="font-serif text-h1 text-ink outline-none">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-3 text-ink-2">{t("not_found")}</p>
      <p className="mt-6">
        <Link href="/" className="inline-flex h-9 items-center rounded-btn border border-line-strong px-4 text-small font-medium">
          {t("notFoundAction")}
        </Link>
      </p>
    </>
  );
}
