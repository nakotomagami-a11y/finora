# Markets: data for Crash monitor and company profiles

> Phase 1 research by `data-markets`. Measured 2026-11-19 (UTC evening) with the probes in `research/probes/markets/`. Every count and date below comes from a probe run, not from a provider's marketing page. Raw responses stay in the gitignored `research/.cache/markets/`; nothing here contains a price.

> **Rulings of 2026-11-21:** H5 (no keys) takes every key-gated source out of v1. H4 (no outside names in the tree) moves commercial providers' names, hosts and terms URLs to the maintainer's private notes, and index owners' FRED series appear here as F1-F5. The measurements below are unchanged.

## Verdict

**Crash monitor can run with zero keys on official data, but only for about a third of what it shows today. Everything else needs the user's own key, and nothing that shows stock or crypto prices may be hosted publicly for free.**

1. **Official and open, no key, safe to store and display anywhere:** US national debt (daily), Brent and WTI spot (daily, 2-day lag), the Taiwan broad index (daily, open-government licence), FX rates (daily), the total market value of US corporate equities (quarterly), gold (monthly).
2. **Official but not reusable:** the US large-cap indices on FRED are marked "pre-approval required" by their owners. FRED dropped its total-market index in 2024 and its gold price in 2022. Japanese, Korean and Hong Kong exchange data is personal or non-commercial only.
3. **Crypto has a clean keyless path:** bitcoin supply is a formula of block height, and a public RPC whose terms allow display returns that height. Price feeds read from on-chain oracle contracts over the same RPC work keyless, but the oracle's own terms could not be read (open question).
4. **Stock and index prices need a user key.** Of 12 commercial price APIs tested, none gives a free licence to display to anyone but the key holder. Two fit a self-hosted app well: one runs an explicit programme for open-source apps where each user brings their own key (stocks and ETFs, 30+ years); another allows personal apps and has free index and futures data (2 years).
5. **The old dashboard's main source is out.** Its terms bar automated access without permission. Finora must not ship a connector for it (CLAUDE.md rule 4, legal rule 17).
6. **"Delayed data" does not unlock anything for free.** Delay removes exchange fees, not provider terms: every free tier still limits display to the key holder.

**Recommendation:** official sources by default, keyless on-chain crypto as a second default, and one optional user key for stock tiles. Data lives only in the user's local store, and a `public` deployment mode disables every user-key tile. Details in [Recommended design](#recommended-design).

## How to re-run the measurements

```bash
python research/probes/markets/official.py        # Treasury, FRED, EIA, World Bank, ECB, ESMA FIRDS
python research/probes/markets/prices_stocks.py   # commercial stock/index APIs (demo keys or none)
python research/probes/markets/prices_crypto.py   # crypto aggregators and exchange public APIs
python research/probes/markets/onchain.py         # bitcoin height, public RPC, oracle feeds
```

- Python 3.12+ standard library only. Each script prints one line per probe and writes a summary (status, latency, row count, first and last date, rate-limit headers, no values) to `research/.cache/markets/<script>.json`.
- Single-stock probes need `PROBE_STOCK_SYMBOL` (a US ticker, no default: the repo names no real company); without it they record "skipped".
- Optional keys, read from the environment and never written: `FRED_API_KEY`, `EIA_API_KEY`, `SEC_USER_AGENT`, and one variable per commercial provider (named in each probe). Without a key, the probe records the provider's refusal.
- Python 3.13+ rejected the Taiwan exchange's certificate under its strict X.509 flag; relaxing only that flag kept chain verification.
- **Two providers were measured once and then removed from the probes:** an unofficial keyless chart endpoint (S1), whose terms bar automated access, and a CSV download site (S2), which now sits behind a browser check. Their numbers below are from that single run.

## Naming

Official sources are named. Commercial providers carry codes (S = stock APIs, C = crypto aggregators, X = exchanges, O = on-chain services), per the mission rule that a commercial provider is named only in code that must call it. The probe scripts therefore show which code is which. Licence URLs and verbatim clauses for coded providers are kept in the maintainer's private research notes (main checkout, `.local/research/markets/terms.md`, entries by code); qa can read them on this machine.

## What Crash monitor needs

Tiles use the IDs in `docs/research/README.md`. "Peak" is the highest daily close since a configurable start date (the old version used 2025-01-01, so the store needs about 23 months of daily history today).

| Tile | Series | Market cap lost needs |
|---|---|---|
| M01 | US total market, US large-cap and tech indices | a total-market cap figure on a known date |
| M02 | Europe broad index | an index-wide cap figure |
| M03 | Japan, South Korea, Taiwan, Hong Kong, mainland China, India, Australia | one exchange cap figure per market, plus FX |
| M04 | Canada, Brazil | same, plus FX |
| M05 | Gold | above-ground stock (tonnes) |
| M06 | Bitcoin, ether, total crypto market | circulating supply; total-market peak |
| M07 | Brent, WTI | none (price only) |
| M08 | US national debt, live | none |
| M09 | Proposals: 10-year Treasury yield, unemployment rate | none |

