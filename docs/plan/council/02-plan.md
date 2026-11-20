# Council session 2: plan approval

Convened 2026-11-20 after phase 3 closed (`e007ed4`: qa has no open MUST-FIX, web-qa signed off the mockups). `council` returns the decision; `cto` owns the technical and scaling calls; `legal` advises. Posts are committed by the coordinator. Council approval is the go-ahead to build.

## Legal input (legal seat, 2026-11-20)

Not legal advice.
- **No legal blocker remains in the plan.** Every rule in `legal.md` (1-18) and every Part H call has an enforcement point and a test, as qa's verdict records. The build keeps the LAWYER register's interims, and `check-lawyer-register` fails if a row is removed or a `[pending: lawyer]` marker has no row.
- **O1 (no verdict level on the instant profile):** no legal objection. The facts-only rule for natural persons and sole traders holds either way.
- **O2 (the "proposed" rule-table entries, `agents.md` §6.2):** an engineering call. Any entry touching a natural person, a listed person or a share-alike value keeps its P8, share-alike and canary tests.
- **Hosted build: blocked.** `LAW-AGPL-HOSTED`, `LAW-SHARE-ALIKE` and the CC BY-NC and market-cap rows bar any hosted version until a lawyer clears them. v1 is local only, and the build docs say so on their first screen.

## cto's technical red-team (cto seat, 2026-11-20)

**Approve once three blocking items land.** All three are architecture-text fixes for the architect; no slice moves and no data decision changes.

### Blocking

| # | Finding | Close | Tests | Owner |
|---|---|---|---|---|
| B1 | **Nothing stops two writers syncing the same source at once.** The first core load runs up to 30 min in the CLI, the scheduler can fire a daily job for the same source inside that window, and each sync's set-difference purge deletes the rows the other just wrote. `next dev` can start the job runner twice, and recovering dead runs must happen exactly once (`architecture.md:28, 349, 448, 1083`) | A `leases` table (resource, holder = pid + boot id, heartbeat, expiry) taken with `BEGIN IMMEDIATE`: every sync takes `sync:<source>`, the job runner `runner`, investigation recovery `recover`; a second taker exits `already_running` (CLI) or skips (scheduler); an expired lease is taken over | two concurrent syncs of one fixture source: one runs, the other ends `already_running`, no rows lost; two `boot()` calls: one runner; a killed holder's lease is taken over after expiry | architect (S04, S12) |
| B2 | **Sync work must never run on the server's main thread.** `node:sqlite` is synchronous: ≈ 0.19 s of CPU per 5,000-record batch (measured), and the daily Baltic set is minutes of CPU. On the main thread that freezes SSE streams, the 20 s heartbeat and page renders (`:28, 461, 468`) | The job runner runs every sync in a worker thread (or the CLI child process) with its own connection; the main thread serves requests and does only the small investigation writes | during a fixture sync of ≥ 10 s, `/api/v1/health` p95 < 100 ms and no SSE heartbeat more than 1 s late | architect (S04, S12) |
| B3 | **The one command doesn't say production build or dev server.** Daily use on `next dev` means a compile on each first route visit, dev-mode React and B1's double runner start (`:1083`; `slices.md:246` says "within minutes", vaguer than P10) | `pnpm finora` runs `next build` when `.next` is missing or stale (keyed on commit + lockfile hash), then `next start` on 127.0.0.1. S12 acceptance cites P10 (LV searchable ≈ 2 min after the app is up) plus the cold path (clone → install → build → app up) as a number recorded on `dev-desktop-1` | S12 acceptance | architect (S12) |

### Should-fix (same revision)
- **S1. A Windows CI leg:** `windows-latest` for `test` and `demo-boot` (the human runs Finora on Windows; `slices.md:57, 246` require it).
- **S2. Disk preflight, integrity and backup:** `doctor` and `pnpm finora` refuse the core load with < 15 GB free; `doctor` runs `PRAGMA quick_check`; `finora-cli backup` (`VACUUM INTO`) for the non-derivable tables (investigations, `purpose_log`, disputes, settings); on corruption, rebuild the derivable tables from the raw cache.
- **S3. Migrations on a ~7 GB store:** migrations on `statements`, `facts` and `records` are additive only; anything else is a re-derive through `parserVersion`.
- **S4. A Part G edit re-parses every source** (≈ the first-load time): it runs under the B1 leases, in the background, with the UI usable.

