# Benchmarks

Absolute numbers for the store and loaders, recorded on a named machine profile. CI cannot hold absolute times, so CI checks relative regression budgets on the fixture world; the numbers here are the budgets the loader slices are accepted against (policy P10, `docs/architecture.md` §4.5).

Re-run with the probes in `research/probes/cto/` (see its README). Never record entity-level output here.

## Machine profiles

| Profile | Hardware | OS | Node / SQLite |
|---|---|---|---|
| `dev-desktop-1` | 8 cores / 16 threads, 32 GB RAM, disk type not recorded | Windows 11 | Node 24.20, SQLite 3.53.4 (`node:sqlite`) |

## Budgets (P10)

| Budget | Value |
|---|---|
| Disk | LV ≤ 2.5 GB · EE ≤ 3 GB (+ ≤ 0.25 GB share-alike) · LT ≤ 2 GB · cross-border ≤ 1 GB · US ≤ 1 GB · whole store ≤ 10 GB (binding; history inside it). Estimate ≈ 7.75 GB, ≈ 8.75 GB with a year of history |
| First core load | ≤ 30 min; LV and LT searchable in ≈ 2 min, EE in ≈ 6 min |
| Daily refresh | ≤ 5 min, never blocking reads |
| Unchanged reload | one `syncs` row, 0 statement writes |
| Raw cache | ≤ 1.5 GB (latest artifact per source, gzip; measured gzip ratios: LV register x4.7, LT legal entities x4.0, LV members x4.5; estimate ≈ 1.3 GB) |
| Whole data dir | ≤ 12 GB, backups included |
| During a sync | `/api/v1/health` p95 < 100 ms; SSE heartbeats < 1 s late (recorded here; CI asserts only a 3 s heartbeat bound) |
| Per source | records, bytes per record, statements, facts and events reported by each loader slice |

## Recorded measurements

### Statement layout (cto, 2026-11-20, `dev-desktop-1`)

LV company file. Run 1: quiet machine, 490,496 rows → 4,975,756 statements. Run 2: 490,539 rows, taken while an unrelated application held about 50% of the CPU; **run 2 times are not budgets**, its sizes and write counts are (see `research/probes/cto/README.md`).

| Layout | Run | First load | Size | Per statement | Reload of an unchanged file |
|---|---|---|---|---|---|
| Drafted (text keys, timestamps per row, indexes during load) | 1 | 1,039 s | 1,879 MB | 378 B | not measured |
| Drafted | 2 | - | 1,879 MB, grew to 2,045 MB on reload | 378 B | 1,430 s (not a budget), all 4,976,210 statements rewritten |
| Lean (adopted: integer keys, interned props, sync ids, row hash per record, indexes after load) | 1 | 28.8 s | 612 MB | 123 B | 8.9 s, 0 writes |
| Lean | 2 | - | 612 MB | 123 B | 28.6 s (not a budget), 0 writes |

### Facts and record units (cto, 2026-11-20)

EE FY2024 annual-report figures: 3,890,789 figures in 258,448 reports.

| Layout | Size | Per figure |
|---|---|---|
| Text statements | 478 MB | 123 B |
| Narrow facts (adopted) | 61 MB | 16 B |
| One row per report | 44 MB | 11 B |

| Record unit (`records` table) | Records | Size | Per record |
|---|---|---|---|
| One per file row, sha256 | 3,884,506 | 587 MB | 151 B |
| One per file row, 16-byte hash | 3,884,506 | 524 MB | 135 B |
| One per report (adopted for long-format sources) | 258,448 | 19 MB | 74 B |

### Search indexes (cto, 2026-11-20)

All 1,422,706 Baltic company names, 25.8 characters on average.

| Index | Size | Build | Query |
|---|---|---|---|
| FTS5 `unicode61 remove_diacritics 2` (prefix) | 81 MB | 6.3 s | top 20, ranked: p50 19 ms, p95 39 ms |
| FTS5 `trigram remove_diacritics 1` | 126 MB | 7.8 s | top 20, ranked (`order by rank`): p50 13 ms, p95 34 ms |

The search API ranks, so the budget is about 40 ms p95 per index. (An unranked trigram query measured p50 0.18 ms; it is not comparable.)
