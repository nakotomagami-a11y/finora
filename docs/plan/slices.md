# Slice plan

> **Status: draft (phase 3 input).** Read with `docs/architecture.md`. Data-dependent slices (loaders, report sections) get their exact field lists from `docs/plan/loaders/*.md` and `docs/plan/council/01-data.md`; UI slices get their screens and states from `DESIGN.md` and the frontend component inventory. Items waiting on those are marked **[pending]**.

## How slices work

- A slice is one vertical, demoable piece. It lands as **one commit** on the hub branch (more only if the guard or a review forces a split), with its tests.
- **Done means:** every acceptance criterion holds; `pnpm lint`, `pnpm typecheck`, `pnpm test` (and `pnpm e2e` once it exists) are green locally and in CI; qa has reviewed the commit with no open MUST-FIX; UI slices also have a web-qa pass with no open MUST-FIX; the demo step works for someone who only reads this file.
- **Order** is the numbering, except where "Depends on" allows parallel work. Data seats can build loaders (S06-S10) in parallel once S05 lands; frontend can build S04 in parallel with S03.
- **Owner** builds; **with** reviews the parts in their domain before qa.
- Every slice's tests use synthetic fixtures only (`fixtures/`), never downloaded data.

## Milestones

| Milestone | Slices | Council session 3 asks |
|---|---|---|
| **M1 Foundation** | S01-S05 | Can a contributor clone, run, test and add a loader without asking anyone? |
| **M2 Explorer with real data** | S06-S14 | Would we look a company up here instead of on the registry sites? What is missing per country? |
| **M3 Agentic search** | S15-S18 | Does an investigation earn its cost and time? Are the verdicts sourced, fair and useful? |
| **M4 Crash monitor and one command** | S19-S21 | Is this the app the maintainer opens every day? |
| **M5 Done** | S22 | Phase 6 exit criteria, signed off |

---

## M1 Foundation

### S01 Workspace and toolchain
- **Owner:** architect · **Depends on:** human answer H1 (licence)
- **Scope:** pnpm workspace (`apps/*`, `packages/*`), `packageManager` pinned, Node ≥ 24 in `engines`, `packages/tooling` (tsconfig base with `strict`, ESLint flat config with the import rules of architecture §2, Vitest preset), root scripts (`lint`, `typecheck`, `test`, `build`, `e2e`), `scripts/check-deps.mjs` with the dependency table, `pnpm-workspace.yaml` with `minimumReleaseAge` and `allowBuilds`, `.env.example`, `LICENSE`, `license` field in every `package.json`, `.data/` gitignored, `ci.yml` (steps 1-4 and 7 of architecture §14).
- **Acceptance:**
  1. A fresh clone runs `pnpm install && pnpm lint && pnpm typecheck && pnpm test` green on Windows and in CI on Linux.
  2. `check-deps` fails when a package declares a dependency its table row forbids (proved by a test that feeds it a bad manifest).
  3. ESLint fails on `any`, on `process.env` outside `env.ts`, and on a forbidden cross-package import (proved by lint fixtures).
  4. `ci.yml` runs on the hub PR alongside `guard`, both green.
- **Tests:** `check-deps` unit tests; lint-rule fixtures; one trivial package test proving Vitest runs.
- **Demo:** clone into a new folder, run the four commands, see them pass; open the hub PR's checks and see `ci` and `guard` green.