### Verified, no change needed
Monorepo and boundaries; licence on every value; store, resolution and budgets (P10); the agent runtime (tools first, parallel specialists, hold-then-settle per attempt, global daily hold, runtime-owned questions, run clock excluding waiting, citation spans and pinning, S10 gated on the measured run); API and MCP (one tool definition, three surfaces, read-only MCP with a purpose on person calls); auth and hosting (127.0.0.1, `Actor` in every service, no hosted build while publication LAWYER rows are open); security (host allowlist and Origin check, SSRF re-check per redirect, CSP, bundle secret canary, supply chain); testing and CI (fixtures only, the `fake` provider, HIDE on six surfaces, `field-registry`, migrations from every version, nightly `live` job); legal rules in code (§10, `check-lawyer-register`).

**O1 and O2, technical note:** the verdict rule table is pure and runs on stored data with no LLM, so a level on the instant profile would cost $0 and no new infrastructure: a product call either way. Every O2 rule stays deterministic, with one test per rule.

## Revision (architect, `3c6cd90`)

B1-B3 and S1-S4 are closed in `3c6cd90`: a `leases` table taken inside `BEGIN IMMEDIATE` (`store/src/leases.test.ts`, `agents/src/recovery.test.ts`); every sync in a worker thread (`server/src/jobs.main-thread.test.ts`); `pnpm finora` builds when `.next` is missing or stale and runs `next start` on 127.0.0.1, with the cold path recorded in `benchmarks.md`; CI `test` and `demo-boot` on Ubuntu and Windows; a 15 GB disk preflight, `PRAGMA quick_check`, daily `finora-cli backup` (last 7 kept) and `doctor --repair`; additive-only migrations on the three big tables; Part G re-parses in the background under the leases. Legal's "v1 runs locally only" line is at the top of `docs/architecture.md` and in the README's run section (`d9457c2`).

## cto: technical approval (2026-11-20)

**Approved to build from `3c6cd90`.** B1-B3 and S1-S4 verified in the files. Conditions carried into the build (qa checks them per slice; they don't block approval):
1. Every loader slice records its P10 numbers in `benchmarks.md` (disk, records, bytes per record, times); a slice over budget cuts fields or years, never the budget.
2. S10 is not accepted until the measured run (`ANTHROPIC_API_KEY`) replaces the modelled cost.
3. S12 records the cold path as a measured number.
4. Council session 3 at each milestone gets a cto health check: budgets against actuals, open debt, scaling risks.

## qa on the revision (`3c6cd90`)

| # | Severity | Finding | Fix | Status |
|---|---|---|---|---|
| Q1 | MUST-FIX | `VACUUM INTO` copies the whole database, not selected tables: 7 backups of a ~7 GB store ≈ 49 GB against the 12 GB data-dir budget | back up only the non-derivable tables (attach a file and `INSERT … SELECT`, or keep them in their own database file); count backups in the 12 GB; `cli/src/backup.test.ts` asserts contents and a size budget | open (architect) |
| Q2 | MUST-FIX | `doctor --repair` can bring back deleted personal data: a restore from a backup up to 7 days old returns investigations deleted by the user or expired under the TTL (R11, P5), and resolved disputes | a deletion tombstone log that is never restored and is re-applied after a restore, then the retention job and suppressions run before reads resume; backups are pruned of deleted investigations, or their retention becomes a LAWYER row with legal's light; `cli/src/doctor.test.ts`: delete, back up, corrupt, repair, the investigation stays gone | open (architect, legal) |
| Q3 | SHOULD-FIX | A worker's batch transaction can hold the WAL write lock long enough for a main-thread investigation write to hit `SQLITE_BUSY` | bound each batch by time (≤ 250 ms, adaptive size) and retry main-thread writes; extend `jobs.main-thread.test.ts` | open |
| Q4 | SHOULD-FIX | Absolute timing assertions (p95 < 100 ms, heartbeat ≤ 1 s late) will flake on shared CI runners | keep them as recorded benchmarks on `dev-desktop-1`; in CI assert relative budgets or a generous bound (≤ 3 s gap) | open |
| Q5 | NIT | "Stale" keyed on commit + lockfile misses uncommitted changes | add the dirty-tree hash, or document `pnpm finora --rebuild` | open |

**cto's corrected backup design (accepts qa 1-5; item 1 was cto's error):** user data lives in its own file, `finora-user.db` (investigations, runs, findings, citations, documents, `purpose_log`, disputes, judgements, settings, fund slots), attached like the share-alike store, with cross-file references by `eid` only. `finora-cli backup` runs `VACUUM INTO` on that file only, counted in the 12 GB; `finora.db` is never backed up (it re-derives from the raw cache). Deletions (user delete, TTL expiry, resolved disputes) are appended as ids and timestamps to `<data dir>/deletions.log`, never backed up or restored; `doctor --repair` restores, replays the log, runs retention and suppressions, then reopens for reads. 3 backups kept. Worker transactions close after ≤ 250 ms with main-thread retries on `SQLITE_BUSY`; absolute timings are `dev-desktop-1` benchmarks and CI asserts a ≤ 3 s heartbeat gap and relative regression; the staleness key adds the dirty-tree hash, plus `pnpm finora --rebuild`.

