# markets: the Crash monitor data layer

> Loader spec by `data-markets`. It covers every M item in `docs/plan/council/01-data.md` Part G, cto's cadence (`01-data-cto.md` §7), the fund tickers in local settings (P12) and the Taiwan peak rule (cto amendment). Contract: `docs/architecture.md` §3-§4 and §8. Research and terms: `docs/research/markets.md`. Probes: `research/probes/markets/` (`official.py`, `prices_crypto.py`, `onchain.py`, `shapes.py`), last run 2026-11-20.
>
> Commercial providers keep their research codes (S7, S3, X4, C1, C3, O3) in prose. Their hosts appear only in the `SourceMeta` blocks, because the code must call them. Env var names are coded too.

This is a group spec: one shared part (series model, maths, scheduling, settings, tests), then one section per source in the template order. The template's "Party gate" does not apply to any market source: series are not parties, and no market source holds personal data.

## Part 1: shared

### 1.1 What is built in v1

| item_id | Call | Tile row | Source(s) | Value lost? |
|---|---|---|---|---|
| `M01.X.01` | CAVEAT "Quarterly; includes non-listed equity" | US corporate equities, market value | `us-fred-open` (`BOGZ1LM893064105Q`) | yes: the series is a USD market value |
| `M01.X.02` | CAVEAT fund text, KEY | US total market, US large caps, US tech (3 fund slots) | `stocks-s7` | no |
| `M02.X.01` | CAVEAT fund text, KEY | Europe (1 slot) | `stocks-s7` | no |
| `M03.X.01` | CAVEAT Taiwan peak rule | Japan (index), Taiwan (index) | `us-fred-cited` (`NIKKEI225`), `tw-twse-index` | no |
| `M03.X.02` | CAVEAT fund text, KEY | Japan, South Korea, Taiwan, Hong Kong, mainland China, India, Australia (7 slots) | `stocks-s7` | no |
| `M04.X.01` | CAVEAT fund text, KEY | Canada, Brazil (2 slots) | `stocks-s7` | no |
| `M05.X.01` | CAVEAT "Monthly average" | Gold, monthly | `intl-worldbank-pinksheet` | no |
| `M05.X.02b` | CAVEAT "With your own key; personal use" | Gold, daily | `gold-s3` | no |
| `M06.X.01b` | CAVEAT "Self-hosted, personal use" | Bitcoin, ether | `crypto-x4-ohlc` (price), `crypto-o3-btc-height` (bitcoin supply), `crypto-c1` (ether supply) | bitcoin: yes; ether: yes, citing C1 for supply |
| `M06.X.02` | CAVEAT "Personal use; attribution" | Total crypto market | `crypto-c1` (now), `crypto-c3-global` (peak) | yes: both are USD caps |
| `M07.X.01` | SHOW | Brent, WTI ($/barrel) | `us-fred-open` (`DCOILBRENTEU`, `DCOILWTICO`) | no: price only |
| `M08.X.01` | SHOW, "Ticker is an estimate" | US national debt | `us-treasury-debt` | n/a |

**Not built (LATER, no connector, negative-tested):** `M05.X.02a` and `M06.X.01a` (the oracle route, O5), `M09.X.01` (macro tiles). No code may call an oracle contract or create an M09 tile; see `tiles.test.ts` in 1.9.

**Value lost** is shown only where the row says yes (council: "only where the source's terms allow it and are quoted"). Fund rows, index rows and gold show drawdown only, until legal clears one cited cap figure per market (`markets.md` open question 1). The tile config carries `valueLost: "series" | "supply" | null`, and nothing else computes it.

**Dropped from research, not needed in v1:** FX (ECB, Fed H.10). FX was only needed to turn Asian caps into USD, and v1 shows no Asian value lost. KRX (Korea) is also dropped: Korea comes through a fund slot. The second stock connector (S6) is also dropped: one connector (S7) fills every fund slot.

### 1.2 Data model (addition to architecture §3.8)

Market series are not entities. Writing a `records` row per daily observation would double their size for no gain, so series rows carry provenance through their `sync_id`, and `syncs` already holds the licence, retrieval time and upstream as-of (§3.2). The architect takes these three tables into §3.8 and §8 in milestone B. They live in `finora.db` for `store` sources and in `connector-cache.db` (same DDL) for `connector-cache` sources.

```sql
market_series(
  id         INTEGER PRIMARY KEY,
  series_key TEXT NOT NULL UNIQUE,   -- e.g. 'fred:DCOILBRENTEU', 'twse:taiex', 's7:slot:M03.japan'
  source_id  INTEGER NOT NULL REFERENCES sources(id),
  item_id    INTEGER NOT NULL,       -- Part G item, via the items intern table
  unit       TEXT NOT NULL,          -- 'index_points' | 'usd' | 'usd_per_oz' | 'usd_per_bbl' | 'usd_cap' | 'coins'
  frequency  TEXT NOT NULL,          -- 'daily_exchange' | 'daily_7d' | 'monthly' | 'quarterly'
  symbol     TEXT                    -- fund ticker for slot series, copied from settings at sync time; NULL otherwise
);
market_obs(
  series_id INTEGER NOT NULL,
  date      TEXT NOT NULL,           -- ISO date; for monthly/quarterly the period END date
  value     REAL NOT NULL,
  sync_id   INTEGER NOT NULL,        -- the sync that wrote this value
  PRIMARY KEY (series_id, date)
) WITHOUT ROWID;
market_latest(
  series_id   INTEGER PRIMARY KEY,
  value       REAL NOT NULL,
  observed_at TEXT NOT NULL,         -- ISO UTC timestamp of the quote or snapshot, from the source
  sync_id     INTEGER NOT NULL
);
```

- **Window:** only observations dated on or after `peakSince − 10 days` are stored (the 10 days give a previous close at the window start). Moving `peakSince` earlier in Settings triggers a full refetch of every series; moving it later deletes the rows before the new window.
- **Provenance to `SourceRef`:** `sourceId` from `market_series.source_id`; `licenceId`, `retrievedAt`, `asOf` and `asOfBasis` from `market_obs.sync_id` → `syncs`; `checkedAt` from the source's latest content or unchanged sync. `sourceUrl` is the source's `deepLink`. Values Finora computes (drawdown, value lost, the debt ticker, bitcoin supply) are `derived: true` and cite the series they come from.
- **Connector cache:** `connector-cache.db` is never exported, never included in an API list or MCP bulk tool, and never served to another user (R17). Deleting a key in Settings deletes that source's rows.