### S02 Next.js shell, server mount, locales
- **Owner:** architect · **with:** frontend · **Depends on:** S01
- **Scope:** `apps/web` (App Router, `[locale]` segment, `next-intl` with `en`, `lt`, `lv`, `et`), `packages/i18n` (catalogues, parity test, `Intl` helpers), `apps/server` (`handle`, `boot`, route-table generator and test, `env.ts`, host and origin guard, error-code helpers, `GET /api/v1/health`), the `api/[...path]` mount, `instrumentation.ts` calling `boot()`, tool manifests with two placeholder tools (explorer, crash) driving the top navigation, `pnpm dev` and `pnpm start` binding `127.0.0.1`, Playwright set up with a smoke test, `e2e` step added to CI.
- **Acceptance:**
  1. `pnpm dev` serves `/en`, `/lt`, `/lv`, `/et`; `/` redirects by `Accept-Language`; a locale switcher keeps the path.
  2. `GET /api/v1/health` returns `{ status: "ok", version, store: null }` and validates against its contract schema.
  3. A request with `Host: evil.example` gets `403 host_not_allowed`; a `POST` with a foreign `Origin` gets `403 forbidden` (pages and API).
  4. Adding a route file without regenerating the table fails a test.
  5. The i18n parity test fails when one locale misses a key or an ICU argument.
  6. Unknown env values fail boot with the variable's name.
- **Tests:** server unit tests (router, guard, env); i18n parity; Playwright smoke (each locale renders, nav from manifests, health endpoint, guard headers).
- **Demo:** `pnpm dev`, open `/lv`, switch to `/et`, click Crash monitor in the nav (placeholder page), `curl -H "Host: evil.example" 127.0.0.1:3000/api/v1/health` → 403.

### S03 Design system
- **Owner:** frontend · **with:** designer · **Depends on:** S02, `DESIGN.md`
- **Scope:** `packages/ui` tokens (CSS variables, dark and light), Tailwind v4 `@theme` mapping, fonts self-hosted, the primitives in the component inventory **[pending: inventory]**, the `/design` kitchen-sink page, Playwright visual baselines at 360/768/1280/1920 in both themes, axe checks, the visual step in CI.
- **Acceptance:**
  1. Every primitive renders on `/design` in every state DESIGN.md lists (default, hover, focus-visible, active, disabled, loading, error, empty where applicable).
  2. Keyboard: every interactive primitive is reachable and operable by keyboard, with a visible focus ring.
  3. axe reports no serious or critical violations on `/design`.
  4. Colour contrast of text tokens meets WCAG AA on both themes (asserted by a token test).
  5. Visual baselines committed; CI fails on an unreviewed diff.
- **Tests:** token contrast unit test; Playwright visual and axe on `/design`; keyboard e2e for Dialog, Tabs, Menu.
- **Demo:** open `/en/design`, tab through it, toggle the theme.

### S04 Domain model and store
- **Owner:** architect · **Depends on:** S01
- **Scope:** `packages/domain` (schema subset as data, value sets, statement and fact types, entity IDs, error codes, `display-policy.ts` skeleton, report section registry S01-S18), `packages/store` (`node:sqlite`, pragmas, migrations with `user_version`, repositories for sources, statements, facts, entities, FTS word and trigram indexes, links, judgements, suppressions, jobs), the `fixtures` dataset generator (synthetic companies in all four countries, people, relationships, facts).
- **Acceptance:**
  1. Migrations run from an empty file and are idempotent; a test runs every migration path.
  2. Inserting a statement with an unknown `sourceId` fails; with a full personal-code-shaped value fails (L7).
  3. Search finds "Šķūņu" by `skunu`, a trigram substring and a one-letter typo, ranked by a deterministic score; a person name returns no result (L3).
  4. A complete-load purge removes only that source's stale statements; a partial load purges nothing (L9).
  5. A suppression hides an entity's values from every repository read (L8).
  6. `entities` rows are rebuilt for exactly the entities a batch touched.
  7. Loading the fixtures dataset (≈ 2,000 entities) takes under 5 s on a laptop.
- **Tests:** store unit tests for each criterion; schema-subset test (every property is in the upstream FtM model or an allowed extension).
- **Demo:** `pnpm --filter @finora/cli finora data sync --profile fixtures`, then `finora search "example compa"` prints ranked companies from all four countries.

