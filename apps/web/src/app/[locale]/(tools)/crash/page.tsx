import { CrashResponse } from "@finora/api-contract";
import type { Metadata } from "next";
import { DEFAULT_LOCALE, isLocale } from "@finora/i18n";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrashPage } from "../../../../components/crash/CrashPage.tsx";
import { isFixtureName, readUiFixture } from "../../../../lib/fixture-mode.ts";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: isLocale(locale) ? locale : DEFAULT_LOCALE, namespace: "crash" });
  return { title: t("title") };
}

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ state?: string }> };

/**
 * The Crash monitor. In demo mode (`FINORA_DEMO=1`) `?state=` serves a fixture (`fixtures/ui/crash/<state>.json`), or the
 * loading skeleton for `?state=loading`; in any other run the parameter is ignored and the page reads the live API.
 */
export default async function CrashMonitor({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { state } = await searchParams;

  const demoLoading = state === "loading" && readUiFixture({ screen: "crash", state: "live" }) !== null;
  const raw = state && isFixtureName(state) && !demoLoading ? readUiFixture({ screen: "crash", state }) : null;
  const fixture = raw === null ? undefined : CrashResponse.parse(raw);

  return <CrashPage fixture={fixture} loading={demoLoading} />;
}