**Legal's conditions on Q2 (gate 1):** the tombstone log holds only an opaque id and a deletion date; resolved disputes stay resolved after a restore (tested); new LAWYER row `LAW-BACKUP-RETENTION` with the interim **person-level rows excluded from backups entirely**; a second `doctor.test.ts` case: a backup that held a person row never restores it.

**Converged backup design (cto 7048828925, legal 7048828896 final, qa 7048824046):** `finora-cli backup` copies an **explicit allowlist of tables** into a fresh file with `INSERT … SELECT` (no `VACUUM INTO`): settings, fund slots, judgements, disputes (content hashes only), `purpose_log` (company eid + purpose), and the investigation index (id, subject eid, status, level, coverage, cost, dates). Excluded as person-level: findings text, citation snapshots, `documents`, question and answer text, follow-ups. Every schema table carries one class, `backed_up | person_excluded | derivable`, and `store/src/backup-classes.test.ts` fails on an unclassified table. `deletions.log` (opaque id + date) is appended and fsynced before a delete is acknowledged; `doctor --repair` refuses to restore if the log is missing or unreadable; a repair restores the allowlist, replays the log, runs retention and suppressions, then reopens reads, and repaired investigations read "Details not restorable after repair: re-run to see findings". 3 daily backups (legal's 3-day window). The architect's `65bf0b0` crossed with this and still backs up investigation content; it is superseded.

**Final backup spec (2026-11-20; cto 7048844734 and 7048855348, legal 7048848652, qa 7048838567):** exclude **by table, not by row**: a per-row "holds natural-person data" judgement is one the code can get wrong. Backed up: settings; fund slots; judgements (`eid_a`, `eid_b`, decision, by, at; any row touching an entity with `natural_person = 1` excluded; no note column); disputes only where the item is non-personal and the entity has `natural_person = 0` (content hashes); `purpose_log` (company eid + purpose); the index of pinned company investigations (id, subject eid, status, level, coverage, cost, dates; unpinned free-text investigations excluded entirely; never the typed text). Excluded as whole tables: findings text, citation snapshots, `documents`, question and answer text, follow-ups. `store/src/backup-classes.test.ts` classifies every table and asserts each filter by name. `deletions.log` fails closed (in `8db4e4a`). 3 daily backups. The architect's row-level `WHERE personal = 0` in `8db4e4a` is replaced by this.

**Landed in `c2b6dbc`:** the architecture's §16 and S12 follow the final spec (no row filter and no `VACUUM INTO` left; `suppressions` added to the allowlist; run events and tasks and signals added to the excluded tables). Legal confirmed (7048878772). **qa closed Q2: the session 2 review has no open MUST-FIX** (at `c2b6dbc`). **cto confirmed: nothing technical is open; approved from cto's side.** One open point: `suppressions`. Legal wants them filtered like disputes (a suppression on an officer line is person-level); cto and qa want all of them kept, because losing one on restore would re-show hidden data.

## Council decision (2026-11-20)

**Approved to start S01-S03 now. Everything from S04 on waits for 16 fixes, each gated on the slice it touches; the council confirms in one line when the revision post arrives, with no further round.** O1 confirmed; O2 approved with two changes.

**How it was made:** CEO, CFO, CPO, CMO and COO each convened in isolation (the first dispatch hit a usage limit and was re-run whole), then critic and synthesis. All five said block, each with a short list of cheap fixes; no seat found a structural flaw. cto's technical approval and the backup settlement are taken as given. Seat findings were checked against the files (`ui-build-plan.md:477, 328, 810`, `mockups/company.html:268`, `agents.md` §8.1, `prototype.md:101`).

**Decision:** the plan is complete, buildable and scales to many tools (CPO: the IA holds without a redesign). It falls short of the mission bar in three places: nothing measures daily use; the secondary job (invoice check) never sees the sender's domain; a few places still let missing data read as clean.

### Blocking items (gated per slice)

| # | Fix | Owner | Gates |
|---|---|---|---|
| 1 | **Daily-use trial, D11:** 10 working days from M2; counts only, local; pass = opened 8 of 10 days, ≥ 5 real look-ups, ≥ 2 investigations worth paying for; friction notes become MUST-FIX or LATER before M5; otherwise "daily use unmeasured" | coordinator | S26 |
| 2 | **Session 3 runbook** (`docs/plan/council/session3-runbook.md`) | coordinator | M1 demo |
| 3 | **Key fallback and parallel lane:** ask for `ANTHROPIC_API_KEY` at M1 exit with a date; K2 fires when S09 is green on `fake` with no key; S09 may merge "pending the measured run" but M2 can't pass without it; parallel lane S22 after S04, S23/S24 after S22, S19 after S09, S21 after S11, S17 before S16 if `SEC_USER_AGENT` is late, only while critical-path seats wait | coordinator (lane in `slices.md`: architect) | before M2 |
| 4 | **Build spend, honest:** about $45 expected, plan for $100, on the human's own key (replaces "about $5") | coordinator | S10 |
| 5 | **The milestone gate can run:** regression set in `research/.cache/regression/set.json` (coordinator, before S12); the wrong-company definition (data-osint); scripted question answers; fixed table, exit 0/1; regression set investigated, fresh sample at $0 for fill only; `--budget-usd` ledger; gate runs feed the estimate history | architect, data-osint, coordinator | S12 |
| 6 | **Hard caps count search-result tokens:** hold adds searches left × `SEARCH_RESULT_TOKENS_EST` (25k, then measured p95) × input price × 1.25; `hold_underestimate` logged; test: over-hold call, no new call, verdict still runs; "calibrated" = ≥ 90% at or under `high`, median within ±30% of `typical` | data-osint, architect | S09 |
| 7 | **The invoice job sees the sender's domain:** `subject: {eid, offerDomain?}`, a field in the Investigate sheet; the web agent checks it against the register (DNS, certificates, homepage, RDAP or .lt creation date); U3, demo step 5 and one `fake` scenario use it | architect, designer, data-osint, coordinator | S04b, S10, S11 |
| 8 | **One denominator, 11:** drop `applicable` from every user-visible string (incl. screen readers, library, MCP); coverage carries `ran`, the fixed 11 and skip reasons; test every coverage string reads "of 11" | architect, frontend | S04b, S07 |
| 9 | **Every flag fires a rule:** `status_not_active` and `no_officers_on_record` become Points to check; test every `point_to_check`+ signal maps to a rule | data-osint | S10 |
| 10 | **Key findings by rule:** concerns, then points to check, then check number; never inferred, name-only or context; fewer than three when fewer qualify; fix the US mockup's name-only court match | data-osint, designer | S10, S11 |
| 11 | **Sole traders never read "none found" for data we don't load:** rule-based lock on every dropped row and check; test: a bankrupt and a non-bankrupt fixture sole trader give identical output; fix `company.html`'s sole-trader branch | designer, architect | S07, S08 |
| 12 | **One fallback line:** "No written explanation for this report" for both the banned-term fallback and no-cited-sentence; delete "Not enough evidence for a verdict" | frontend | S11 |
| 13 | **The profile says it is not a verdict** (O1's condition): "No verdict yet. These checks use official data only; the rest run when you investigate. Missing does not mean clean." on the checks panel; a check past its cycle shows a clock, not a check mark | designer, frontend | S08 |
| 14 | **One owner per slice:** split S04 (store / ingest / fixtures and CLI), S09 (runtime and ledger / questions, events and recovery), S04b, S20, S24 (server / UI), S15 (resolution / GLEIF and FIRDS), each with its own criteria, tests and demo | architect | S04 |
| 15 | **A daily way in:** S25 specifies an opt-in start at login (Windows first, 127.0.0.1, in the security review) and a catch-up refresh at boot (values Stale until done); U1 names the route | architect | S25 |
| 16 | **O2 changes** (below) | data-osint | S10 |

### O1: confirmed
The instant profile shows the checks and the coverage line, with no level. **Reasons:** a level on 9 official checks would say "No concerns found" before the web, live lists and courts are checked (the overclaim Part B forbids); a level on every free profile reads as a rating; hard flags already show as concerns; a level that changes after Investigate teaches that levels are unstable. **Condition:** item 13. **Dissent:** none (CEO, CPO, CMO agree; legal no objection; cto: $0 either way). **Suspicious unanimity:** the architect framed the option and no seat argued for a level; the strongest case for one is speed in daily look-ups. **What would change it:** at session 3 the human rarely presses Investigate, or the trial shows look-ups but no investigations.

### O2: rule rows
- `regulator_warning` → Points to check: approved; listed first among key findings, naming the list and the matching identifier; not Serious, because clone-firm warnings can carry the real firm's identifiers.
- `court_case_by_identifier`: changed; fires only when the company is the defendant in a case open or filed in the last 3 years (FJC party role and dates); other cases are facts.
- `website_inconsistent` → Points to check: approved.
- `domain_newer_than_company`: changed; fires only on a registry creation date (US RDAP, .lt) under 12 months or newer than the company, for the offer domain (item 7) or the register-listed domain; certificate-log dates never fire it and read "certificates seen since [date]".

### Not blocking (fold in when the slice is touched), ranked
1. **CMO, wording:** a rule-based "Added by this investigation: N findings from live sources" line; demo step 4 on a company where a question is certain; the banned list covers inflections ("cleared", "fraudulent", "scams"), fix `crash.html:73`, `sources.html:39-40`; the mockup wording fixes in the CMO findings.
2. **CMO, README at S26:** Baltic court checks are manual; "free" means the instant profile, agents use your own key; templates LATER, no "scoring"; the US private pre-run sheet says the verdict will normally be "Not enough data".
3. **CFO:** re-checks only when the room left is at least the role's `high`; per-source call counters that survive restarts, C1 polled every 15 min; an out-of-credit state with no retries; dated `prices.ts`; month-to-date spend in Settings; crash recovery settles open holds at worst case; the nightly `live` job asserts zero LLM calls.
4. **CPO:** a checks tally under the header below 1024 px; a bottom-bar "More" overflow and manifest hooks for many tools; define or remove Export; the follow-up question in U4 and D4; "Not part of v1" lists change alerts, compare and a shareable report.
5. **COO:** frontend owns S02; slices for `field-registry`, the P9 "last run ≤ 48 h" test and the P3 agent canary; web-qa on S13 and S14; S26 capped, its findings become new slices.
6. **CEO:** the cut order if M3 slips: US private first (K11), then the network becomes a list, then MCP; a per-milestone time or quota trigger in K10.

**First LATER item:** change flags on companies in the library (a new insolvency, arrears or removal, from the daily refresh, at $0). Trigger: the trial fails its look-up count, or the human asks for it at a demo.

### Where the seats disagreed
- **Change flags:** CEO wanted them weighed for v1; CPO wants them out of v1. The council makes them the first LATER item, triggered by the trial. CEO dissent recorded.
- **Trial thresholds:** CPO says the company job is weekly, not daily; kept, since 5 look-ups in 10 days is weekly-plus and Crash monitor carries the daily opens.
- **Slice splits vs cto's "no slice moves":** not a conflict; cto approved technical correctness, COO owns who can finish a slice.
- **Build spend:** CFO's $45-100 replaces session 0's "about $50" and the earlier "about $5".
- **Domain strays:** CEO set trial thresholds (COO's and CPO's), accepted as owner-neutral; CMO's key-findings rule touches data-osint's runtime, routed there.

### Kill criteria
- **The trial:** fewer than 5 real look-ups in 10 days → v1 is not signed off as a daily company tool; stop adding countries and tools; build the change flags first (CEO).
- **Calibration:** fewer than 90% of measured runs at or under `high` → S10 not accepted; cut agent depth before raising the cap (CFO, session 0).
- **Wrong company:** any wrong-company finding in a gate run → stop feature work (K1).

### Coordinator's items done in the same commit
Items 1, 3 and 4 are in `prototype.md` (D11, K2 with the key date and the parallel lane, §6 spend, §7 the milestone gate); item 2 is `session3-runbook.md`. The regression set (item 5) is built before S12. The parallel lane goes into `slices.md` with the architect's revision.

### Open: person-line suppressions (architect `0e35177`)
legal (7048919634) refuses any hash of a person's line, including the `targetHash` in `0e35177`. legal's vote, matching the coordinator's recommendation: row id where the source has one (`{companyEid, itemId, sourceRowId, at}`); where none exists, `{companyEid, itemId, at}` and the whole item section for that company stays hidden until a re-run; sole traders hidden by default with no entry; lifts compacted daily. qa proposed a role-level variant for sources without a row id. The council rules in its one-line confirmation.