### S05 Loader framework and the first real loader
- **Owner:** architect (framework) + data-baltics (loader) · **Depends on:** S04, `docs/plan/loaders/` for the first source
- **Scope:** `packages/sources` (loader contract, licence registry with invariants, polite fetcher with host allowlists, rate limits, conditional requests, raw cache, policy filter, sync pipeline steps 1-8, sync reports), `apps/cli` commands `data sync`, `data status`, `doctor`; the first loader: the Latvian Enterprise Register company file **[pending: confirm it is the best first source]**.
- **Acceptance:**
  1. The licence-registry test fails for a source with `storage: "store"` and a share-alike, non-commercial or non-redistributable licence (L2).
  2. A loader emitting a property without a display-policy row fails its contract test; a `hide` property is dropped and counted (L5).
  3. Re-running a sync with an unchanged upstream file downloads nothing (conditional request or checksum) and writes nothing.
  4. The fetcher refuses a host not in the source's allowlist and a private IP address.
  5. `finora data sync lv-ur-register` loads the real file into `.data/finora.db`; `finora data status` shows rows, skips by reason, upstream date, duration.
  6. Interrupting a sync and running it again completes correctly.
- **Tests:** licence-registry invariants; fetcher unit tests (allowlist, private IPs, rate limit, retries); pipeline tests with a fake loader; the loader's contract test on its synthetic fixture; a `live` check for the source.
- **Demo:** `finora data sync lv-ur-register`, then `finora search` a Latvian company and see its registry code, status and address with source and licence.

**M1 demo (council session 3a):** clone → `pnpm install` → `pnpm test` green → `pnpm dev` shows the localised shell and `/design` → `finora data sync lv-ur-register` loads real Latvian companies → `finora search` finds one.

---

## M2 Explorer with real data

### S06-S10 Loaders
One slice per source group, each with the S05 acceptance criteria 2-6 for its sources, its contract tests and `live` check, and its display-matrix sections filled in the report DTO. **[pending: exact sources and fields from `docs/plan/loaders/*.md`]**

| Slice | Owner | Sources (expected) | Sections |
|---|---|---|---|
| S06 Latvia | data-baltics | Enterprise Register (companies, officers, members, insolvency, securing measures), annual-report financials, tax authority data | S01-S04, S06-S09 |
| S07 Estonia | data-baltics | e-Business Register open data (companies, persons, key figures, pledges), tax authority data and debtor list | S01-S04, S06-S09 |
| S08 Lithuania | data-baltics | JAR, tax authority datasets, social-insurance files | S01-S02, S06-S08 |
| S09 United States | data-us | SEC submissions, company facts (XBRL), insider and Form D data sets; selected state registries; federal court data | S01-S03, S06, S10, S13-S14 |
| S10 Cross-border | data-us (GLEIF), data-osint (sanctions) | GLEIF records and relationships; EU, UN, OFAC and UK sanctions lists | S01, S05, S11 |

- **Demo per slice:** `finora data sync <group>`, open a real company of that country in the CLI output, see the sections it fills with sources.

### S11 Entity resolution
- **Owner:** architect · **with:** data-us, data-baltics · **Depends on:** S04, S10
- **Scope:** `packages/resolve`: official-ID links (GLEIF ↔ registry codes, CIK ↔ LEI, VAT ↔ registry code), within-register person keys, name normalisation per country (legal forms, diacritics, transliteration), candidate scoring, judgements API used by agents and humans, sanctions screening on top of scoring.
- **Acceptance:**
  1. A company with an LEI in GLEIF and a code in its national register is one report with both sources' statements.
  2. Two different people with the same name in one register stay two people unless their register key matches.
  3. Candidate scoring ranks the right fixture company first for 95% of a 200-query synthetic benchmark (typos, legal-form variants, missing diacritics, transliterations), and the benchmark runs in CI.
  4. A human judgement survives a reload of every source.
  5. A sanctions candidate without an official-ID or human match is labelled "possible match, unconfirmed".
- **Tests:** unit tests per tier; the benchmark; judgement persistence.
- **Demo:** `finora resolve "example companu sia"` shows ranked candidates with scores and reasons.

