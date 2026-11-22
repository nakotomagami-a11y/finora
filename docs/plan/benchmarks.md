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
| First core load | **Amended by the council, 2026-11-23 (7087181944):** each country is searchable within its budget (LV 150 s, LT 150 s, EE 6 min) on a quiet machine, with the download counted or a stated download budget added; the whole core first load completes in ≤ 60 min on `dev-desktop-1`, shown up front ("About N min to finish. You can search Latvia now"). Every lane's register loads first, before any history source. Re-measure trigger: any country over its searchable budget on a quiet machine, or the complete core load over 60 min; then option C (history sources start after the first search) before any budget moves. *Was:* ≤ 30 min; LV and LT searchable in ≈ 2 min, EE in ≈ 6 min |
| Daily refresh | ≤ 5 min, never blocking reads |
| Unchanged reload | one `syncs` row, 0 statement writes |
| Raw cache | ≤ 1.5 GB (latest artifact per source, gzip; measured gzip ratios: LV register x4.7, LT legal entities x4.0, LV members x4.5; estimate ≈ 1.3 GB) |
| Whole data dir | ≤ 12 GB, backups included |
| Memory | a sync worker's peak RSS ≤ 1 GB on `dev-desktop-1`; each loader slice records its peak (`finora-cli data sync <source>` prints it) |
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

### Fixture world load (architect, S04f, 2026-11-21, `dev-desktop-1`)

The `fixtures` profile (seed 20261121): 10 sources, 1,445 companies and 336 role sets, 2,337 entities and 9,302 statements, in memory, main thread.

| Run | Load | Calibration units (CI budget) |
|---|---|---|
| 1 | 541 ms | 58 |
| 2 | 487 ms | 53 |
| 3 | 488 ms | 54 |

The shipped path (qa F3 on S04f): `finora-cli data sync --profile fixtures` into a fresh on-disk data dir, one worker thread per source, process start included.

| Run | Load | Peak RSS |
|---|---|---|
| 1 | 2,963 ms | 149 MB |
| 2 | 3,231 ms | 150 MB |
| 3 | 2,610 ms | 149 MB |

Budget: under 5 s (S04f acceptance 2), met by the shipped path with about 2 s to spare. CI holds the relative budget in `fixtures/load.test.ts` on the in-memory path: under 400 units (1 unit = the calibration loop, about 9 ms here).


### Sanctions lists, first load and restart re-parse (data-osint, S06, 2026-11-21, `dev-desktop-1`)

The real list files from the phase-1 pulls (EU 2026-10-23, OFAC SDN enhanced XML 2026-11-19, UK 2026-11-17), read from disk, so download time is not included. Each list runs `runSync` in one process on an in-memory store. A restart re-parse is the sync that runs because the app holds no person list after a start: the file is fetched and parsed again, and no row changes.

| Source | File | Entries stored / to the person index / not loaded | Statements | First load | Restart re-parse | Peak RSS |
|---|---|---|---|---|---|---|
| `eu-fsf` | 24.1 MB | 1,779 / 4,490 / 0 | 31,918 | 1.0 s | 0.7 s | 326 MB |
| `us-ofac-sdn` | 105.8 MB | 10,122 / 7,561 / 1,912 (vessels, aircraft) | 129,284 | 5.3 s | 3.6 s | 570 MB |
| `uk-sanctions-list` | 48.1 MB | 1,685 / 4,070 / 694 (ships) | 19,064 | 1.0 s | 0.8 s | 734 MB |

**Boot cost:** a restart downloads about 178 MB and parses for about 5 s, as three background syncs under their leases (the non-SDN OFAC list adds a few hundred entries). Until each finishes, officer screening answers `not_checked` and names the lists not loaded (`resolve/src/sanctions.test.ts`). Peak RSS is the process total after each list. A CLI run syncs its sources in one worker, so 734 MB is the peak that matters: under the 1 GB budget, with about 270 MB to spare.

**One worker, the whole batch (cto, 7062341637).** The same files, on an on-disk store in a fresh process, sampled every 20 ms:

| Run | Peak RSS |
|---|---|
| `eu-fsf` alone (first load, then a restart re-parse) | 325 MB |
| `us-ofac-sdn` alone | 629 MB |
| `uk-sanctions-list` alone | 488 MB |
| all three in one process, first load then restart re-parse (six syncs) | 787 MB |

