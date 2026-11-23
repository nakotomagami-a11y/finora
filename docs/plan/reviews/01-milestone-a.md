# qa review: architecture milestone A (store and loader contract)

**Status: closed 2026-11-20.** Every item below is fixed and verified by qa at `faed2df`.

`qa` reviewed `docs/architecture.md` §3-§4 at `233b78f` on 2026-11-20, before the loader specs build on it; committed by the coordinator. Early-review items #1, #2, #9, #10, #15, #19, #20, #22, #23 and N1 are confirmed closed in the text.

| # | Severity | Finding | Fix asked | Status |
|---|---|---|---|---|
| A1 | MUST-FIX | An unchanged upstream file stops the pipeline, so a release that moves an item to HIDE or LATER (or fixes a parser bug) never reaches that source's stored rows | "Unchanged" = same artifact sha **and** same `parserVersion` (hash of loader module + field map, on `syncs`); otherwise re-parse from the raw cache. Test `ingest/src/parser-version.test.ts` | **closed**: fixed in `e78c8a8`, verified by qa |
| A2 | MUST-FIX | A truncated or empty upstream file parses fine and the purge deletes every record | Per-source `maxPurgeShare` in `SourceMeta`; above it the sync ends `partial` with reason `purge_guard` and deletes nothing unless run with `--allow-mass-purge`. Tests: an empty file and a half file delete nothing | **closed**: fixed in `e78c8a8`, verified by qa |
| A3 | MUST-FIX | "Never only HTTP Last-Modified" plus `as_of_missing` makes EE (Last-Modified only) and LV (portal metadata or max date) unloadable | `AsOfRule` = an ordered list of strategies (`in_file_field`, `in_file_name`, `max_date_in_data`, `portal_metadata`, `http_last_modified`), recorded as `as_of_basis`; the UI names weaker bases. One test per strategy; EE and LV fixtures sync | **closed**: fixed in `e78c8a8`, verified by qa |
| A4 | MUST-FIX | `finora.debtor_listed` / `debtor_cleared` events derived from the CC BY-SA EE debtor list land in the main store, against P1 | Events derived from a share-alike source go to `finora-sa.db`; none exist in `live-no-store`. Test `ingest/src/share-alike.test.ts` in both modes | **closed**: fixed in `e78c8a8`, verified by qa |
| A5 | SHOULD-FIX | "Checked" and "as of" are different dates; an identical file checked daily reads as unchecked | Add `checkedAt` (latest content or unchanged sync) to `SourceRef`; the stale rule keeps `asOf` | **closed**: fixed in `e78c8a8`, verified by qa |
| A6 | SHOULD-FIX | Share-alike rows reference main-store integer ids that are not stable across a rebuild | Key on `eid`, or state and test the rebuild rule | **closed**: fixed in `e78c8a8`, verified by qa |
| A7 | SHOULD-FIX | A source changing storage class or licence is undefined | Full reload into the new class plus purge from the old; test: flip the class on a fixture, no row left in the old store | **closed**: fixed in `e78c8a8`, verified by qa |
| A8 | MUST-FIX (cto) | Read as "one record per file row", long-format sources overflow the budgets: EE key figures ≈ 1.2 GB of `records` (EE ≈ 3.6 GB vs 3 GB), LT P&L and balance lines ≈ 1.3 GB (LT ≈ 2.8 GB vs 2 GB). Measured on the EE FY2024 file: 3,884,506 row records = 587 MB; 258,448 report records = 19 MB | A record is the unit of change: long-format sources group rows into one record per report or company-period, with `hashInput` the group's lines in a fixed order (EE annual-report elements, LT P&L and balance lines, LT social-insurance monthly rows); `row_hash` is sha256 truncated to 16 B; every loader spec states its record unit and sort order (unsorted sources group through a temp table); the S04 benchmark reports records per source and bytes per record against P10 | **closed**: `6c08299`, verified by qa |

**For milestone B:** `live-cached` US states are only stored after a view and FTS covers stored rows only, so B must include cto's fan-out search to the state portals, with timeouts, rate limits and the "did not answer" state.

