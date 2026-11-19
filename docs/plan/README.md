# Finora v1: mission register

The single place to see where the mission stands. The coordinator keeps it current. The hub is the open draft PR labelled `ao-mission`.

**Goal:** a fully working, free, open-source, agentic company-intelligence app that the maintainer uses every day. Main flow: a company explorer (everything official data says about a company) combined with agentic search (research agents dig further, in parallel and visibly, and end in a sourced verdict). Second tool: Crash monitor (markets). Scope: USA, Lithuania, Latvia, Estonia.

## Status

| Phase | State | Started | Exit met |
|---|---|---|---|
| 1. Data research | **in progress** | 2026-11-19 | |
| 2. Council session 1: data | waiting for phase 1 | | |
| 3. The plan | waiting for phase 2 | | |
| 4. Council session 2: plan approval | waiting for phase 3 | | |
| 5. Build, slice by slice | waiting for phase 4 | | |
| 6. Done | | | |

No phase starts before the previous phase's exit criteria are met. No app code before phase 5.

## Exit criteria

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
| `docs/research/baltics.md`, `baltics-dictionary.md` | data-baltics | 1 | |
| `docs/research/us.md` | data-us | 1 | |
| `docs/research/markets.md` | data-markets | 1 | landed 2026-11-19 (`1c39fb8`); qa spot-check before session 1 |
| `docs/research/osint.md` | data-osint | 1 | |
| `docs/research/legal.md` | legal (committed by coordinator) | 1 | done (rounds 1 and 2) |
| `docs/research/display-matrix.md` | coordinator, from the area docs | 1 | |
| `docs/research/cto-preread.md` (volumes, store benchmark, provisional technical calls) | cto (committed by coordinator) | 1 | done |
| `docs/design/display-options.md` (display states, advice for session 1) | designer | 1 | done |
| `docs/research/reality-check.md` | coordinator, from the area docs | 1 | |
| `docs/plan/council/00-framing.md` (session 1 gates, matrix format, v1 frame) | council (committed by coordinator) | 1 | done |
| `docs/plan/council/01-data.md` | council + cto (committed by coordinator) | 2 | |
| `docs/architecture.md`, `docs/plan/slices.md` | architect (+ frontend) | 3 | early draft exists; frozen until phase 3 opens |
| `DESIGN.md`, mockups | designer | 3 | v0 draft exists; frozen until session 1 rules |
| `docs/plan/loaders/*.md` | data seats | 3 | |
| `docs/plan/agents.md` | data-osint | 3 | |
| `docs/plan/prototype.md` | coordinator, with architect | 3 | |
| `docs/plan/council/02-plan.md` | council + cto (committed by coordinator) | 4 | |
| `docs/plan/qa-plan-checklist.md` | qa (committed by coordinator) | 3 | done |
| `docs/plan/reviews/00-early-plan-review.md` (qa's review of the early drafts; architect's committed fixes) | qa + architect (committed by coordinator) | 1 | done; 12 MUST-FIX open for phase 3 |

## Decisions

### For the human

| # | Question | Recommendation | Asked | Answer |
|---|---|---|---|---|
| H1 | Code licence (and docs licence) | AGPL-3.0 for code, CC BY 4.0 for docs | 2026-11-19 | **Yes** (2026-11-19): code AGPL-3.0, docs and research text CC BY 4.0, data keeps its source licence. `LICENSE` added |
| H2 | Paid per-use services for the agents: an LLM API and, if no free option is good enough, a web search API | Yes, bring-your-own-key, with a per-investigation cost cap enforced in code | 2026-11-19 | **Yes** (2026-11-19): own keys from a local `.env`, estimated cost shown before an investigation, per-investigation cap enforced in code, CI and tests on recorded fixtures only |
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
| C6 | The early `DESIGN.md` v0, `docs/architecture.md` and `docs/plan/slices.md` drafts stay on the branch but are frozen until phase 3 opens | Not reverted (no harm, saves work); revised against session 1's decisions |