### 1.3 Licence registry entries (`packages/sources/src/licences.ts`)

| LicenceId | attributionRequired | shareAlike | nonCommercial | redistribution | verifiedOn |
|---|---|---|---|---|---|
| `us-gov-public-domain` | false (citation requested) | false | false | true | 2026-11-19, Fiscal Data API docs; Fed disclaimer; EIA copyright page |
| `fred-public-domain` | true (FRED citation) | false | false | true | 2026-11-19, https://fred.stlouisfed.org/legal/ |
| `fred-citation-required` | true | false | false | **false** (owner permission needed to redistribute) | 2026-11-19, FRED legal page + series notes |
| `ogdl-tw-1.0` | true | false | false | true | 2026-11-19, https://data.gov.tw/license |
| `cc-by-4.0` (World Bank) | true | false | false | true | 2026-11-19, https://datacatalog.worldbank.org/public-licenses#cc-by |
| `provider-personal-s7`, `provider-personal-s3` | true | false | true | false | 2026-11-19, private terms notes by code |
| `provider-derived-x4` | false | false | false | **false** (commercial use needs the exchange's data licence; legal: CAVEAT self-hosted, LATER hosted) | 2026-11-19, private terms notes, X4 |
| `provider-attribution-c1` | true ("Powered by" line) | false | false | false | 2026-11-19, private terms notes, C1 |
| `provider-personal-c3` | true | false | true | false | 2026-11-19, private terms notes, C3 |
| `rpc-display-o3` | false | false | false | true (chain data "is not Service Content") | 2026-11-19, private terms notes, O3 |

Invariant 3 (§4.2) puts every `redistribution: false` source in `connector-cache`, which matches the storage column below. R17 reads "redistribution = false ⇒ connector-cache; a key is required only where `requires` lists one" (architect, accepted; legal: consistent with memo rule 5). So X4, C3 and the cited FRED series are keyless `connector-cache` sources, and C1's key is optional.

### 1.4 Maths (`packages/markets/src/calc.ts`, pure)

Inputs per series: observations `obs` (date ascending, within the window), the optional `latest` row, `peakSince` (setting, default `2025-01-01`), `now`.

1. `closes` = `obs` with `date >= peakSince`.
2. `current` = `latest.value` if `latest` exists and `latest.observed_at` is later than the last close's date, else the last close. `currentAt` is the matching timestamp or date.
3. **Peak known?** `peakKnown` is true when the first stored observation is on or before `peakSince + grace`:
   - grace is 7 days for daily series (1 January is a holiday everywhere)
   - 31 days for monthly series
   - 92 days for quarterly series
   - otherwise `peakKnown = false` and `trackingSince` = the first observation's date.
4. `peak` = max over `closes` ∪ {`current`}; `peakDate` = its date (latest wins ties).
5. `drawdownPct` = `(current / peak − 1) × 100`, rounded to 0.1 at render time, never above 0. **When `peakKnown` is false, `drawdownPct` is `null`, never 0.** The tile renders "Peak not known yet: tracking since [trackingSince]" (Part G, M03.X.01).
6. `dayChangePct` = `current / previousClose − 1`, for daily series only. `previousClose` is the last close dated before `currentAt`'s date.
7. **Value lost:**
   - `valueLost: "series"` (unit `usd_cap` or Z.1 `usd`): `peak − current`
   - `valueLost: "supply"`: `(peak − current) × supplyNow`, with `supplyNow` from the supply series' latest value (bitcoin: computed from block height; ether: C1 circulating supply). The result cites both series.
   - otherwise `null`.
8. `totalWiped` = the sum of non-null `valueLost` across tiles, returned with the list of tile rows it includes and the oldest `asOf` among them. The UI decides how to label a sum of quarterly and live figures (designer).
9. **Stale** (council clarification 1, 2× cadence):

   | Frequency | Stale when the last observation is older than |
   |---|---|
   | `daily_exchange` | 2 business days (Mon-Fri; no holiday calendar, so the day after a holiday can read Stale for a few hours) |
   | `daily_7d` | 2 calendar days |
   | `monthly` | 62 days after the period end |
   | `quarterly` | 184 days after the period end |

   A `latest` row older than 2× its poll interval is ignored (step 2 falls back to the last close).
10. **Debt ticker** (M08): `anchor` = `record_date` at 21:00 UTC (close of business in Washington, as an approximation). `yearAgo` is the latest row dated on or before `record_date − 365 days`. `perSecond = (total − yearAgo.total) / secondsBetween(yearAgo.anchor, anchor)`. The client shows `total + perSecond × (now − anchor)`, labelled "Ticker is an estimate", beside the official figure and its date.

Tile view returned by `getCrashMonitor()` (Zod schema in `packages/api-contract`):

```ts
type MarketRow = {
  itemId: ItemId; rowKey: string;              // e.g. "M03.X.01:taiwan"
  state: "ok" | "peak_unknown" | "needs_key" | "needs_symbol" | "stale" | "error" | "loading";
  current: SourcedValue<number> | null; currentAt: string | null;
  peak: number | null; peakDate: string | null; peakKnown: boolean; trackingSince: string | null;
  drawdownPct: number | null; dayChangePct: number | null;
  valueLost: SourcedValue<number> | null;      // only where the tile config allows it
  unit: Unit; caveatKey: string | null; symbol: string | null;   // symbol only for fund slots
  cadence: "quarterly" | "monthly" | "daily_exchange" | "daily_7d" | "live";
  delayed: boolean;
  peakBasis: "since" | "all_time" | "seeded";
};
```

Three fields from the frontend plan (frontend, 7029664310), defined here so the UI never guesses:

- **`cadence`** is `"live"` when `current` comes from a `market_latest` row inside its freshness limit (1.4 step 2). Otherwise it is the series' `frequency`.
- **`delayed`** is a fixed property of the source: true when the source publishes its observation at least one day after the observation date. It is true for Treasury (1 business day), FRED oil (≈ 2 days), FRED Japan (next day), Z.1 (about 10 weeks), the World Bank (the next month), TWSE (the evening after the session) and S7 or S3 end-of-day closes. It is false for X4, C1 and O3, and for S7 when its intraday endpoint is available. It sits in the tile config beside each series, and `tiles.test.ts` asserts every series has it.
- **`peakBasis`:**
  - `"since"`: the highest close since `peakSince`, the normal case
  - `"all_time"`: the total-crypto row, whose peak is the C3 all-time high
  - `"seeded"`: the peak or the window start comes from `seeds.ts`, and the row cites the seed

  A row with `peakKnown: false` keeps `peakBasis: "since"` and renders "tracking since".

### 1.5 Settings (P12)

The `settings` table (§3.8) holds:

| Key | Value | Default |
|---|---|---|
| `markets.peakSince` | ISO date | `2025-01-01` |
| `markets.fund.<slot>` | fund ticker, `^[A-Z0-9.\-]{1,10}$` | **none** |

There are 13 slots:
- `M01.us_total`, `M01.us_large`, `M01.us_tech`
- `M02.europe`
- `M03.japan`, `M03.korea`, `M03.taiwan`, `M03.hong_kong`, `M03.china`, `M03.india`, `M03.australia`
- `M04.canada`, `M04.brazil`

The rules:
- No ticker ships in the repo, in defaults, fixtures, docs or tests. With no symbol, a slot's state is `needs_symbol` and the UI shows "Choose a fund in settings" with no number (Part G).
- With a symbol but no key, the state is `needs_key`.
- Changing a slot's symbol deletes that slot's series rows and refetches.
- Keys are env vars, never settings (architecture §15). The Settings page shows only whether each is set.

### 1.6 Scheduling (`packages/markets/src/schedule.ts`; cto §7)

| Job | Sources | When |
|---|---|---|
| official daily | `us-treasury-debt`, `us-fred-open`, `us-fred-cited`, `tw-twse-index` | every 6 h at 01:00, 07:00, 13:00, 19:00 UTC; unchanged costs one sync row |
| official monthly | `intl-worldbank-pinksheet` | daily at 12:00 UTC (the file changes about once a month) |
| crypto quotes | `crypto-x4-ohlc` (latest), `crypto-c1` (global) | every 5 min **while a Crash monitor client is connected and for 30 min after**; otherwise hourly |
| crypto daily | `crypto-x4-ohlc` (daily candles), `crypto-c1` (ether supply), `crypto-o3-btc-height` | hourly |
| crypto peak | `crypto-c3-global` | daily at 00:30 UTC |
| stocks | `stocks-s7` | hourly between 09:30 and 16:00 America/New_York, Mon-Fri, plus one end-of-day run at 16:30 New York time; only for slots with a symbol and only if the key is set |
| gold | `gold-s3` | daily at 22:00 UTC, only if the key is set |

Request budget per day, all slots filled, client connected all day:

| Source | Calls/day | Free limit | Headroom |
|---|---|---|---|
| X4 | 288 + 48 | 10,000 per 10 min | large |
| C1 | 288 + 24 | 10,000/month on the optional demo key (9,360/month used); keyless limit unpublished | ~6% on the demo key |
| C3 | 1 | 20,000/month | large |
| O3 | 24 | unpublished; 429 on excess | back off on 429 |
| S7 | 13 × 7 + 13 = 104 | 50/h, 1,000/day, 500 symbols/month | large; **never faster than hourly** (13 calls every 15 min would break 50/h) |
| S3 | 1 | 25/day | large |
| official | ≤ 20 | none published | - |

Every job uses the polite fetcher (§4.4): host allowlist from `officialHosts`, backoff on 429 and 5xx (1 min, 5 min, 30 min), and no parallel requests to the same host.

### 1.7 Refresh and change (all sources)

- **Change detection:** content hash per artifact plus `parserVersion` (§4.4 step 1, A1); both equal → one `unchanged` sync. Otherwise the loader upserts `market_obs` by (`series_id`, `date`): a changed value is overwritten (FRED and the World Bank revise history) and records the new `sync_id`.
- **`parserVersion`** for a market source is the hash of its module under `packages/sources/src/<cc>/<id>/` (fetch and parse), its field map, the items list, and `packages/markets/src/tiles.ts` (a tile's `valueLost` rule or unit change must re-parse). `calc.ts` is not part of it: it runs at read time over stored observations.
- **Record unit:** one observation, (`series_key`, `date`), sorted by `series_key` then `date` ascending. Its hash input is `[series_key, date, value]`, and the value is normalised to the source's stated decimals. Market sources write `market_obs` rows, not `records` rows (1.2). The pipeline's staging table holds `(series_key:date, hash)` pairs the same way.
- **Removal:** for full-history sources (FRED, Treasury, World Bank), an observation inside the window that is absent from a complete pull is deleted. Incremental sources (X4, S7, S3, TWSE) and snapshot sources (C1, C3, O3) never delete in a sync; they only append or overwrite. This is `SourceMeta.purgeScope` (§4.2): `window` for the full-history pulls, so the purge only covers the pulled date range; `none` for the rest.
- **`maxPurgeShare`** = max(2%, 5 × the measured removal share per refresh period), per §4.4. The removal share measured over two pulls (2026-11-19 and -20) was 0 for every full-history source: rows only grew. So the value is **0.02**. Sources with `purgeScope: "none"` declare `0` and never delete in a sync. Settings-driven deletions (moving `peakSince` later, changing a fund symbol, removing a key) are explicit jobs outside the sync purge and are logged as such.
- **`checkedAt`** (A5): every row shows "checked [time]" from the latest content or unchanged sync, beside its as-of. The stale rule (1.4 step 9) uses the observation date, never `checkedAt`.
- **History events:** none. Market series emit no `finora.*` events.

| Source | Record unit, sort | `asOf` (proven) | `maxPurgeShare` | `purgeScope` |
|---|---|---|---|---|
| us-treasury-debt | observation, by date | `max_date_in_data` (`record_date`) | 0.02 | window |
| us-fred-open, us-fred-cited | observation, by series then date | `max_date_in_data` (`observation_date`) | 0.02 | window |
| tw-twse-index | observation, by date | `max_date_in_data` (`Date`, ROC) | 0 | none |
| intl-worldbank-pinksheet | observation, by month | `in_file_field` (sheet "Monthly Prices", A4 "Updated on …") | 0.02 | window |
| stocks-s7 | observation, by slot then date | `max_date_in_data` (`date`), proven in the key round | 0 | none |
| gold-s3 | observation, by date | `max_date_in_data`, proven in the key round | 0 | none |
| crypto-x4-ohlc | observation, by pair then date | `max_date_in_data` (`timestamp`) | 0 | none |
| crypto-o3-btc-height | one snapshot per UTC day | `in_file_field` (block header `time`) | 0 | none |
| crypto-c1 | one snapshot per series | `in_file_field` (`updated_at`, `last_updated`) | 0 | none |
| crypto-c3-global | one snapshot | `in_file_field` (`last_updated`) | 0 | none |

### 1.8 Fixtures

- `packages/markets/src/fixtures/series.ts` generates every series from a seed. The walk is geometric with a planted peak on `2025-07-15` and a drawdown of −23.4% on the fixture "today" `2026-11-18`, so `calc.test.ts` asserts exact numbers.
- Per-source layout writers (below) wrap the series in each source's raw format. Each committed layout fixture is under 50 KB.
- **Fund tickers in fixtures:** `ZZFX01` to `ZZFX13`. A fixture ticker never matches a real listing: real US tickers have no digits. Hosts are real (the parsers need them); values are synthetic.
- Fixture "today" is fixed by a fake clock in every test.

### 1.9 Tests (shared)

| File | Proves |
|---|---|
| `packages/markets/src/calc.test.ts` | peak, peak date and drawdown on the planted series; `peakKnown = false` gives `drawdownPct = null` and never 0; value lost only for `series`/`supply`; `totalWiped` lists its rows; the stale thresholds per frequency, including a Monday after a Friday close (not stale) |
| `packages/markets/src/debt.test.ts` | per-second rate and ticker from two fixture rows; label key present |
| `packages/markets/src/tiles.test.ts` | every M SHOW/CAVEAT item in `items.generated.ts` has a tile row; `M05.X.02a`, `M06.X.01a` and `M09.X.01` have none, and no connector lists an oracle host (LATER negative tests) |
| `packages/markets/src/settings.test.ts` | no slot has a default symbol; `needs_symbol` vs `needs_key`; a symbol change deletes the slot's rows |
| `packages/markets/src/schedule.test.ts` | with a fake clock, one full day of jobs stays within every limit in 1.6, and crypto drops to hourly 30 min after the last client leaves |
| `packages/markets/src/connector-cache.test.ts` | connector-cache rows never appear in export, list endpoints or MCP bulk tools; removing a key deletes its rows; C1 rows older than 24 h are deleted |
| `packages/markets/src/provenance.test.ts` | every `MarketRow` value carries a `SourceRef` with licence, retrieval time and as-of; derived values are flagged and cite their inputs |
| `apps/web/e2e/crash-monitor.spec.ts` | zero keys: the official rows render with numbers, fund slots show "Choose a fund in settings", and Taiwan renders "Peak not known yet: tracking since [date]" with no % |
| guard (CI) | committed files hold no real ticker (denylist) |

### 1.10 Size and time budget

- About 40 series × ≤ 700 observations ≈ 28,000 `market_obs` rows, under 2 MB across both files. Share: cross-border (≤ 1 GB), negligible.
- First load: about 25 requests without keys, plus 13 with the stock key and slots filled. Under 1 min. A daily refresh is a few seconds per job.

---

## Part 2: sources

### us-treasury-debt: US Treasury Fiscal Data, Debt to the Penny

**Source**
```ts
{ id: "us-treasury-debt", country: "us", publisher: "U.S. Department of the Treasury, Bureau of the Fiscal Service",
  homepage: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/",
  officialHosts: ["api.fiscaldata.treasury.gov", "fiscaldata.treasury.gov"],
  licence: "us-gov-public-domain", attribution: "Source: U.S. Treasury, Fiscal Data (Debt to the Penny)",
  storage: "store", cadence: "daily", publishedAtUtc: null,
  asOf: [{ strategy: "max_date_in_data", field: "data[].record_date" }], maxPurgeShare: 0.02,
  deepLink: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/", orderUrl: null,
  requires: [], limits: { requestsPerSecond: 1 }, items: ["M08.X.01"], purgeScope: "window" }
```
- Endpoint: `GET https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=10000&fields=record_date,tot_pub_debt_out_amt,debt_held_public_amt,intragov_hold_amt&filter=record_date:gte:<peakSince − 400 days>`. One page holds everything; measured full table 8,437 rows, 2.8 MB, 1.1 s.
- Publication: the previous business day's figure appears late in the US day. It was not yet published at 19:45 UTC on 2026-11-19, so the 6-hourly poll catches it on the next run.

**Items:** `M08.X.01` SHOW, caveat "Ticker is an estimate", empty state NC.

**Field map**

| Source field | Type | Target | item_id | Personal? | Transform |
|---|---|---|---|---|---|
| `record_date` | `YYYY-MM-DD` | `market_obs.date` | M08.X.01 | no | ISO date |
| `tot_pub_debt_out_amt` | decimal string, USD | series `treasury:debt_total` (unit `usd`) | M08.X.01 | no | parse as number; reject non-finite |
| `debt_held_public_amt` | decimal string | series `treasury:debt_public` | M08.X.01 | no | as above |
| `intragov_hold_amt` | decimal string | series `treasury:debt_intragov` | M08.X.01 | no | as above |

Rows from `peakSince − 400 days` are kept, enough for the 365-day rate.

**Identity and joins:** none; national series. **Refresh:** full pull of the window, `purgeScope: "window"`.
**Fixtures:** `fixtures/us-treasury-debt.json` in the API's envelope (`data`, `meta` with `total-count`, `links`), 450 synthetic business days.
**Tests:** `packages/sources/src/us/treasury-debt/treasury-debt.test.ts` (parse, field map, as-of = max `record_date`).
**Failure modes:** API down → keep rows, Stale after 2 business days; a missing `record_date` → `as_of_missing`; a value that drops by more than 5% day on day → sync `failed` with `implausible_change` (it has never happened, so it means a parse error).
**Open questions:** none.

### us-fred-open and us-fred-cited: FRED CSV downloads

Two registry entries share one parser because their licences differ (one storage class per source).

**Source**
```ts
{ id: "us-fred-open", country: "us", publisher: "Federal Reserve Bank of St. Louis (FRED)",
  homepage: "https://fred.stlouisfed.org/", officialHosts: ["fred.stlouisfed.org"],
  licence: "fred-public-domain",
  attribution: "Source: FRED, Federal Reserve Bank of St. Louis; original: Board of Governors of the Federal Reserve System (Z.1), U.S. Energy Information Administration (oil)",
  storage: "store", cadence: "daily", publishedAtUtc: null,
  asOf: [{ strategy: "max_date_in_data", field: "observation_date" }], maxPurgeShare: 0.02,
  deepLink: "https://fred.stlouisfed.org/series/{seriesId}", orderUrl: null,
  requires: [], limits: { requestsPerSecond: 1 }, items: ["M01.X.01", "M07.X.01"], purgeScope: "window" }

{ id: "us-fred-cited", /* same fields, except: */ licence: "fred-citation-required",
  attribution: "Source: FRED, Federal Reserve Bank of St. Louis; index data reprinted with the owner's permission, as FRED's series notes state",
  storage: "connector-cache", items: ["M03.X.01"] }
```
- Endpoint: `GET https://fred.stlouisfed.org/graph/fredgraph.csv?id=<SERIES>&cosd=<peakSince − 10 days>`. No key; the optional `FRED_API_KEY` is not used in v1. Header `observation_date,<SERIES>`; a missing value is an empty field or `.` (measured: 1,173 of 10,305 Brent rows).
- Series:

| Series | Source id | series_key | Unit | Frequency | Date convention |
|---|---|---|---|---|---|
| `BOGZ1LM893064105Q` | us-fred-open | `fred:BOGZ1LM893064105Q` | `usd` (millions in the source, × 1e6 at parse) | quarterly | FRED dates quarters by their **start**; store the quarter **end** |
| `DCOILBRENTEU` | us-fred-open | `fred:DCOILBRENTEU` | `usd_per_bbl` | daily_exchange | as is |
| `DCOILWTICO` | us-fred-open | `fred:DCOILWTICO` | `usd_per_bbl` | daily_exchange | as is |
| `NIKKEI225` | us-fred-cited | `fred:NIKKEI225` | `index_points` | daily_exchange | as is |

**Items:** `M01.X.01` CAVEAT "Quarterly; includes non-listed equity" (NC); `M07.X.01` SHOW (NC). Legal: oil is SHOW on the official wording, with source and date on each figure. `M03.X.01` (Japan row) CAVEAT (NC).

**Field map:** `observation_date` → `market_obs.date` (transform above); `<SERIES>` value → `market_obs.value` (skip empty and `.`; reject non-finite). Every other column: none exist.

**Identity:** `series_key` as above. **Refresh:** full pull of the window, `purgeScope: "window"`.
**Fixtures:** one CSV per series in the measured format, from the fixture series. **Tests:** `packages/sources/src/us/fred/fred.test.ts` (missing-value forms; quarter start → end; units × 1e6 for Z.1; the cited series lands in `connector-cache.db` only).
**Failure modes:** HTTP error or an HTML page instead of CSV (first line not `observation_date,`) → `failed` with `not_csv`; keep rows; Stale per frequency.
**Open questions:** none. The unit of `BOGZ1LM893064105Q` is "Millions of Dollars" on its series page; the parser asserts this against `fixtures/fred-units.json`, and a nightly `live` job re-reads the page.

### tw-twse-index: Taiwan Stock Exchange OpenAPI

**Source**
```ts
{ id: "tw-twse-index", country: "intl", publisher: "Taiwan Stock Exchange (open data)",
  homepage: "https://openapi.twse.com.tw/", officialHosts: ["openapi.twse.com.tw"],
  licence: "ogdl-tw-1.0", attribution: "Taiwan Stock Exchange, TWSE OpenAPI (Open Government Data License, version 1.0)",
  storage: "store", cadence: "daily", publishedAtUtc: "22:00",
  asOf: [{ strategy: "max_date_in_data", field: "[].Date", calendar: "roc" }], maxPurgeShare: 0,
  deepLink: "https://openapi.twse.com.tw/", orderUrl: null,
  requires: [], limits: { requestsPerSecond: 1 }, items: ["M03.X.01"], purgeScope: "none" }
```
- Endpoint: `GET https://openapi.twse.com.tw/v1/indicesReport/MI_5MINS_HIST`. It returns the broad index's daily OHLC for the **current month only** (14 rows measured on 2026-11-19). Fields: `Date`, `OpeningIndex`, `HighestIndex`, `LowestIndex`, `ClosingIndex`.
- TLS: Python 3.13+ rejected the certificate under its strict X.509 flag. Node's default verification must be tested by `twse.live.test.ts` in the nightly `live` job. If Node also rejects it, the fetcher may relax only the strict flag for this host, never chain verification.
- Dates are ROC calendar, 7 digits `YYYMMDD`: Gregorian year = `YYY + 1911`.

**Items:** `M03.X.01` (Taiwan row) CAVEAT. Empty state, verbatim from Part G: "Peak not known yet: tracking since [date]" (no %, never 0%).

**Taiwan peak rule:** history accumulates from the first sync (the OpenAPI has no backfill; the TWSE website's history pages are off-limits, its terms ban crawlers). `peakKnown` stays false until the first stored observation is within 7 days of `peakSince`, which with today's default never happens. So the row shows "tracking since" until a seed exists. A seed is one cited official figure (`packages/markets/src/seeds.ts`: `{ seriesKey, date, value, citation, licence }`, committed only after legal clears `markets.md` open question 1). **v1 ships `seeds.ts` empty.** `calc.ts` treats a seed as an observation for the peak and `peakKnown`, and the row cites it.

**Field map**

| Source field | Type | Target | item_id | Transform |
|---|---|---|---|---|
| `Date` | ROC `YYYMMDD` string | `market_obs.date` | M03.X.01 | ROC → ISO; reject if month or day is out of range |
| `ClosingIndex` | decimal string, may contain `,` | series `twse:taiex` value (`index_points`) | M03.X.01 | strip `,`; reject non-finite |
| `OpeningIndex`, `HighestIndex`, `LowestIndex` | - | dropped (not read) | - | - |

**Refresh:** append or overwrite by date; `purgeScope: "none"`. A gap of more than 3 business days (the app was off) cannot be backfilled. The row keeps its observations and shows the gap in its history; the drawdown uses what exists.
**Fixtures:** `fixtures/twse-mi5mins.json`, a JSON array in the measured shape with ROC dates and comma thousands separators. **Tests:** `packages/sources/src/intl/twse/twse.test.ts` (ROC conversion, commas, `peakKnown` false and "tracking since", a seed flips it).
**Failure modes:** HTTP error → keep rows, Stale after 2 business days. Empty array (month start, before the first session) → `unchanged`.
**Open questions:** none.

### intl-worldbank-pinksheet: World Bank commodity prices, monthly

**Source**
```ts
{ id: "intl-worldbank-pinksheet", country: "intl", publisher: "World Bank, Commodity Markets (Pink Sheet)",
  homepage: "https://www.worldbank.org/en/research/commodity-markets",
  officialHosts: ["www.worldbank.org", "thedocs.worldbank.org"],
  licence: "cc-by-4.0", attribution: "World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0",
  storage: "store", cadence: "monthly", publishedAtUtc: null,
  asOf: [{ strategy: "in_file_field", sheet: "Monthly Prices", cell: "A4", match: "^Updated on (.+)$" }], maxPurgeShare: 0.02,
  deepLink: "https://www.worldbank.org/en/research/commodity-markets", orderUrl: null,
  requires: [], limits: { requestsPerSecond: 1 }, items: ["M05.X.01"], purgeScope: "window" }
```
- Fetch: GET the homepage, take the first link matching `https://[^"']+CMO-Historical-Data-Monthly\.xlsx` (the URL changes each month), then GET it (588 KB measured).
- Layout (measured 2026-11-20, sheet **"Monthly Prices"**):
  - row 4, column A: "Updated on <Month DD, YYYY>" (the as-of)
  - row 5: series names, gold under the header cell whose text is exactly `Gold`; find it by text, not by column letter
  - row 6: units (`($/troy oz)` expected for gold; the parser asserts the unit cell contains `troy oz`)
  - from row 7: column A is the month `YYYYMmm` (`1960M01` … `2026M10`); missing values are `…` (U+2026) or empty.
- Unzip with `fflate` (MIT, no dependencies) unless milestone B names a shared zip reader, in which case use that.
- The series definition changed: from June 2025 the gold series is a spot average of daily rates (the sheet's description says so). Keep the label "Monthly average".

**Items:** `M05.X.01` CAVEAT "Monthly average" (NC).
**Field map:** column A month → `market_obs.date` = last day of that month; the `Gold` column → series `worldbank:gold` (`usd_per_oz`, frequency `monthly`). No other column is read.
**Refresh:** full pull of the window, `purgeScope: "window"` (the Bank revises recent months).
**Fixtures:** `fixtures/worldbank-pinksheet.xlsx` is **generated at test time** by `fixtures/xlsx-writer.ts` (stored zip entries, the five sheets by name, the same header rows). It is never committed, because the guard blocks binaries. **Tests:** `packages/sources/src/intl/worldbank/pinksheet.test.ts` (link discovery, gold column by name, `…` handling, unit assertion, as-of from row 4).
**Failure modes:**
- No xlsx link on the page → `failed` with `link_not_found`.
- No `Gold` header, or the unit isn't troy oz → `failed` with `schema_changed`.
- In both cases rows are kept and the row reads Stale after 62 days.

**Open questions:** none.

### stocks-s7: fund prices with the user's own key

**Source**
```ts
{ id: "stocks-s7", country: "intl", publisher: "<provider S7, from meta>",
  homepage: "https://www.tiingo.com/", officialHosts: ["api.tiingo.com"],
  licence: "provider-personal-s7", attribution: "<the provider's required attribution line, private terms notes S7>",
  storage: "connector-cache", cadence: "daily", publishedAtUtc: null,
  asOf: [{ strategy: "max_date_in_data", field: "[].date" }], maxPurgeShare: 0,   // proven on real responses in the key round
  deepLink: null, orderUrl: null,
  requires: ["MARKETS_S7_API_KEY"], limits: { dailyRequests: 1000, requestsPerHour: 50 },
  items: ["M01.X.02", "M02.X.01", "M03.X.02", "M04.X.01"], purgeScope: "none" }
```
- Terms: S7 runs a programme for open-source software where each user supplies their own key, with attribution required (research, private notes S7). The Settings page links to the provider's sign-up page from `meta.homepage`.
- **Daily closes:** `GET https://api.tiingo.com/tiingo/daily/<symbol>/prices?startDate=<peakSince − 10 days>&token=<key>` (the endpoint the phase 1 probe called; with no key it returned 403). Reads `date` and `adjClose`. Use `adjClose`, not `close`: a fund split must never read as a crash. The drawdown then includes reinvested distributions, which the fund caveat already covers ("Not the index").
- **Hourly latest:** the provider's intraday endpoint for US-listed symbols. Its availability on the free plan is **deferred: key pending**. The fallback, which is fully specified: if the key round shows no intraday access, the stocks job runs only the 16:30 end-of-day pass, and the row shows the last close with its date.
- **Deferred: key pending.** Field names `date` and `adjClose` come from the provider's public docs. The key-testing round records one real response shape (no values) into `research/.cache/markets/` and confirms them. Until it does, the fixture follows the docs, and `s7.contract.test.ts` is marked `todo` with a link to the key-round task.

**Items:** M01.X.02, M02.X.01, M03.X.02, M04.X.01, all CAVEAT with the fund text: "Via [your symbol], a US-listed fund. In US dollars: includes currency moves and fund fees. Not the index". Empty states: "Choose a fund in settings" (no symbol); KEY (no key).

**Field map**

| Source field | Type | Target | item_id | Transform |
|---|---|---|---|---|
| `date` | ISO datetime | `market_obs.date` | the slot's item | date part |
| `adjClose` | number | series `s7:slot:<slot>` (`usd`) | the slot's item | reject non-finite or ≤ 0 |
| all other fields | - | not read | - | - |

**Identity:** `series_key = "s7:slot:" + slot`; `market_series.symbol` records the ticker used, so a changed symbol is detected and the slot's rows are reset.
**Refresh:** append or overwrite; `purgeScope: "none"` within a symbol.
**Fixtures:** `fixtures/s7-daily.json` with symbols `ZZFX01`…`ZZFX13`. **Tests:** `packages/sources/src/intl/s7/s7.test.ts` (parse; adjClose used; key never logged: a mocked logger receives no key value); `packages/markets/src/settings.test.ts` (in 1.9).
**Failure modes:**
- 401 or 403 → state `needs_key` with "Key rejected"; nothing else is touched.
- 404 for a symbol → that slot shows "Symbol not found: check settings".
- 429 → backoff, keep rows.
- In every case the rows go Stale after 2 business days.

**Open questions:** none. The intraday endpoint and the response shape are deferred to the key round, with the fallback above.

### gold-s3: daily gold price with the user's own key

**Source**
```ts
{ id: "gold-s3", country: "intl", publisher: "<provider S3, from meta>",
  homepage: "https://www.alphavantage.co/", officialHosts: ["www.alphavantage.co"],
  licence: "provider-personal-s3", attribution: "<the provider's attribution, private terms notes S3>",
  storage: "connector-cache", cadence: "daily", publishedAtUtc: null,
  asOf: [{ strategy: "max_date_in_data", field: "data[].date" }], maxPurgeShare: 0,   // proven in the key round
  deepLink: null, orderUrl: null, requires: ["MARKETS_S3_API_KEY"], limits: { dailyRequests: 25 },
  items: ["M05.X.02b"], purgeScope: "none" }
```
- Endpoint: the provider's daily gold history function. Its parameters and response shape are **deferred: key pending**; the demo key answers only for sample symbols. Fully specified fallback: if the key round shows the history is premium-only, `M05.X.02b` shows KEY with "Not available on the free plan" and the monthly row `M05.X.01` stays.
- **Items:** `M05.X.02b` CAVEAT "With your own key; personal use"; empty state NC / KEY.
- **Field map:** a date field → `market_obs.date`; the USD-per-ounce value → series `s3:gold` (`usd_per_oz`, `daily_7d`, because spot gold is quoted on weekdays only, treated as calendar days for staleness). Exact names come from the key round.
- **Fixtures:** `fixtures/s3-gold.json` following the provider's documented envelope. **Tests:** `packages/sources/src/intl/s3/s3.test.ts`, with the contract test `todo` until the key round.
- **Failure modes:** as stocks-s7. The provider answers rate limits with HTTP 200 and an `Information` or `Note` body, so the parser treats a body without the data array as `rate_limited`, not as data.
- **Open questions:** none (deferred items have fallbacks).

### crypto-x4-ohlc: bitcoin and ether daily candles and latest price

**Source**
```ts
{ id: "crypto-x4-ohlc", country: "intl", publisher: "<exchange X4, from meta>",
  homepage: "https://www.bitstamp.net/api/", officialHosts: ["www.bitstamp.net"],
  licence: "provider-derived-x4", attribution: null,
  storage: "connector-cache", cadence: "daily", publishedAtUtc: "00:05",
  asOf: [{ strategy: "max_date_in_data", field: "data.ohlc[].timestamp", epoch: "s" }], maxPurgeShare: 0,
  deepLink: null, orderUrl: null, requires: [], limits: { requestsPerSecond: 1 },
  items: ["M06.X.01b"], purgeScope: "none" }
```
- **Daily:** `GET https://www.bitstamp.net/api/v2/ohlc/<pair>/?step=86400&limit=1000&start=<epoch of peakSince − 10 days>` for `btcusd` and `ethusd`. Measured: 689 rows from 2025-01-01 in one call. If the window ever exceeds 1,000 days, page by `start` in 1,000-day steps.
- **Latest:** the same endpoint with `step=300&limit=1`. Its close and timestamp go to `market_latest`.
- **Terms and legal position:** the exchange allows derived figures ("ratios, calculations, new original works, statistics"). Commercial users must sign a data licence. Legal: CAVEAT for a self-hosted instance (unverified reading of the trigger); LATER for any hosted build.

**Items:** `M06.X.01b` CAVEAT "Self-hosted, personal use" (NC).

**Field map**

| Field | Type | Target | Transform |
|---|---|---|---|
| `data.ohlc[].timestamp` | string, epoch seconds | `market_obs.date` (UTC day) or `market_latest.observed_at` | integer seconds → ISO |
| `data.ohlc[].close` | decimal string | series `x4:btcusd`, `x4:ethusd` (`usd`, `daily_7d`) | number, > 0 |
| `open`, `high`, `low`, `volume` | - | not read | - |

**Refresh:** append or overwrite; `purgeScope: "none"`. **Fixtures:** `fixtures/x4-ohlc-<pair>.json` in the envelope `{"data":{"pair":"BTC/USD","ohlc":[...]}}`, with timestamps as strings. **Tests:** `packages/sources/src/intl/x4/x4.test.ts` (string epochs; latest vs daily; the paging rule above 1,000 days).
**Failure modes:** HTTP error → keep rows; a latest older than 10 min is ignored (1.4 step 2); daily Stale after 2 days.
**Open questions:** none.

### crypto-o3-btc-height: bitcoin supply from block height

**Source**
```ts
{ id: "crypto-o3-btc-height", country: "intl", publisher: "<public RPC O3, from meta>",
  homepage: "https://www.publicnode.com/", officialHosts: ["bitcoin-rpc.publicnode.com", "mempool.space"],
  licence: "rpc-display-o3", attribution: null, storage: "store", cadence: "daily", publishedAtUtc: null,
  asOf: [{ strategy: "in_file_field", field: "result.time", epoch: "s" }], maxPurgeShare: 0,
  deepLink: null, orderUrl: null, requires: [],
  limits: { requestsPerSecond: 1 }, items: ["M06.X.01b"], purgeScope: "none" }
```
- Requests: `POST https://bitcoin-rpc.publicnode.com` with `{"jsonrpc":"1.0","id":1,"method":"getbestblockhash","params":[]}`, then `{"jsonrpc":"1.0","id":2,"method":"getblockheader","params":["<hash>"]}`. Read `result.height` and `result.time` (epoch seconds) from the header. Measured 2026-11-20: height 976,676, header 0.3 h old; probe `publicnode_btc_height` in `onchain.py`.
- Fallback host: O1, `GET https://mempool.space/api/blocks/tip/height`, plain-text integer. O1's software is AGPL-3.0, and users may point `MARKETS_BTC_HEIGHT_URL` at their own instance.
- Supply: `btcSupply(height)` in `packages/markets/src/btc-supply.ts` sums each halving era: 210,000 blocks, subsidy starting at 50 BTC and halved by integer division in satoshis, from block 0 to `height` inclusive. Measured gap to an explorer's reported supply: 28 BTC of 20.1 M (unclaimed early subsidy), documented in the row's note.
- `asOf` is the best block's header `time`. On the fallback host, the as-of is the tip block's `timestamp` from `GET https://mempool.space/api/block/<hash>` (proven in phase 1). Store one `market_obs` row per UTC day (the last fetch of the day) in series `btc:supply` (`coins`, `daily_7d`), plus a `market_latest` row.

**Items:** `M06.X.01b` (bitcoin supply, used only for value lost). **Field map:** `result.height` → `btcSupply` → value; `result.time` → as-of. No other header field is read. **Tests:** `packages/markets/src/btc-supply.test.ts` (height 0 → 50; 209,999 → 10,500,000; 210,000 → 10,500,025; monotonic; never above 21,000,000), `packages/sources/src/intl/o3/o3.test.ts` (JSON-RPC envelope; fallback host on failure).
**Fixtures:** a JSON-RPC response with a fixture height. **Failure modes:** both hosts down → the supply keeps its last value; the bitcoin value lost shows with the supply's as-of; after 2 days the value lost is hidden (null) and the drawdown stays.
**Open questions:** none.

### crypto-c1: total crypto market cap and ether supply

**Source**
```ts
{ id: "crypto-c1", country: "intl", publisher: "<aggregator C1, from meta>",
  homepage: "https://www.coingecko.com/en/api", officialHosts: ["api.coingecko.com"],
  licence: "provider-attribution-c1", attribution: "<the 'Powered by' line required by C1's terms, private notes C1>",
  storage: "connector-cache", cadence: "daily", publishedAtUtc: null,
  asOf: [{ strategy: "in_file_field", field: "data.updated_at", epoch: "s" }], maxPurgeShare: 0,
  deepLink: null, orderUrl: null, requires: [], optional: ["MARKETS_C1_DEMO_KEY"],
  limits: { requestsPerMinute: 10 }, items: ["M06.X.02", "M06.X.01b"], purgeScope: "none" }
```
- **Global:** `GET https://api.coingecko.com/api/v3/global`; reads `data.total_market_cap.usd` and `data.updated_at`. Goes to `market_latest` for series `c1:total_cap` (`usd_cap`).
- **Ether supply:** `GET https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum`; reads `[0].circulating_supply` and `[0].last_updated`. Goes to `market_latest` for series `c1:eth_supply` (`coins`).
- With `MARKETS_C1_DEMO_KEY` set, the loader sends the header `x-cg-demo-api-key`; without it, requests are keyless (shared IP limit, unpublished).
- **Storage rule from the terms** ("refresh the cache at least every 24 hours"): only the latest snapshot is kept, never history. A snapshot older than 24 h is deleted by the job `markets-c1-expire` (hourly), and the rows that use it show NC.

**Items:** `M06.X.02` CAVEAT "Personal use; attribution"; `M06.X.01b` (ether supply for value lost).
**Field map:** the four fields above; nothing else is read.
**Fixtures:** `fixtures/c1-global.json`, `fixtures/c1-markets.json` in the measured key sets. **Tests:** `packages/sources/src/intl/c1/c1.test.ts` (parse; the demo-key header only when set; the 24 h expiry in `connector-cache.test.ts`).
**Failure modes:** 429 → backoff to hourly; HTTP 200 with an `error` body (the keyless refusals seen in the probes) → `failed` with the provider's error code; rows expire after 24 h.
**Open questions:** none.

### crypto-c3-global: total crypto market peak

**Source**
```ts
{ id: "crypto-c3-global", country: "intl", publisher: "<aggregator C3, from meta>",
  homepage: "https://coinpaprika.com/api/", officialHosts: ["api.coinpaprika.com"],
  licence: "provider-personal-c3", attribution: "<the 'Powered by' credit, private notes C3>",
  storage: "connector-cache", cadence: "daily", publishedAtUtc: null,
  asOf: [{ strategy: "in_file_field", field: "last_updated", epoch: "s" }], maxPurgeShare: 0,
  deepLink: null, orderUrl: null, requires: [], limits: { requestsPerSecond: 1 },
  items: ["M06.X.02"], purgeScope: "none" }
```
- `GET https://api.coinpaprika.com/v1/global`; reads `market_cap_ath_value` (USD) and `market_cap_ath_date` (ISO), stored as the single seed of series `c3:total_cap_peak`, plus `last_updated`.
- The peak for `M06.X.02` = max(`market_cap_ath_value`, the highest C1 snapshot ever seen in this install). `peakDate` follows whichever is larger. `peakKnown` is true, because the all-time high is on or before any `peakSince`.
- **Caveat on meaning:** this is the all-time high, not "the highest close since `peakSince`". If the all-time high falls before `peakSince`, the row's peak date shows it. The row's note states "all-time high" (designer to place).

**Items:** `M06.X.02`. **Field map:** the three fields above. **Fixtures:** `fixtures/c3-global.json`. **Tests:** `packages/sources/src/intl/c3/c3.test.ts` (peak rule with a higher local snapshot). **Failure modes:** keep the last peak; it doesn't go stale (an all-time high only moves up, and local snapshots cover that).
**Open questions:** none.

---

## Part 3: what the builder must not do

- No connector for the unofficial keyless chart endpoint measured in phase 1 (its terms bar automated access), and none for the CSV site behind a browser check.
- No oracle contract reads (`M05.X.02a`, `M06.X.01a` are LATER).
- No FX, KRX or second stock connector in v1 (1.1).
- No real ticker anywhere committed. No price value in any committed file: fixtures are generated.
- No `connector-cache` row in an export, a list endpoint, an MCP bulk tool, a log line or an error message.
