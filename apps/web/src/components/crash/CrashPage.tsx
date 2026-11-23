"use client";

import { CrashResponse } from "@finora/api-contract";
import { formatDate, formatRelative } from "@finora/i18n";
import { Icon } from "@finora/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { callApi } from "../../lib/api.ts";
import { CrashTile, CrashTileSkeleton } from "./CrashTile.tsx";
import { DebtCard } from "./DebtCard.tsx";
import { DrawdownStrip, DrawdownStripSkeleton } from "./DrawdownStrip.tsx";
import { buildPageView, TILES } from "./model.ts";
import { useLocaleId, useNow } from "./parts.tsx";

/** The page polls this often while it is visible (a cache read on the server) and stops while the tab is hidden. */
export const POLL_MS = 60_000;

async function fetchCrash(): Promise<CrashResponse> {
  const result = await callApi("marketsCrash");
  if (!result.ok) throw new Error(result.code);
  return CrashResponse.parse(result.data);
}

export type CrashPageProps = {
  /** A fixture, in demo mode: shown as it is, with no polling. */
  fixture?: CrashResponse | undefined;
  /** Demo only: draw the loading skeleton and stay there. */
  loading?: boolean;
};

function Banner({ tone, role, children, action }: { tone: "warn" | "bad"; role: "status" | "alert"; children: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div role={role} className={`flex items-start gap-3 rounded-btn px-4 py-3 text-small text-ink ${tone === "warn" ? "bg-warn-tint" : "bg-bad-tint"}`}>
      <Icon name="warn" className={`mt-0.5 ${tone === "warn" ? "text-warn" : "text-bad"}`} />
      <span>
        {children}{" "}
        {action ? (
          <button type="button" onClick={action.onClick} className="inline-flex min-h-8 items-center text-small text-ink-2 underline decoration-line-strong underline-offset-[3px] hover:text-ink hover:decoration-current">
            {action.label}
          </button>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The Crash monitor (docs/plan/ui-build-plan.md §5.9, DESIGN.md §12). Every tile has a reserved height, so a refresh
 * changes values in place and moves nothing.
 */
export function CrashPage({ fixture, loading = false }: CrashPageProps) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  const now = useNow(30_000);

  const query = useQuery({
    queryKey: ["markets", "crash"],
    queryFn: fetchCrash,
    enabled: fixture === undefined && !loading,
    // TanStack pauses an interval while the tab is hidden unless asked not to: the page does not poll in the background.
    refetchInterval: fixture === undefined ? POLL_MS : false,
    refetchIntervalInBackground: false,
    // Figures that were left behind while the tab was hidden are refreshed when it is shown again (the client default is off).
    refetchOnWindowFocus: true,
  });
  const data = fixture ?? query.data;
  const page = useMemo(() => (data ? buildPageView(data) : undefined), [data]);
  const rows = useMemo(() => page?.tiles.flatMap((tile) => tile.all) ?? [], [page]);
  const refetch = () => {
    if (fixture === undefined) void query.refetch();
  };
  const clock = now ?? new Date(0);
  const ready = page !== undefined && !loading && !page.empty;

  const attributions = useMemo(() => [...new Set([...rows.flatMap((r) => (r.attribution ? [r.attribution] : [])), ...(page?.debt?.attribution ? [page.debt.attribution] : [])])], [rows, page]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 pb-2">
        <span className="text-label font-medium tracking-[0.08em] text-muted uppercase">{t("overline")}</span>
        <h1 tabIndex={-1} className="font-serif text-h1 text-ink outline-none">
          {t("heading")}
        </h1>
        <div className="flex flex-col gap-1 text-small text-ink-2">
          <span aria-live="off">{ready && page?.updatedAt && now ? t("updated", { when: formatRelative(locale, page.updatedAt, clock) }) : t("waiting")}</span>
          <span>{t("cadenceNote")}</span>
        </div>
      </div>

      {ready && page?.stale ? (
        <Banner tone="warn" role="status" action={{ label: t("banner.retry"), onClick: refetch }}>
          {t("banner.stale")}
        </Banner>
      ) : null}
      {ready && page?.failed ? (
        <Banner tone="bad" role="alert" action={{ label: t("banner.retry"), onClick: refetch }}>
          {t("banner.failed")}
        </Banner>
      ) : null}
      {query.isError && !data ? (
        <Banner tone="bad" role="alert" action={{ label: t("banner.retry"), onClick: refetch }}>
          {t("error")}
        </Banner>
      ) : null}

      {ready && page ? (
        <>
          <div className="flex flex-wrap items-stretch gap-4">
            <div className="flex min-w-0 flex-[2_1_520px] [&>section]:flex-1">
              <DrawdownStrip page={page} rows={rows} />
            </div>
            <div className="flex min-w-0 flex-[1_1_320px] [&>section]:flex-1">
              <DebtCard row={page.debt} now={clock} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {page.tiles.map((tile) => (
              <CrashTile key={tile.id} tile={tile} now={clock} onRetry={refetch} />
            ))}
          </div>
        </>
      ) : (
        <div aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-stretch gap-4">
            <div className="flex min-w-0 flex-[2_1_520px] [&>section]:flex-1">
              <DrawdownStripSkeleton />
            </div>
            <div className="flex min-w-0 flex-[1_1_320px] [&>section]:flex-1">
              <DebtCard row={undefined} now={clock} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {TILES.map((tile) => (
              <CrashTileSkeleton key={tile.id} />
            ))}
          </div>
        </div>
      )}

      <p role="note" className="m-0 flex items-center gap-1.5 text-small text-muted">
        <Icon name="dash" className="size-3.5" />
        {t("notCovered")}
      </p>
      <p className="m-0 text-small text-muted">{t("personalUse")}</p>

      <section aria-labelledby="how-h" className="flex flex-col gap-1 text-small text-muted">
        <h2 id="how-h" className="text-small font-semibold text-ink-2">
          {t("how.title")}
        </h2>
        <span>{page?.peakSince ? t("how.bodySince", { since: formatDate(locale, page.peakSince) }) : t("how.body")}</span>
        {attributions.length > 0 ? (
          <>
            <span className="font-medium text-ink-2">{t("how.sources")}</span>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {attributions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
