# Finora v1: mission register

The single place to see where the mission stands. The coordinator keeps it current. The hub is the open draft PR labelled `ao-mission`.

**Goal:** a fully working, free, open-source, agentic company-intelligence app that the maintainer uses every day. Main flow: a company explorer (everything official data says about a company) combined with agentic search (research agents dig further, in parallel and visibly, and end in a sourced verdict). Second tool: Crash monitor (markets). Scope: USA, Lithuania, Latvia, Estonia.

## Status

| Phase | State | Started | Exit met |
|---|---|---|---|
| 1. Data research | **done** | 2026-11-19 | 2026-11-20 |
| 2. Council session 1: data | **done** | 2026-11-20 | 2026-11-20 |
| 3. The plan | **done** | 2026-11-20 | 2026-11-20 |
| 4. Council session 2: plan approval | **done**: approved; the 16-item revision confirmed complete | 2026-11-20 | 2026-11-20 |
| 5. Build, slice by slice | **in progress**: S01, S02, S03, S04a, S04f, S04i, S04b, S04u, S06 and S22 **accepted**, so every M1 slice is in. **M1 gates left:** a steady test suite (architect, open items), then qa's fresh-clone demo and council session 3a. S05 (Latvia, M2) is open: items 1-5 and K5 are accepted by qa. Next come qa's re-check of item 6 at `9502d0d`, the coordinator's security re-check, the quiet-window clean run, and the raw-download deletion (`reviews/slices/S05.md`). H6 = 1 (2026-11-23). Waiting on the human: C18 web tools, the mission file's 2 H4 hits, and confirmation of the seat-slot rule below | 2026-11-20 | |
| 6. Done | | | |

No phase starts before the previous phase's exit criteria are met. No app code before phase 5.

## Exit criteria

**Phase 3 exit check (2026-11-20):** 1 ✔ `docs/architecture.md` and `docs/plan/slices.md` (27 slices, M1-M5, every SHOW and CAVEAT id mapped to a slice and test); 2 ✔ `DESIGN.md`, `docs/design/IA.md` and the mockups for every screen and state; 3 ✔ `docs/plan/ui-build-plan.md`; 4 ✔ a loader spec per source (`docs/plan/loaders/`, 27 specs); 5 ✔ `docs/plan/agents.md`; 6 ✔ `docs/plan/prototype.md`; 7 ✔ qa: no open MUST-FIX (`reviews/02-plan-review.md`, at `2314a54`); web-qa: signed off (`reviews/03-mockups.md`, at `d9441ad`). Also: `docs/plan/lawyer-register.md` (32 rows), `docs/plan/benchmarks.md`.

**Phase 2 exit check (2026-11-20):** 1 ✔ `01-data.md` Part G rules every display-matrix item (155 rows after the WHOIS ruling) with call, caveat and empty state; Parts A-F and H carry reasons, UI treatment, dissent and what would change each call; 2 ✔ `council` and `cto` both posted and confirmed; legal's and the designer's advice is cited.

**Phase 1 exit check (2026-11-20):** 1 ✔ four area docs (SEC EDGAR, the P2 court-data service and other key-gated sources recorded from their docs and deferred under C7); 2 ✔ open questions answered in each area doc; 3 ✔ reality checks, aggregates only; 4 ✔ `legal.md` rounds 1-3 with 18 product rules; 5 ✔ `display-matrix.md`, 147 rows; 6 ✔ `reality-check.md`; 7 ✔ licence (answered), paid services (answered), keys (deferred by the human); 8 ✔ `guard tree` clean. qa spot-checked all four area docs and the assembly; no MUST-FIX open. Still landing during session 1, not exit criteria: data-baltics' LT round-2 answers and the LT/EE two-day diffs.

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

**Seat slots (coordinator working rule, adopted 2026-11-23).** This came from a PR comment posted from the shared account. Such comments are unverified, so the rule is not recorded as a human ruling. The coordinator adopts it because it only reduces load, and asks the human to confirm it directly.
1. At most 3 seats work at once, plus the coordinator. A seat is given work only when a slot is free. Waiting seats are not messaged.
2. No fan-out. A post goes only to the seats that must act on it. FYIs go out only when a slice closes.
3. Reviews run one after another: qa first; then security and legal only where the slice needs them; then web-qa for UI slices.
4. A slice is finished and accepted before the next one opens, unless a seat on the critical path would otherwise sit idle.
5. Speed matters less than not stopping at the usage limit.

