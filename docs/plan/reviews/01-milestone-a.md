# qa review: architecture milestone A (store and loader contract)

`qa` reviewed `docs/architecture.md` §3-§4 at `233b78f` on 2026-11-20, before the loader specs build on it; committed by the coordinator. Early-review items #1, #2, #9, #10, #15, #19, #20, #22, #23 and N1 are confirmed closed in the text.

| # | Severity | Finding | Fix asked | Status |
|---|---|---|---|---|
| A1 | MUST-FIX | An unchanged upstream file stops the pipeline, so a release that moves an item to HIDE or LATER (or fixes a parser bug) never reaches that source's stored rows | "Unchanged" = same artifact sha **and** same `parserVersion` (hash of loader module + field map, on `syncs`); otherwise re-parse from the raw cache. Test `ingest/src/parser-version.test.ts` | open |
| A2 | MUST-FIX | A truncated or empty upstream file parses fine and the purge deletes every record | Per-source `maxPurgeShare` in `SourceMeta`; above it the sync ends `partial` with reason `purge_guard` and deletes nothing unless run with `--allow-mass-purge`. Tests: an empty file and a half file delete nothing | open |
| A3 | MUST-FIX | "Never only HTTP Last-Modified" plus `as_of_missing` makes EE (Last-Modified only) and LV (portal metadata or max date) unloadable | `AsOfRule` = an ordered list of strategies (`in_file_field`, `in_file_name`, `max_date_in_data`, `portal_metadata`, `http_last_modified`), recorded as `as_of_basis`; the UI names weaker bases. One test per strategy; EE and LV fixtures sync | open |
| A4 | MUST-FIX | `finora.debtor_listed` / `debtor_cleared` events derived from the CC BY-SA EE debtor list land in the main store, against P1 | Events derived from a share-alike source go to `finora-sa.db`; none exist in `live-no-store`. Test `ingest/src/share-alike.test.ts` in both modes | open |
| A5 | SHOULD-FIX | "Checked" and "as of" are different dates; an identical file checked daily reads as unchecked | Add `checkedAt` (latest content or unchanged sync) to `SourceRef`; the stale rule keeps `asOf` | open |
| A6 | SHOULD-FIX | Share-alike rows reference main-store integer ids that are not stable across a rebuild | Key on `eid`, or state and test the rebuild rule | open |
| A7 | SHOULD-FIX | A source changing storage class or licence is undefined | Full reload into the new class plus purge from the old; test: flip the class on a fixture, no row left in the old store | open |

**For milestone B:** `live-cached` US states are only stored after a view and FTS covers stored rows only, so B must include cto's fan-out search to the state portals, with timeouts, rate limits and the "did not answer" state.