**Market cap lost**, the formula to keep: `cap_now = published_cap(d) × level_now / level(d)`, where `d` is the date of the published figure and `level(d)` comes from the same series' history. That replaces the old dashboard's hard-coded "cap per index point" constants with one cited figure per market plus its date.

## Source catalog

### Official and open sources

#### US Treasury Fiscal Data: Debt to the Penny
- Publisher and URL: Bureau of the Fiscal Service, `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny`
- Access: REST API, JSON, `page[size]` paging, sort and field selection; no key.
- Fields: `record_date` (date), `tot_pub_debt_out_amt`, `debt_held_public_amt`, `intragov_hold_amt` (decimal strings, USD).
- Rows and coverage: 8,436 rows, 1993-04-01 to 2026-11-17. One row per business day.
- Freshness: stated "updated at the end of each business day with data from the previous business day". Latest seen 2026-11-17 on 2026-11-19 (current).
- Size and speed: latest row 0.4 s; the full table is ~1 MB in 22 pages of 400. No validators seen.
- Join keys: none needed (one national series).
- Licence: "The data is offered free, without restriction, and available to copy, adapt, redistribute, or otherwise use for non-commercial or commercial purposes." https://fiscaldata.treasury.gov/api-documentation/ (verified 2026-11-19).
- Keys, limits, cost: no key; no documented rate limit; free.
- Legal constraints: none. Cite the Treasury.
- Tested with: `official.py` probe `treasury_debt_to_penny` (row count, first and last date, fields).
- Verdict: **use.** The "live" ticker is an extrapolation: latest official total plus the average change per second over the last 365 days, labelled as an estimate.

#### FRED (Federal Reserve Bank of St. Louis)
- Access: `fredgraph.csv?id=<series>` (no key, full history, CSV) or the API (free key, 120 requests/min, JSON).
- Licence: per series. FRED's legal page has three classes: "Copyrighted: Pre-approval required", "Copyrighted: Citation required", "Public Domain: Citation requested" (https://fred.stlouisfed.org/legal/, verified 2026-11-19). API apps must show: "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis." (https://fred.stlouisfed.org/docs/api/terms_of_use.html). The probe reads each series page's class.
- Tested with: `official.py` probes `fred_csv_<ID>` and `fred_page_<ID>`.

| Series | What | Rows | First | Last seen | Lag | Licence class | Use |
|---|---|---|---|---|---|---|---|
| F1 (id in private notes) | US large-cap index | 2,512 | 2016-11-21 | 2026-11-18 | 1 day | pre-approval | **no** (also capped at 10 years) |
| F4 | US blue-chip average | 2,512 | 2016-11-21 | 2026-11-18 | 1 day | pre-approval | **no** |
| F2 | US tech-heavy composite | 14,066 | 1971-02-05 | 2026-11-18 | 1 day | pre-approval | **no** |
| F3 | US tech large-cap 100 | 10,302 | 1986-01-02 | 2026-11-18 | 1 day | pre-approval | **no** |
| (a total-market index) | US total market | - | - | removed 2024-06-03 | - | - | gone |
| F5 | Japan large-cap index | 19,243 | 1949-05-16 | 2026-11-19 | same day | citation required | caveat: owner allows download "for research"; redistribution needs its permission |
| (two exchange-sourced series) | bitcoin, ether (one exchange) | 4,336 / 3,834 | 2014-12-01 / 2016-05-18 | 2026-11-18 | 1 day | citation required | **no**: notes say reproduction "prohibited except with the prior written permission" of the exchange |
| `DCOILWTICO` | WTI spot (EIA) | 9,547 | 1986-01-02 | 2026-11-17 | 2 days | public domain | **yes** |
| `DCOILBRENTEU` | Brent spot (EIA) | 9,132 | 1987-05-20 | 2026-11-17 | 2 days | public domain | **yes** |
| (a gold fixing) | gold fixing | - | - | removed 2022-01-31 | - | - | gone |
| `GFDEBTN` | federal debt, quarterly | 242 | 1966-01-01 | 2026-04-01 | ~7 months | public domain | backup for M08 |
| `BOGZ1LM893064105Q` | all corporate equities, market value (Z.1) | 305 | 1945-10-01 | 2026-04-01 | ~10 weeks after quarter | public domain | **yes**, quarterly US cap |
| `NCBEILQ027S` | non-financial corporate equities (Z.1) | 305 | 1945-10-01 | 2026-04-01 | same | public domain | alternative |
| `DGS10` | 10-year Treasury yield (M09) | 16,205 | 1962-01-02 | 2026-11-18 | 1 day | public domain | **yes** |
| `UNRATE` | unemployment rate (M09) | 945 | 1948-01-01 | 2026-10-01 | monthly | public domain | **yes** |
| `DEXJPUS`, `DEXKOUS`, `DEXHKUS`, `DEXCHUS`, `DEXINUS`, `DEXTAUS` | FX, Fed H.10 | 10,522-14,003 | 1971-1983 | 2026-11-13 | 6 days (weekly release) | public domain | **yes** |

- Freshness: daily series update each business day; H.10 weekly; Z.1 quarterly.
- Verdict: **use** the public-domain series (oil, FX, Z.1, debt). **Skip** the index and crypto series for display.

