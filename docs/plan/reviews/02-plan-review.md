# qa review: the phase 3 plan (milestone B)

`qa` reviewed the plan at `0de4d5f` on 2026-11-20 against `docs/plan/qa-plan-checklist.md` 1-13, Part G and the early-review commitments; committed by the coordinator with legal's conditions (legal 7030098645). Not covered in this pass: the Baltic loader specs and `prototype.md` (both on the branch at `6dc2881` and `20b2c00`, reviewed next), `sanctions.md` (not yet written), and the mockups (web-qa).

**Verdict: not approvable yet, 21 MUST-FIX.** What holds: Part G → appendix is complete (100 of 100 SHOW and CAVEAT ids, diffed); HIDE suites on six surfaces; walking skeleton first; checklist 1-13 each addressed; no real names, tickers or non-reserved example domains.

## MUST-FIX

| # | Owner | Finding | Fix | Status |
|---|---|---|---|---|
| 1 | architect + data-osint | Share-alike data leaks into the main store through investigations (findings, signals, citation snapshots in `finora.db`) | share-alike-derived rows go to `finora-sa.db` or keep a reference only; in `live-no-store` they keep no value; `agents/src/share-alike.test.ts` both modes (legal: required) | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 2 | data-osint | The run clock (6 min) kills a run before its question default (10-30 min) | exclude `waiting` time from the run clock; test | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 3 | data-osint | The model controls question defaults, blocking and candidates | defaults, blocking and timeouts from the kind table only; `entity_choice` options from `search_companies`; `cap_reached` runtime-only; one test each | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 4 | data-osint | Fetched pages are stored before the P8 filter | filter before storage; verify quotes against the filtered text; canary asserts `documents` rows (legal: required) | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 5 | data-osint | Follow-ups have no rules | apply §5.2 and §6.4 (banned terms, uncited-sentence drop, quote check), the $0.25 cap test, follow-up scenarios in §13-§14 (legal: required) | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 6 | data-osint + architect | The agent-path canary is narrower than §10.4 | iterate `items.generated.ts` plus the Part H categories; follow-ups among the asserted surfaces | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 7 | data-osint + architect | "Linked entity" undefined in the wrong-company rule | name the store `links` table (official-id `same_as` only); say when `Finding.entityId` may differ from the pin | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 8 | frontend | Slice numbers differ from `slices.md` | use `slices.md`'s mapping | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 9 | frontend | Gallery route `/dev/states` vs `/design` | `/design` everywhere; align test names | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 10 | frontend | Purpose session in `sessionStorage` vs the HTTP-only cookie | the cookie set by `POST /purpose` | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 11 | frontend | `not_evaluated` mapped to `not_checked{later}` | the check-level `not_evaluated{trackedSince}`, with a `FieldRow` row | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 12 | frontend | An empty list renders "none found" | "none found" only from `checked_none{source, asOf}`; an empty array is a contract error, tested; `not_published` and `checked_none` states on role and holder tables | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 13 | frontend + architect | Two homes for banned terms, and grade wording missing | one file, with letter-grade and credit-score patterns and tests | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 14 | frontend | Sole traders named in search results and the header | legal form plus code (L3, P6); cases in `search.spec.ts`, `seo-headers.spec.ts` (legal: agreed) | fixed (`7c5afaf` architecture, `5649fc9` agents, `5d71425` UI); qa to verify |
| 15 | data-us | Accession numbers as record keys and hash inputs (their prefix can be a person's CIK) | key individual filers on issuer + filing date + sequence; `person-fields.test.ts` checks accession prefixes (legal: required) | fixed `e20002a` (qa to verify) |
| 16 | data-us | A live portal's empty answer wipes a company's people | the two-miss rule per dataset query (legal: required) | fixed `e20002a` (qa to verify) |
| 17 | data-markets | `esma-firds.md` has no `purgeScope` | `full` | fixed `5e68685` (qa to verify) |
| 18 | data-markets | C1 keeps only the latest snapshot, yet the peak uses the highest ever seen | drop the local maximum, or legal clears it | fixed `5e68685`: peak = max(C3 all-time high, current C1 total) (qa to verify) |
| 19 | data-us | `us-fmcsa.md`: two storage classes for one source id; a natural person's address reduced to state, `legal_name`/`dba_name` kept; "verified partial" without URL and date | one class per source id; drop personal names, address country only; cite the terms or keep LATER (legal: required) | fixed `e20002a` (qa to verify) |
| 20 | data-us | `us-fdic.md`: `purgeScope: full` but only the latest quarter is fetched | `window`, or split the source | fixed `e20002a` (qa to verify) |
| 21 | data-us | `us-sam-exclusions.md` loads firms that may be sole proprietors | load only firms that pass the party gate (legal: required) | fixed `e20002a` (qa to verify) |

## SHOULD-FIX (fix in the same revision)

The full list is in qa's hub post (7030010972). By owner:
- **architect:** a numeric `coverage.applicable` with `not_published` as a skip reason; `free_text` timeout doesn't end as "company not confirmed"; define the `disputed` section state; P12 enforced by a reserved fictional ticker prefix in `fixtures/ids.test.ts` (C12); GLEIF weekly full load and its re-download in §4; the US budget line in §4.5; drop the stale guard note on test-double naming (§13, `slices.md:14`); the loader template in `loaders/README.md` (coordinator) gains `agent-only`, `connector-cache` and the A.1 contract slots.
- **data-osint:** `waiting`/`waitingOn: "cap"` instead of `paused_at_cap`, plus status rows in §11; `computeVerdict(answers)`; the web-search split; the lead's question budget; "None of these" and no natural persons in options; `not_enough_data` status; cap edge cases; which errors count toward the 3-error stop; a signal-to-severity table with precedence tests; the banned-term algorithm and `banned_term_fallback`; `statement_not_read`; fetch hardening (DNS pinning, reserved ranges, candidate hosts, delimiter escaping); press classification by origin; a named test for dropping uncited sentences.
- **frontend:** resolve decided "pending" items; U7 delete criterion; search group states vs the DTO; copy fields missing from DTOs; `ChecksList` `not_run`; one live region; `/` and `Esc` defined once; "Report a problem" kinds; seam files; `FINORA_DEMO` only; the tests the architecture names; `noindex` and disclaimer on `runs/[id]`; axe at every viewport and a 1024 test; reserved domains in fixtures; a "possible match, needs review" state for stored sanctions hits; Export and "AI key rejected".
- **data-us:** Form D record shapes; holder `purgeScope`; no citizenship read for individuals; mark key-pending `asOf` and `maxPurgeShare`; NY dissolutions via status history; a fixture-mode validator for fixture ids; CT and CO UCC need an identifier match before a principal's filing shows (legal); PA "Owner"/"Member" treated as natural persons until proven a company (legal); one hash order; NY `verifiedOn` URL; `maxPurgeShare` duplicates in fmcsa and courts; live-cache tests; the FDIC holding-company parent is S05 (LATER); FJC storage class and `verifiedOn`; mask the enforcement excerpt before agents see it.
- **data-markets:** `numFound` check in FIRDS; `MARKETS_BTC_HEIGHT_URL` within `officialHosts`; fields outside `SourceMeta`; `verifiedOn` for private-notes licences.

## NIT
Part G ids carry bracketed labels (`gen-items` strips them, with a test); `agents.md:7` R1-R18; `finora.name_changed` everywhere; `ui-build-plan.md:3` mockups are on the branch.

**Legal notes on the fixes (not blocking):** a fired rule id kept in the main store must never embed a value from a share-alike source (add to `agents/src/share-alike.test.ts`); FMCSA needs its `verifiedOn` URL and date before the source is enabled.

## Round 2 (qa at `68ace5d`, 2026-11-20)

All 21 round 1 MUST-FIX are closed. First review of the Baltic specs, `sanctions.md`, `prototype.md` and `lawyer-register.md`: **4 MUST-FIX.**

| # | Owner | Finding | Status |
|---|---|---|---|
| R2-1 | data-osint | `sanctions.md` stored listed natural persons and kept them in the raw cache | **closed**, verified by qa at `88ef579` |
| R2-2 | data-osint | `sanctions.md:239`: unproven foreign parties on the LV FIU list stored as organisations | open: load only with a legal-form token, else drop as `unproven_party` |
| R2-3 | data-baltics | `ee-register.md:98`: sole traders' VAT numbers stored | open: drop the number for `natural_person = 1`, keep yes/no |
| R2-4 | data-baltics | `ee-register.md:62, 122-138`: natural-person insolvency stored | open: gate the status mapping and the cards, rulings and pledges files on `natural_person = 0`; HIDE negative case |

| R2-5 | data-baltics | `lt-sodra.md` still said `live-no-store` in the instant profile | aligned to agent-only in `b092931`; qa to verify |

**SHOULD-FIX (round 2):** sanctions: "listed" only with an issuing country; rule out only on a differing official id, not an address country; define the officer and sole-trader match path (options, signal, MCP name-only form); measured `maxPurgeShare` for UK, LV FID, ESMA and OFAC consolidated; `verifiedOn` URLs for EU, OFAC and UK. Baltic specs: no "late/overdue/deadline" vocabulary in events and test names (`filing.not_in_register`); `lv-risk.md` S10.LV.01 is LATER with MANUAL, with the portal host in `officialHosts`. `prototype.md` (coordinator, fixed): LT demo step and the CI jobs. `lawyer-register.md` (coordinator, fixed): affected-items and test columns, one stated row count. NITs: sanctions hash and `parserVersion` for UK, LV FID, ESMA; OFAC hash order; `officialHosts` gaps; fixture-id ranges in §3.4; `ruled_out` in `agents.md:169`; a test per R8 rule; `us-sec.md:111` points at the accession rule.
