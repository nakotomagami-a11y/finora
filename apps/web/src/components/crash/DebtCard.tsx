"use client";

import { Badge } from "@finora/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatAsOfDate, formatDollars, tickerValue, type RowView } from "./model.ts";
import { Caveat, RowSkeleton, SourceChips, useLocaleId } from "./parts.tsx";

/**
 * The US national debt (M08): a ticking estimate between official figures, beside the official figure and its date.
 * The estimate is never shown alone. Its digits are `aria-hidden` (they change every second), and a static line gives
 * a reader the estimate, the official figure and its date. It ticks once a second, in place, with no motion.
 */
export function DebtCard({ row, now }: { row: RowView | undefined; now: Date }) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  const [tick, setTick] = useState(now);
  useEffect(() => {
    const timer = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ticking = row?.ticker && row.state !== "loading" && row.state !== "error" ? row.ticker : undefined;
  const estimate = ticking ? formatDollars(locale, tickerValue(ticking, tick)) : undefined;
  const official = row?.value !== undefined ? formatDollars(locale, row.value) : undefined;
  const date = row?.asOf ? formatAsOfDate(locale, row.asOf) : undefined;
  return (
    <section aria-labelledby="debt-h" className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface p-5">
      <div className="flex items-baseline gap-2">
        <h2 id="debt-h" className="font-sans text-h3 font-semibold text-ink">
          {t("tiles.M08")}
        </h2>
        <span className="ml-auto font-mono text-mono text-muted">M08</span>
      </div>
      {row === undefined || row.state === "loading" ? (
        <>
          <RowSkeleton className="h-9 w-full" />
          <RowSkeleton className="h-3.5 w-2/3" />
        </>
      ) : row.state === "not_configured" || row.state === "error" ? (
        <span className="text-small text-muted">{t("error")}</span>
      ) : (
        <>
          {estimate ? (
            <span aria-hidden data-ticker className="block min-h-10 text-[clamp(22px,2.4vw,34px)] leading-[1.15] font-semibold tracking-[-0.01em] whitespace-nowrap text-ink tabular-nums">
              {estimate}
            </span>
          ) : null}
          {estimate && official && date ? <span className="sr-only">{t("debt.spoken", { estimate, official, date })}</span> : null}
          {estimate ? (
            <span className="flex flex-wrap items-center gap-2 text-small text-ink-2">
              <Badge tone="neutral">{t("debt.estimate")}</Badge>
              <span>{t("debt.ticking")}</span>
            </span>
          ) : null}
          <div className="flex flex-col">
            {official && date ? (
              <div className="flex items-baseline justify-between gap-3 border-t border-line py-1.5 text-small first:border-t-0">
                <span className="text-muted">{t("debt.official", { date })}</span>
                <span className="tabular-nums">{official}</span>
              </div>
            ) : null}
          </div>
          {estimate ? <Caveat>{t("debt.caveat")}</Caveat> : null}
        </>
      )}
      <div className="mt-auto flex flex-col gap-1.5">
        {row ? <SourceChips rows={[row]} /> : null}
        {row?.attribution ? <Caveat>{row.attribution}</Caveat> : null}
      </div>
    </section>
  );
}
