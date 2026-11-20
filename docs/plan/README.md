# Finora v1: mission register

The single place to see where the mission stands. The coordinator keeps it current. The hub is the open draft PR labelled `ao-mission`.

**Goal:** a fully working, free, open-source, agentic company-intelligence app that the maintainer uses every day. Main flow: a company explorer (everything official data says about a company) combined with agentic search (research agents dig further, in parallel and visibly, and end in a sourced verdict). Second tool: Crash monitor (markets). Scope: USA, Lithuania, Latvia, Estonia.

## Status

| Phase | State | Started | Exit met |
|---|---|---|---|
| 1. Data research | **done** | 2026-11-19 | 2026-11-20 |
| 2. Council session 1: data | **done** | 2026-11-20 | 2026-11-20 |
| 3. The plan | **in progress** | 2026-11-20 | |
| 4. Council session 2: plan approval | waiting for phase 3 | | |
| 5. Build, slice by slice | waiting for phase 4 | | |
| 6. Done | | | |

No phase starts before the previous phase's exit criteria are met. No app code before phase 5.

## Exit criteria

**Phase 2 exit check (2026-11-20):** 1 ✔ `01-data.md` Part G rules every display-matrix item (155 rows after the WHOIS ruling) with call, caveat and empty state; Parts A-F and H carry reasons, UI treatment, dissent and what would change each call; 2 ✔ `council` and `cto` both posted and confirmed; legal's and the designer's advice is cited.

**Phase 1 exit check (2026-11-20):** 1 ✔ four area docs (SEC EDGAR, CourtListener and other key-gated sources recorded from their docs and deferred under C7); 2 ✔ open questions answered in each area doc; 3 ✔ reality checks, aggregates only; 4 ✔ `legal.md` rounds 1-3 with 18 product rules; 5 ✔ `display-matrix.md`, 147 rows; 6 ✔ `reality-check.md`; 7 ✔ licence (answered), paid services (answered), keys (deferred by the human); 8 ✔ `guard tree` clean. qa spot-checked all four area docs and the assembly; no MUST-FIX open. Still landing during session 1, not exit criteria: data-baltics' LT round-2 answers and the LT/EE two-day diffs.