#### US EIA: crude oil spot prices
- Access: API v2 needs a free key (`API_KEY_MISSING` without one; ~9,000 requests/h, 5,000 rows/request). History spreadsheets `hist_xls/RWTCd.xls` and `RBRTEd.xls` are keyless.
- Freshness: spreadsheets Last-Modified 2026-11-18; the release is weekly (next 2026-11-25) but carries daily values; FRED's mirror had 2026-11-17.
- Licence: "U.S. government publications are in the public domain" (https://www.eia.gov/about/copyrights_reuse.php). **Caveat:** EIA states its spot prices "are republished by EIA with permission" from a commercial data vendor (https://www.eia.gov/todayinenergy/prices.php, verified 2026-11-19); no downstream restriction was found.
- Tested with: `official.py` probes `eia_api_spot`, `eia_xls_wti`, `eia_xls_brent`.
- Verdict: **use with caveat**, through FRED's CSV (no key) or the EIA API (key: deferred). Legal to confirm the vendor caveat.

#### Federal Reserve: H.10 FX and Z.1 Financial Accounts
- Reached through FRED above. Licence: "information on Board's website is in the public domain ... may be copied and distributed without permission. Please cite to the Board" (https://www.federalreserve.gov/disclaimer.htm, verified 2026-11-19).
- Verdict: **use.** H.10 lags up to a week; for same-day FX use the ECB below.

#### ECB euro reference rates
- Access: `data-api.ecb.europa.eu/service/data/EXR/D.<CUR>.EUR.SP00.A`, CSV or JSON, no key.
- Freshness: daily around 16:00 CET; 2026-11-19 seen the same day (3.6 s response).
- Coverage: USD, JPY, KRW, HKD, CNY, INR (cross via EUR). No TWD reference rate: use H.10 `DEXTAUS`.
- Licence: free use if "the ECB must be cited as the source" (https://www.ecb.europa.eu/services/disclaimer/html/index.en.html, verified 2026-11-19).
- Tested with: `official.py` probe `ecb_fx`.
- Verdict: **use** for FX conversion of M03 and M04.

#### Taiwan exchange open-data API (provider code `e1`)
- Access: JSON, no key, 143 endpoints. The host lives in the private notes and the local provider file (H4).
- Fields: `/exchangeReport/MI_INDEX`: date (ROC calendar), index name, closing level, direction, points change, % change; 267 indices per day, the broad index included. `/indicesReport/MI_5MINS_HIST`: broad-index daily OHLC, **current month only** (14 rows on 2026-11-19).
- Freshness: latest trading day (2026-11-18 seen on 2026-11-19 UTC, before the next close).
- History: no backfill through the OpenAPI. The peak must be accumulated from the first run or seeded once from a cited figure. The website's history pages are off-limits (its terms ban crawlers).
- Market cap: no market-value endpoint found in the swagger.
- Licence: Open Government Data License Taiwan 1.0, "compatible with CC BY 4.0"; attribution is a condition (https://data.gov.tw/license, linked from the swagger; verified 2026-11-19).
- Tested with: probes run 2026-11-19 and -20, since removed from the tree with the provider's name (H4).
- Verdict: **use with caveat** (history starts on first run).

#### The Korean exchange's open API
- Access: key required (401 "Unauthorized Key" without one); 10,000 calls/key/day; daily index data from 2010-01-04.
- Licence: "API Users may only use the API Service for non-commercial purposes" and "may not provide the data provided by [the exchange] to any third parties" (terms URL in the private notes, verified 2026-11-19).
- Verdict: **deferred: key pending.** Fine for one user's own instance; never for a hosted build.

#### Japanese and Hong Kong exchange operators (statistics only)
- Both publish monthly market capitalisation. The Japanese operator's site terms forbid "secondary use of information from this website for commercial purposes" without permission (fetched via search snippet; site returned 403). The Hong Kong operator's terms allow personal use only and forbid redistribution "whether or not for gain" and any scraping.
- Verdict: **skip** as data sources. A single cited cap figure per market (see [Market-cap figures](#market-cap-figures)) is a separate legal question.

#### World Bank commodity prices ("Pink Sheet")
- Access: monthly XLSX linked from https://www.worldbank.org/en/research/commodity-markets (link found and downloaded: HTTP 200). Next update 2026-12-02.
- Coverage: monthly nominal USD prices including gold, Brent and WTI (per the file's documentation; contents not parsed yet).
- Licence: CC BY 4.0, via the page's "Data Access and Licensing" link (https://datacatalog.worldbank.org/public-licenses#cc-by, verified 2026-11-19).
- Verdict: **use with caveat** for M05 when no key is set: monthly only, so the tile shows "drawdown at last month-end".

#### IMF Primary Commodity Prices
- Desk check only. Terms allow reuse with attribution, but "For any potential commercial reuse ... request permission" and "prohibits bulk download ... by automated technology without explicit permission" (https://www.imf.org/en/About/copyright-and-terms, verified 2026-11-19).
- Verdict: **skip** (the World Bank series covers the same need under CC BY).

#### ESMA FIRDS (instrument reference data, for company profiles)
- Access: public Solr endpoint `registers.esma.europa.eu/solr/esma_registers_firds/select`, JSON, no key; 335,294,213 records in total.
- Fields used: `isin`, `lei`, `mic`, `gnr_full_name`, `gnr_cfi_code`, `mrkt_trdng_start_date`, `mrkt_trdng_trmination_date`.
- Coverage measured, current shares (CFI `ES*`, `latest_received_flag` 1, no termination date): Riga main market 8, Tallinn 19, Vilnius 22; the three growth markets 5, 10 and 3. **67 live listings.** LEI filled on 67/67, ISIN on 67/67.
- Versioning: FIRDS keeps every version of a record. Only `latest_received_flag` 1 is current; superseded versions carry `valid_to_date`. A count without that filter gave 73 (corrected 2026-11-20). One listing's latest version carries a later admission date than its first version, so "listed since" is the earliest `mrkt_trdng_start_date` across versions.
- Join keys: LEI (to GLEIF and the registers), ISIN.
- Licence: "Reproduction of all information on this site (ESMA Library) is authorised except as otherwise stated", source acknowledged (https://www.esma.europa.eu/legal-notice, verified 2026-11-19).
- Tested with: `official.py` probes `firds_shares_<MIC>`.
- Verdict: **use** for S14 "listed securities" in LT, LV, EE.

#### SEC XBRL frames and company facts (for company profiles)
- Shares outstanding (`dei:EntityCommonStockSharesOutstanding`) and public float (`dei:EntityPublicFloat`) give market cap once a price is known.
- Licence: SEC content "may be copied or further distributed ... without the SEC's permission" (https://www.sec.gov/privacy, verified 2026-11-19). 10 requests/s, contact User-Agent required; XBRL latency "under a minute".
- Verdict: **deferred: key pending** (`SEC_USER_AGENT`; no live EDGAR calls until it is set, coordinator rule C7). `data-us` owns EDGAR; this doc only needs the two fields above.

### Commercial stock, index and commodity APIs

Measured 2026-11-19 with demo keys where offered, otherwise without a key. Terms quoted in the private notes by code, with URLs.

| Code | Free access | Measured | History (free) | Delay | Index levels / futures free | Store | Display | Redistribute | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| S1 | keyless, undocumented | 200; daily bars from 1970 (US large-cap), 1996-97 (Asia), 2000 (futures); intraday live | full | live / exchange delay | yes / yes | - | - | - | **skip**: terms bar automated access without permission |
| S2 | key since 2026 (reported) | 200 with a browser check page instead of CSV | - | - | - | unknown | unknown | unknown | **skip**: unusable from scripts |
| S3 | free key, 25/day; unlimited for verified open-source projects | demo key refused (demo is for samples only) | compact only; full is premium | EOD | no (premium) / commodity spot yes | not stated | personal, non-commercial | not stated | **deferred: key pending**; candidate for gold and oil spot |
| S4 | free key, 8/min, 800/day | demo: 5,000 daily rows from 2007, 1-day lag; index refused | not stated | EOD | not on free | no caching beyond documented windows | free tier "internal non-display" | no | **skip** |
| S5 | free key, 60/min | 401 without key | candles premium | live quote | not found | delete on plan end | personal use | no | **skip**: no history, so no peak |
| S6 | free key, 5/min | 401 without key | 2 years | EOD | the tech large-cap index yes, the large-cap index paid / US commodity and index futures yes | delete within 30 days of termination | personal, non-commercial apps allowed | no | **deferred: key pending**; candidate |
| S7 | free key, 50/h, 1,000/day, 500 symbols/month | 403 without token | 30+ years | EOD (intraday for US) | no (stocks and ETFs only) / no | Starter persistent storage possibly restricted (unverified) | personal; **explicit programme for apps where each user supplies their own key**, attribution required | no | **deferred: key pending**; first candidate |
| S8 | free key, 250/day | demo refused | 5 years | EOD | 9 US indices / 4 commodities | no copying without approval | personal; no multi-user platforms; may not name the provider as source | no | **skip**: terms block an app |
| S9 | free key, 20/day | demo: 11,577 daily rows from 1980, 1-day lag; index 403 | 1 year | EOD | yes (EOD) | private, non-commercial | private only | no | **skip**: 1 year can't reach a 2025 peak, 20 calls/day |
| S10 | free key, 100/month | 401 | 1 year | EOD | paid / paid | not stated | free tier is "testing and evaluation" | not stated | **skip** |
| S11 | key; anonymous 50/day | 403 | dataset-specific | - | not found | internal business only | internal | no | **skip** |
| S12 | free account | 401 | since 2016 | live (one venue) | no (ETFs only) | not stated | not stated | "cannot redistribute" | **skip** |

Notes:
- **Asian indices on a free tier: none confirmed.** The workable route is US-listed country ETFs through S7. Their drawdown approximates the index drawdown in USD, so it includes the currency move and fund costs. The tile must say so.
- **No provider measured here allows public display on a free tier.** Display rights start at business plans or "contact sales".

### Crypto aggregators

| Code | Free access | Measured | History (free) | Freshness | Terms (store / display / redistribute / attribution) | Verdict |
|---|---|---|---|---|---|---|
| C1 | keyless (shared IP limit, unpublished) or free demo key, 100/min, 10k/month | global endpoint 200 (total cap, 24 h change, 21,366 coins), 0.2 h old; 365 days of daily prices OK; `days=max` refused; global history chart paid-only | 1 year | minutes | refresh cached data at least every 24 h / allowed in your product / no syndication / "Powered by" line required | **use with caveat** for the total-market tile |
| C2 | free key, 15k credits/month | 401 without key | 1 year daily | 5 min | integrated use allowed; no standalone resale | **deferred: key pending** |
| C3 | keyless, 20k calls/month/IP, 10/s | global endpoint 200, includes the **total-market all-time-high value and date**; history before 1 year refused (402) | 1 year | 1 min | not stated / free tier "personal use only" / Enterprise to show customers / attribution required | **use with caveat**: one call a day for the total-market peak, self-hosted only |
| C4 | free key, 500 credits/month | old API host gone (DNS failure); new API 401 | - | - | personal use only | **skip** |
| C5 | free tier retired 2026-05-21 | 401 "API key required" | - | - | internal use only | **skip** |
| C6 | keyless | current price 200, seconds old; daily chart 200 | at least back to 2023 | seconds | no mirroring, no republishing "in any form without permission" | **skip** |

### Exchange public APIs (crypto)

| Code | Free access | Measured | History per call | Terms | Verdict |
|---|---|---|---|---|---|
| X1 | keyless, 10 requests/s | 200, 350 daily candles in one call | 300-350, pages backwards | market-data terms page returned 403; third-party summaries say personal or research use only | **unclear**: personal use only until terms are read |
| X2 | keyless | 200, 721 daily candles back to 2024-11-29 | **720 most recent only, no paging**: from late December 2026 it no longer reaches 2025-01-01 | content "only for your own benefit"; no third-party apps without consent | **skip** |
| X3 | keyless | 200, 1,000 daily candles | 1,000, pages | US IPs reportedly refused (451); bulk files are CC BY-NC-SA, never to be mixed into our data | **skip** |
| X4 | keyless, 10,000 per 10 min | 200, 1,000 daily candles back to 2024-02-24 | 1,000, pages | "allows the incorporation and redistribution of our exchange data for commercial purposes", incl. "ratios, calculations, new original works"; commercial users sign a data licence | **use with caveat**: best-licensed price history for bitcoin and ether; ask for the data licence before any hosted build |

### On-chain sources

| Code | What | Measured | Terms | Verdict |
|---|---|---|---|---|
| O1 | bitcoin explorer API | tip height 976,627; block 0.1 h old | no data clause; software AGPL-3.0 and self-hostable | **use** as a fallback for height |
| O3 | public JSON-RPC (bitcoin and Ethereum) | `getblockcount` 976,632 (64 ms); `eth_call` to three oracle contracts 61-107 ms | "Blockchain data returned by the Endpoints is not Service Content. You may use it in your own applications and services, including displaying it to your users"; no reselling | **use**: the only source here whose terms allow public display for free |
| O2 | bitcoin explorer query API | total coins in circulation | no copying, storing or caching; personal only | **skip** (used once as a cross-check) |
| O4 | second public Ethereum RPC | HTTP 525 on all calls | - | **skip** |
| O5 | oracle price-feed contracts (BTC/USD, ETH/USD, XAU/USD), read through O3 | all three answered; last update 0.2 h, 1.0 h and 2.5 h old (they update on deviation or heartbeat) | terms page unreadable; licence of the values unverified | **use with caveat** until legal reads the terms; on-chain state is public |
| O6 | ether supply endpoint | 200 (beacon and execution balance sums) | no API terms found | **skip** |
| O7 | Ethereum explorer API | 200 with an error body without key | free tier "Personal & Research use only"; "Powered by" attribution | **deferred: key pending** (ether supply) |

**Bitcoin supply without any licence question:** supply = Σ over halving eras of (blocks in era × subsidy), 50 BTC halving every 210,000 blocks. From the RPC height this gave 20,114,462 BTC; the explorer reported 20,114,434 (the 28 BTC gap is subsidy that early miners never claimed). Good enough for a market cap; document the gap.

**Ether supply** has no equally clean route: it needs an aggregator's circulating supply (C1, attribution) or an explorer key (O7).

## Market-cap figures

The cap per market changes slowly, so one cited figure per market (with its date) is enough. Today's options:

| Market | Official, reusable | Other published figure |
|---|---|---|
| US total | Z.1 market value of corporate equities, quarterly, public domain (includes non-listed equity; label it) | index-provider factsheets |
| Asian markets | none found | each exchange's monthly statistics (Japanese and Hong Kong operators: site terms restrict copying) |
| Europe, Canada, Brazil | none found | index factsheets, exchange statistics |
| Gold | none | the gold industry body's quarterly above-ground stock estimate (its terms allow "limited extracts" for "review and commentary" with citation) |
| Bitcoin | computed from block height | - |
| Ether, total crypto | none | aggregator figures (C1, C3) |

**Open question for legal:** may the repo ship a config file with one published cap figure, its date and its source citation per market (about 15 numbers, as the old dashboard did), or must each user enter them? A single fact with a citation is the least risky form, but two exchange operators' terms forbid copying.

## Compliance options

What Crash monitor can show under each option. ✅ shown, 🟡 shown with a caveat, ❌ not shown.

| Tile | A. Official only, no key | B. User keys, self-hosted | C. Delayed / end-of-day | D. Keyless non-official (on-chain, exchange, aggregator), self-hosted | E. Paid licence, hosted |
|---|---|---|---|---|---|
| M01 US stocks | 🟡 total US equity value, quarterly (Z.1); no daily index | ✅ daily via S7 (ETF proxies) or S6 (one index free, the large-cap index paid) | ❌ nothing free | ❌ | ✅ |
| M02 Europe | ❌ | 🟡 ETF proxy (S7) | ❌ | ❌ | ✅ |
| M03 Asia | 🟡 Taiwan daily (history from first run); Japan daily via FRED with citation, self-hosted only | 🟡 country ETFs in USD (S7); Korea via the exchange's key | ❌ | ❌ | ✅ |
| M04 Americas ex-US | ❌ | 🟡 ETF proxies (S7) | ❌ | ❌ | ✅ |
| M05 Gold | 🟡 monthly (World Bank, CC BY) | ✅ daily spot (S3) or futures (S6) | 🟡 same as A | 🟡 oracle XAU/USD, hourly, terms unverified | ✅ |
| M06 Crypto | ❌ (FRED's crypto series need the exchange's permission) | ✅ | ❌ | ✅ bitcoin: price (oracle or X4) × computed supply; ether: price × aggregator supply; total market (C1) and its peak (C3) | ✅ |
| M07 Oil | ✅ daily spot, 2-day lag (EIA, public domain, vendor caveat) | ✅ futures, near live (S6) | ✅ same as A | - | ✅ |
| M08 US debt | ✅ daily + extrapolated ticker | ✅ | ✅ | - | ✅ |
| M09 Proposals | ✅ 10-year yield, unemployment (FRED public-domain series) | ✅ | ✅ | - | ✅ |
| Total wiped | 🟡 sum of the few markets that have a cap | ✅ | - | 🟡 adds crypto | ✅ |
| Hostable publicly | **yes** | no | yes, only with A's sources | no (except O3 data) | yes |
| Cost | $0 | $0 (free tiers) | $0 | $0 | business plans; "contact sales" (human decision) |

Why C adds nothing: delayed exchange data is free of exchange fees, but every provider tested still limits free-tier display to the key holder. The only free end-of-day series that may be redistributed are the official ones in A.

## Recommended design

1. **Default (zero keys): A + D.** Debt, oil, US equity value (quarterly), Taiwan, Japan (self-hosted), gold (monthly), FX, and crypto from public on-chain data plus one exchange that licenses derived works. This satisfies the council frame "works with zero keys on official series".
2. **One optional free key unlocks the stock tiles (B).** First candidate S7: its developer programme explicitly covers open-source software where each user brings their own key, with attribution. Second candidate S6, for index levels and futures. Each tile without a key shows an explicit "add your key" state naming the variable; never a fallback to a barred source.
3. **Connectors, not data.** Prices live only in the user's local store, tagged with source id, licence id and fetched-at (the architecture's statement model). Where a provider restricts storage (C1: refresh within 24 h; S7: possibly no persistent storage on the free plan), the connector keeps an in-memory window and refetches history once a day instead of storing it.
4. **A `public` deployment mode** (only if the human ever approves hosting) hides every tile whose source licence is not open. The licence id on each value makes that a filter, not a code fork.
5. **Attribution in the tile footer**, from the source registry: e.g. "Source: U.S. Treasury, Fiscal Data", "FRED, Federal Reserve Bank of St. Louis" plus the required FRED API notice if the API is used, "U.S. EIA", "ECB", the Taiwan exchange's open-data attribution, and each coded provider's required line.
6. **Peak bookkeeping:** keep the running maximum and its date per series in the local store. Sources with short history (the Taiwan index: current month only; X2: 720 days) are seeded once from a longer source or start "peak since first run", labelled as such.

## Request budget (cto ask 4)

Target refresh: crypto every 5 min, stocks hourly while their market is open, official series daily. 13 stock symbols covers M01-M04 as ETF proxies.

| Source | Calls per refresh | Refreshes per day | Calls per day | Free limit | Fits? |
|---|---|---|---|---|---|
| Treasury debt | 1 | 2 | 2 | none documented | yes |
| FRED CSV (oil 2, FX 6, M09 2) | 10 | 1 | 10 | none documented (API: 120/min) | yes |
| ECB FX | 1 | 1 | 1 | none documented | yes |
| e1 | 2 | 1 | 2 | none documented | yes |
| O3 RPC (height + 3 oracle reads) | 4 | 288 | 1,152 | unpublished; 429 when exceeded | probably; back off on 429 |
| X4 daily candles (bitcoin, ether) | 2 | 24 | 48 | 10,000 per 10 min | yes |
| C1 global (keyless or demo key) | 1 | 288 | 288 (8,640/month) | demo key 10k/month | yes, with ~14% headroom |
| C3 total-market peak | 1 | 1 | 1 | 20k/month | yes |
| S7 stocks | 13 | 24 (hourly) | ≤312 | 50/h, 1,000/day, 500 symbols/month | yes; **every 15 min would need 52/h and fail** |
| S6 stocks/futures | 13 | 1 (end of day) | 13 | 5/min | yes, takes ~3 min per pass |
| S3 | 13 | 1 | 13 | 25/day | only end of day, and indices are premium |
| S9 | 13 | 1 | 13 | 20/day, 1 year history | no: history too short for the peak |

## UI facts (designer question 15, architect's markets questions)

| Tile | Identifier(s) | Delay | History back to 2025-01-01 | May we store it? | Attribution | With no key |
|---|---|---|---|---|---|---|
| M01 | Z.1 `BOGZ1LM893064105Q`; user key: ETF or index symbols | quarterly (~10 weeks after quarter end); with key: end of day or hourly | Z.1 yes; S7 yes (30 years); S6 yes (2 years) | Z.1 yes; key data: user's local store only, deleted on key removal | "Board of Governors of the Federal Reserve System, via FRED"; provider line | quarterly total US equity value |
| M02 | user key only | end of day | with key yes | local only | provider line | "Add your key" state |
| M03 | the Taiwan exchange's broad index (e1); FRED F5; the Korean exchange with a key | daily (same or next day) | Japan yes; Taiwan **no** (current month only); Korea from 2010 with key | Taiwan yes (OGDL); FRED Japan series: local only, no redistribution | the Taiwan exchange's open-data line; the index owner's citation via FRED; ECB for FX | Taiwan and Japan |
| M04 | user key only | end of day | with key yes | local only | provider line | "Add your key" state |
| M05 | World Bank Pink Sheet gold; oracle XAU/USD; user key | monthly; oracle ~hourly | World Bank yes (from 1960) | World Bank yes (CC BY) | "World Bank Commodity Price Data (CC BY 4.0)" | last month-end drawdown |
| M06 | block height; oracle BTC/USD, ETH/USD; X4 `btcusd`, `ethusd`; C1 global; C3 global | minutes; oracle up to ~1 h | X4 yes (pages back); oracle per round only | X4 derived values yes; C1 refresh within 24 h; C3 personal only | X4 none required; C1 "Powered by" line; C3 attribution | bitcoin and ether price, drawdown, cap; total market |
| M07 | FRED `DCOILBRENTEU`, `DCOILWTICO` (EIA `RBRTE`, `RWTC`) | end of day, 2-day lag | yes, from 1986-87 | yes | "U.S. Energy Information Administration" | full tile |
| M08 | Fiscal Data `debt_to_penny.tot_pub_debt_out_amt` | 1 business day; ticker is an estimate | yes, from 1993 | yes | "U.S. Treasury, Fiscal Data" | full tile |
| M09 | FRED `DGS10`, `UNRATE` (proposals) | 1 day / monthly | yes, from 1962 / 1948 | yes (both public domain) | FRED citation | full tile |

Each value carries its own as-of date (observation date, or block time for on-chain). Stale thresholds per council clarification 1: daily 2 days, weekly 14, monthly 62, quarterly 184. Deep links: FRED series pages (`https://fred.stlouisfed.org/series/<ID>`), the Fiscal Data dataset page; no per-value links for on-chain reads. Labels are English everywhere except the Taiwan exchange (Chinese field and index names; map the one index we use).

## Company profiles (S14 Securities)

- **US public companies:** shares outstanding and public float from SEC XBRL (`dei` facts; deferred until `SEC_USER_AGENT` is set). Price and market cap only with the user's key (S7 or S6). Join: CIK → ticker comes from SEC's ticker file (owned by `data-us`).
- **Baltic listed companies:** 67 live listings found in ESMA FIRDS (LEI and ISIN, venue, admission date). No free, reusable price source found: the Baltic exchange operator publishes prices on its website, terms not checked (unknown; settle by reading the operator's website terms). Show "listed on <venue> since <date>" from FIRDS; price only through a user key, if a provider covers these venues (unknown).

## Deferred: key pending

| Source | Variable (proposed) | Unlocks |
|---|---|---|
| FRED API | `FRED_API_KEY` | API instead of CSV: series metadata, licence notes per series, revision dates. Not required: the CSV route works keyless |
| EIA API | `EIA_API_KEY` | oil spot directly from EIA, weekly release metadata. Not required |
| SEC EDGAR | `SEC_USER_AGENT` | shares outstanding and public float for S14 |
| Korean exchange API | (a key) | Korean broad index in M03 (self-hosted only); off under H5 |
| S7 | per probe | M01-M04 daily via ETFs, 30-year history: the main stock-tile unlock |
| S6 | per probe | one index level and US futures (oil, gold, index futures for a premarket line) |
| S3 | per probe | daily gold and oil spot |
| C1 demo key | `C1_DEMO_API_KEY` | a stable 10k/month quota for the total-crypto tile instead of the shared keyless limit |
| C2, O7 | per probe | alternatives for the total-crypto history and ether supply |

## Open questions

1. **Legal:** may the repo ship one cited market-cap figure per market (see [Market-cap figures](#market-cap-figures))?
2. **Legal:** the oracle network's terms for reading price feeds (O5): its terms page returned no clauses.
3. **Legal:** EIA spot prices are "republished with permission" from a data vendor; does that limit our display?
4. **Legal:** X1's market-data terms (403 to every fetch); X4's data licence before any hosted build.
5. **Council:** accept ETF proxies (USD drawdown, includes FX and fund costs) for M02-M04, or show those tiles only with an index-level key?
6. **Council:** Taiwan peak "since first run" or seeded once from a cited figure?
7. Desk research's open items for markets are answered: no free redistributable US price source exists (confirmed with 12 providers); crypto has a keyless path for bitcoin with public-display rights (O3), not for ether supply.

## Display matrix rows

| Section | Country | Sources | Grade | Fill rate | Notes |
|---|---|---|---|---|---|
| M01 | - | Fed Z.1 via FRED (quarterly) | B | 1/3 series | API/CSV; licence verified Y; quarterly only, includes non-listed equity |
| M01 | - | S7 or S6 with user key | C | 3/3 series (estimated) | user key; licence verified Y; personal use; ETF proxies on S7, the large-cap index paid on S6 |
| M02 | - | S7 with user key | C | 1/1 (estimated) | user key; licence verified Y; ETF proxy |
| M03 | - | Taiwan exchange open data (e1), FRED F5, ECB FX | B | 2/7 series | API; licence verified Y; Taiwan history from first run; Japan self-hosted only |
| M03 | - | S7 with user key; the Korean exchange with a key | C | 7/7 (estimated) | user key; licence verified Y; country ETFs in USD |
| M04 | - | S7 with user key | C | 2/2 (estimated) | user key; licence verified Y; ETF proxies |
| M05 | - | World Bank Pink Sheet | B | 1/1 | bulk XLSX; licence verified Y; monthly only |
| M05 | - | O5 oracle via O3; S3 or S6 with user key | C | 1/1 | API (on-chain) / user key; licence verified N for the oracle |
| M06 | - | O3 height (computed supply), O5 oracle, X4 candles | C | 2/2 (bitcoin, ether price) | keyless API; licence verified Y (O3, X4), N (O5); ether cap needs C1 supply |
| M06 | - | C1 global, C3 peak | C | 1/1 (total market) | keyless API; licence verified Y; attribution; C3 personal use only |
| M07 | - | EIA spot via FRED | B | 2/2 | CSV/API; licence verified Y; 2-day lag; licence caveat: vendor-permission note (open question 3), A once legal clears it |
| M08 | - | Treasury Fiscal Data, Debt to the Penny | A | 1/1 | API; licence verified Y; daily, ticker is an estimate |
| M09 | - | FRED `DGS10`, `UNRATE` (proposal) | A | 2/2 | CSV/API; licence verified Y; both public domain |
| S14 | LT, LV, EE | ESMA FIRDS | A | 67/67 LEI and ISIN | API; licence verified Y; reference data only, no prices |
| S14 | LT, LV, EE | prices | D | 0 | no free reusable source found |
| S14 | US | SEC XBRL `dei` facts; price with user key | B | deferred | API; licence verified Y; key pending (`SEC_USER_AGENT`) |

## Reality check

The "entities" for Crash monitor are its 20 series (M01 3, M02 1, M03 7, M04 2, M05 1, M06 3, M07 2, M08 1). Filled = the series could be shown on 2026-11-19 from a live probe under that configuration, back to the 2025-01-01 peak date unless noted. Configurations with a key are not measured (keys pending) and are marked estimated.

| Section | Country | Segment | Sample size | Filled | Fill rate | Notes |
|---|---|---|---|---|---|---|
| M01-M08 | - | A: official only, no key | 20 | 7 (strict: 6) | 35% (strict: 30%) | debt, Brent, WTI, Japan; plus quarterly US value, monthly gold, Taiwan without backfill. Strict count excludes Taiwan: it can't show a drawdown from the 2025-01-01 peak until seeded |
| M01-M08 | - | A + D: official plus keyless on-chain/exchange/aggregator | 20 | 10 (strict: 9) | 50% (strict: 45%) | adds bitcoin, ether, total crypto; strict count excludes Taiwan |
| M01-M08 | - | A + D + one stock key (S7) | 20 | 20 (estimated) | 100% (estimated) | stock tiles via ETF proxies; not measured: key pending |
| M01-M08 | - | strictly hostable in public (open licences only) | 20 | 6 (strict: 5) | 30% (strict: 25%) | Japan drops out (redistribution needs the owner's permission); crypto too, until oracle and exchange licences are confirmed |
| S14 | LT, LV, EE | live listings with ISIN and LEI | 67 | 67 | 100% | FIRDS reference data; no prices; corrected from 73 (superseded versions), 2026-11-20 |