### S12 API v1 (read) and report assembly
- **Owner:** architect · **Depends on:** S04, S11 (S06-S10 for real data)
- **Scope:** report assembly in `domain` (sections S01-S18 from statements and facts per the display policy, each value with `sources[]`, caveat keys, "not available in this country" vs "no data" vs "hidden by policy" states), routes `health`, `search`, `companies/:id`, `companies/:id/sections/:section`, `companies/:id/export`, `sources`; `api-contract` schemas; OpenAPI generation; render seam functions.
- **Acceptance:**
  1. Every route's response validates against its contract schema on the fixtures store (contract test per route).
  2. Every value in a report carries at least one source with licence and attribution (L1).
  3. A section the display policy marks `later` or `hide` is absent; `caveat` items carry their caveat key.
  4. Export contains no `redistribution: false` value and no suppressed entity (L2, L8).
  5. Unknown company → `404 entity_not_found`; a bad section ID → `400 invalid_section`.
  6. `docs/api/openapi.json` is current (test).
  7. p95 of `GET /companies/:id` under 150 ms on the `core` profile on a laptop.
- **Tests:** contract tests; report assembly unit tests per section state; export filters; a timing test on the fixtures store with a regression budget.
- **Demo:** `curl 127.0.0.1:3000/api/v1/search?q=...` then `curl .../companies/<id>`; open `docs/api/openapi.json` in any OpenAPI viewer.

### S13 MCP server
- **Owner:** architect · **Depends on:** S12
- **Scope:** `packages/agent-tools` (read tools of architecture §5.2, each with Zod input and output, sources in every result), `apps/mcp` (stdio binary `finora mcp`, Streamable HTTP handler mounted at `/mcp` behind the same guards).
- **Acceptance:**
  1. An MCP client lists exactly the six tools; the list is snapshot-tested; no person tool exists (L3).
  2. Each tool returns schema-valid output with `sources[]` on the fixtures store.
  3. Invalid input returns an MCP tool error with a machine code, not a crash.
  4. The HTTP endpoint refuses a foreign `Host` or `Origin`.
  5. A desktop MCP client configured with `finora mcp` can search and read a company (documented in `docs/mcp.md`).
- **Tests:** MCP contract tests over an in-memory transport; HTTP guard tests.
- **Demo:** add `finora mcp` to an MCP-capable desktop client, ask it to look up a fixture or real company, see cited answers.

### S14 Explorer UI
- **Owner:** frontend · **with:** designer, architect · **Depends on:** S03, S12
- **Scope:** search page (search-as-you-type, country filter, keyboard navigation, empty, loading, error and no-results states), company report page (server component, sections S01-S18 per policy, each with source chips and attribution, per-section "not available" / "no data" states, financial charts, officers and owners in company context only, links to the original record), sources page, `noindex` and title rules. **[pending: screens and states from DESIGN.md]**
- **Acceptance:**
  1. Every screen and state in DESIGN.md for search, report and sources is implemented and matches its mockup at the four viewports (visual tests).
  2. A report renders in under 1 s on the `core` profile (first contentful paint, local).
  3. Every value shows its source on hover or focus; CC BY sources show their attribution (L11).
  4. Report and investigation pages send `X-Robots-Tag: noindex`; the `<title>` holds only the company name (L4).
  5. All text is localised in four locales; numbers and dates follow the locale.
  6. axe clean; full keyboard path from search to a section.
- **Tests:** Playwright e2e (search → report → source chip → original link), visual, axe, header assertions.
- **Demo:** `pnpm dev`, search a real Latvian, Estonian, Lithuanian and US company, open each report, hover a value, follow its source link.

**M2 demo (council session 3b):** `pnpm finora` on the `core` profile; look up one real company per country; compare what the report shows with the display matrix; ask the same questions from an MCP client.

---

## M3 Agentic search

