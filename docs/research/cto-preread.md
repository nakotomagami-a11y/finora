# CTO pre-read for council session 1 (2026-11-19)

Posted by the `cto` seat on the hub; committed by the coordinator. Measured from that seat; probes and downloads stay in the gitignored `research/.cache/`. Tags: 🟢 measured · 🟡 extrapolated · 🔴 assumed.

**Summary:** loading and refreshing the official data is feasible on one laptop at $0. The cost nobody has measured yet is LLM tokens per investigation.

## 1. Volumes and freshness

| Source | Rows | Bytes per full pull | Freshness seen | Validators |
|---|---|---|---|---|
| LV Enterprise Register, 29 datasets | 🟢 490,496 entities (222,222 not terminated) | 🟢 ~817 MB CSV, no gzip; financial statements alone ~520 MB | 🟢 all regenerated 2026-11-18; the name-history file unchanged since 2025-04-02 | ETag + Last-Modified, but both change on every daily regeneration |
| EE e-Business Register, 9 daily files | 🟢 381,685 entities | 🟢 ~495 MB zipped daily; annual-report files ~188 MB zipped, monthly | 🟢 daily files dated 2026-11-19; the parquet files on the same page date from 2023 (stale, don't use) | Last-Modified |
| LT legal-entity register (JAR) | 🟢 550,482 (~235k without a deregistration date) | 🟢 146 MB CSV in 2.2 s | 🟡 Last-Modified 2026-10-22, 28 days old | ETag + Last-Modified |
| GLEIF golden copy | 🟢 3,499,919 LEI records, 493,515 relationships | 🟢 full LEI file 486.9 MB | 🟢 three publishes a day, daily and weekly delta files | use deltas |
| EU, UN, OFAC sanctions | - | 🟢 25.3 MB, 2.2 MB, 5.8 MB | daily | - |
| US state registries | 🟢 NY 4,284,155 · CO 3,140,873 · OR 1,592,149 | not pulled | 🟢 all updated 2026-11-19 | - |
| SEC EDGAR bulk | unknown | unknown | unknown | 🟢 returns 403 without a contact address in the User-Agent |

## 2. Store benchmark

LV + EE + LT basics (1,422,663 rows) loaded into SQLite with an FTS5 name index, using the SQLite built into Node 24 (3.53.4, nothing to install):
- 🟢 Load 73.5 s with a naive single-thread parser; FTS build 24.0 s.
- 🟢 File size 299 MB.
- 🟢 Prefix name search, top 20: p50 19 ms, p95 39 ms.
- 🟢 The build machine has neither Docker nor Postgres installed.

## 3. Fill-rate traps

- 🟢 LT legal-entity file: address 0%; status and legal form are ID references. Address needs a join to the registered-office dataset (`buveines`); status and form need the classifier datasets.
- 🟢 EE: normalised address 92.8%, VAT number 34.7%. LV: name and address ~100%.
- 🟢 Beneficial-owner files are still downloadable today in LV (17.8 MB, dated 2026-11-18) and EE (28.0 MB, dated 2026-11-19). Whether they may be shown is a legal call; whatever is decided is enforced per field in the data layer, not by hiding it in the UI.

## 4. Provisional technical calls (the architect can overturn them with measured numbers)

1. **One embedded store for v1: SQLite through Node's built-in driver.** "One documented command" has to run on a machine without Docker or Postgres, and the benchmark leaves headroom. 🟡 Baltics + NY/CO/OR ≈ 10.4M rows ≈ 2-3 GB. Postgres comes later, behind the same repository interface, only if a hosted multi-user deploy is approved. No second engine in v1: no separate search server, no graph database.
2. **Load budgets become acceptance criteria:** first full load ≤ 30 min, daily refresh ≤ 5 min, database ≤ 10 GB on a typical developer laptop. Progress is visible, and a load resumes after a failure.
3. **Refresh cadence:** registers and sanctions daily. Financial statements weekly (LV re-publishes ~520 MB every day whether or not anything changed). GLEIF by daily delta. SEC per company, on demand, at most 10 requests per second, cached.
4. **Skip unchanged files by content hash**, not by HTTP validators; LV's ETag changes on every regeneration.
5. **Every stored record carries** source id, source URL, licence id, fetched-at and source record id. A record without a licence id fails the load. The legal product rules hook in here.
6. **US state registries:** bulk per state, behind an opt-in loader flag; on by default for the states the council keeps.

## 5. The missing number

Every source above costs $0. The running cost is the agent runtime: LLM tokens and web-search calls per investigation. It is unmeasured, and without it the council can't set agent count, depth or cost caps. `data-osint` is asked to run one real investigation end to end and report tokens, tool calls and wall time per agent, priced at two or three model tiers plus a local open-weights option.

## 6. Statement-store benchmark (2026-11-20)

The LV company file, 490,496 rows → 4,975,756 statements, through `node:sqlite`. Probes: `research/probes/cto/` (README records both runs and which numbers to trust).

| Statement layout | First load | Size | Reload of an unchanged file |
|---|---|---|---|
| As drafted: text hash key, ISO timestamps on every row, indexes built during the load, `last_seen` set on every statement | 1,039 s | 1,879 MB, 378 B/statement | 1,430 s, all 4,976,210 statements rewritten (measured; file grew to 2,045 MB) |
| Lean: integer keys, interned property names, load-run ids instead of timestamps, a row hash per source record so unchanged rows are skipped, indexes built after the load | 28.8 s | 612 MB, 123 B/statement | 8.9 s, 0 writes |

- The statement model holds up; the drafted layout does not meet the load budgets once US states are in.
- 🟡 NY + CO + OR at ~10 fields each ≈ 90M statements ≈ 11 GB at 123 B/statement: over the 10 GB budget before any Baltic data. data-us's active-row and field counts decide which states load by default.
- Session 2 will check that loader slices carry measured budgets (first load, daily refresh, database size) and row-level diffs, not only fixture timings.
