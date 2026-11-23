import type { CrashResponse, MarketRow } from "@finora/api-contract";
import { formatDate, formatNumber, formatTime, type Locale } from "@finora/i18n";

/**
 * The Crash monitor as the page draws it (docs/plan/ui-build-plan.md §5.9, DESIGN.md §12). `CrashResponse` is the
 * server's answer; this file turns it into tiles, rows, a drawdown strip and a debt card, with no React in it, so
 * every rule is a plain function with a test. A row with no number never gets one here: `not_configured`, `error`,
 * `loading` and `peak_unknown` rows carry no drawdown, and the page never shows 0%.
 */

export type RowState = MarketRow["state"];
export type TileKey = "M01" | "M03" | "M05" | "M06" | "M07";

/** The tiles in page order, and the row that is the tile's large figure. */
export const TILES: readonly { id: TileKey; lead: string }[] = [
  { id: "M01", lead: "M01.X.01:us_equities" },
  { id: "M03", lead: "M03.X.01:japan" },
  { id: "M05", lead: "M05.X.01:gold_monthly" },
  { id: "M06", lead: "M06.X.02:total_crypto" },
  { id: "M07", lead: "M07.X.01:wti" },
];

/** What the last label of a row's catalogue key is: `crash.rows.us_large` gives `us_large`. */
export const rowLabelId = (label: string): string => label.replace(/^crash\.rows\./u, "");

export type RowView = {
  rowKey: string;
  itemId: string;
  /** The id under `crash.rows` in the catalogue. */
  labelId: string;
  state: RowState;
  cadence: MarketRow["cadence"];
  /** The source publishes a day or more after the date it shows. */
  delayed: boolean;
  asOf: string | undefined;
  drawdownPct: number | undefined;
  valueLostUsd: number | undefined;
  /** The peak's date and basis; its value only where showing it is allowed. */
  peak: { date: string; basis: "since" | "all_time" | "seeded"; value: number | undefined } | undefined;
  trackingSince: string | undefined;
  /** The index-level or price value, kept only where showing it is allowed (never for an index series: drawdown only). */
  value: number | undefined;
  unit: MarketRow["unit"];
  attribution: string | undefined;
  ticker: MarketRow["ticker"];
  /** The provider code a `not_configured` row needs in the local provider file, as the response names it (H4: a code only). */
  providerCode: string | undefined;
  /** An error row only: the last stored value, too old to count as current, with its date (U9 7). */
  lastGood: { value: number; asOf: string } | undefined;
  /** The latest time any of its sources was checked or retrieved, for "updated" lines. */
  checkedAt: string | undefined;
  /** The sources behind the figure, for the tile's source chips and their popovers. */
  sources: SourceView[];
  /** The row came with a drawdown above zero, which cannot be true: it is shown as failed, never as a number. */
  invalid: boolean;
  /** The debt row only: the change between two official figures about 30 days apart (never the ticker). */
  change30d: { valueUsd: number; from: string; to: string } | undefined;
};

export type SourceView = { sourceId: string; licenceId: string; asOf: string | undefined; retrievedAt: string; checkedAt: string | undefined; accessTier: "open" | "purpose"; derived: boolean };

/** A market size under this reads "0 million" when rounded, so the page leaves it out. */
export const MIN_MONEY_USD = 500_000;

export function toRowView(source: MarketRow): RowView {
  // A drawdown above zero cannot happen (the peak is the highest close): it is bad data, shown as a row that was not checked.
  const invalid = (source.state === "ok" || source.state === "stale") && source.drawdownPct !== undefined && source.drawdownPct > 0;
  const row: MarketRow = invalid ? { ...source, state: "error", drawdownPct: undefined, valueLostUsd: undefined } : source;
  const hidden = row.unit === "index_points"; // a cited index series: drawdown only, never the raw series
  const times = row.sources.flatMap((s) => [s.checkedAt, s.retrievedAt]).filter((t): t is string => typeof t === "string");
  return {
    rowKey: row.rowKey,
    itemId: row.itemId,
    labelId: rowLabelId(row.label),
    state: row.state,
    cadence: row.cadence,
    delayed: row.delayed,
    asOf: row.asOf,
    drawdownPct: row.state === "ok" || row.state === "stale" ? row.drawdownPct : undefined,
    valueLostUsd: (row.state === "ok" || row.state === "stale") && row.valueLostUsd !== undefined && row.valueLostUsd >= MIN_MONEY_USD ? row.valueLostUsd : undefined,
    peak: row.peak ? { date: row.peak.date, basis: row.peak.basis, value: hidden ? undefined : row.peak.value } : undefined,
    trackingSince: row.trackingSince,
    value: hidden || row.state === "not_configured" || row.state === "error" ? undefined : row.value,
    unit: row.unit,
    attribution: row.attribution,
    ticker: row.ticker,
    providerCode: row.provider,
    lastGood: row.state === "error" ? row.lastGood : undefined,
    checkedAt: times.sort().at(-1),
    sources: row.sources.map((src) => ({ sourceId: src.sourceId, licenceId: src.licenceId, asOf: src.asOf ?? undefined, retrievedAt: src.retrievedAt, checkedAt: src.checkedAt ?? undefined, accessTier: src.accessTier, derived: src.derived })),
    invalid,
    change30d: row.change30d,
  };
}