**Measured by cto, no action:** search indexes over all 1,422,706 Baltic names are cheap: `unicode61` prefix FTS 81 MB, built in 6.3 s; `trigram` FTS 126 MB, 7.8 s; substring top-20 at p50 0.18 ms, p95 0.76 ms. These go into `docs/plan/benchmarks.md`.

**cto's numbers for the fixes (2026-11-20, adopted as cto's technical calls):**
- **Raw cache (A1):** keep only the latest artifact per source, gzip-compressed (measured x4.0-x4.7); EE zips as downloaded; no GLEIF full file after the first load. ≈ 1.3 GB. P10 gains: **raw cache ≤ 1.5 GB; the whole data dir ≤ 12 GB.** Without a raw cache, a `parserVersion` change re-downloads (LV ≈ 6 min): an acceptable fallback.
- **`maxPurgeShare` (A2):** `max(2%, 5x the source's measured removal share per refresh period)`, stated in each loader spec with its measurement. Measured daily removals: LV officers 0.04%, LV members 0.04%, LV securing measures 0.1%, LV register 0, LT insured 0.04%, LT tax arrears 4.3% (so ≈ 22% there; a flat 5% would block it on a normal day). Test: fixtures just under and just over the boundary.

**Still open on milestone A (qa check at `915b03d`):**
- **A9 (closed, `f9afef6`, verified by qa): cto's budget numbers.** "Raw cache ≤ 1.5 GB / data dir ≤ 12 GB" is not yet in §4.5 or `benchmarks.md`, and `maxPurgeShare` is not yet the rule `max(2%, 5x measured removal share)` with a boundary test.
- **A10 (closed, `f9afef6`, verified by qa): N2 regression.** `architecture.md:649` still says "the hold is kept across retries and settled once"; each attempt must settle and a retry takes a new hold.
- **A11 (closed, `0e3cee3`, verified by qa): change-feed deletes** (qa). A feed's deletes are explicit (LT tax arrears: 1,379 a day), so the purge guard never sees them, and one bad feed page could clear the list. `maxPurgeShare` applies to a feed sync's deletes too. Test: a feed page that deletes 50% of records is refused as `purge_guard`.

**cto's corrections to `docs/plan/benchmarks.md` (sent to the architect):** drop the unmeasured "NVMe SSD" from `dev-desktop-1` (8 cores / 16 threads, 32 GB RAM, disk type not recorded); label the statement-layout rows by run (run 2 ran under unrelated CPU load: its times are not budgets, its sizes and write counts are); compare ranked with ranked: trigram top 20 with rank is p50 13 ms, p95 34 ms, beside prefix p50 19 ms, p95 39 ms, so ~40 ms p95 per index is the budget.

**Person rows (§3.3, `names_no_id`), qa check at `37cf9a8` (legal agrees with all three):**
- **M1, MUST-FIX: a dispute must survive a role-set reload** (R10). Its target is company eid + source + item + an internal hash of the disputed line's normalised content, re-applied after every load; the hash is never output, exported or logged (canary rule). Test `store/src/disputes.test.ts`: dispute officer A, add officer B, A stays suppressed and B shows. **Closed:** fixed in `faed2df`, verified by qa (`store/src/disputes.test.ts`, `store/src/person-targets.test.ts`).
- **S1, SHOULD-FIX: a correction must not read as "a role ended".** Diff on the source's own row-local role id (LV officer `id`, EE `kirje_id`), internal only, else (role, start date); names are never compared. **Closed:** `faed2df`, verified by qa (`ingest/src/role-ended.test.ts`).
- **S2, SHOULD-FIX: §3.4 is stale** (still `p-<20 hex>` with a fixture HMAC key); update it so no builder implements the HMAC. **Closed:** `faed2df`, verified by qa.
- **Legal note:** the role-set hash and the dispute content hash are internal change detection only and fall under the PS5 canary scope.

**cto's `benchmarks.md` corrections:** done in `b61002a` per the architect.
