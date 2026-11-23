"use client";

import { Icon } from "@finora/ui";
import { useTranslations } from "next-intl";
import { formatDate } from "@finora/i18n";
import { type RowView, type TileView } from "./model.ts";
import { AsOf, Caveat, Drawdown, RetryButton, RowSkeleton, SetupHelp, SourceChips, useLocaleId, useMoney } from "./parts.tsx";

type TileProps = { tile: TileView; now: Date; onRetry: () => void };

/** The text under the large figure: the peak, worded by its basis. */
function PeakLine({ row }: { row: RowView }) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  if (!row.peak) return null;
  const date = formatDate(locale, row.peak.date);
  const text = row.peak.basis === "all_time" ? t("peak.allTime", { date }) : row.peak.basis === "seeded" ? t("peak.seeded", { date }) : t("peak.since", { date });
  // The all-time high and a seeded peak say so on a line of their own; a peak since the peak date stays inline.
  return <span className={row.peak.basis === "since" ? undefined : "basis-full"}>{text}</span>;
}

/** The lag chip's words: a live figure that is a quarter of an hour late, or a series published after the date it shows. */
function Lag({ row }: { row: RowView }) {
  const t = useTranslations("crash");
  if (!row.delayed) return null;
  return <span>{row.cadence === "live" ? t("lagLive") : t("lag")}</span>;
}

/** The shape a tile (or its lead) takes while its provider is not configured: no number, and how to fix it. */
function NotConfigured({ codes, onCheck }: { codes: string[]; onCheck: () => void }) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  return (
    <div className="flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-btn border border-dashed border-line-strong p-3 text-center text-small text-muted">
      <Icon name="settings" className="size-5" />
      <span>{codes.length === 1 ? t("notConfiguredOne", { codes: codes.join(", ") }) : t("notConfiguredMany", { codes: new Intl.ListFormat(locale === "en" ? "en-GB" : locale).format(codes) })}</span>
      <span className="text-muted">{t("noNumber")}</span>
      <SetupHelp codes={codes} onCheck={onCheck} />
    </div>
  );
}

function LeadBlock({ tile, now, onRetry }: TileProps) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  const money = useMoney();
  const lead = tile.lead;
  if (!lead) return <RowSkeleton className="h-10 w-1/2" />;

  if (lead.state === "loading") {
    return (
      <>
        <RowSkeleton className="h-10 w-2/5" />
        <RowSkeleton className="h-3.5 w-3/4" />
      </>
    );
  }
  if (lead.state === "not_configured") {
    return <NotConfigured codes={lead.providerCode ? [lead.providerCode] : tile.missingProviders} onCheck={onRetry} />;
  }
  if (lead.state === "error") {
    return (
      <div className="flex min-h-[86px] flex-col items-start justify-center gap-1">
        <span className="flex items-start gap-1.5 text-small text-ink-2">
          <Icon name="warn" className="mt-0.5 size-3.5 text-warn" />
          <span>{t("error")}</span>
        </span>
        <span className="text-small text-muted">{t("errorHidden")}</span>
        <RetryButton onRetry={onRetry} />
      </div>
    );
  }
  if (lead.state === "peak_unknown") {
    return (
      <div className="flex min-h-[86px] flex-col justify-center gap-1">
        <span className="text-body text-ink">{lead.trackingSince ? t("peakUnknown", { date: formatDate(locale, lead.trackingSince) }) : t("peakUnknownShort")}</span>
        <span className="text-small text-muted">{t(`rows.${lead.labelId}`)}</span>
      </div>
    );
  }
  return (
    <>
      <div className="flex min-h-10 flex-wrap items-baseline gap-x-3">
        {lead.drawdownPct !== undefined ? <Drawdown pct={lead.drawdownPct} word="visible" big /> : <span className="text-small text-muted">{t(`rows.${lead.labelId}`)}</span>}
      </div>
      <span className="flex flex-wrap gap-x-2 text-small text-ink-2">
        <span>{t(`rows.${lead.labelId}`)}</span>
        <AsOf row={lead} now={now} />
        <PeakLine row={lead} />
        <Lag row={lead} />
      </span>
      {lead.valueLostUsd !== undefined ? <span className="text-small text-ink-2">{t("belowPeak", { money: money(lead.valueLostUsd) })}</span> : null}
    </>
  );
}