export type TileView = {
  id: TileKey;
  lead: RowView | undefined;
  /** The rows under the lead, in the server's order. */
  rows: RowView[];
  all: RowView[];
  /** Every row of the tile is `not_configured`: the tile draws its empty shape. */
  allNotConfigured: boolean;
  /** The provider codes the tile's unconfigured rows need, once each, sorted: "c1", "x4". */
  missingProviders: string[];
  /** Any row is stale. */
  stale: boolean;
  /** The attribution lines of the tile's rows, each once. */
  attributions: string[];
};

/** A row of the distance strip: a drop, a market at its peak, a peak not known yet, a provider not configured, or a row that failed. */
/** How a peak was found: the highest close since the peak date, the all-time high, or a figure seeded once from a cited record. */
export type PeakBasis = "since" | "all_time" | "seeded";

export type StripRow =
  | { rowKey: string; labelId: string; kind: "drop"; drawdownPct: number; stale: boolean; basis: PeakBasis }
  | { rowKey: string; labelId: string; kind: "at_peak"; stale: boolean; basis: PeakBasis }
  | { rowKey: string; labelId: string; kind: "peak_unknown" }
  | { rowKey: string; labelId: string; kind: "not_configured" }
  | { rowKey: string; labelId: string; kind: "error"; invalid: boolean }
  | { rowKey: string; labelId: string; kind: "loading" };

export type WipedView = {
  valueUsd: number;
  /** The rows the sum counts, in the order the server lists them. */
  counted: { labelId: string; asOf: string | undefined }[];
  /** The total crypto market is among them, so the page says bitcoin and ether are part of it and not added again. */
  includesCrypto: boolean;
  /** Counted rows the server had to leave out for lack of a value. */
  excluded: string[];
  oldestAsOf: string;
};

export type PageView = {
  tiles: TileView[];
  debt: RowView | undefined;
  strip: StripRow[];
  wiped: WipedView | undefined;
  stale: boolean;
  /** Some row's source failed. */
  failed: boolean;
  /** The latest time any row was refreshed, for "Updated N min ago". */
  updatedAt: string | undefined;
  /** The start of every "since" peak window: the user's peak date setting. Absent from an older answer. */
  peakSince: string | undefined;
  /** No row has a value yet: first load or an empty install. */
  empty: boolean;
};

const latest = (times: (string | undefined)[]): string | undefined => times.filter((t): t is string => t !== undefined).sort().at(-1);

