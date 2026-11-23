# markets: the Crash monitor data layer

> Loader spec by `data-markets`. It covers every M item in `docs/plan/council/01-data.md` Part G, cto's cadence (`01-data-cto.md` §7) and the Taiwan peak rule (cto amendment), under the human's rulings H4 (no outside names in the tree) and H5 (no keys). Contract: `docs/architecture.md` §3-§4 and §8. Research and terms: `docs/research/markets.md`. Probes: `research/probes/markets/` (`official.py`, `shapes.py`), last run 2026-11-20.
>
> Commercial providers appear only as codes (x4, c1, c3, o3, e1, and fred-cited for FRED's third-party series). Their hosts, URL templates, attribution lines and terms live in the user's local provider file (1.5), never in the tree. The code map is in the maintainer's private notes.

> **H4 and H5 (2026-11-21):**
> - No key-gated source remains. The fund slots (M01.X.02, M02.X.01, M03.X.02, M04.X.01) and daily gold (M05.X.02b) are LATER in Part G, and the M02 and M04 tiles have no row. US stocks keep the quarterly official row, plus the daily US rows `M01.X.03` from FRED's cited series F1-F3 under legal's personal-use light (legal 7066891816, council 7066900211).
> - The crypto sources, the Taiwan exchange's open data and FRED's cited series are configured by the local provider file. Without it their rows show `not_configured`: no number, never 0%. `totalWiped` names an unconfigured counted row in `excludedItemIds`.

> **Built in S22 (2026-11-21); where the build refined this spec:**
> - `market_series.item_id` is the item id as text (the table is small, so it isn't interned). `cc` tables have no foreign key on `sync_id`, because SQLite can't reference another file; the main ones do.
> - `MarketRow` carries `state: "loading"` before a source's first sync, and `ticker` on the M08 row. Value lost is whole USD as a float (`valueLostUsd`, `totalWiped.valueUsd`): integer micro-USD passes `Number.MAX_SAFE_INTEGER` above about $9 billion.
> - A seed in `seeds.ts` makes a row's peak known whatever its history (the seed is a cited figure for the peak itself).
> - The total-crypto aggregator's quotes run every 15 min while a client is connected (council session 2, CFO), not 5. Last runs and per-source daily request counts live in `main.jobs`, so they survive a restart, and a source at its daily free limit is skipped.
> - The Treasury connector reads `tot_pub_debt_out_amt` only; the other two debt fields are not read (no row shows them).
> - A POST (the bitcoin block-header read) is retried only when marked idempotent, and is never followed through a redirect.
> - The user agent names the source URL (`Finora/<version> (+<url>)`): FRED's edge resets a request whose agent has no `(+https://…)` part (measured 2026-11-21).
> - Jobs start in `boot()`, which `instrumentation.ts` runs in the Node.js runtime only. `FINORA_DEMO=1` runs one pass of the real connectors over synthetic fixtures, into an in-memory store, with no network.
- Security review (S22.md): an as-of, a close or a snapshot time more than a day past the run fails the sync `future_date` and stores nothing (SEC-5). An unforeseen error still closes the sync `failed` with `internal`, and the log names the error class only (SEC-7). A run first closes any sync of its own source that a crash left `running` (`interrupted`; S22 re-check N3). Only a request with `Sec-Fetch-Site` `same-origin` or `none`, or with no such header, counts as a client poll (SEC-8).
- For S23 (designer 7093091185): the response carries `peakSince`, the start of every "since" peak window (the user's setting; a peak basis of `all_time` or `seeded` says otherwise), and the debt row carries `change30d`: the latest official figure minus the last one on or before 30 days earlier, never the ticker's estimate. A drawdown is never positive: `calc.ts` caps it at 0 and the contract refuses one.
- Each row carries `attribution`: the cited series' own line for `us-fred-cited`, else its source's line (from the provider file for a coded source). The contract refuses an `M01.X.03` row with a value unless its attribution states personal use.

This is a group spec: one shared part (series model, maths, scheduling, settings, tests), then one section per source in the template order. The template's "Party gate" does not apply to any market source: series are not parties, and no market source holds personal data.

## Part 1: shared

### 1.1 What is built in v1

| item_id | Call | Tile row | Source(s) | Value lost? |
|---|---|---|---|---|
| `M01.X.01` | CAVEAT "Quarterly; includes non-listed equity" | US corporate equities, market value | `us-fred-open` (`BOGZ1LM893064105Q`) | yes: the series is a USD market value |
| `M01.X.03` | CAVEAT "Personal use; [owner]'s copyright, via FRED; 1-day lag" | US large companies, US broad market, US technology (daily) | `us-fred-cited` (F1-F3 from the provider file) | no: drawdown only (legal 7066891816) |
| `M03.X.01` | CAVEAT Taiwan peak rule | Japan (broad index), Taiwan (broad index) | `us-fred-cited`, `e1-taiwan` (both from the provider file) | no |
| `M05.X.01` | CAVEAT "Monthly average" | Gold, monthly | `intl-worldbank-pinksheet` | no |
| `M06.X.01b` | CAVEAT "Self-hosted, personal use" | Bitcoin, ether | `crypto-x4-ohlc` (price), `crypto-o3-btc-height` (bitcoin supply), `crypto-c1` (ether supply); all from the provider file | bitcoin: yes; ether: yes, citing c1 for supply; neither counted in the total |
| `M06.X.02` | CAVEAT "Personal use; attribution" | Total crypto market | `crypto-c1` (now), `crypto-c3-global` (peak); provider file | yes: both are USD caps |
| `M07.X.01` | SHOW | Brent, WTI ($/barrel) | `us-fred-open` (`DCOILBRENTEU`, `DCOILWTICO`) | no: price only |
| `M08.X.01` | SHOW, "Ticker is an estimate" | US national debt | `us-treasury-debt` | n/a |
| `M01.X.02`, `M02.X.01`, `M03.X.02`, `M04.X.01`, `M05.X.02b` | LATER under H5 | none | none | - |

**Not built (LATER, no connector, negative-tested):** `M05.X.02a` and `M06.X.01a` (the oracle route, O5), `M09.X.01` (macro tiles). No code may call an oracle contract or create an M09 tile; see `items.test.ts` in 1.9.

**Value lost** is shown only where the row says yes (council: "only where the source's terms allow it and are quoted"). Index rows and gold show drawdown only, until legal clears one cited cap figure per market (`markets.md` open question 1). The tile config carries `valueLost: "series" | "supply" | null` and `countInTotal: boolean` (1.4 step 8), and nothing else computes either.

**Dropped from research, not needed in v1:** FX (ECB, Fed H.10). FX was only needed to turn Asian caps into USD, and v1 shows no Asian value lost. The Korean exchange's API needs a key, so Korea is off (H5).

### 1.2 Data model (addition to architecture §3.8)

Market series are not entities. Writing a `records` row per daily observation would double their size for no gain, so series rows carry provenance through their `sync_id`, and `syncs` already holds the licence, retrieval time and upstream as-of (§3.2). The architect takes these three tables into §3.8 and §8 in milestone B. They live in `finora.db` for `store` sources and in `connector-cache.db` (same DDL) for `connector-cache` sources.

```sql
market_series(
  id         INTEGER PRIMARY KEY,
  series_key TEXT NOT NULL UNIQUE,   -- e.g. 'fred:DCOILBRENTEU', 'e1:taiwan', 'fred-cited:japan'
  source_id  INTEGER NOT NULL REFERENCES sources(id),
  item_id    INTEGER NOT NULL,       -- Part G item, via the items intern table
  unit       TEXT NOT NULL,          -- 'index_points' | 'usd' | 'usd_per_oz' | 'usd_per_bbl' | 'usd_cap' | 'coins'
  frequency  TEXT NOT NULL,          -- 'daily_exchange' | 'daily_7d' | 'monthly' | 'quarterly'
  symbol     TEXT                    -- unused since H5 (was the fund ticker of a slot series); always NULL
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
| `fred-citation-required` | true | false | false | **false** (owner permission needed to redistribute) | 2026-11-19, https://fred.stlouisfed.org/legal/ |
| `ogdl-tw-1.0` | true | false | false | true | 2026-11-19, https://data.gov.tw/license |
| `cc-by-4.0` (World Bank) | true | false | false | true | 2026-11-19, https://datacatalog.worldbank.org/public-licenses#cc-by |
| (provider file) | per entry | false | per entry | per entry | per entry: the date and terms URL the user records |

Invariant 3 (§4.2) puts every `redistribution: false` source in `connector-cache`, which matches the storage column below. Each configured provider's licence comes from its provider-file entry (id, name, the three flags, verified date and terms URL). The server registers it for `checkSource` (`extraLicences`), and it can never replace a built-in licence. R17 reads "redistribution = false ⇒ connector-cache" (architect, accepted; legal: consistent with memo rule 5).

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
8. `totalWiped` = the sum of non-null `valueLost` over the rows whose tile config has **`countInTotal: true`**. It is returned with the rows it includes and the oldest `asOf` among them.
   - `countInTotal` is true only for `M01.X.01` (US corporate equities) and `M06.X.02` (total crypto market).
   - Bitcoin and ether (`M06.X.01b`) are false, because the total crypto market already contains them (designer, 7029912590).
   - If a counted row has no value lost (source down or stale), the total omits it and lists it under `excludedItemIds`. It is never replaced by its parts.
   - Display: "Value below peaks ≈ $X trillion" with the list of rows and the oldest as-of (DESIGN.md §12).
9. **Stale** (council clarification 1, 2× cadence):

   | Frequency | Stale when the last observation is older than |
   |---|---|
   | `daily_exchange` | 2 business days (Mon-Fri; no holiday calendar, so the day after a holiday can read Stale for a few hours) |
   | `daily_7d` | 2 calendar days |
   | `monthly` | 62 days after the period end |
   | `quarterly` | 184 days after the period end |

   A `latest` row older than 2× its poll interval is ignored (step 2 falls back to the last close).
10. **Debt ticker** (M08): `anchor` = `record_date` at 21:00 UTC (close of business in Washington, as an approximation). `yearAgo` is the latest row dated on or before `record_date − 365 days`. `perSecond = (total − yearAgo.total) / secondsBetween(yearAgo.anchor, anchor)`. The client shows `total + perSecond × (now − anchor)`, labelled "Ticker is an estimate", beside the official figure and its date.

**The row DTO is `MarketRow` in `docs/architecture.md` §8**, served by `GET /api/v1/markets/crash` from the server cache. The maths above fill it as follows:

| §8 field | From |
|---|---|
| `itemId`, `label` | the tile config row (`label` is an i18n key) |
| `state` | `not_configured` when the provider file doesn't configure the row's source (H4); `error` from the source; `loading` before its first sync; `peak_unknown` when `peakKnown` is false; `stale` per step 9; otherwise `ok` |
| `value` | `current` (step 2) |
| `unit` | `market_series.unit` |
| `peak` | `{ value: peak, date: peakDate, basis: peakBasis }` (steps 3-4); absent when `peakKnown` is false |
| `drawdownPct` | step 5; absent when `peakKnown` is false (never 0) |
| `valueLostMicroUsd` | step 7, as an integer number of micro-USD (`Math.round(usd × 1e6)`); absent unless the tile config allows value lost |
| `cadence`, `delayed` | below |
| `asOf` | `currentAt` (step 2) |
| `sources` | the `SourceRef`s of the series used, plus `derived: true` and the input series for computed values |

`CrashResponse.totalWiped.valueUsd` is step 8, with `rowItemIds`, `excludedItemIds` (counted rows that had no value, including a row whose provider isn't configured) and `oldestAsOf`.

**Fields §8 added for this spec** (`91a002e`, `ceb20ec`): `rowKey` (e.g. `"M06.X.01b:bitcoin"`; one item can have several rows), `trackingSince` (the Taiwan empty state), `dayChangePct` (step 6) and `totalWiped.excludedItemIds`. The fund `symbol` field went with H5.

Three fields from the frontend plan (frontend, 7029664310) are defined here so the UI never guesses:

- **`cadence`** is `"live"` when `value` comes from a `market_latest` row inside its freshness limit (step 2). Otherwise it is the series' `frequency`.
- **`delayed`** is a fixed property of the source: true when the source publishes its observation at least one day after the observation date.
  - true: Treasury (1 business day), FRED oil (≈ 2 days), FRED Japan (next day), Z.1 (about 10 weeks), the World Bank (the next month), the Taiwan index (the evening after the session), and the cited FRED series
  - false: x4, c1, o3

  It sits in the tile config beside each series, and `items.test.ts` asserts every series has it.
- **`peak.basis`:**
  - `"since"`: the highest close since `peakSince`, the normal case
  - `"all_time"`: the total-crypto row, whose peak is the C3 all-time high
  - `"seeded"`: the peak or the window start comes from `seeds.ts`, and the row cites the seed
  A row with `peakKnown: false` has no `peak`; it renders "tracking since [trackingSince]".

### 1.5 Settings and the local provider file (H4)

The `settings` table (§3.8) holds one market key, `markets.peakSince` (ISO date, default `2025-01-01`). The fund slots and the market keys are gone (H5).

**The provider file**, `<data dir>/providers.json` (or `FINORA_PROVIDERS_FILE`), is gitignored and read once at start. Schema (`packages/markets/src/providers.ts`; qa 7066883380):
- `{"version": 1, "providers": {"<code>": entry}}`, where code is one of `x4`, `c1`, `c3`, `o3`, `fred-cited`, `e1`. The file is under 64 KB, strict, and refuses unknown keys.
- Each entry has `hosts` (bare hostnames only: no scheme, IP literal, localhost or wildcard), `urls` (the named https templates the connector needs, each on one of the entry's hosts, with no credentials or port; placeholders only in the path or query, and only the names the connector fills), `termsUrl` and `homepage` (on its hosts), `publisher`, `attribution` (one line or null), and `licence` (`id`, `name`, `redistribution`, `nonCommercial`, `attributionRequired`, `verifiedOn`). Display text (`publisher`, `attribution`, `licence.name`, a series' `attribution`) is one line with no control or format characters. A licence id may not repeat a built-in licence's id or another entry's. Codes are matched as own keys only, so `__proto__` or `constructor` reads as an unknown code.
- `fred-cited` adds `series`: `{id, rowKey, attribution}`, where rowKey is a known row (`M03.X.01:japan`, `M01.X.03:us_large`, `M01.X.03:us_broad`, `M01.X.03:us_tech`), one series per row. Cited series are stored under `fred-cited:<row>`, never under an id that names the owner. A daily US row's attribution must be exactly legal's approved line "For personal use only. <owner>'s copyright, via FRED; 1-day lag" (case-insensitive, whitespace-normalised), or the file is refused (legal 7070739448, qa 7070731934). The owner is the only free slot, and holds the copyright holder's name only; no licence terms (legal 7070784724): one line, no ";", no second sentence, no control or format character. Anything before, after or instead is refused; the owner's name lives only in that line. A row whose series the file doesn't list reads `not_configured`.
- **Any problem configures nothing.** Problems are reported as paths only, never values; the server logs their count only. The server checks that the path is a regular file under 64 KB before reading it. The file is user configuration: it never reaches a backup (tested), a log, an error or a response, and `doctor` doesn't read it.
- The polite fetcher's allowlist comes from the entry's hosts. Private-address refusal, redirect re-checks and the no-POST-redirect rule hold whatever the file says.
- Tests use placeholder hosts under `.example`, built from parts (`fixtureProviders()`).
- The maintainer's filled file lives in the main checkout's `.local/`, to copy into the data dir.

### 1.6 Scheduling (`packages/markets/src/schedule.ts`; cto §7)

| Job | Sources | When |
|---|---|---|
| official daily | `us-treasury-debt`, `us-fred-open`, `us-fred-cited`, `e1-taiwan` | every 6 h at 01:00, 07:00, 13:00, 19:00 UTC; unchanged costs one sync row |
| official monthly | `intl-worldbank-pinksheet` | daily at 12:00 UTC (the file changes about once a month) |
| crypto quotes | `crypto-x4-ohlc` (latest) every 5 min, `crypto-c1` (global) every 15 min | **while a Crash monitor client is connected and for 30 min after**; otherwise hourly. Only when the provider file configures them |
| crypto daily | `crypto-x4-ohlc` (daily candles), `crypto-c1` (ether supply), `crypto-o3-btc-height` | hourly |
| crypto peak | `crypto-c3-global` | daily at 00:30 UTC |

Request budget per day, client connected all day:

| Source | Calls/day | Free limit | Headroom |
|---|---|---|---|
| x4 | 288 + 48 | 10,000 per 10 min | large |
| c1 | 96 + 48 | keyless limit unpublished | back off on 429 |
| c3 | 1 | 20,000/month | large |
| o3 | 24 | unpublished; 429 on excess | back off on 429 |
| official | ≤ 20 | none published | - |

Every job uses the polite fetcher (§4.4): host allowlist from `officialHosts`, backoff on 429 and 5xx (1 min, 5 min, 30 min), and no parallel requests to the same host.

### 1.7 Refresh and change (all sources)

- **Change detection:** content hash per artifact plus `parserVersion` and the window start (§4.4 step 1, A1); all equal → one `unchanged` sync. The window start is in the hash because the World Bank workbook is the same file whatever the window: moving the peak date earlier must re-parse it. Otherwise the loader upserts `market_obs` by (`series_id`, `date`): a changed value is overwritten (FRED and the World Bank revise history) and records the new `sync_id`.
- **`parserVersion`** for a market source is the hash of its module under `packages/sources/src/<cc>/<id>/` (fetch and parse), its field map, the items list, and `packages/markets/src/tiles.ts` (a tile's `valueLost` rule or unit change must re-parse). `calc.ts` is not part of it: it runs at read time over stored observations.
- **Record unit:** one observation, (`series_key`, `date`), sorted by `series_key` then `date` ascending. Its hash input is `[series_key, date, value]`, and the value is normalised to the source's stated decimals. Market sources write `market_obs` rows, not `records` rows (1.2). The pipeline's staging table holds `(series_key:date, hash)` pairs the same way.
- **Removal:** for full-history sources (FRED, Treasury, World Bank), an observation inside the window that is absent from a complete pull is deleted. Incremental sources (x4, e1) and snapshot sources (C1, C3, O3) never delete in a sync; they only append or overwrite. This is `SourceMeta.purgeScope` (§4.2): `window` for the full-history pulls, so the purge only covers the pulled date range; `none` for the rest.
- **`maxPurgeShare`** = max(2%, 5 × the measured removal share per refresh period), per §4.4. The removal share measured over two pulls (2026-11-19 and -20) was 0 for every full-history source: rows only grew. So the value is **0.02**. Sources with `purgeScope: "none"` declare `0` and never delete in a sync. Settings-driven deletions (moving `peakSince` later, changing a fund symbol, removing a key) are explicit jobs outside the sync purge and are logged as such.
- **`checkedAt`** (A5): every row shows "checked [time]" from the latest content or unchanged sync, beside its as-of. The stale rule (1.4 step 9) uses the observation date, never `checkedAt`.
- **History events:** none. Market series emit no `finora.*` events.

| Source | Record unit, sort | `asOf` (proven) | `maxPurgeShare` | `purgeScope` |
|---|---|---|---|---|
| us-treasury-debt | observation, by date | `max_date_in_data` (`record_date`) | 0.02 | window |
| us-fred-open, us-fred-cited | observation, by series then date | `max_date_in_data` (`observation_date`) | 0.02 | window |
| e1-taiwan | observation, by date | `max_date_in_data` (`Date`, ROC) | 0 | none |
| intl-worldbank-pinksheet | observation, by month | `in_file_field` (sheet "Monthly Prices", A4 "Updated on …") | 0.02 | window |
| crypto-x4-ohlc | observation, by pair then date | `max_date_in_data` (`timestamp`) | 0 | none |
| crypto-o3-btc-height | one snapshot per UTC day | `in_file_field` (block header `time`) | 0 | none |
| crypto-c1 | one snapshot per series | `in_file_field` (`updated_at`, `last_updated`) | 0 | none |
| crypto-c3-global | one snapshot | `in_file_field` (`last_updated`) | 0 | none |

### 1.8 Fixtures

- `packages/markets/src/fixtures/series.ts` generates every series from a seed. The walk is geometric with a planted peak on `2025-07-15` and a drawdown of −23.4% on the fixture "today" `2026-11-18`, so `calc.test.ts` asserts exact numbers.
- Per-source layout writers (below) wrap the series in each source's raw format. Each committed layout fixture is under 50 KB.
- **Hosts in fixtures:** official hosts are real (the parsers need them); provider hosts are placeholders under `.example`, built from parts (`fixtureProviders()`). Every value is synthetic.
- Fixture "today" is fixed by a fake clock in every test.

### 1.9 Tests (shared)

| File | Proves |
|---|---|
| `packages/markets/src/calc.test.ts` | peak, peak date and drawdown on the planted series; the total-crypto peak uses only the C3 all-time high and the current C1 total (no stored C1 history); `peakKnown = false` gives `drawdownPct = null` and never 0; value lost only for `series`/`supply`; `totalWiped` sums only `countInTotal` rows (bitcoin and ether with value lost are not added on top of the total crypto market), lists them, and reports a counted row with no value as excluded; the stale thresholds per frequency, including a Monday after a Friday close (not stale) |
| `packages/markets/src/debt.test.ts` | per-second rate and ticker from two fixture rows; label key present |
| `packages/markets/src/items.test.ts` | one case per M item: every M SHOW/CAVEAT item in `items.generated.ts` has a tile row and a connector; every LATER item (the H5 rows, `M05.X.02a`, `M06.X.01a`, `M09.X.01`) has neither, and no connector lists an oracle host |
| `packages/markets/src/settings.test.ts` | the peak date's default and validation |
| `packages/markets/src/providers.test.ts` | one case per provider-file refusal; a broken file configures nothing; problems never echo a value |
| `packages/markets/src/schedule.test.ts` | with a fake clock, one full day of jobs stays within every limit in 1.6, and crypto drops to hourly 30 min after the last client leaves |
| `packages/markets/src/connectors.test.ts` | connector-cache rows never appear in export, list endpoints or MCP bulk tools; c1 rows older than 24 h are deleted |
| `packages/markets/src/provenance.test.ts` | every `MarketRow` value carries a `SourceRef` with licence, retrieval time and as-of; derived values are flagged and cite their inputs |
| `apps/server/src/routes/v1/markets/crash/route.contract.test.ts` | the response validates against `CrashResponse`; it is served from the server cache with no upstream call; with no provider file, official rows are `ok` and provider rows `not_configured` |
| `apps/web/e2e/crash-monitor.spec.ts` | no provider file: the official rows render with numbers, provider rows show "Not configured", and Taiwan renders "Peak not known yet: tracking since [date]" with no % |
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

**Items:** `M01.X.01` CAVEAT "Quarterly; includes non-listed equity" (NC); `M07.X.01` SHOW (NC). Legal: oil is SHOW on the official wording, with source and date on each figure. `M03.X.01` (Japan row) CAVEAT (NC).

**Field map:** `observation_date` → `market_obs.date` (transform above); `<SERIES>` value → `market_obs.value` (skip empty and `.`; reject non-finite). Every other column: none exist.

**Identity:** `series_key` as above. **Refresh:** full pull of the window, `purgeScope: "window"`.
**Fixtures:** one CSV per series in the measured format, from the fixture series. **Tests:** `packages/sources/src/us/fred/fred.test.ts` (missing-value forms; quarter start → end; units × 1e6 for Z.1; the cited series lands in `connector-cache.db` only).
**Failure modes:** HTTP error or an HTML page instead of CSV (first line not `observation_date,`) → `failed` with `not_csv`; keep rows; Stale per frequency.
**Open questions:** none. The unit of `BOGZ1LM893064105Q` is "Millions of Dollars" on its series page; the parser asserts this against `fixtures/fred-units.json`, and a nightly `live` job re-reads the page.

### e1-taiwan: Taiwan broad index (provider file, code `e1`)

The Taiwan exchange's open-data API, under Taiwan's Open Government Data License 1.0 (CC BY 4.0 compatible, attribution required). Its host, URL and attribution line live in the provider file (H4). The parser is fixed: daily closes for the current month only (`Date` in the ROC calendar, `YYYMMDD` with year + 1911, and `ClosingIndex` with thousands separators). It is stored in the main store when the entry's licence allows redistribution. The as-of is `max_date_in_data`. Series `e1:taiwan` (`index_points`, `daily_exchange`); `purgeScope: none`.

**Taiwan peak rule:** history accumulates from the first sync (the open-data API has no backfill, and the exchange's website history pages are off-limits: its terms ban crawlers). `peakKnown` stays false until the first stored observation is within 7 days of `peakSince`, which with today's default never happens. So the row shows "tracking since" until a seed exists. A seed is one cited official figure (`packages/markets/src/seeds.ts`: `{ seriesKey, date, value, citation, licence }`, committed only after legal clears `markets.md` open question 1). **v1 ships `seeds.ts` empty.** `calc.ts` treats a seed as an observation for the peak and `peakKnown`, and the row cites it.

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

### Removed under H5: stocks-s7 and gold-s3

The fund-price and daily-gold connectors needed the user's own key, so human ruling H5 removed them with their rows, settings and env vars. Monthly gold (`intl-worldbank-pinksheet`) stays.

### Provider-file sources: x4, o3, c1, c3, fred-cited (and e1, above)

Each is built from its provider-file entry (1.5): `officialHosts` = the entry's hosts, `licence` = the entry's licence id, `attribution`, `homepage` and `publisher` from the entry. With no entry, the source has no connector, is never fetched, and its rows read `not_configured`. The parsers below are fixed in the tree; only the endpoints come from the file.

| Source | Code and URL templates | Storage | asOf | Reads | Series |
|---|---|---|---|---|---|
| `crypto-x4-ohlc` | `x4`: `daily` (`{pair}`, `{limit}`, `{start}`), `latest` (`{pair}`) | connector-cache | `max_date_in_data` (`timestamp`) | `data.ohlc[].timestamp` (string epoch seconds), `close` | `x4:btcusd`, `x4:ethusd` (`usd`, `daily_7d`); a window over 1,000 days pages by `start` |
| `crypto-o3-btc-height` | `o3`: `rpc` (JSON-RPC POST, idempotent: `getbestblockhash`, then `getblockheader`), `tip` and `block` (`{hash}`) as the GET fallback | store (chain data may be displayed) | `in_file_field` (header `time`, or the fallback block's `timestamp`) | `result.height`, `result.time` | `btc:supply` from `btcSupply(height)` (`coins`) |
| `crypto-c1` | `c1`: `global`, `ethereum` | connector-cache, latest snapshot only, deleted after 24 h | `in_file_field` (`data.updated_at`) | `data.total_market_cap.usd`; `[0].circulating_supply`, `[0].last_updated` | `c1:total_cap`, `c1:eth_supply` |
| `crypto-c3-global` | `c3`: `global` | connector-cache | `in_file_field` (`last_updated`) | `market_cap_ath_value`, `market_cap_ath_date` | `c3:total_cap_peak` |
| `us-fred-cited` | `fred-cited`: `series` (`{id}`, `{from}`), with the series list | connector-cache (personal use; redistribution needs the owner's permission) | `max_date_in_data` (`observation_date`) | `observation_date`, the series value | `fred-cited:<row>` (`index_points`) |

- **x4:** the latest candle goes to `market_latest`, the daily candles to `market_obs`. On HTTP errors rows are kept, a latest older than 2 h is ignored, and daily rows go Stale after 2 days.
- **o3:** supply follows the halving schedule; the gap to an explorer's figure is unclaimed early subsidy. If both routes fail the supply keeps its last value, and value lost hides after 2 days.
- **c1:** a keyless refusal arrives as HTTP 200 with an `error` body and is failed, not stored. The view drops snapshots older than 24 h (`SNAPSHOT_MAX_AGE_HOURS`), and the job `c1-expire` deletes them.
- **c3:** the total-crypto peak is max(the c3 all-time high, the current c1 total). No c1 history is kept.
- **fred-cited:** the same CSV parser as `us-fred-open`; missing values (`.`) are dropped and counted. Its items are the rows its series fill (`M03.X.01`, `M01.X.03`). The daily US rows (legal 7066891816): personal use only; connector cache only, so never exported, served in bulk, backed up or put in MCP; the row shows the latest value, its as-of, the drawdown and the attribution, never the series; fixtures are the synthetic walk; F4 is never configured. Without them M01 is the quarterly official row.
- **Tests:** `markets/src/connectors.test.ts` and `providers.test.ts` (one case per schema refusal, including a daily US row without personal use); `server/src/markets/markets.test.ts` (no file → `not_configured`, never zero; a licence the file didn't register writes nothing; the daily US rows carry their personal-use line and sit in cc; a file without them leaves them `not_configured`; a backup holds no provider host; SEC-5, SEC-7 and SEC-8).

## Part 3: what the builder must not do

- No connector for the unofficial keyless chart endpoint measured in phase 1 (its terms bar automated access), and none for the CSV site behind a browser check.
- No oracle contract reads (`M05.X.02a`, `M06.X.01a` are LATER).
- No FX connector, no Korean exchange connector and no key-gated connector in v1 (1.1, H5).
- No commercial host, URL, attribution line or terms URL anywhere in the tree (H4): they belong in the local provider file.
- No real ticker anywhere committed. No price value in any committed file: fixtures are generated.
- No `connector-cache` row in an export, a list endpoint, an MCP bulk tool, a log line or an error message.