### Open items for later phases
- Guard test cleanup (`scripts/guard/guard.test.mjs`, the worktree test) should run in `finally`, so a failed assert can't leave a denylist behind (qa NIT). Fix in the foundation slice.
- The frontend seat's proposed UI stack goes to the architect as input for the phase 3 slice plan; nothing is decided yet.

### By the council
Requirement (after H2): the estimated cost is shown before an investigation starts, as a range (typical to worst case under the cap) next to the cap and today's remaining daily spend. Owners: data-osint (estimation method), designer (pre-run state).

Session 0 (`docs/plan/council/00-framing.md`): the five session 1 gates; the display-matrix intake format; the v1 frame (primary job, two speeds, deterministic verdict level, five v1 agents, social and reviews agents LATER, one-hop network, local-only hosting, cost-cap defaults $1.50 / $0.25 / $10 per day); kill criteria; and the gates session 2 will check. Amendments: decision 2 withdrawn (one compact matrix format); "current" = no older than 2x the stated cadence; banned wording scope (own voice only, reject and regenerate, never rewrite); each country searchable as soon as its own load finishes.

Decision 4 (verdict wording, from the designer): No concerns found / Points to check / Serious concerns / Not enough data; one-shot cost-cap extension; "Not enough data" is a rule in the verdict table.

## Session 1 agenda (collected from phase 1)

- designer: the open questions in `docs/design/display-options.md` §8.
- data-markets (`markets.md`, Open questions): legal on one cited market-cap figure per market, the oracle feed's terms, EIA's vendor-permission note, two exchanges' data terms; council on ETF proxies for M02-M04 and on seeding the Taiwan peak.
- legal: the coordinator's three proposals in `legal.md` (no personal codes, retention for ended roles, blocked 15 USC 1681b uses); the legal light and basis wording per matrix row.
- cto: which US states load by default, against the 10 GB budget (`cto-preread.md` §6).

## Keys: what each unlocks

For the key-testing round. Nothing here blocks phase 1. Values live only in the main checkout's `.env`.

| Env var | Account | Unlocks | Areas waiting on it |
|---|---|---|---|
| `SEC_USER_AGENT` | none, a contact string | All live SEC EDGAR calls (submissions, companyfacts, filing index, 8-K items, EX-21, DEF 14A, Form D, 13D/G); EDGAR returns 403 without it | data-us: S01, S03, S06, S13, S14 for US public companies; data-markets: SEC XBRL fundamentals |
| `COURTLISTENER_TOKEN` | free | US federal court search and dockets via API (bulk files may be keyless) | data-us: S10 (US) |
| `SAM_GOV_API_KEY` | free | SAM.gov entity registrations and exclusions (debarment) | data-us: S11, S12 (US) |
| `FRED_API_KEY` | free | Not required (the CSV route works keyless); adds series metadata, licence notes and revision dates | data-markets: M01, M03, M07, M09 |
| `EIA_API_KEY` | free | Not required; oil spot directly from EIA with release metadata | data-markets: M07 |
| `KRX_API_KEY` | free | Korean broad index (self-hosted only) | data-markets: M03 |
| LLM provider key (name from data-osint) | paid per use, approved (H2) | Live agent runs, the measured cost per investigation, the pre-run estimate calibration | data-osint: agent pattern and cost |
| Web search API key (name from data-osint) | free tier, then paid per use (H2) | The open-web agent's search | data-osint: S15, S16 |
| One stock price key (provider S7, else S6; codes in `markets.md`) | free tier | M01-M04 via ETF proxies with 30-year history; S6 adds index futures | data-markets: M01-M04, S14 prices |
| Commodity spot key (provider S3) | free tier | Daily gold and oil spot | data-markets: M05, M07 |
| Crypto aggregator demo key (provider C1) | free | A stable monthly quota for the total-crypto tile | data-markets: M06 |
| Estonian e-Business Register API agreement | free, contract | Full annual reports via API (the key figures are in the open files) | data-baltics: S06 (EE) |

Data seats add rows here through their `result` posts; the coordinator keeps the table.

## Council records
- Session 0 (framing): `docs/plan/council/00-framing.md`, 2026-11-19
- Session 1 (data): not yet convened
- Session 2 (plan): not yet convened