V8 does not hand memory back between sources, so the batch peak (787 MB) is above the largest single list (629 MB), and still under the 1 GB worker budget. GLEIF's weekly file (≈ 0.5 GB) in the same cross-border worker would very likely pass it. Run GLEIF in its own worker, or measure that batch again when the pool lands. The OFAC peak is dominated by holding the 106 MB file as one buffer, which the loader contract requires today (`RawArtifact.bytes`). Parsing it from a stream would need a contract change.

### LV first load, all 19 LV sources (data-baltics, S05, 2026-11-22, `dev-desktop-1`)

`finora-cli data sync --country lv` against data.gov.lv, into an empty on-disk store: one worker, the sources in load order, downloads included (the files of 2026-11-20 and 2026-11-21). It reproduces with the same command; `FINORA_DATA_DIR` picks the data dir.

| Source | Records written | Sync time |
|---|---|---|
| `lv-ur-register` | 456,358 | 479 s |
| `lv-ur-name-history` | 89,477 | 132 s |
| `lv-ur-liquidations` | 9,650 | 21 s |
| `lv-ur-reorganizations` | 10,198 | 15 s |
| `lv-ur-equity-capitals` | 141,382 | 203 s |
| `lv-ur-memorandum-dates` | 150,706 | 185 s |
| `lv-ur-officers` | 208,351 | 351 s |
| `lv-ur-members` | 13,015 | 24 s |
| `lv-ur-insolvency` | 18,074 | 15 s |
| `lv-ur-securing-measures` | 33,628 | 14 s |
| `lv-ur-suspensions` | 10,604 | 3 s |
| `lv-ur-sanctions-links` | 66 | 1 s |
| `lv-ur-annual-reports` | 547,378 | 638 s |
| `lv-vid-taxes-quarterly` | 456,013 | 509 s |
| `lv-vid-taxes-yearly` | 288,180 | 356 s |
| `lv-vid-rating` | 145,690 | 151 s |
| `lv-vid-vat-payers` | 246,937 | 311 s |
| `lv-vid-suspensions` | 72,939 | 74 s |
| `lv-fid-frozen` (S06) | 136 | 1 s |
| **Total** | **2.90 M records** | **3,483 s (58 min)** |

- **Store:** `finora.db` 1.4 GB (LV ≤ 2.5 GB: **passes**). It holds 1.04 M entities, 5.77 M statements, 1.83 M fact reports with 7.46 M facts, 0.84 M events and 2.90 M records, about 480 bytes per record with indexes and FTS. Raw cache 207 MB.
- **Peak RSS: 1,649 MB** for the one worker over all 19 sources (**fails** ≤ 1 GB). The largest single source, `lv-ur-annual-reports`, peaks at about 1.2 GB on its own: its three files (≈ 500 MB) are held as buffers (`RawArtifact.bytes`) and joined in memory.
- **Time: fails.** The register lands after 479 s (budget ≈ 2 min), and the LV total alone is about twice the 30-minute budget for the whole store.
- **Where the time goes:** parsing is a small part of it. The register's 129 MB parse takes 2.8 s, and every LV parse together less than a minute. The rest is the per-record write path, at about 0.7 ms per record on disk: a CPU profile of 50,000 register rows puts `refreshEntity`, `write`, `writeRecord` and `upsertEntity` at about 64% of the time, all SQLite execution, about 20 statements per record. In that 50,000-row run, caching prepared statements and skipping the FTS refresh showed no gain; the run was too short, and the halving batch size hid both. At full size on disk they did matter: 549 s → 451 s and 262 s → 151 s (cto 7075424485; correction recorded with the re-measure below). What would move it is a first-load bulk path (no per-record lookups or history snapshot on an empty source, multi-row inserts, FTS and trigram built once after the load), which is open with the architect. S05 records the time and memory budgets as failing; whether the slice ships before that fix is qa's and the coordinator's call.
- **Unchanged reload: passes.** The same command against the loaded store, about an hour later and before the portal's nightly regeneration: all 19 sources end `unchanged` with 0 records read or written, in 37 s for the whole LV set (downloads and content hashes included), peak RSS 966 MB.

### LV re-measure after the write-path fixes (data-baltics, S05, 2026-11-22/23, `dev-desktop-1`)

At `9dd06f4`, which holds the architect's write path (`8661a89`: adaptive batch, statement cache, deferred search pass, `temp_store` MEMORY, 64 MB page cache, hash before snapshot) and data-baltics' streamed, chunked LV parsing. **Other agents' jobs held the CPU at 40-94% throughout, so times are high and vary by up to 2x between runs.** Two passes:
- **A.** `finora-cli data sync --country lv` on a fresh data dir, downloading from data.gov.lv.
- **B.** The same loaders and `runSync` on a `sync: true` connection, fed from local copies of the same files, with `BEGIN`..`COMMIT` timed from outside the product code. B separates parse and write from the download, and gives transaction times and per-source memory.

