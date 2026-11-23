import { isPersonalUseLine } from "@finora/domain";
import { z } from "zod";
import { SourceRef } from "./common.ts";

// GET /api/v1/markets/crash (architecture §8, loaders/markets.md §1.4). Written with S22; its SourceRef is the
// shared one in common.ts (S04b). Money is whole US dollars as a float: an integer of micro-USD
// passes Number.MAX_SAFE_INTEGER above about $9 billion, and these values run to trillions.


/** The coded providers of the local provider file (`PROVIDER_URLS` in @finora/markets; a server test keeps them equal). */
export const PROVIDER_CODES = ["x4", "c1", "c3", "o3", "e1", "fred-cited"] as const;

// M02 (Europe) and M04 (Americas excluding the US) had only key-gated rows; human ruling H5 removed them.
export const TileId = z.enum(["M01", "M03", "M05", "M06", "M07", "M08"]);

export const MarketRow = z
  .object({
    rowKey: z.string().min(1),
    itemId: z.string().regex(/^M0\d\.X\.\d{2}[a-z]?$/),
    label: z.string().min(1),
    state: z.enum(["ok", "stale", "not_configured", "peak_unknown", "error", "loading"]),
    unit: z.enum(["index_points", "usd", "usd_per_oz", "usd_per_bbl", "usd_cap", "coins"]),
    value: z.number().optional(),
    asOf: z.string().optional(),
    peak: z.object({ value: z.number(), date: z.string(), basis: z.enum(["since", "all_time", "seeded"]) }).optional(),
    trackingSince: z.string().optional(),
    dayChangePct: z.number().optional(),
    drawdownPct: z.number().max(0).optional(),
    valueLostUsd: z.number().optional(),
    cadence: z.enum(["quarterly", "monthly", "daily_exchange", "daily_7d", "live"]),
    delayed: z.boolean(),
    ticker: z.object({ total: z.number(), anchor: z.string(), perSecond: z.number() }).optional(),
    /** State error only: the last stored value, too old to count as current, with its date (U9 7). */
    lastGood: z.object({ value: z.number(), asOf: z.string().min(1) }).strict().optional(),
    /** State not_configured only: the provider code the user's local provider file must add (H4). */
    provider: z.enum(PROVIDER_CODES).optional(),
    /** The debt row only: the change between two official figures 30 days apart (DESIGN.md §12). */
    change30d: z.object({ valueUsd: z.number(), from: z.string(), to: z.string() }).strict().optional(),
    /** The source's attribution line; for a coded provider it comes from the user's local provider file (H4). */
    attribution: z.string().min(1).max(200).optional(),
    sources: z.array(SourceRef),
  })
  .strict()
  // A value always has its source; a peak-unknown row never shows a drawdown (never 0%).
  .refine((r) => r.value === undefined || r.sources.length > 0, { message: "a value needs a source" })
  .refine((r) => r.state !== "peak_unknown" || r.drawdownPct === undefined, { message: "no drawdown without a known peak" })
  // A row whose provider is not configured (H4) shows no number, never 0% (qa 7066883380, condition 4).
  .refine((r) => r.state !== "not_configured" || (r.value === undefined && r.drawdownPct === undefined), { message: "no number for a provider that is not configured" })
  .refine((r) => r.ticker === undefined || r.itemId === "M08.X.01", { message: "only the debt row carries a ticker" })
  .refine((r) => r.change30d === undefined || r.itemId === "M08.X.01", { message: "only the debt row carries a 30-day change" })
  .refine((r) => r.lastGood === undefined || (r.state === "error" && r.sources.length > 0), { message: "a last good value only on an error row, with its source" })
  .refine((r) => (r.state === "not_configured") === (r.provider !== undefined), { message: "a not-configured row names its provider, and only such a row does" })
  // The daily US rows are lit for personal use only: a value is shown only with legal's approved line, exactly (legal 7070739448).
  .refine((r) => r.itemId !== "M01.X.03" || r.value === undefined || isPersonalUseLine(r.attribution ?? ""), { message: "a daily US row needs its personal-use attribution" });

export const CrashResponse = z
  .object({
    /** The start of every "since" peak window: the user's peak date setting (a basis of all_time or seeded says otherwise). */
    peakSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tiles: z.array(z.object({ tileId: TileId, rows: z.array(MarketRow) }).strict()),
    totalWiped: z.object({ valueUsd: z.number(), rowItemIds: z.array(z.string()), excludedItemIds: z.array(z.string()), oldestAsOf: z.string() }).strict().optional(),
  })
  .strict();
export type CrashResponse = z.infer<typeof CrashResponse>;
export type MarketRow = z.infer<typeof MarketRow>;
