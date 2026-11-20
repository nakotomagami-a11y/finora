# Benchmarks

Absolute numbers for the store and loaders, recorded on a named machine profile. CI cannot hold absolute times, so CI checks relative regression budgets on the fixture world; the numbers here are the budgets the loader slices are accepted against (policy P10, `docs/architecture.md` §4.5).

Re-run with the probes in `research/probes/cto/` (see its README). Never record entity-level output here.

## Machine profiles

| Profile | Hardware | OS | Node / SQLite |
|---|---|---|---|
| `dev-desktop-1` | 8-core desktop CPU, NVMe SSD | Windows 11 | Node 24.20, SQLite 3.53.4 (`node:sqlite`) |

## Budgets (P10)

| Budget | Value |
|---|---|
| Disk | LV ≤ 2.5 GB · EE ≤ 3 GB (+ ≤ 0.25 GB share-alike) · LT ≤ 2 GB · cross-border ≤ 1 GB · whole store ≤ 10 GB |
| First core load | ≤ 30 min; LV and LT searchable in ≈ 2 min, EE in ≈ 6 min |
| Daily refresh | ≤ 5 min, never blocking reads |
| Unchanged reload | one `syncs` row, 0 statement writes |
| Raw cache | ≤ 1.5 GB (latest artifact per source, gzip; measured gzip ratios: LV register x4.7, LT legal entities x4.0, LV members x4.5; estimate ≈ 1.3 GB) |
| Whole data dir | ≤ 12 GB |
| Per source | records, bytes per record, statements, facts and events reported by each loader slice |

## Recorded measurements

### Statement layout (cto, 2026-11-20, `dev-desktop-1`)

LV company file, 490,496 rows → 4,975,756 statements.

| Layout | First load | Size | Per statement | Reload of an unchanged file |
|---|---|---|---|---|
| Drafted (text keys, timestamps per row, indexes during load) | 1,039 s | 1,879 MB | 378 B | 1,430 s, all 4,976,210 statements rewritten |
| Lean (adopted: integer keys, interned props, sync ids, row hash per record, indexes after load) | 28.8 s | 612 MB | 123 B | 8.9 s, 0 writes |

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
| FTS5 `unicode61 remove_diacritics 2` (prefix) | 81 MB | 6.3 s | top-20 prefix search: p50 19 ms, p95 39 ms (earlier run, 1.42M rows) |
| FTS5 `trigram remove_diacritics 1` | 126 MB | 7.8 s | top-20 substring search: p50 0.18 ms, p95 0.76 ms |