### S15 Agent runtime core
- **Owner:** architect (runtime integration) + data-osint (agent behaviour) · **Depends on:** S12, S13, `docs/plan/agents.md`
- **Scope:** `packages/agents`: investigation model and tables, orchestrator (plan → parallel specialists with dependencies → synthesis), `LlmProvider` with `fake` and `anthropic`, tool loop with parallel tool calls, `ask_human` park and resume, `record_finding` with citation verification, documents store, cost ledger with hold and settle, caps and reserves, restart recovery, event log; server routes for investigations, questions, stop, follow-ups and the SSE stream; job runner integration in `boot()`.
- **Acceptance (all with the `fake` provider):**
  1. Six specialists run concurrently; event order per run is preserved; the SSE stream replays from any `Last-Event-ID` with no gap or duplicate.
  2. A specialist that calls `ask_human` parks; its dependants wait; independent specialists finish; answering resumes it with the answer as the tool result; an unanswered question resolves to its default after the timeout and is marked so.
  3. A finding without a citation, or with a quote not present in its document, is rejected (L10).
  4. With a cap set so the third call would exceed it, no call exceeds it even with six parallel runs; the investigation ends `budget_exceeded` with its findings and a synthesis inside the reserve.
  5. Killing the server mid-investigation and starting it again resumes every unfinished run from its last persisted turn.
  6. An unknown model price refuses to start (`price_unknown`).
  7. Stop ends all runs within 5 s and keeps partial results.
- **Tests:** runtime tests per criterion with scripted transcripts; SSE resume test; crash-recovery test (child process killed); security-engineer review of tool and fetch paths.
- **Demo:** `FINORA_DEMO=1 pnpm dev`, `curl -X POST .../investigations` on a fixture company, watch `curl -N .../events` stream parallel runs, answer the question with `curl`, see the verdict event.

### S16 Agent tools and specialists
- **Owner:** data-osint · **with:** architect · **Depends on:** S15
- **Scope:** the specialist agents, prompts and tools in `docs/plan/agents.md` (registry and ownership, financials, legal and insolvency, sanctions and watchlists, web presence, news and reputation, people in company context, red flags), web search and fetch per that spec, synthesis into a verdict, follow-ups. **[pending: agents.md]**
- **Acceptance:** **[pending: agents.md]** at minimum:
  1. On five fixture scenarios (clean, tax debt, insolvency, sanctions candidate, ambiguous name) the recorded transcripts produce the expected rating per agent and overall.
  2. With a real key, on one real company per country, an investigation finishes within the default cap and time budget, every verdict sentence is cited, and the cost is recorded.
  3. No tool has a side effect outside the store; fetches refuse private addresses (security review).
- **Tests:** scenario replays; tool unit tests; a manual, recorded real run per country (costs logged, transcripts kept in `research/.cache/`, not committed).
- **Demo:** start a real investigation from a company report and watch it end in a cited verdict.

### S17 Investigation UI
- **Owner:** frontend · **with:** designer, data-osint · **Depends on:** S14, S15
- **Scope:** "Investigate" from a report and from free text; the live view (agent cards with status, current step, sources read, progress; overall progress and spend; skip to report); questions (highlighted card, options, dependent agents shown waiting); the report (verdict, per-agent ratings, key findings, advice, evidence grouped by agent with citation chips that open the quoted span, dig deeper and re-run); follow-up panel; library; stop; budget-exceeded and error states; reconnect after a dropped connection. **[pending: screens from DESIGN.md]**
- **Acceptance:**
  1. Every screen and state in DESIGN.md for investigations matches its mockup at four viewports.
  2. The live view reflects events within 500 ms of their emission; a page reload mid-run restores the same state.
  3. Answering a question from the UI resumes the waiting agents.
  4. Every verdict sentence shows citation chips; a chip opens the source with the quoted span highlighted.
  5. Keyboard and screen-reader users get status changes through an `aria-live` region without noise (one announcement per run status change).
- **Tests:** Playwright e2e on `FINORA_DEMO=1` (the full flow, reload mid-run, question, stop, budget exceeded), visual, axe.
- **Demo:** from a real company report press Investigate, answer the question, read the cited verdict, ask a follow-up.

