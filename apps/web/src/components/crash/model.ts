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

/** The coded provider a row needs from the local provider file (H4: codes only, the real names live in that file). */
const PROVIDER_CODE: Record<string, string> = {
  "M01.X.03:us_large": "F1",
  "M01.X.03:us_broad": "F2",
  "M01.X.03:us_tech": "F3",
  "M03.X.01:japan": "F5",
  "M03.X.01:taiwan": "E1",
  "M06.X.01b:bitcoin": "X4",
  "M06.X.01b:ether": "X4",
  "M06.X.02:total_crypto": "C1",
};

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
  providerCode: string | undefined;
  /** The latest time any of its sources was checked or retrieved, for "updated" lines. */
  checkedAt: string | undefined;
};

export function toRowView(row: MarketRow): RowView {
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
    valueLostUsd: row.state === "ok" || row.state === "stale" ? row.valueLostUsd : undefined,
    peak: row.peak ? { date: row.peak.date, basis: row.peak.basis, value: hidden ? undefined : row.peak.value } : undefined,
    trackingSince: row.trackingSince,
    value: hidden || row.state === "not_configured" || row.state === "error" ? undefined : row.value,
    unit: row.unit,
    attribution: row.attribution,
    ticker: row.ticker,
    providerCode: PROVIDER_CODE[row.rowKey],
    checkedAt: times.sort().at(-1),
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
  /** The coded providers the tile's unconfigured rows need, sorted: "C1", "X4". */
  missingProviders: string[];
  /** Any row is stale. */
  stale: boolean;
  /** The attribution lines of the tile's rows, each once. */
  attributions: string[];
};

export type StripRow = { rowKey: string; labelId: string; kind: "drop"; drawdownPct: number; stale: boolean } | { rowKey: string; labelId: string; kind: "peak_unknown" };

export type WipedView = {
  valueUsd: number;
  /** The rows the sum counts, in the order the server lists them. */
  counted: { labelId: string; asOf: string | undefined }[];
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

  const strip: StripRow[] = all
    .filter((r) => r.itemId !== "M08.X.01")
    .flatMap<StripRow>((r) => {
      if ((r.state === "ok" || r.state === "stale") && r.drawdownPct !== undefined && r.drawdownPct < 0) {
        return [{ rowKey: r.rowKey, labelId: r.labelId, kind: "drop", drawdownPct: r.drawdownPct, stale: r.state === "stale" }];
      }
      if (r.state === "peak_unknown") return [{ rowKey: r.rowKey, labelId: r.labelId, kind: "peak_unknown" }];
      return [];
    })
    .sort((a, b) => (a.kind === "drop" ? a.drawdownPct : 1) - (b.kind === "drop" ? b.drawdownPct : 1));

  const labelOf = (itemId: string) => all.find((r) => r.itemId === itemId);
  const w = response.totalWiped;
  // The summary needs at least two counted rows to be a sum of anything (docs/plan/ui-build-plan.md §5.9).
  const wiped: WipedView | undefined =
    w && w.rowItemIds.length >= 2
      ? {
          valueUsd: w.valueUsd,
          counted: w.rowItemIds.flatMap((itemId) => {
            const row = labelOf(itemId);
            return row ? [{ labelId: row.labelId, asOf: row.asOf }] : [];
          }),
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

export function asOfText(locale: Locale, cadence: MarketRow["cadence"], asOf: string | undefined, now: Date): AsOfText {
  if (!asOf) return { kind: "none" };
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) return { kind: "none" };
  if (cadence === "quarterly") return { kind: "quarter", text: `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}` };
  if (cadence === "monthly") {
    const month = new Intl.DateTimeFormat(intl(locale), { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
    return { kind: "month", text: month };
  }
  if (cadence === "live") {
    const sameDay = now.toDateString() === date.toDateString();
    return { kind: sameDay ? "time" : "day", text: sameDay ? formatTime(locale, asOf) : formatDate(locale, asOf) };
  }
  return { kind: "day", text: formatDate(locale, asOf) };
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
