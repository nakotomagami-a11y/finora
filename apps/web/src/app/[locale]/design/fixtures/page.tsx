import {
  CompanyReport,
  CrashResponse,
  ErrorResponse,
  EstimateResponse,
  InvestigationSnapshot,
  LibraryResponse,
  NetworkResponse,
  SearchResponse,
  AgentsStatusResponse,
} from "@finora/api-contract";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { FixtureView } from "../../../../components/gallery/FixtureView.tsx";
import { Link } from "../../../../i18n/navigation.ts";
import { isFixtureName, listUiFixtures, readUiFixture } from "../../../../lib/fixture-mode.ts";
import { isDemoMode } from "../../../../lib/server-data.ts";

export const metadata: Metadata = { title: "Fixture states", robots: { index: false } };

const SCHEMAS: Record<string, { parse(input: unknown): unknown }> = {
  investigation: InvestigationSnapshot,
  crash: CrashResponse,
  search: SearchResponse,
  network: NetworkResponse,
  library: LibraryResponse,
  estimate: EstimateResponse,
  "agents-status": AgentsStatusResponse,
  company: CompanyReport,
  errors: ErrorResponse,
};

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ screen?: string; state?: string }> };

/** Every fixture of `fixtures/ui/`, validated on the way in and drawn with the real reducer and formatters. Demo only. */
export default async function FixtureStates({ params, searchParams }: Props) {
  if (!isDemoMode()) notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const { screen = "investigation", state } = await searchParams;
  const all = listUiFixtures();

  let shown: { screen: string; state: string; data: unknown } | null = null;
  if (state !== undefined) {
    if (!isFixtureName(screen) || !isFixtureName(state)) notFound();
    const raw = readUiFixture({ screen, state });
    const schema = SCHEMAS[screen];
    if (raw === null || !schema) notFound();
    shown = { screen, state, data: schema.parse(raw) };
  }

  return (
    <>
      <p className="text-small text-muted">
        <Link href="/design" className="-my-1.5 inline-flex min-h-8 items-center underline">
          Design system
        </Link>
      </p>
      <h1 tabIndex={-1} className="mt-1 font-serif text-h1 text-ink outline-none">
        Fixture states
      </h1>
      <p className="mt-3 max-w-[60ch] text-ink-2">
        The synthetic data behind the demo, validated against the contract. Open one with{" "}
        <code className="font-mono text-mono">?screen=investigation&amp;state=report</code>.
      </p>
      {shown ? (
        <div className="mt-6 flex flex-col gap-5" data-testid="fixture">
          <p className="font-mono text-mono text-muted">
            {shown.screen} / {shown.state}
          </p>
          <FixtureView screen={shown.screen} data={shown.data} />
        </div>
      ) : null}
      <div className="mt-8 flex flex-col gap-4">
        {Object.entries(all).map(([name, states]) => (
          <section key={name} aria-label={name}>
            <h2 className="font-serif text-h2 text-ink">{name}</h2>
            <ul className="mt-2 flex list-none flex-wrap gap-x-4 gap-y-0 p-0">
              {states.map((item) => (
                <li key={item}>
                  <Link href={`/design/fixtures?screen=${name}&state=${item}`} className="inline-flex min-h-8 items-center text-body text-ink underline">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
