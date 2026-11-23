"use client";

import { Badge, Table, Td, Th } from "@finora/ui";
import { formatDate } from "@finora/i18n";
import { useTranslations } from "next-intl";
import { formatDrawdown, formatMarketValue, type PageView, type RowView, type StripRow } from "./model.ts";
import { Drawdown, RowSkeleton, useLocaleId, useMoney } from "./parts.tsx";

/** The summary at the top of the drawdown card: the market value below the peaks of the rows that may be summed. */
function WipedSummary({ wiped, rows }: { wiped: NonNullable<PageView["wiped"]>; rows: RowView[] }) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  const money = useMoney();
  const list = new Intl.ListFormat(locale === "en" ? "en-GB" : locale, { style: "long", type: "conjunction" });
  const name = (labelId: string, asOf: string | undefined) => {
    const row = rows.find((r) => r.labelId === labelId);
    const when = asOf ?? row?.asOf;
    return when ? `${t(`rows.${labelId}`)} (${formatDate(locale, when)})` : t(`rows.${labelId}`);
  };
  return (
    <div className="flex flex-col gap-1 border-b border-line pb-3">
      <span className="text-label font-medium tracking-[0.08em] text-muted uppercase">{t("wiped.title")}</span>
      <span className="text-[34px] leading-10 font-semibold tracking-[-0.01em] text-ink tabular-nums">{money(wiped.valueUsd)}</span>
      <span className="text-small text-ink-2">
        {t("wiped.sum", { rows: list.format(wiped.counted.map((c) => name(c.labelId, c.asOf))), oldest: formatDate(locale, wiped.oldestAsOf) })}
      </span>
      {wiped.excluded.length > 0 ? <span className="text-small text-warn">{t("wiped.left", { rows: list.format(wiped.excluded.map((id) => t(`rows.${id}`))) })}</span> : null}
      <span>
        <Badge tone="info">{t("wiped.derived")}</Badge>
      </span>
    </div>
  );
}

/** The bars: a drop from each market's own peak. Decoration only: the table below is its text alternative. */
function Bars({ strip }: { strip: StripRow[] }) {
  const t = useTranslations("crash");
  return (
    <ul aria-hidden className="m-0 flex list-none flex-col gap-2.5 p-0">
      {strip.map((row) => (
        <li key={row.rowKey} className="flex items-center gap-3 text-small">
          <span className="w-[92px] flex-none text-ink-2 md:w-[150px]">{t(`rows.${row.labelId}`)}</span>
          <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            {row.kind === "drop" ? <i className="block h-full rounded-full bg-bad" style={{ width: `${Math.min(100, Math.abs(row.drawdownPct) * 2.5)}%` }} /> : null}
          </span>
          <span className="w-24 flex-none text-right tabular-nums md:w-[132px]">
            {row.kind === "drop" ? (
              <span className="inline-flex flex-col items-end">
                <Drawdown pct={row.drawdownPct} />
                {row.stale ? <span className="text-warn">{t("strip.older")}</span> : null}
              </span>
            ) : (
              <span className="text-muted">{t("peakUnknownShort")}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The strip's text alternative: peak date and value, latest value, drawdown, for each row, as a real table. */
function StripTable({ rows, strip }: { rows: RowView[]; strip: StripRow[] }) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  return (
    <div className="sr-only">
      <Table label={t("strip.table")} caption={t("strip.title")}>
        <thead>
          <tr>
            <Th>{t("strip.col.market")}</Th>
            <Th>{t("strip.col.drawdown")}</Th>
            <Th>{t("strip.col.peakDate")}</Th>
            <Th>{t("strip.col.peakValue")}</Th>
            <Th>{t("strip.col.latest")}</Th>
            <Th>{t("strip.col.asOf")}</Th>
          </tr>
        </thead>
        <tbody>
          {strip.map((s) => {
            const row = rows.find((r) => r.rowKey === s.rowKey);
            if (!row) return null;
            return (
              <tr key={s.rowKey}>
                <Td>{t(`rows.${s.labelId}`)}</Td>
                <Td>{s.kind === "drop" ? t("fromPeak", { pct: formatDrawdown(locale, s.drawdownPct).text || t("underTenth") }) : t("peakUnknownShort")}</Td>
                <Td>{row.peak ? formatDate(locale, row.peak.date) : "–"}</Td>
                <Td>{formatMarketValue(locale, row.unit, row.peak?.value) ?? "–"}</Td>
                <Td>{formatMarketValue(locale, row.unit, row.value) ?? "–"}</Td>
                <Td>{row.asOf ? formatDate(locale, row.asOf) : "–"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

export function DrawdownStrip({ page, rows }: { page: PageView; rows: RowView[] }) {
  const t = useTranslations("crash");
  return (
    <section aria-labelledby="strip-h" className="flex min-w-0 flex-col gap-3.5 rounded-card border border-line bg-surface p-5">
      {page.wiped ? <WipedSummary wiped={page.wiped} rows={rows} /> : null}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id="strip-h" className="font-serif text-h2 text-ink">
          {t("strip.title")}
        </h2>
        <span className="text-small text-muted">{t("strip.basis")}</span>
      </div>
      <Bars strip={page.strip} />
      <StripTable rows={rows} strip={page.strip} />
      <p className="m-0 text-small text-muted">{t("strip.note")}</p>
    </section>
  );
}

export function DrawdownStripSkeleton() {
  return (
    <section aria-busy="true" className="flex min-w-0 flex-col gap-3.5 rounded-card border border-line bg-surface p-5">
      <RowSkeleton className="h-5 w-1/3" />
      {Array.from({ length: 6 }, (_, i) => (
        <RowSkeleton key={i} className="h-3.5 w-full" />
      ))}
    </section>
  );
}