### Phase 1: data research
1. `docs/research/baltics.md` (+ `baltics-dictionary.md`), `us.md`, `markets.md` and `osint.md` are committed. Every source entry follows the template in `docs/research/README.md`: fields, rows, coverage, freshness, join keys, licence (verified on the official page, with URL and date), keys, limits, cost, legal constraints.
2. Every open question in `docs/research/00-feasibility.md` is answered with evidence, or marked unresolvable with the reason.
3. Each area doc has a reality check: real profiles built for sample entities, committed as aggregate fill rates only. Entity-level output stays in `research/.cache/`.
4. `docs/research/legal.md` is committed (from the legal seat's post) and ends with numbered product rules.
5. `docs/research/display-matrix.md` covers every report section by country and every Crash monitor tile, with sources and quality grades.
6. `docs/research/reality-check.md` summarises fill rates across areas.
7. The human-only questions for the build (code licence, paid services, keys and accounts) have been asked.
8. `node scripts/guard/guard.mjs tree` is clean.

### Phase 2: council session 1 (data)
1. `docs/plan/council/01-data.md` records, for every display-matrix item: show / show with caveat / hide / later, the reasons, how it appears in the UI, the dissent, and what would change the decision.
2. `council` and `cto` have both posted; legal and designer advice is cited.

### Phase 3: the plan
1. `docs/architecture.md` and `docs/plan/slices.md`: every slice has acceptance criteria, tests and a demo step.
2. `DESIGN.md` and HTML mockups for every screen and state, checked in a real browser.
3. Component inventory and UI build plan (frontend, inside the slice plan).
4. A loader spec per source (`docs/plan/loaders/`).
5. Agent runtime and tool specs (`docs/plan/agents.md`): parallel agents, questions to the human, citations, cost caps.
6. `docs/plan/prototype.md`: what "fully working" means, daily-use scenarios, demo script, risk register, test and CI strategy.
7. qa has reviewed the plan against `docs/plan/qa-plan-checklist.md` and web-qa the mockups, with no open MUST-FIX.

### Phase 4: council session 2 (plan approval)
1. `council` and `cto` approve the whole plan; `docs/plan/council/02-plan.md` records the red-team, the revisions and any dissent.
2. The code licence is decided by the human (done: AGPL-3.0).

### Phase 5: build
Slices land in the approved order. Each slice: tests green, qa review with no open MUST-FIX, web-qa pass for UI slices. A council session 3 record (`docs/plan/council/03-*.md`) at each milestone demo.

### Phase 6: done
1. One documented command runs the app locally with real data for LV, EE, LT and US companies.
2. The explorer + agentic search flow works end to end with sourced verdicts.
3. Crash monitor works.
4. Tests and CI are green.
5. The council signs off that it is fully working. Then the human merges the hub PR.

## Roster

| Seat | Role | Phase 1 job |
|---|---|---|
| `coordinator` | orchestrator | Runs the phases, keeps this register, commits posts of seats that can't write files, assembles the display matrix and reality-check summary |
| `data-baltics` | developer | LT, LV, EE registers, tax, social insurance, procurement, Kohesio; LEI coverage of Baltic samples |
| `data-us` | developer | SEC EDGAR, state registries, federal courts, other federal sources, GLEIF |
| `data-markets` | developer | Market data for Crash monitor and company profiles |
| `data-osint` | developer | Open-web sources, all sanctions and PEP lists, the agent pattern and its cost |
| `legal` | web-researcher | Legal memo (posted; committed by the coordinator) |
| `council` | cs-boardroom | Decides in sessions 1-3 |
| `cto` | cs-cto | Technical member of the council; owns build and scaling calls |
| `designer` | designer | Advises session 1; DESIGN.md and screens in phase 3 |
| `architect` | developer | Architecture and slice plan in phase 3; builds the foundation and core |
| `frontend` | frontend-craftsman | Component inventory in phase 3; builds the UI |
| `qa` | qa-code-review | Phase 1: spot-checks research claims. Then reviews the plan and every slice |
| `web-qa` | web-qa | Checks mockups (phase 3) and every UI slice |

## Deliverables

| Deliverable | Owner | Phase | State |
|---|---|---|---|
| `docs/research/README.md` (conventions, section IDs) | coordinator | 1 | done |
| `docs/research/baltics.md`, `baltics-dictionary.md` | data-baltics | 1 | landed 2026-11-20 (`12d735a`); **done**: qa spot-check passed (0 MUST-FIX); fixes in `09d9de1`; round-2 answers in `8275fad`; LT/EE two-day diffs still to come |
| `docs/research/us.md` | data-us | 1 | landed 2026-11-20 (`0a7be16`); SEC EDGAR deferred (key pending, C7); **done**: qa spot-check passed; CT split in `268cc3c` |
| `docs/research/markets.md` | data-markets | 1 | **done**: qa spot-check passed; MUST-FIX fixed in `2a2d70d` |
| `docs/research/osint.md` | data-osint | 1 | landed 2026-11-20 (`671dadc`, round 2 `e0c3bce`: TED for S12, sanctions identifier coverage, rate limits, UI facts); modelled cost, measured run deferred to the key round; **done**: qa spot-check passed (0 MUST-FIX); fixes in `4680a2f` |
| `docs/research/legal.md` | legal (committed by coordinator) | 1 | done (rounds 1-3, market addendum) |
| `docs/research/display-matrix.md` | coordinator, from the area docs | 1 | done 2026-11-20, 147 rows after the qa fixes (4 US rows added, 2 duplicate sources merged, CT, EE beneficial owners and LT social insurance split out); the council derives legal lights in session 1 from `legal.md` (amendment 1) |
| `docs/research/cto-preread.md` (volumes, store benchmark, provisional technical calls) | cto (committed by coordinator) | 1 | done |
| `docs/design/display-options.md` (display states, advice for session 1) | designer | 1 | done |
| `docs/research/reality-check.md` | coordinator, from the area docs | 1 | done 2026-11-20 |
| `docs/plan/council/00-framing.md` (session 1 gates, matrix format, v1 frame) | council (committed by coordinator) | 1 | done |
| `docs/plan/council/01-data-cto.md` (cto's feasibility, cost and scaling calls) | cto (committed by coordinator) | 2 | done 2026-11-20 |
| `docs/plan/council/01-data.md` | council (committed by coordinator) | 2 | **done** 2026-11-20: Part G final, 155 rows (SHOW 41, CAVEAT 56, LATER 53, HIDE 5 after the phase 3 calls), confirmed by council and cto |
| `docs/architecture.md`, `docs/plan/slices.md` | architect (+ frontend) | 3 | milestone B pushed `0de4d5f` (27 slices, M1-M5); qa full review next; milestone A **closed** (store and loader contract, verified by qa at `faed2df`; `docs/plan/reviews/01-milestone-a.md`); milestone B in progress |
| `DESIGN.md`, `docs/design/IA.md`, mockups (`docs/design/mockups/`) | designer | 3 | v1 and 8 mockup pages (~60 states) pushed `7dc2e76`; web-qa review next |
| `docs/plan/loaders/README.md` (spec template and ownership) | coordinator | 3 | done |
| `docs/plan/loaders/*.md` | data seats | 3 | landed: `markets.md`, `esma-firds.md` (data-markets, `d3fce4c`, fixed contract `384ddb4`); `gleif.md`, `us-states.md`, `us-sec.md`, `us-fdic.md`, `us-fmcsa.md`, `us-sam-exclusions.md`, `us-enforcement.md`, `us-courts.md` (data-us, `4e820f1`, fixed contract `e5fd7bd`); 14 Baltic specs `lt-*`, `lv-*`, `ee-*` (data-baltics, `6dc2881`); `sanctions.md` (data-osint, `87301af`). **All specs landed** |
| `docs/plan/ui-build-plan.md` | frontend | 3 | landed |
| `docs/plan/agents.md` | data-osint | 3 | landed `1ecbbc4`; court portals (§4.5a) to follow; §16 lists contract additions for the architect |
| `docs/plan/prototype.md` | coordinator, with architect | 3 | draft pushed |
| `docs/plan/lawyer-register.md` (P13) | legal (committed by coordinator) | 3 | 16 rows from legal + 5 added by the coordinator for legal to confirm |
| `docs/plan/council/02-plan.md` | council + cto (committed by coordinator) | 4 | |
| `docs/plan/qa-plan-checklist.md` | qa (committed by coordinator) | 3 | done |
| `docs/plan/reviews/02-plan-review.md` (qa's full plan review, milestone B) | qa (committed by coordinator) | 3 | 21 MUST-FIX, all fixed by their owners; qa re-review pending |
| `docs/plan/reviews/03-mockups.md` (web-qa's mockup review) | web-qa (committed by coordinator) | 3 | 6 blocking open (designer) |
| `docs/plan/reviews/00-early-plan-review.md` (qa's review of the early drafts; architect's committed fixes) | qa + architect (committed by coordinator) | 1 | done; 12 MUST-FIX open for phase 3 |

## Decisions

### For the human

| # | Question | Recommendation | Asked | Answer |
|---|---|---|---|---|
| H1 | Code licence (and docs licence) | AGPL-3.0 for code, CC BY 4.0 for docs | 2026-11-19 | **Yes** (2026-11-19): code AGPL-3.0, docs and research text CC BY 4.0, data keeps its source licence. `LICENSE` added |
| H2 | Paid per-use services for the agents: an LLM API and, if no free option is good enough, a web search API | Yes, bring-your-own-key, with a per-investigation cost cap enforced in code | 2026-11-19 | **Yes** (2026-11-19): own keys from a local `.env`, estimated cost shown before an investigation, per-investigation cap enforced in code, CI and tests on recorded fixtures only |
| H4 | Two real ticker symbols in an early probe commit: fix forward, or rewrite branch history | Fix forward; symbols added to the private denylist; the code fix is a new commit | 2026-11-20 | |
| H3 | Keys and accounts (human-task) | See the hub post | 2026-11-19 | Deferred to a separate key-testing round (human's hub reply). See "Keys: what each unlocks" below |

### By the coordinator

| # | Decision | Why |
|---|---|---|
| C1 | All sanctions and PEP lists (EU, UN, OFAC, UK) belong to `data-osint`; `data-us` skips OFAC; `data-baltics` only measures sample hits | One owner per source, no duplicate work |
| C2 | GLEIF belongs to `data-us`; `data-baltics` measures LEI coverage of its samples | Same |
| C3 | EU-wide procurement (TED) belongs to `data-osint`; national procurement and Kohesio to `data-baltics`; USAspending and SAM.gov to `data-us` | Same |
| C4 | Report section and tile IDs are fixed in `docs/research/README.md`; every area doc uses them | So the display matrix can be assembled without guessing |
| C5 | The display-matrix row format is the compact one (`Section | Country | Sources | Grade | Fill rate | Notes`), per council session 0 amendment 1, which withdrew decision 2. cto's measurement fields go in the source entry template | One format; the council derives the rest in session |
| C7 | Phase 1 researches every keyless source in full. Key-gated sources are recorded from their public docs and terms, marked "deferred: key pending", and never block. Keyless routes first (bulk files, the local SEC insider database, keyless endpoints). No live EDGAR calls until `SEC_USER_AGENT` is set | Matches the human's hub reply; costs nothing and keeps research moving |
| C8 | No loader specs, agent specs or plan reviews before phase 3 opens; data seats finish their area docs first | Phase gate; the plan must rest on measured data |
| C9 | Lean phase 1 (after the shared usage limit was hit): `council`, `cto`, `designer`, `architect`, `frontend`, `qa` and `web-qa` are paused by the human until phase 1 exits. qa's spot-checks of the area docs move to just before council session 1. The coordinator asks the human to resume them when phase 1's exit criteria are met. Short posts, no broadcasts | Quota; those seats have no phase 1 work |
| C10 | The one-shot "allow up to $0.50 more" at the per-investigation cap is within H2: the cap is still enforced in code, the extension is offered once per investigation (not per agent run), never past the daily cap, and the person who clicks is the person whose key pays | Council decision 4 guardrail 1; no separate human question needed |
| C11 | No outreach to the OR and WA open-data teams for v1. Their live queries stay LATER (licence verified partial); v1's US live states are NY, CO, CT and PA. Trigger: a readable terms page, or the human chooses to email them | Emailing a state is outreach outside the repo in the human's name; four states cover the counterparty job |
| C12 | The fund ticker added to the private denylist on 2026-11-20 is removed again: it is also a common English word for a test double and blocked ordinary test code. P12 (fund tickers only in local settings) is enforced by fixtures with fictional symbols and by qa review; the two company tickers stay on the denylist. qa's proposal for a lint rule that reads the guard's denylist goes to the S01 slice | Friction in every test file outweighed the protection for one symbol |
| C6 | The early `DESIGN.md` v0, `docs/architecture.md` and `docs/plan/slices.md` drafts stay on the branch but are frozen until phase 3 opens | Not reverted (no harm, saves work); revised against session 1's decisions |

### Open items for later phases
- Guard test cleanup (`scripts/guard/guard.test.mjs`, the worktree test) should run in `finally`, so a failed assert can't leave a denylist behind (qa NIT). Fix in the foundation slice.
- The frontend seat's proposed UI stack goes to the architect as input for the phase 3 slice plan; nothing is decided yet.

### By the council
Session 1 (`docs/plan/council/01-data.md`): per-country v1 promise (LT is a money-and-status check, names `paid_only`; US public needs `SEC_USER_AGENT`); a fixed 11-check verdict scale with "Not enough data" rules and arrears thresholds; calls for all 147 items (155 rows after splits and new S15 ids: SHOW 41, CAVEAT 56, LATER 53, HIDE 5 after the phase 3 calls on Sodra and Baltic courts; .lt WHOIS CAVEAT, .lv and .ee WHOIS and the web archive LATER); the policy table P1-P14; the proven-company gate for every party row; US live states NY, CO, CT, PA that session 2 checks; S05 and S12 LATER; social and reviews LATER, news a CAVEAT sub-task.

Requirement (after H2): the estimated cost is shown before an investigation starts, as a range (typical to worst case under the cap) next to the cap and today's remaining daily spend. Owners: data-osint (estimation method), designer (pre-run state).

Session 0 (`docs/plan/council/00-framing.md`): the five session 1 gates; the display-matrix intake format; the v1 frame (primary job, two speeds, deterministic verdict level, five v1 agents, social and reviews agents LATER, one-hop network, local-only hosting, cost-cap defaults $1.50 / $0.25 / $10 per day); kill criteria; and the gates session 2 will check. Amendments: decision 2 withdrawn (one compact matrix format); "current" = no older than 2x the stated cadence; banned wording scope (own voice only, reject and regenerate, never rewrite); each country searchable as soon as its own load finishes.

Decision 4 (verdict wording, from the designer): No concerns found / Points to check / Serious concerns / Not enough data; one-shot cost-cap extension; "Not enough data" is a rule in the verdict table.

## Session 1 agenda (collected from phase 1)

- designer: the open questions in `docs/design/display-options.md` §8.
- data-markets (`markets.md`, Open questions): legal on one cited market-cap figure per market, the oracle feed's terms, EIA's vendor-permission note, two exchanges' data terms; council on ETF proxies for M02-M04 and on seeding the Taiwan peak. Agreed with legal so far (`legal.md`, market addendum): oracle route LATER; EIA SHOW with source and date; X1 LATER; bitcoin price from X4 CAVEAT for a self-hosted instance (its clause covers derived figures; commercial use needs a data licence, so ask the exchange before any hosted build).
- legal: the coordinator's three proposals in `legal.md` (no personal codes, retention for ended roles, blocked 15 USC 1681b uses); the legal light and basis wording per matrix row.
- council + legal: ETF proxies (M02-M04) need real fund ticker symbols somewhere. Decide whether they live only in the user's local settings (never in the repo), since hard rule 2 bars real products as examples and the guard now blocks the probe tickers.
- data-osint (`osint.md` §6): legal on the .lv and .ee WHOIS purpose clauses for due-diligence lookups, the web archive's terms, and showing a map platform's rating without LLM processing. Modelled cost: about $0.46 typical, $0.92 worst case per investigation on a mid-tier model (under the $1.50 cap). Sanctions name-only hits are generic names, so a second identifier is required before showing a match.
- data-baltics (`baltics.md`, "For the legal memo"): ten legal items, led by LV and EE beneficial owners still bulk-published (candidate X), the LV masked personal code that reveals the birth date, the EE person hash, and **CC BY-SA data from the EE tax board, procurement and notices**: hard rule 4 bars mixing share-alike data into our datasets, and EE taxes feed a primary-job section. Legal answers in round 3.
- data-baltics: the LV and EE bulk files keep no history (ended roles and deleted EE companies vanish), so "officer left" events need our own daily snapshots, or the EE register API (contract). Council: history in v1 or later? cto: snapshot cost.
- data-baltics: LT has no people at all; LV tax-debt amounts are not open (rating C as the proxy, 5.4% of active companies).
- data-us (`us.md`): FEC individual donors HIDE (no commercial use by statute); FINRA BrokerCheck per-query only with source, compile date and an error channel; CT principals' residence addresses and FMCSA emails and phones dropped at load. Florida's bulk licence can't be verified (pages refuse automated reads). CA and DE have no free bulk data.
- **Share-alike storage (qa, blocking for the plan):** `docs/architecture.md` fails any share-alike source stored locally, while `legal.md` round 3 proposes a separate store tagged per record. Session 1 rules either a share-alike storage class (separate file, never exported or merged) or EE tax debt (S08), procurement (S12) and notices (S09) as agent-only. Otherwise S08 EE is unbuildable as decided.
- `OUT.US.01` (FEC individual contributions, graded X): legal flags its light as "?" until the text of 52 U.S.C. 30111(a)(4) is read in session 1. The question is whether it restricts use (solicitation or commercial purposes) or publication. It is outside the counterparty job either way.
- **Store size (cto):** at the proposed load rule the Baltics alone are ~192.2M statements, ~23.6 GB (LT 78.5M, LV 35.8M, EE 77.9M), over the 10 GB budget before any US data. Most of it is financial line items and time series stored one statement per value; one wide row per company-year (LT key lines, ~6x smaller) or per report (EE, 23.8M → 10.3M) fixes most of it. data-baltics proposes wide rows for financials and periodic series, statements for identity, people and events (`baltics.md`, "Load volume and refresh"). EE annual-report key figures stored one row per report cut that table from 23.8M to ~10.3M. EE deleted companies vanish from the daily files, so keeping struck-off companies searchable means retaining every entity ever seen. LV financial statements refresh weekly (~0.003% change per day).
- cto: which US states load by default, against the 10 GB budget (`cto-preread.md` §6). data-us's proposal (`us.md` §2.10): six states in bulk ≈ 18 GB, so query NY, CO, OR, CT, PA and WA live per search and profile (no key, median 0.66-1.05 s) and cache each entity looked up; FL bulk opt-in (≈ 5.5 GB, off by default); state network views (S17) wait for a bulk load.

## Keys: what each unlocks

For the key-testing round. Nothing here blocks phase 1. Values live only in the main checkout's `.env`.

| Env var | Account | Unlocks | Areas waiting on it |
|---|---|---|---|
| `SEC_USER_AGENT` | none, a contact string with a real email (SEC refuses no-reply addresses). **Needed before the US loader slices in phase 5:** without it, US public companies have no profile and the "US companies" done criterion fails (cto) | All live SEC EDGAR calls (submissions, companyfacts, filing index, 8-K items, EX-21, DEF 14A, Form D, 13D/G); EDGAR returns 403 without it | data-us: S01, S03, S06, S13, S14 for US public companies; data-markets: SEC XBRL fundamentals |
| `COURTLISTENER_TOKEN` | free | Docket search by party name, 125 searches a day (bulk dockets need no token) | data-us: S10 (US) |
| `SAM_GOV_API_KEY` | free | **Needed for S11.US.01 (federal exclusions, SHOW):** SAM.gov's terms bar automated gathering except with permission, so exclusions come only through the keyed Extracts API (pending legal's light) | data-us: S11.US.01 |
| `SOCRATA_APP_TOKEN` | free, optional | Avoids shared throttling on live state-registry queries | data-us: S01-S03 (US) |
| `USPTO_ODP_KEY`, `FEC_API_KEY` | free | Only LATER items | data-us |
| `FRED_API_KEY` | free | Not required (the CSV route works keyless); adds series metadata, licence notes and revision dates | data-markets: M01, M03, M07, M09 |
| `EIA_API_KEY` | free | Not required; oil spot directly from EIA with release metadata | data-markets: M07 |
| `KRX_API_KEY` | free | Korean broad index (self-hosted only) | data-markets: M03 |
| `ANTHROPIC_API_KEY` | paid per use, approved (H2) | Live agent runs, including the provider's web search and web fetch tools (no separate search key); the measured run of 3 sample companies per country at two model tiers (about $5), replacing the modelled cost | data-osint: agent pattern, cost, S15, S16 |
| One stock price key (provider S7, else S6; codes in `markets.md`) | free tier | M01-M04 via ETF proxies with 30-year history; S6 adds index futures | data-markets: M01-M04, S14 prices |
| Commodity spot key (provider S3) | free tier | Daily gold and oil spot | data-markets: M05, M07 |
| Crypto aggregator demo key (provider C1) | free | A stable monthly quota for the total-crypto tile | data-markets: M06 |
| Estonian e-Business Register API agreement | free, a contract signed by the operator (up to five working days) | History, deleted companies and full annual reports, 50,000 answers a day. Ask the human only if session 1 wants history in v1 | data-baltics: S02, S06 (EE) |

Data seats add rows here through their `result` posts; the coordinator keeps the table.

## Council records
- Session 0 (framing): `docs/plan/council/00-framing.md`, 2026-11-19
- Session 1 (data): `docs/plan/council/01-data.md` (decision, confirmed 2026-11-20) and `docs/plan/council/01-data-cto.md` (technical calls)
- Session 2 (plan): not yet convened
