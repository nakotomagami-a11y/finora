import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "../../../i18n/navigation.ts";
import { isDemoMode } from "../../../lib/server-data.ts";
import { GROUPS } from "../../../components/gallery/group-list.ts";

export const metadata = { title: "Design system", robots: { index: false } };

/** The state gallery: every primitive in every state. Demo and test builds only (`FINORA_DEMO=1`). */
export default async function DesignIndex({ params }: { params: Promise<{ locale: string }> }) {
  if (!isDemoMode()) notFound();
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <h1 tabIndex={-1} className="font-serif text-h1 text-ink outline-none">
        Design system
      </h1>
      <p className="mt-3 max-w-[60ch] text-ink-2">
        Every primitive in every state, with fictional data. Add <code className="font-mono text-mono">?theme=dark</code> or{" "}
        <code className="font-mono text-mono">?theme=light</code> to a page to fix its theme.
      </p>
      <ul className="mt-6 flex list-none flex-col gap-2 p-0">
        {Object.entries(GROUPS).map(([id, title]) => (
          <li key={id}>
            <Link href={`/design/${id}`} className="inline-flex min-h-8 items-center text-body text-ink underline">
              {title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
