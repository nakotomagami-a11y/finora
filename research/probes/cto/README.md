# cto probes: store benchmarks

These scripts check two things:
- whether the embedded store (SQLite through Node's built-in `node:sqlite`) can hold the Baltic registers
- what a one-row-per-value statement layout costs

The results feed `docs/research/cto-preread.md` and the store slice's benchmark.

## Run

```bash
node research/probes/cto/download.mjs                            # LV, EE, LT company files, ~294 MB
node research/probes/cto/bench-search.mjs                        # flat table + FTS5 name search, three countries
node research/probes/cto/bench-statements.mjs --layout=lean
node research/probes/cto/bench-statements.mjs --layout=drafted   # slow: tens of minutes
```

- Add `--limit=20000` to any benchmark for a quick smoke run.
- No keys are needed.
- Downloads and databases stay in the gitignored `research/.cache/cto/`.

## What each script measures

| Script | Measures |
|---|---|
| `download.mjs` | Bytes, seconds, `Last-Modified` and `ETag` per file |
| `bench-search.mjs` | Load time, FTS5 build time, database size, prefix-search latency (40 queries on generic words), address fill per country |
| `bench-statements.mjs` | First load, index build, size, bytes per statement, a reload of the unchanged file (rows changed, statements written, seconds), entity read latency |

The two statement layouts:
- **`drafted`** is the early architecture draft: a text hash key, ISO timestamps on every row, indexes built during the load, and `last_seen` set on every statement at each load.
- **`lean`** uses:
  - integer keys
  - interned property names
  - sync ids instead of timestamps
  - a row hash per source record, so unchanged rows are skipped
  - indexes built after the first load

## Results

Machine profile: Windows 11, 8 cores / 16 threads, 32 GB RAM, Node 24.20 with SQLite 3.53.4.

### Run 1: quiet machine, 2026-11-19 and 2026-11-20

These are the figures quoted in `docs/research/cto-preread.md`. They came from earlier one-off versions of these scripts with the same logic.

| Benchmark | Input | Load | Size | Reload of the unchanged file | Reads |
|---|---|---|---|---|---|
| Flat search | 1,422,663 rows | 73.5 s + 24.0 s FTS build | 299 MB | not measured | search p50 19.2 ms, p95 39.4 ms |
| Statements, drafted | 490,496 rows → 4,975,756 statements | 1,039 s | 1,879 MB, 378 B/statement | not measured | entity p50 0.17 ms |
| Statements, lean | same | 18.7 s + 10.1 s index build | 612 MB, 123 B/statement | 8.9 s, 0 statements written | entity p50 0.02 ms |

### Run 2: these scripts, 2026-11-20, machine under unrelated load (~50% CPU)

| Benchmark | Input | Load | Size | Reload of the unchanged file | Reads |
|---|---|---|---|---|---|
| Flat search | 1,422,706 rows | 630.5 s + 61.6 s FTS build | 308 MB | not measured | search p50 24.2 ms, p95 56.7 ms |
| Statements, lean | 490,539 rows → 4,976,210 statements | 102.7 s + 31.6 s index build | 612 MB, 123 B/statement | 28.6 s, 0 statements written | entity p50 0.02 ms |
| Statements, drafted | 490,539 rows → 4,976,210 statements | 1,016.7 s | 1,879 MB, 378 B/statement | 1,430 s, all 4,976,210 statements rewritten; the file grows to 2,045 MB | entity p50 0.17 ms |

- **Sizes and write counts reproduce exactly.**
- **Times moved unevenly under the other load.** The drafted first load matched run 1 (1,017 s against 1,039 s). The lean load and the FTS5 build, which is pure SQLite work, took 2.6x to 5.5x longer.
- **The flat load slowed 8.6x.** That mixes the machine load with the committed parser, which yields rows through an async generator. Re-run on a quiet machine before quoting run 2 times.
- **Compare layouts within one run**, not across runs.

## Limits

- **The CSV splitter is line-based.** It is right for these three files (row counts match a full CSV parser) but not for files with line breaks inside quoted fields.
- **The drafted layout leaves out the draft's `(prop, value)` index**, so its figures are a lower bound.
- **One run per benchmark, with no warm-up control.** Treat differences under 10% as noise.