export function buildPageView(response: CrashResponse): PageView {
  const byTile = new Map(response.tiles.map((tile) => [tile.tileId, tile.rows.map(toRowView)]));
  const all = [...byTile.values()].flat();
  const tiles: TileView[] = TILES.map(({ id, lead }) => {
    const rows = byTile.get(id) ?? [];
    const leadRow = rows.find((r) => r.rowKey === lead) ?? rows[0];
    const rest = rows.filter((r) => r !== leadRow);
    const missing = [...new Set(rows.filter((r) => r.state === "not_configured").flatMap((r) => (r.providerCode ? [r.providerCode] : [])))].sort();
    return {
      id,
      lead: leadRow,
      rows: rest,
      all: rows,
      allNotConfigured: rows.length > 0 && rows.every((r) => r.state === "not_configured"),
      missingProviders: missing,
      stale: rows.some((r) => r.state === "stale"),
      attributions: [...new Set(rows.flatMap((r) => (r.attribution ? [r.attribution] : [])))],
    };
  });

  // Drops first, the biggest on top; then markets at their peak, peaks not known yet, providers not configured, rows that failed, and rows still loading. The strip never hides a market, even briefly.
  const RANK = { drop: 0, at_peak: 1, peak_unknown: 2, not_configured: 3, error: 4, loading: 5 } as const;
  const rank = (row: StripRow): number => RANK[row.kind];
  const strip: StripRow[] = all
    .filter((r) => r.itemId !== "M08.X.01")
    .flatMap<StripRow>((r) => {
      if ((r.state === "ok" || r.state === "stale") && r.drawdownPct !== undefined) {
        const stale = r.state === "stale";
        return [r.drawdownPct < 0 ? { rowKey: r.rowKey, labelId: r.labelId, kind: "drop", drawdownPct: r.drawdownPct, stale, basis: r.peak?.basis ?? "since" } : { rowKey: r.rowKey, labelId: r.labelId, kind: "at_peak", stale, basis: r.peak?.basis ?? "since" }];
      }
      if (r.state === "peak_unknown") return [{ rowKey: r.rowKey, labelId: r.labelId, kind: "peak_unknown" }];
      if (r.state === "loading") return [{ rowKey: r.rowKey, labelId: r.labelId, kind: "loading" }];
      if (r.state === "not_configured") return [{ rowKey: r.rowKey, labelId: r.labelId, kind: "not_configured" }];
      if (r.state === "error") return [{ rowKey: r.rowKey, labelId: r.labelId, kind: "error", invalid: r.invalid }];
      return [];
    })
    .sort((a, b) => rank(a) - rank(b) || (a.kind === "drop" && b.kind === "drop" ? a.drawdownPct - b.drawdownPct : 0));

  const labelOf = (itemId: string) => all.find((r) => r.itemId === itemId);
  const w = response.totalWiped;
  // The total shows over the rows it has, even when only one allows a value (designer, 7096062152): the sentence names exactly those rows.
  // A row the server left out for lack of a value is named in the "left out" line, never in the sum's own sentence.
  const counted =
    w?.rowItemIds
      .filter((itemId) => !w.excludedItemIds.includes(itemId))
      .flatMap((itemId) => {
        const row = labelOf(itemId);
        return row ? [{ labelId: row.labelId, asOf: row.asOf }] : [];
      }) ?? [];
  const wiped: WipedView | undefined =
    w && counted.length >= 1 && w.valueUsd >= MIN_MONEY_USD
      ? {
          valueUsd: w.valueUsd,
          counted,
          includesCrypto: counted.some((c) => c.labelId === "total_crypto"),
          excluded: w.excludedItemIds.flatMap((itemId) => {
            const row = labelOf(itemId);
            return row ? [row.labelId] : [];
          }),
          oldestAsOf: w.oldestAsOf,
        }
      : undefined;

  const debt = all.find((r) => r.itemId === "M08.X.01");
  return {
    tiles,
    debt,
    strip,
    wiped,
    stale: all.some((r) => r.state === "stale"),
    failed: all.some((r) => r.state === "error"),
    updatedAt: latest(all.map((r) => r.checkedAt)),
    peakSince: response.peakSince,
    empty: all.length > 0 && all.every((r) => r.state === "loading"),
  };
}

// ------------------------------------------------------------------------------------------------ formatting

const MINUS = "−";