Slots now: architect (S05 items 1-6), qa (S04u review), and one free slot, which is held for web-qa after qa.

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
| `docs/plan/loaders/*.md` | data seats | 3 | landed: `markets.md`, `esma-firds.md` (data-markets, `d3fce4c`, fixed contract `384ddb4`); `gleif.md`, `us-states.md`, `us-sec.md`, `us-fdic.md`, `us-fmcsa.md`, `us-sam-exclusions.md`, `us-enforcement.md`, `us-courts.md` (data-us, `4e820f1`, fixed contract `e5fd7bd`); 14 Baltic specs `lt-*`, `lv-*`, `ee-*` (data-baltics, `6dc2881`); `sanctions.md` (data-osint, `87301af`; listed persons screened live only `64667b7`). **All specs landed**; Baltic specs on the fixed contract `6241727` |
| `docs/plan/ui-build-plan.md` | frontend | 3 | landed |
| `docs/plan/agents.md` | data-osint | 3 | landed `1ecbbc4`; court portals (§4.5a) to follow; §16 lists contract additions for the architect |
| `docs/plan/prototype.md` | coordinator, with architect | 3 | draft pushed |
| `docs/plan/lawyer-register.md` (P13) | legal (committed by coordinator) | 3 | 32 rows, with affected items and tests |
| `docs/plan/council/02-plan.md` | council + cto (committed by coordinator) | 4 | **done**: approved S01-S03; 16 gated fixes; O1 confirmed, O2 changed |
| `docs/plan/council/session3-runbook.md` (milestone sessions) | coordinator | 4 | done |
| `docs/plan/qa-plan-checklist.md` | qa (committed by coordinator) | 3 | done |
| `docs/plan/reviews/02-plan-review.md` (qa's full plan review, milestone B) | qa (committed by coordinator) | 3 | **qa verdict: no open MUST-FIX; ready for council session 2** (`2314a54`) |
| `docs/plan/reviews/03-mockups.md` (web-qa's mockup review) | web-qa (committed by coordinator) | 3 | **signed off** by web-qa at `d9441ad` |
| `docs/plan/reviews/00-early-plan-review.md` (qa's review of the early drafts; architect's committed fixes) | qa + architect (committed by coordinator) | 1 | done; 12 MUST-FIX open for phase 3 |

## Decisions

### For the human

| # | Question | Recommendation | Asked | Answer |
|---|---|---|---|---|
| H1 | Code licence (and docs licence) | AGPL-3.0 for code, CC BY 4.0 for docs | 2026-11-19 | **Yes** (2026-11-19): code AGPL-3.0, docs and research text CC BY 4.0, data keeps its source licence. `LICENSE` added |
| H2 | Paid per-use services for the agents: an LLM API and, if no free option is good enough, a web search API | Yes, bring-your-own-key, with a per-investigation cost cap enforced in code | 2026-11-19 | **Yes** (2026-11-19), **superseded by H5** (2026-11-21) |
| H4 | Two real ticker symbols in an early probe commit: fix forward, or rewrite branch history | Fix forward; symbols added to the private denylist; the code fix is a new commit | 2026-11-20 | **1, fix forward** (2026-11-21). History does not matter: this repo is later replaced by a fresh public repo; the tree does. **Tree rule:** no mention of any outside company in the current tree (competitors; real companies used as samples, tests, fixtures or tickers; commercial data providers). Public files use coded aliases (like provider C1); real names live only in the main checkout's `.local/`. Public bodies, official registries and open standards may stay named. qa adds a check that runs before every slice is accepted |
| H5 | Paid agent services (detail for H2: cost per investigation, caps, web search) | (H2 as asked) | 2026-11-21 | **Settled** (2026-11-21): **no paid services and no API keys.** Agents run on the local Claude Code CLI under the user's subscription. "Cost" means subscription usage, not money: show the estimated usage before an investigation, and keep a per-investigation cap enforced in code |
| H6 | The local CLI under the subscription terms. Legal (7066854077) reads the consumer terms' bar on "automated or non-human means" (except with an API key or explicit permission) as covering a script that drives the CLI on a subscription login: **not cleared**. Options (council 7066880821, cto 7066920998): (1) accept the risk knowingly under legal's five conditions (personal single-user use, one investigation at a time, within the plan's limits, no third-party scraping, the credential never stored or forwarded); (2) ask the vendor for written permission (the human sends it, C11); (3) a local open-weights model: needs a GPU of at least 24 GB (2-6 min per investigation; CPU-only 40-120 min), loses web search, effort L, must pass the same gate on the human's hardware | (2) now, while the build continues on the fake CLI; choose (1) or (3) at S10 if no answer has come. The runtime stays behind `cli \| local \| fake`, so the choice is a config change. Also: keep paid extra usage **off** in the Claude account | 2026-11-21 | **Option 1** (the human, 2026-11-23): the agents run on the human's own subscription. The human accepts the risk knowingly, under legal's five conditions: personal single-user use; one investigation at a time; within the plan's limits; no scraping against a site's terms; the login is never stored or forwarded. Legal did not clear the terms question and cannot do so on the human's behalf. It wrote the conditions out in full (7091194342), adding no unattended or scheduled runs, no sharing, no API key, and a ledger that keeps counts only. A hosted or shared build is not covered and stays LAWYER. Recorded as `LAW-SUBSCRIPTION-TERMS` in `lawyer-register.md`. This meets C18 (1)'s condition, so the `cli` backend may be enabled. Whether the default changes from `off` goes to the architect at S10. Paid extra usage stays off in the Claude account (the human's setting, C19) |
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
| C13 | S02, S03 and S04f accepted (2026-11-21): no open MUST-FIX from qa, web-qa (UI), the designer (S03), legal or security (S02) | Records in `reviews/slices/` |
| C14 | How the tree rule (H4) is read: software tools and dependencies the code runs on (runtimes, frameworks, libraries, the git host, CI, the agent CLI) are not "outside companies" for this rule; competitors, sample companies and commercial data providers are. `SEC_USER_AGENT` is a contact header the SEC requires, not a key or account, so it stays an optional local setting under H5; without it US public companies have no profile | The rule lists competitors, samples and data providers; tools are needed by name to run the code. The human can override |
| C15 | How the tree rule (H4) is applied (2026-11-21). **Named:** public bodies (incl. FINRA as the SEC-overseen regulator), official registries and their own download hosts (also when served from a cloud host), open standards and their stewards (LEI and GLEIF, FollowTheMoney as a data model), public broadcasters cited as sources and the official ccTLD registry operators (legal 7070549282), and software tools and libraries (C14). Social-platform link patterns are **not** kept: v1 has no use for them (S16.ALL.02 is LATER), so they are deleted; if S16.ALL.02 ever ships, a generic social-block rule reads the platform list from the local provider map (council 7070608083, legal 7070605484). **Coded** (real names only in the main checkout's `.local/`): competitors (K), commercial data providers (S, C, X, O, P), every other non-public data source even when nonprofit (P), exchange operators (E) and index brands (I). Field names of official datasets and series ids assigned by a public body (for example FRED's) stay as identifiers; prose and UI use descriptive names. **Hosts and identifiers of coded sources leave the tree:** connectors read them from a local provider map at runtime, tests use `*.example` hosts, and with no map the source shows `needs_source`. This replaces the earlier rule that provider hosts stay in the code | The rule's own whitelist is public bodies, official registries and open standards; the safe reading codes everything else. The human can relax it for nonprofits |
| C16 | Usage caps in standard tokens (cto 7066903638 and 7067029277, council 7066916684; supersedes the dollar figures of C10, session 0 decision 3 and session 2 item 4): 500k st per investigation, 85k st per follow-up, 3.3M st per day, one-shot +170k st clipped to the daily cap. The CLI backstop `--max-budget-usd` sits at the run's allocation minus one response (about 25k st), never above it; web searches are added at 3,333 st each unless the measured run shows the fee is already counted. No currency on any surface; the UI shows a share of Finora's cap. Build and gate usage: about 15M st, planned at 33M st | Same strength as the human-approved dollar caps; H5 |
| C17 | data-markets' H4 proposal accepted (7066874021): crypto connectors keep their parsers under codes, with hosts, URL templates, attribution and terms URLs in a gitignored local provider file under qa's six conditions (7066883380); commercial-provider probes leave the tree; row labels name the market, not the index | legal and qa agreed |
| C18 | The agent runtime under H5 (architect and data-osint 7067111911) is accepted with its four decisions and these conditions: **(1)** `FINORA_AGENT_BACKEND=cli\|local\|off`, default `off` until the human's H6 decision is recorded here; with `off`, Investigate shows its own not-enabled state (council). **(2)** The run dir is in the OS temp dir, owner-only, removed at run end and swept at boot without logging its path; on Windows an explicit owner-only ACL, tested (legal: a per-user TEMP is not the control); mode 0700 tested on POSIX. **(3)** **No CLI built-in tools in any investigation:** `--tools ""`, `--allowedTools mcp__finora__*` only; the init check fails the run if any built-in is listed; the web lane reads only through `cite_page` (qa MUST, legal). **(4)** The plan limit pauses the whole investigation on a limit result, on a `rate_limit` retry at its last attempt, or on a retry delay over 60 s; otherwise the CLI's own retry runs and the lane reads "Waiting: Claude is busy", never failed or done, and no new process starts while the CLI waits; Finora retries nothing and starts nothing to get round a limit (cto, qa, legal 7067142843). **(5)** The env allowlist sets `CLAUDE_CODE_MAX_TURNS`; the fake CLI asserts its own argv, env and cwd before replaying. **(6)** The MCP endpoint hardening (cto's four rules, qa's tests) is in S09a/S10. **(7)** The isolation proof runs once by the human, in a throwaway `CLAUDE_CONFIG_DIR` with one sign-in, never the real config; no credential is copied out or kept, and the script checks the dir's deletion; the proof records counts and the CLI version only, and a version change re-opens it (`doctor` warns) | legal, council and qa agreed; the human steps are listed in `prototype.md` §6 |
| C19 | **Finora refuses paid extra usage, not just warns** (data-osint measured `rate_limit_event.rate_limit_info.overageStatus` and `isUsingOverage` in the CLI stream; cto withdrew "cannot check"; council 7067174721, legal 7067167577): **the final rule** (council 7067190899, cto 7067196158, legal 7067191845): `isUsingOverage: true` interrupts every run of the investigation at once and pauses it with "Paid extra usage is on in your Claude account. Turn it off to continue."; overage permitted **and** a plan window exhausted (status `rejected`, or `utilization` at 100%) gives the same pause, before the first paid request; overage permitted with every window still inside the plan gives a warning only ("Paid extra usage is on in your Claude account; Finora will stop before using it"); no event means status unknown, the one-time notice only, never a claim either way. A pause never resets itself; Resume is a user action after a later event shows overage off or a window reset. Scenarios: `overage-in-use`, `overage-at-limit` (pause), `overage-permitted` (warning), `no-event`. The residual exposure (the request in flight, capped at 4,096 output tokens) is measured first in S09 and stated in `docs/running.md`; with no event seen the status is "unknown" and the one-time notice stays. The CLI's plan-window `utilization` may appear only as a secondary line labelled as Claude's own figure, in the pause message, and before a start only if the event arrives on runs that are not limited (then, at 90% or more of the 5-hour window: "Claude reports your 5-hour window at [N]%; this investigation may pause."); Finora's cap share stays primary. **The `fake` backend runs only in CI, tests and `FINORA_DEMO=1`**: with real data loaded and no demo flag it is refused at boot (council) | Makes H5's "never costs money" an enforced stop; a fake backend on real data would print invented findings |
| C20 | P10 first core load amended by the council (7087181944): each country searchable within its budget (LV 150 s, LT 150 s, EE 6 min), the whole core load ≤ 60 min on `dev-desktop-1` shown up front, registers first across lanes; a run over 60 min returns to the council. Recorded in `01-data-cto.md` and `benchmarks.md` | cto's measured option B; the fix came first |
| C21 | Research raw downloads are minimised (legal 7087473085, data-baltics 7087464258): the LV bench input stays only until S05 is accepted, then it is deleted and fetched fresh; the EE, LT, day-two diff and cross-border raw downloads are deleted now (later slices fetch fresh); counts-only outputs are kept, after a check that each holds no name or code. data-baltics posts a listing as the record. `research/local/` and `.data/` join the guard's local-only paths, with a test each (architect) | The raw downloads hold natural persons; no slice needs them before its own fresh fetch |
| C6 | The early `DESIGN.md` v0, `docs/architecture.md` and `docs/plan/slices.md` drafts stay on the branch but are frozen until phase 3 opens | Not reverted (no harm, saves work); revised against session 1's decisions |

### Open items for later phases
- Guard test cleanup (`scripts/guard/guard.test.mjs`, the worktree test) should run in `finally`, so a failed assert can't leave a denylist behind (qa NIT). Fix in the foundation slice.
- The frontend seat's proposed UI stack goes to the architect as input for the phase 3 slice plan; nothing is decided yet.

- **S12 boot refusals** (cto, accepted by legal and qa): `scripts/finora.mjs` refuses every heap, inspect and report flag in `NODE_OPTIONS` and `execArgv`, the worker's `execArgv` included; `--report-exclude-env` is the only exception. Each has a test. `docs/running.md` notes the V8 `jit_page_` check (many short-lived worker isolates), its trigger and the Node version, and the roughly 178 MB the sanctions lists download at each start.
- **Before S05's first real load** (architect): **done** (`0f20896`, `c82e87b`): the sync-worker heap cap at 768 MB (the crash guard; P10's RSS budget stays the real bound), an OOM inside an open transaction stores nothing of that batch (tested), and `SourceMeta.order` with `lanesOf()` puts each lane's register first (tested); S12 acceptance 10 uses the same lanes.
- **Edge instrumentation warnings** (S22): `apps/web/src/instrumentation.ts` guards its server import with `NEXT_RUNTIME === "nodejs"`; frontend owns the file, the architect reviews the env-lint allowance.
- **A steady test suite before M1** (qa 7091597736; owner: architect; an M1 gate). At `902fcd5`, qa ran the full suite 5 times on `dev-desktop-1`. 3 runs passed. 1 ended on the known V8 teardown fatal. 1 had 15 failures in `fixtures/load.test.ts`, `lv-byte-scan.test.ts` and others, cause unconfirmed; both files pass 10 of 10 alone. The mitigation must not hide real failures: run the worker-heavy files in their own forks pool, and retry only a fork that crashed, never a failed assertion. qa keeps every run's output until the 15-failure case repeats. The V8 decision itself is S12's.

- **Native review of the `lt`, `lv` and `et` texts** (legal, S02): the Baltic UI and terms texts are drafted by the frontend seat and listed in `packages/i18n/REVIEW.md`; no seat is a native speaker. They ship marked as drafts, and native review goes to the session 3 agenda (the human may know a reviewer, or accept drafts for v1). Legal reviews the terms texts as a second pass after native review.

- **S12, install keyed on the lockfile** (cto, after qa found a stale `node_modules`): `pnpm finora` writes `node_modules/.finora-install` with the lockfile's sha256 only after a successful frozen install, and installs whenever the marker is missing or differs, so a `git pull` that changes the lockfile, or an interrupted install, never leaves a stale install. **qa adds:** a marker alone misses an install pnpm calls "up to date" that still lacks a package, so after the install resolve the runtime entry points (`next`, `react`, `react-dom`, the `@finora/*` packages) from `apps/web` with `createRequire`; on failure remove `node_modules` once, reinstall and verify; on a second failure stop with a clear message; `doctor` runs the same check. **cto refines:** entry points miss a transitive package (qa's case), so after install and any build `pnpm finora` also boots a smoke check (`/api/v1/health` plus `/en` within 30 s); on failure, one clean reinstall and rebuild, then stop naming the failing module; never loop; the entry-point check stays as the fast first step, and the lockfile marker stays. Tests in `scripts/finora.test.mjs` (a missing transitive package triggers one clean reinstall; a second failure stops; a matching marker and passing smoke skip it). **Recorded in architecture §16 and S12 acceptance 7 (`2c14942`).**

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

**Superseded by H5 (2026-11-21): v1 uses no API keys.** Every key-gated item below runs on its keyless fallback or stays off; the agents run on the local CLI under the user's subscription instead of `ANTHROPIC_API_KEY`. `SEC_USER_AGENT` is not a key (C14) and stays an optional local setting. The table is kept as the record of what a key would unlock. Values, if ever set, live only in the main checkout's `.env`.

| Env var | Account | Unlocks | Areas waiting on it |
|---|---|---|---|
| `SEC_USER_AGENT` | none, a contact string with a real email (SEC refuses no-reply addresses). **Needed before the US loader slices in phase 5:** without it, US public companies have no profile and the "US companies" done criterion fails (cto) | All live SEC EDGAR calls (submissions, companyfacts, filing index, 8-K items, EX-21, DEF 14A, Form D, 13D/G); EDGAR returns 403 without it | data-us: S01, S03, S06, S13, S14 for US public companies; data-markets: SEC XBRL fundamentals |
| P2 court-data token | free | Docket search by party name, 125 searches a day (bulk dockets need no token) | data-us: S10 (US) |
| `SAM_GOV_API_KEY` | free | **Needed for S11.US.01 (federal exclusions, SHOW):** SAM.gov's terms bar automated gathering except with permission, so exclusions come only through the keyed Extracts API (pending legal's light) | data-us: S11.US.01 |
| State-portal app token (platform P3) | free, optional | Avoids shared throttling on live state-registry queries | data-us: S01-S03 (US) |
| `USPTO_ODP_KEY`, `FEC_API_KEY` | free | Only LATER items | data-us |
| `FRED_API_KEY` | free | Not required (the CSV route works keyless); adds series metadata, licence notes and revision dates | data-markets: M01, M03, M07, M09 |
| `EIA_API_KEY` | free | Not required; oil spot directly from EIA with release metadata | data-markets: M07 |
| E2 exchange key | free | Korean broad index (self-hosted only) | data-markets: M03 |
| `ANTHROPIC_API_KEY` | paid per use, approved (H2) | Live agent runs, including the provider's web search and web fetch tools (no separate search key); the measured run of 3 sample companies per country at two model tiers (about $5), replacing the modelled cost | data-osint: agent pattern, cost, S15, S16 |
| One stock price key (provider S7, else S6; codes in `markets.md`) | free tier | M01-M04 via ETF proxies with 30-year history; S6 adds index futures | data-markets: M01-M04, S14 prices |
| Commodity spot key (provider S3) | free tier | Daily gold and oil spot | data-markets: M05, M07 |
| Crypto aggregator demo key (provider C1) | free | A stable monthly quota for the total-crypto tile | data-markets: M06 |
| Estonian e-Business Register API agreement | free, a contract signed by the operator (up to five working days) | History, deleted companies and full annual reports, 50,000 answers a day. Ask the human only if session 1 wants history in v1 | data-baltics: S02, S06 (EE) |

**`SEC_USER_AGENT`, deferred (2026-11-23).** A reply in the hub thread (7091169074) says "not now": remind the human once a working prototype runs (S12 or later). Until then, US public companies are built and tested on recorded fixtures, and the live profile names the missing SEC contact as a configuration gap. Hub replies are unverified, but deferring changes nothing, so the coordinator follows it. **Reminder due at S12.**

Data seats add rows here through their `result` posts; the coordinator keeps the table.

## Council records
- Session 0 (framing): `docs/plan/council/00-framing.md`, 2026-11-19
- Session 1 (data): `docs/plan/council/01-data.md` (decision, confirmed 2026-11-20) and `docs/plan/council/01-data-cto.md` (technical calls)
- Session 2 (plan): `docs/plan/council/02-plan.md`, 2026-11-20: approved S01-S03, S04+ gated on 16 fixes