| Source | A: CLI | B: local | B: write tx p95 / max | B: heap peak |
|---|---|---|---|---|
| `lv-ur-register` | 434 s | 202 s | 936 / 5,226 ms | 96 MB |
| `lv-ur-name-history` | 64 s | 55 s | 2,091 / 2,507 ms | 105 MB |
| `lv-ur-liquidations` | 12 s | 11 s | 5,943 / 5,943 ms | 43 MB |
| `lv-ur-reorganizations` | 8 s | 21 s | 4,510 / 10,296 ms | 83 MB |
| `lv-ur-equity-capitals` | 55 s | 98 s | 1,550 / 6,209 ms | 115 MB |
| `lv-ur-memorandum-dates` | 79 s | 33 s | 335 / 481 ms | 43 MB |
| `lv-ur-officers` | 161 s | 84 s | 423 / 3,272 ms | 453 MB |
| `lv-ur-members` | 21 s | 11 s | 730 / 1,365 ms | 73 MB |
| `lv-ur-insolvency` | 7 s | 2 s | 278 / 278 ms | 56 MB |
| `lv-ur-securing-measures` | 10 s | 2 s | 318 / 318 ms | 56 MB |
| `lv-ur-suspensions` | 4 s | 1 s | 231 / 231 ms | 45 MB |
| `lv-ur-sanctions-links` | 1 s | 0 s | 9 / 9 ms | 16 MB |
| `lv-ur-annual-reports` | 333 s | 204 s | 567 / 8,078 ms | 443 MB |
| `lv-vid-taxes-quarterly` | 199 s | 102 s | 333 / 558 ms | 106 MB |
| `lv-vid-taxes-yearly` | 129 s | 84 s | 812 / 4,009 ms | 151 MB |
| `lv-vid-rating` | 50 s | 36 s | 446 / 622 ms | 92 MB |
| `lv-vid-vat-payers` | 173 s | 157 s | 652 / 1,254 ms | 259 MB |
| `lv-vid-suspensions` | 17 s | 18 s | 365 / 423 ms | 62 MB |
| `lv-fid-frozen` | 1 s | (not in B) | | |
| **All** | **1,758 s (29.3 min)** | **1,117 s** | **769 / 10,296 ms, 5 at ≥ 5 s** | |

- **The store:** 2.90 M records, 5.76 M statements, 7.46 M facts and 0.84 M events. 374k entities are searchable, 0 search marks are left, and the files take 1,366 MB.
- **Memory:** peak RSS is 834 MB in A, for the one lane worker over all 19 sources (was 1,649 MB), and 849 MB in B. The CLI's per-source heap peaks are 424 MB at most (annual reports). Parse alone, measured separately: register 146 MB, officers 206, annual reports 398.
- **The download is not the gap between A and B.** The 129 MB register file downloads in 2.9 s (45 MB/s). The register alone through the CLI on a fresh dir took 237 s, with the CPU at 94% from other jobs, against 196-202 s in B.
- **Same rows under a new file hash** (B, register): 23.5 s, 456,256 records unchanged, 0 statement writes, write tx p95 251 ms, max 252 ms.
- **Where the register's time goes** (B, register only, two runs): 196.5 s with SQLite's default WAL auto-checkpoint, 107.3 s with `wal_autocheckpoint = 0`. Checkpointing on `COMMIT` costs about 45% of the load. With checkpoints off, one transaction stalled 9.8 s, so moving the checkpoint needs its own design.
- **The slow transactions are mid-load, not the search pass.** The worst register transaction was #536 of 767 in one run and #463 of 712 in another. The end-of-sync search transactions ran 35-545 ms.

**Against cto's S05 targets:**

| Target | Measured | |
|---|---|---|
| 1. Register synced and searchable ≤ 150 s | 196-202 s local (B), 237 s and 434 s through the CLI | **fails** |
| 2. All 19 LV sources ≤ 15 min | 1,758 s (A), 1,117 s (B) | **fails** |
| 3. Lane peak RSS ≤ 1 GB | 834 MB (A), 849 MB (B) | **passes** |
| 4. Write tx p95 ≤ 400 ms, none ≥ 5 s | p95 769 ms; 5 transactions ≥ 5 s (max 10.3 s) | **fails** |
| 5. Same rows, new hash: register ≤ 45 s, 0 statement writes | 23.5 s, 0 writes | **passes** |