/** `−12.4%` with a real minus sign and the locale's decimal mark. `tiny` is a drop too small to show as a number. */
export function formatDrawdown(locale: Locale, pct: number): { text: string; tiny: boolean; atPeak: boolean } {
  const drop = Math.abs(pct);
  if (drop === 0) return { text: formatNumber(locale, 0, { maximumFractionDigits: 0 }) + "%", tiny: false, atPeak: true };
  const rounded = Math.round(drop * 10) / 10;
  // A real drop too small for one decimal: no number is shown (the page says "under 0.1%"), and never 0%.
  if (rounded === 0) return { text: "", tiny: true, atPeak: false };
  return { text: `${MINUS}${formatNumber(locale, rounded, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, tiny: false, atPeak: false };
}

/** Whole US dollars of market value as "1.2 trillion" etc.: the number and the scale, for the catalogue to word. */
export function moneyScale(valueUsd: number): { scale: "trillion" | "billion" | "million"; amount: number } {
  const v = Math.abs(valueUsd);
  if (v >= 1e12) return { scale: "trillion", amount: valueUsd / 1e12 };
  if (v >= 1e9) return { scale: "billion", amount: valueUsd / 1e9 };
  return { scale: "million", amount: valueUsd / 1e6 };
}

/** One decimal for a trillion, none for a billion and a million; the locale's decimal mark. Rounds to nearest. */
export function formatMoneyAmount(locale: Locale, valueUsd: number): { scale: "trillion" | "billion" | "million"; amount: string } {
  const { scale, amount } = moneyScale(valueUsd);
  return { scale, amount: formatNumber(locale, amount, { maximumFractionDigits: scale === "trillion" ? 1 : 0, minimumFractionDigits: 0 }) };
}

/** The date or time a row's figure is as of, written for its cadence (quarterly `Q2 2026`, monthly `Oct 2026`, daily the date, live the time). */
export type AsOfText = { kind: "quarter"; text: string } | { kind: "month"; text: string } | { kind: "day"; text: string } | { kind: "time"; text: string } | { kind: "none" };

/** The calendar day of a moment in `timeZone` (the machine's when omitted), as a sortable key. */
const dayKey = (date: Date, timeZone?: string): string => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(date);

/**
 * The date of a figure's `asOf`. A date on its own (`2026-11-18`) is a calendar day and is written as it is; a moment
 * (`2026-11-22T08:20:00Z`) is written in the user's local time, like the times beside it (DESIGN.md), so it never shows
 * a day that differs from the one the reader is in.
 */
export function formatAsOfDate(locale: Locale, asOf: string, timeZone?: string): string {
  if (!asOf.includes("T")) return formatDate(locale, asOf);
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) return formatDate(locale, asOf);
  return new Intl.DateTimeFormat(intl(locale), { day: "numeric", month: "short", year: "numeric", ...(timeZone ? { timeZone } : {}) }).format(date);
}

export function asOfText(locale: Locale, cadence: MarketRow["cadence"], asOf: string | undefined, now: Date, timeZone?: string): AsOfText {
  if (!asOf) return { kind: "none" };
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) return { kind: "none" };
  if (cadence === "quarterly") return { kind: "quarter", text: `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}` };
  if (cadence === "monthly") {
    const month = new Intl.DateTimeFormat(intl(locale), { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
    return { kind: "month", text: month };
  }
  if (cadence === "live") {
    // One zone throughout: the same-day test, the time and the date are all the user's local time.
    const sameDay = dayKey(now, timeZone) === dayKey(date, timeZone);
    return { kind: sameDay ? "time" : "day", text: sameDay ? formatTime(locale, asOf, timeZone) : formatAsOfDate(locale, asOf, timeZone) };
  }
  return { kind: "day", text: formatAsOfDate(locale, asOf, timeZone) };
}

const intl = (locale: Locale): string => (locale === "en" ? "en-GB" : locale);

/** The debt estimate at `now`: the official total plus its per-second drift since the anchor. Whole dollars. */
export function tickerValue(ticker: NonNullable<MarketRow["ticker"]>, now: Date): number {
  const seconds = Math.max(0, (now.getTime() - new Date(ticker.anchor).getTime()) / 1000);
  return Math.round(ticker.total + ticker.perSecond * seconds);
}

/** Whole dollars with grouping, `$38,612,904,117,220`: the debt card's own digits. */
export function formatDollars(locale: Locale, dollars: number): string {
  return `$${formatNumber(locale, Math.round(dollars), { useGrouping: true, maximumFractionDigits: 0 })}`;
}

/**
 * A price or a market size as plain text for the strip's text alternative (`$71,000`, `$66/bbl`, `$4,080,000,000,000`).
 * An index level is never written: a cited index series is drawdown only.
 */
export function formatMarketValue(locale: Locale, unit: MarketRow["unit"], value: number | undefined): string | undefined {
  if (value === undefined || Number.isNaN(value) || unit === "index_points") return undefined;
  const suffix = unit === "usd_per_oz" ? "/oz" : unit === "usd_per_bbl" ? "/bbl" : "";
  const digits = Math.abs(value) < 1000 ? 2 : 0;
  return `$${formatNumber(locale, value, { useGrouping: true, maximumFractionDigits: digits, minimumFractionDigits: 0 })}${suffix}`;
}