function RowLine({ row, now, onRetry }: { row: RowView; now: Date; onRetry: () => void }) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  const money = useMoney();
  let body;
  if (row.state === "loading") body = <RowSkeleton />;
  else if (row.state === "not_configured") {
    body = (
      <span className="flex max-w-[15rem] flex-col items-start gap-0.5 text-left @[20rem]:items-end @[20rem]:text-right">
        <span className="text-muted">{t("notConfiguredRow", { codes: row.providerCode ?? "" })}</span>
        <SetupHelp codes={row.providerCode ? [row.providerCode] : []} onCheck={onRetry} />
      </span>
    );
  } else if (row.state === "error") {
    body = (
      <span className="flex max-w-[15rem] flex-col items-start gap-0.5 text-left @[20rem]:items-end @[20rem]:text-right">
        <span className="text-muted">{row.invalid ? t("strip.failedCheck") : t("error")}</span>
        <RetryButton onRetry={onRetry} />
      </span>
    );
  } else if (row.state === "peak_unknown") {
    body = <span className="max-w-[15rem] text-left text-muted @[20rem]:text-right">{row.trackingSince ? t("peakUnknown", { date: formatDate(locale, row.trackingSince) }) : t("peakUnknownShort")}</span>;
  } else {
    const stale = row.state === "stale";
    body = (
      <span className="flex flex-col items-end text-right">
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          {row.drawdownPct !== undefined ? <Drawdown pct={row.drawdownPct} /> : null}
          {stale ? null : (
            <span className="text-muted">
              <AsOf row={row} now={now} />
            </span>
          )}
        </span>
        {stale ? (
          <span className="max-w-[15rem]">
            <AsOf row={row} now={now} />
          </span>
        ) : null}
        {row.valueLostUsd !== undefined ? <span className="whitespace-nowrap text-muted">{t("belowPeak", { money: money(row.valueLostUsd) })}</span> : null}
      </span>
    );
  }
  // The label is the only part that wraps: the figure and its date sit in a right column that does not shrink.
  const figure = row.state === "ok" || row.state === "stale";
  return (
    <div className={`grid items-start gap-x-3 gap-y-0.5 border-t border-line py-1.5 text-small first:border-t-0 ${figure ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1 @[20rem]:grid-cols-[minmax(0,1fr)_auto]"}`}>
      <span className="text-muted">{t(`rows.${row.labelId}`)}</span>
      {body}
    </div>
  );
}

/** One market tile: its large figure, its other rows, its caveats and attribution lines (plain text). */
export function CrashTile({ tile, now, onRetry }: TileProps) {
  const t = useTranslations("crash");
  const headingId = `tile-${tile.id}`;
  return (
    <section aria-labelledby={headingId} className="@container flex min-h-[240px] min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-card border border-line bg-surface p-5">
      <div className="flex items-baseline gap-2">
        <h2 id={headingId} className="font-sans text-h3 font-semibold text-ink">
          {t(`tiles.${tile.id}`)}
        </h2>
        <span className="ml-auto font-mono text-mono text-muted">{tile.id}</span>
      </div>
      {tile.allNotConfigured ? <NotConfigured codes={tile.missingProviders} onCheck={onRetry} /> : <LeadBlock tile={tile} now={now} onRetry={onRetry} />}
      {tile.rows.length > 0 && !tile.allNotConfigured ? (
        <div className="flex flex-col">
          {tile.rows.map((row) => (
            <RowLine key={row.rowKey} row={row} now={now} onRetry={onRetry} />
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex flex-col gap-1.5">
        <SourceChips rows={tile.all} />
        {tile.attributions.map((line) => (
          <Caveat key={line}>{line}</Caveat>
        ))}
      </div>
    </section>
  );
}

/** The skeleton of a tile, the size of the real one, so the first fill causes no layout shift. */
export function CrashTileSkeleton() {
  return (
    <section aria-busy="true" className="flex min-h-[240px] min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-card border border-line bg-surface p-5">
      <RowSkeleton className="h-5 w-2/5" />
      <RowSkeleton className="h-10 w-3/5" />
      <RowSkeleton className="h-3.5 w-4/5" />
      <RowSkeleton className="h-3.5 w-full" />
      <RowSkeleton className="h-3.5 w-3/4" />
    </section>
  );
}
