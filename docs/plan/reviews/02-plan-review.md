# qa review: the phase 3 plan (milestone B)

`qa` reviewed the plan at `0de4d5f` on 2026-11-20 against `docs/plan/qa-plan-checklist.md` 1-13, Part G and the early-review commitments; committed by the coordinator with legal's conditions (legal 7030098645). Not covered in this pass: the Baltic loader specs and `prototype.md` (both on the branch at `6dc2881` and `20b2c00`, reviewed next), `sanctions.md` (not yet written), and the mockups (web-qa).

**Verdict: not approvable yet, 21 MUST-FIX.** What holds: Part G → appendix is complete (100 of 100 SHOW and CAVEAT ids, diffed); HIDE suites on six surfaces; walking skeleton first; checklist 1-13 each addressed; no real names, tickers or non-reserved example domains.

## MUST-FIX

| # | Owner | Finding | Fix | Status |
|---|---|---|---|---|
| 1 | architect + data-osint | Share-alike data leaks into the main store through investigations (findings, signals, citation snapshots in `finora.db`) | share-alike-derived rows go to `finora-sa.db` or keep a reference only; in `live-no-store` they keep no value; `agents/src/share-alike.test.ts` both modes (legal: required) | open |
| 2 | data-osint | The run clock (6 min) kills a run before its question default (10-30 min) | exclude `waiting` time from the run clock; test | open |
| 3 | data-osint | The model controls question defaults, blocking and candidates | defaults, blocking and timeouts from the kind table only; `entity_choice` options from `search_companies`; `cap_reached` runtime-only; one test each | open |
| 4 | data-osint | Fetched pages are stored before the P8 filter | filter before storage; verify quotes against the filtered text; canary asserts `documents` rows (legal: required) | open |
| 5 | data-osint | Follow-ups have no rules | apply §5.2 and §6.4 (banned terms, uncited-sentence drop, quote check), the $0.25 cap test, follow-up scenarios in §13-§14 (legal: required) | open |
| 6 | data-osint + architect | The agent-path canary is narrower than §10.4 | iterate `items.generated.ts` plus the Part H categories; follow-ups among the asserted surfaces | open |
| 7 | data-osint + architect | "Linked entity" undefined in the wrong-company rule | name the store `links` table (official-id `same_as` only); say when `Finding.entityId` may differ from the pin | open |
| 8 | frontend | Slice numbers differ from `slices.md` | use `slices.md`'s mapping | open |
| 9 | frontend | Gallery route `/dev/states` vs `/design` | `/design` everywhere; align test names | open |
| 10 | frontend | Purpose session in `sessionStorage` vs the HTTP-only cookie | the cookie set by `POST /purpose` | open |
| 11 | frontend | `not_evaluated` mapped to `not_checked{later}` | the check-level `not_evaluated{trackedSince}`, with a `FieldRow` row | open |
| 12 | frontend | An empty list renders "none found" | "none found" only from `checked_none{source, asOf}`; an empty array is a contract error, tested; `not_published` and `checked_none` states on role and holder tables | open |
| 13 | frontend + architect | Two homes for banned terms, and grade wording missing | one file, with letter-grade and credit-score patterns and tests | open |
| 14 | frontend | Sole traders named in search results and the header | legal form plus code (L3, P6); cases in `search.spec.ts`, `seo-headers.spec.ts` (legal: agreed) | open |
| 15 | data-us | Accession numbers as record keys and hash inputs (their prefix can be a person's CIK) | key individual filers on issuer + filing date + sequence; `person-fields.test.ts` checks accession prefixes (legal: required) | open |
| 16 | data-us | A live portal's empty answer wipes a company's people | the two-miss rule per dataset query (legal: required) | open |
| 17 | data-markets | `esma-firds.md` has no `purgeScope` | `full` | open |
| 18 | data-markets | C1 keeps only the latest snapshot, yet the peak uses the highest ever seen | drop the local maximum, or legal clears it | open |
| 19 | data-us | `us-fmcsa.md`: two storage classes for one source id; a natural person's address reduced to state, `legal_name`/`dba_name` kept; "verified partial" without URL and date | one class per source id; drop personal names, address country only; cite the terms or keep LATER (legal: required) | open |
| 20 | data-us | `us-fdic.md`: `purgeScope: full` but only the latest quarter is fetched | `window`, or split the source | open |
| 21 | data-us | `us-sam-exclusions.md` loads firms that may be sole proprietors | load only firms that pass the party gate (legal: required) | open |

## SHOULD-FIX (fix in the same revision)

The full list is in qa's hub post (7030010972). By owner:
- **architect:** a numeric `coverage.applicable` with `not_published` as a skip reason; `free_text` timeout doesn't end as "company not confirmed"; define the `disputed` section state; P12 enforced by a reserved fictional ticker prefix in `fixtures/ids.test.ts` (C12); GLEIF weekly full load and its re-download in §4; the US budget line in §4.5; drop the stale guard note on test-double naming (§13, `slices.md:14`); the loader template in `loaders/README.md` (coordinator) gains `agent-only`, `connector-cache` and the A.1 contract slots.
- **data-osint:** `waiting`/`waitingOn: "cap"` instead of `paused_at_cap`, plus status rows in §11; `computeVerdict(answers)`; the web-search split; the lead's question budget; "None of these" and no natural persons in options; `not_enough_data` status; cap edge cases; which errors count toward the 3-error stop; a signal-to-severity table with precedence tests; the banned-term algorithm and `banned_term_fallback`; `statement_not_read`; fetch hardening (DNS pinning, reserved ranges, candidate hosts, delimiter escaping); press classification by origin; a named test for dropping uncited sentences.
- **frontend:** resolve decided "pending" items; U7 delete criterion; search group states vs the DTO; copy fields missing from DTOs; `ChecksList` `not_run`; one live region; `/` and `Esc` defined once; "Report a problem" kinds; seam files; `FINORA_DEMO` only; the tests the architecture names; `noindex` and disclaimer on `runs/[id]`; axe at every viewport and a 1024 test; reserved domains in fixtures; a "possible match, needs review" state for stored sanctions hits; Export and "AI key rejected".
- **data-us:** Form D record shapes; holder `purgeScope`; no citizenship read for individuals; mark key-pending `asOf` and `maxPurgeShare`; NY dissolutions via status history; a fixture-mode validator for fixture ids; CT and CO UCC need an identifier match before a principal's filing shows (legal); PA "Owner"/"Member" treated as natural persons until proven a company (legal); one hash order; NY `verifiedOn` URL; `maxPurgeShare` duplicates in fmcsa and courts; live-cache tests; the FDIC holding-company parent is S05 (LATER); FJC storage class and `verifiedOn`; mask the enforcement excerpt before agents see it.
- **data-markets:** `numFound` check in FIRDS; `MARKETS_BTC_HEIGHT_URL` within `officialHosts`; fields outside `SourceMeta`; `verifiedOn` for private-notes licences.

## NIT
Part G ids carry bracketed labels (`gen-items` strips them, with a test); `agents.md:7` R1-R18; `finora.name_changed` everywhere; `ui-build-plan.md:3` mockups are on the branch.
