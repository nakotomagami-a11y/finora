import { z } from "zod";

// GET /api/v1/markets/crash (architecture §8, loaders/markets.md §1.4). Written with S22; S04b owns the
// contract file set and may fold this in. Money is whole US dollars as a float: an integer of micro-USD
// passes Number.MAX_SAFE_INTEGER above about $9 billion, and these values run to trillions.

export const SourceRef = z.object({
  sourceId: z.string().min(1),
  licenceId: z.string().min(1),
  retrievedAt: z.string().min(1),
  asOf: z.string().nullable(),
  asOfBasis: z.string().nullable(),
  checkedAt: z.string().nullable(),
  accessTier: z.enum(["open", "purpose"]),
  derived: z.boolean(),
});

export const TileId = z.enum(["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"]);

export const MarketRow = z
  .object({
    rowKey: z.string().min(1),
    itemId: z.string().regex(/^M0\d\.X\.\d{2}[a-z]?$/),
    label: z.string().min(1),
    state: z.enum(["ok", "stale", "needs_key", "needs_symbol", "peak_unknown", "error", "loading"]),
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
    symbol: z.string().optional(),
    ticker: z.object({ total: z.number(), anchor: z.string(), perSecond: z.number() }).optional(),
    sources: z.array(SourceRef),
  })
  .strict()
  // A value always has its source; a peak-unknown row never shows a drawdown (never 0%).
  .refine((r) => r.value === undefined || r.sources.length > 0, { message: "a value needs a source" })
  .refine((r) => r.state !== "peak_unknown" || r.drawdownPct === undefined, { message: "no drawdown without a known peak" })
  .refine((r) => !["needs_key", "needs_symbol"].includes(r.state) || r.value === undefined, { message: "no number without a key or a symbol" });

export const CrashResponse = z
  .object({
    tiles: z.array(z.object({ tileId: TileId, rows: z.array(MarketRow) }).strict()),
    totalWiped: z.object({ valueUsd: z.number(), rowItemIds: z.array(z.string()), excludedItemIds: z.array(z.string()), oldestAsOf: z.string() }).strict().optional(),
  })
  .strict();
export type CrashResponse = z.infer<typeof CrashResponse>;
export type MarketRow = z.infer<typeof MarketRow>;