### S18 Profile templates (if the council keeps them in v1)
- **Owner:** frontend · **with:** data-osint · **Depends on:** S17
- **Scope:** reusable investigation briefs (contractor, supplier, employer, investment) that preset which specialists run and what they emphasise. **[pending: council decision]**
- **Acceptance / tests / demo:** **[pending]**

**M3 demo (council session 3c):** investigate one real company per country end to end, live, with one question answered, and read the cited verdicts; show the spend per investigation.

---

## M4 Crash monitor and one command

### S19 Market connectors and maths
- **Owner:** data-markets · **with:** architect · **Depends on:** S04, `docs/research/markets.md`
- **Scope:** `packages/markets` connectors per markets.md, tile configuration M01-M09, peak and drawdown maths, refresh jobs, connector cache, `GET /api/v1/markets/crash`. **[pending: connectors]**
- **Acceptance:**
  1. The maths matches hand-computed results on synthetic series (peak, drawdown, value lost, carry-forward, currency conversion).
  2. Licensed series are only in `connector-cache.db` and never in exports or other users' responses (L2).
  3. A tile whose connector has no key returns a `needs_key` state, not an error.
  4. The endpoint responds in under 100 ms from cache.
- **Tests:** maths unit tests; connector contract tests on fixtures; `live` checks.
- **Demo:** `curl .../markets/crash` with and without keys.

### S20 Crash monitor UI
- **Owner:** frontend · **with:** designer, data-markets · **Depends on:** S03, S19
- **Scope:** the tile grid, live refresh, market-open state, needs-key state with setup instructions, sources and attribution. **[pending: screens]**
- **Acceptance:** screens and states match the mockups at four viewports; refresh every 60 s without layout shift; localised; axe clean.
- **Tests:** e2e on fixture series; visual; axe.
- **Demo:** open `/en/crash`, watch a tile update.

### S21 The one command and refresh scheduling
- **Owner:** architect · **Depends on:** S06-S10, S19
- **Scope:** `pnpm finora` and `pnpm finora --demo` (architecture §16), scheduled source refreshes per cadence and market refresh in `boot()`, the Settings page (keys status, data status, cost cap default), `README.md` quick start, `docs/running.md`.
- **Acceptance:**
  1. On a fresh clone on Windows and Linux, `pnpm finora` ends with the app on `127.0.0.1:3000` and real data for LV, EE, LT and US companies, without any manual step besides optional keys.
  2. `pnpm finora --demo` works offline in under 60 s.
  3. A second run is incremental: unchanged sources download nothing.
  4. Daily refresh jobs run while the app is open and show their reports on the Settings page.
- **Tests:** a CI job that runs `pnpm finora --demo` and checks the health endpoint; script unit tests.
- **Demo:** delete the clone, clone again, run `pnpm finora`, use the app.

**M4 demo (council session 3d):** a day of use: morning Crash monitor, two company look-ups, one investigation, all from `pnpm finora`.

---

## M5 Done

### S22 Hardening and sign-off
- **Owner:** architect · **with:** every seat · **Depends on:** all
- **Scope:** security-engineer full review and fixes; a qa-codebase sweep; performance on the `full` profile; visual and e2e coverage of every DESIGN.md state; docs pass (README, running, MCP, contributing); risk register in `docs/plan/prototype.md` closed or accepted.
- **Acceptance:** phase 6 exit criteria in `docs/plan/README.md`; no open MUST-FIX from any review; CI green on the hub PR.
- **Demo:** the demo script in `docs/plan/prototype.md`, run by the council.

---

## Who builds what

| Seat | Slices |
|---|---|
| architect | S01, S02, S04, S05 (framework), S11, S12, S13, S15 (runtime), S21, S22 |
| frontend | S03, S14, S17, S18, S20 |
| data-baltics | S05 (first loader), S06, S07, S08 |
| data-us | S09, S10 (GLEIF) |
| data-osint | S10 (sanctions), S15 (agent behaviour), S16 |
| data-markets | S19 |
| designer | reviews S03, S14, S17, S20 against DESIGN.md |
| qa | every slice |
| web-qa | S02, S03, S14, S17, S18, S20, S21 |
