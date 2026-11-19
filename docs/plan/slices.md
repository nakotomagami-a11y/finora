# Slice plan

> **Status: draft (phase 3 input).** Read with `docs/architecture.md`. Data-dependent slices (loaders, report sections) get their exact field lists from `docs/plan/loaders/*.md` and `docs/plan/council/01-data.md`; UI slices get their screens and states from `DESIGN.md` and the frontend component inventory. Items waiting on those are marked **[pending]**. Rule numbers `R1`-`R17` are the legal memo's product rules and `L1`-`L6` the extra rules in architecture §10.

## How slices work

- A slice is one vertical, demoable piece. It lands as **one commit** on the hub branch (more only if the guard or a review forces a split), with its tests.
- **Done means:** every acceptance criterion holds; `pnpm lint`, `pnpm typecheck`, `pnpm test` (and `pnpm e2e` once it exists) are green locally and in CI; qa has reviewed the commit with no open MUST-FIX; UI slices also have a web-qa pass with no open MUST-FIX; the demo step works for someone who only reads this file.
- **Tests are named.** Each slice lists its test files. A criterion with no test file next to it is not done.
- **Order** is the numbering, except where "Depends on" allows parallel work. Data seats build loaders (S06-S10) in parallel once S05 lands; frontend builds S03 in parallel with S04.
- **Owner** builds; **with** reviews the parts in their domain before qa.
- Fixtures are synthetic only (`fixtures/`, recipe in architecture §13). Never downloaded data.
- Paths below are relative to the package: `store/src/x.test.ts` means `packages/store/src/x.test.ts`; `web/e2e/x.spec.ts` means `apps/web/e2e/x.spec.ts`.

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
- **Owner:** architect · **Depends on:** nothing (licence decided: AGPL-3.0, `LICENSE` is committed)
- **Scope:** pnpm workspace (`apps/*`, `packages/*`); `packageManager` pinned; Node ≥ 24 in `engines`; `packages/tooling` (tsconfig base with `strict`, ESLint flat config with the import rules of architecture §2, Vitest preset); root scripts `lint`, `typecheck`, `test`, `build`, `e2e`; `scripts/check-deps.mjs` holding the dependency table; `pnpm-workspace.yaml` with `minimumReleaseAge` and `allowBuilds`; `.env.example`; `"license": "AGPL-3.0-or-later"` in every `package.json`; `.data/` gitignored; `ci.yml` (architecture §14 steps 1-3 and 7; later slices add their steps).
- **Acceptance:**
  1. A fresh clone runs `pnpm install && pnpm lint && pnpm typecheck && pnpm test` green on Windows and on Linux CI.
  2. `check-deps` fails when a package declares a dependency its table row forbids.
  3. ESLint fails on `any`, on `process.env` outside `env.ts`, on a Node built-in imported in `packages/domain`, and on a forbidden cross-package import.
  4. `ci` runs on the hub PR beside `guard`; both green.
- **Tests:** `scripts/check-deps.test.mjs` (good and bad manifests); `packages/tooling/eslint/rules.test.ts` (lint fixtures that must fail and pass); `packages/tooling/src/smoke.test.ts`.
- **Demo:** clone into a new folder, run the four commands, see them pass; open the hub PR checks and see `ci` and `guard` green.

### S02 Next.js shell, server mount, locales
- **Owner:** architect · **with:** frontend · **Depends on:** S01
- **Scope:** `apps/web` (App Router, `[locale]` segment, `next-intl` with `en`, `lt`, `lv`, `et`); `packages/i18n` (catalogues, parity test, `Intl` helpers); `apps/server` (`handle`, `boot`, route-table generator, `env.ts`, host and origin guard, security headers and CSP, error-code helpers, `GET /api/v1/health`); the `api/[...path]` mount; `instrumentation.ts` calling `boot()`; tool manifests with two placeholder tools (explorer, crash) driving the top navigation; `pnpm dev` and `pnpm start` bound to `127.0.0.1`; Playwright with a smoke test; `scripts/check-bundle-secrets.mjs`; CI steps 4 and 5.
- **Acceptance:**
  1. `/en`, `/lt`, `/lv`, `/et` render; `/` redirects by `Accept-Language`; the locale switcher keeps the path.
  2. `GET /api/v1/health` returns `{ status: "ok", version, store: null }` and validates against its contract schema.
  3. `Host: evil.example` gets `403 host_not_allowed`; a `POST` with a foreign `Origin` gets `403 forbidden`, on pages and API.
  4. A route file added without regenerating the table fails a test.
  5. The parity test fails when a locale misses a key or an ICU argument.
  6. An invalid env value fails boot naming the variable.
  7. A build with sentinel keys has no sentinel in any client chunk; a planted `NEXT_PUBLIC_` leak in a test fixture is caught.
  8. Responses carry CSP, `X-Content-Type-Options`, `Referrer-Policy` and `frame-ancestors 'none'`.
- **Tests:** `server/src/router.test.ts`, `server/src/route-table.test.ts`, `server/src/guard.test.ts`, `server/src/env.test.ts`, `server/src/routes/v1/health/route.contract.test.ts`, `i18n/src/parity.test.ts`, `scripts/check-bundle-secrets.test.mjs`, `web/e2e/smoke.spec.ts`, `web/e2e/security-headers.spec.ts`.
- **Demo:** `pnpm dev`, open `/lv`, switch to `/et`, click Crash monitor in the nav (placeholder), then `curl -H "Host: evil.example" http://127.0.0.1:3000/api/v1/health` → 403.

### S03 Design system
- **Owner:** frontend · **with:** designer · **Depends on:** S02, `DESIGN.md`
- **Scope:** `packages/ui` tokens (CSS variables, dark and light), Tailwind v4 `@theme`, self-hosted fonts, the primitives in the component inventory **[pending: inventory]** including `SourceChip`, `AiLabel` and `PersonDisclaimer`; the `/design` kitchen sink; visual baselines at 390×844, 768×1024, 1280×800 and 1920×1080 in both themes; axe checks; CI step 6.
- **Acceptance:**
  1. Every primitive renders on `/design` in every state DESIGN.md lists (default, hover, focus-visible, active, disabled, loading, error, empty where applicable).
  2. Every interactive primitive is keyboard-reachable and operable, with a visible focus ring.
  3. axe: no serious or critical violations on `/design`.
  4. Text tokens meet WCAG AA contrast in both themes.
  5. Visual baselines committed; CI fails on an unreviewed diff.
- **Tests:** `ui/src/tokens.contrast.test.ts`, `web/e2e/design.visual.spec.ts`, `web/e2e/design.a11y.spec.ts`, `web/e2e/design.keyboard.spec.ts`.
- **Demo:** open `/en/design`, tab through it, toggle the theme.

### S04 Domain model, store and fixtures
- **Owner:** architect · **Depends on:** S01
- **Scope:** `packages/domain` (schema subset as data, value sets, `Statement`, `Fact`, `SourcedValue`, entity IDs, error codes, purposes, `display-policy.ts` skeleton, `isNaturalPerson`, the section registry S01-S18); `packages/store` (`node:sqlite`, pragmas, migrations, repositories for sources, statements, facts, entities, word and trigram FTS, links, judgements, suppressions, disputes, purpose log, jobs; `readPurposeSection`; retention job); `fixtures/` generator and `fixtures/README.md` (architecture §13); `apps/cli` (root script `pnpm finora-cli`) with `data sync --profile fixtures`, `search` and `show`.
- **Acceptance:**
  1. Migrations run from an empty file, are idempotent, and every migration path is tested.
  2. A statement with an unknown `sourceId` is refused (R3); a value shaped like a full personal code is refused (L4).
  3. Search finds a fixture name with diacritics by its plain-ASCII form, by a substring and with a one-letter typo, ranked by a deterministic score; a person's name returns no person result (L2).
  4. A complete-load purge removes only that source's stale statements; a partial load purges nothing (L6).
  5. A suppression or an open dispute hides the affected values from every repository read (L5, R10).
  6. `readPurposeSection` without a purpose fails; with one it writes a `purpose_log` row before returning (R2).
  7. The retention job deletes `personal` statements older than the TTL and nothing else (R11).
  8. `isNaturalPerson` is true for sole-trader legal forms in all four countries (R5).
  9. `pnpm fixtures:gen` is deterministic (same seed → byte-identical output); loading the fixtures (≈ 2,000 entities) takes under 5 s.
- **Tests:** `store/src/migrations.test.ts`, `store/src/statements.test.ts`, `store/src/personal-codes.test.ts`, `store/src/search.test.ts`, `store/src/purge.test.ts`, `store/src/suppressions.test.ts`, `store/src/disputes.test.ts`, `store/src/purpose.test.ts`, `store/src/retention.test.ts`, `domain/src/policy/persons.test.ts`, `domain/src/schema/ftm-subset.test.ts`, `fixtures/gen.test.ts`.
- **Demo:** `pnpm finora-cli data sync --profile fixtures`, then `pnpm finora-cli search "example compa"` prints ranked companies from all four countries.

### S05 Loader framework and the first real loader
- **Owner:** architect (framework) + data-baltics (loader) · **Depends on:** S04, the first source's spec in `docs/plan/loaders/`
- **Scope:** `packages/sources` (loader contract, licence registry and invariants, polite fetcher with host allowlists, rate limits, conditional requests, private-address refusal, raw cache, policy filter, sync pipeline steps 1-8, sync reports); CLI `data sync <source>`, `data status`, `doctor`; the first loader: the Latvian Enterprise Register company file **[pending: data-baltics confirms the best first source]**.
- **Acceptance:**
  1. A source with `storage: "store"` and a share-alike, non-commercial or non-redistributable licence fails the licence test (R12, R13).
  2. A loader emitting a property with no display-policy row fails `policy-coverage`; a `hide` property is dropped and counted (L1).
  3. A rerun against an unchanged upstream downloads and writes nothing.
  4. The fetcher refuses hosts outside the allowlist and private addresses, and keeps each source's rate limit (R14).
  5. `data sync lv-ur-register` loads the real file into `.data/finora.db`; `data status` shows rows, skips by reason, upstream date and duration.
  6. Interrupting a sync and running it again completes correctly.
- **Tests:** `sources/src/licences.test.ts`, `sources/src/policy-coverage.test.ts`, `sources/src/fetcher.test.ts`, `sources/src/pipeline.test.ts`, `sources/src/lv/lv-ur-register.test.ts` (contract, on its synthetic fixture), `sources/src/lv/lv-ur-register.live.test.ts` (nightly only).
- **Demo:** `pnpm finora-cli data sync lv-ur-register`, then `pnpm finora-cli search` a Latvian company and see its registry code, status and address, each with source and licence.

**M1 demo (council session 3a):** clone → `pnpm install` → `pnpm test` green → `pnpm dev` shows the localised shell and `/design` → `data sync lv-ur-register` loads real Latvian companies → `search` finds one.

---

## M2 Explorer with real data

### S06-S10 Loaders
One slice per source group. Each slice meets S05's criteria 2-6 for its sources, adds a contract test (`sources/src/<cc>/<source-id>.test.ts`) and a nightly live check (`<source-id>.live.test.ts`) per source, adds its layout writer to the fixture generator, and fills its display-matrix sections in the report DTO. **[pending: exact sources and fields from `docs/plan/loaders/*.md`]**

| Slice | Owner | Sources (expected) | Sections | Rule tests it must add |
|---|---|---|---|---|
| S06 Latvia | data-baltics | Enterprise Register (companies, officers, members, insolvency, securing measures), annual-report financials, tax authority data | S01-S04, S06-S09 | `sources/src/lv/policy.test.ts` (R1: natural-person shareholders not stored) |
| S07 Estonia | data-baltics | e-Business Register open data (companies, persons, key figures, pledges), tax authority data and debtor list | S01-S04, S06-S09 | `sources/src/ee/policy.test.ts` (beneficial owners per council decision) |
| S08 Lithuania | data-baltics | JAR, tax authority datasets, social-insurance files | S01-S02, S06-S08 | `sources/src/lt/policy.test.ts` |
| S09 United States | data-us | SEC submissions, company facts (XBRL), insider and Form D data sets; selected state registries; federal court data | S01-S03, S06, S10, S13-S14 | `sources/src/us/sec-user-agent.test.ts` (R14) |
| S10 Cross-border | data-us (GLEIF), data-osint (sanctions) | GLEIF records and relationships; official EU and US sanctions lists (others per council) | S01, S05, S11 | `sources/src/licences.test.ts` row for each list (R12) |

- **Demo per slice:** `pnpm finora-cli data sync <group>`, then `pnpm finora-cli show <id>` for a real company of that country, listing the sections it fills with their sources.

### S11 Entity resolution and sanctions screening
- **Owner:** architect · **with:** data-us, data-baltics, data-osint · **Depends on:** S04, S10
- **Scope:** `packages/resolve`: official-ID links (GLEIF ↔ registry codes, CIK ↔ LEI, VAT ↔ registry code); within-register person keys; name normalisation per country (legal forms, diacritics, transliteration); candidate scoring; judgements used by agents and humans; sanctions screening on top of scoring; CLI `resolve`.
- **Acceptance:**
  1. A company with an LEI in GLEIF and a code in its national register shows as one report with both sources' statements.
  2. Two people with the same name in one register stay two unless their register key matches.
  3. Candidate scoring ranks the right fixture company first for ≥ 95% of a 200-query synthetic benchmark (typos, legal-form variants, missing diacritics, transliteration).
  4. A human judgement survives a reload of every source.
  5. A sanctions candidate without an official-ID match to a primary list entry is `possible_match` ("possible match, needs review"); only an ID match is `listed` (R8).
- **Tests:** `resolve/src/links.test.ts`, `resolve/src/persons.test.ts`, `resolve/src/normalise.test.ts`, `resolve/src/benchmark.test.ts`, `resolve/src/judgements.test.ts`, `resolve/src/sanctions.test.ts`.
- **Demo:** `pnpm finora-cli resolve "example companu sia"` shows ranked candidates with scores and reasons.

### S12 API v1 (read), report assembly, disputes
- **Owner:** architect · **Depends on:** S04, S11 (S06-S10 for real data)
- **Scope:** report assembly in `domain` (sections S01-S18 per display policy, `SourcedValue` everywhere, caveat keys, the states "not available in this country", "no data", "hidden by policy", "needs a purpose", `containsPersonalData`); routes `health`, `search`, `companies/:id`, `companies/:id/sections/:section`, `companies/:id/export`, `sources`, `disputes`; `api-contract` schemas; OpenAPI generation; render-seam read functions.
- **Acceptance:**
  1. Every route's response validates against its contract schema on the fixtures store.
  2. Every value carries ≥ 1 `SourceRef` with source name, licence, retrieval date and access tier (R3).
  3. `later` and `hide` items are absent; `caveat` items carry their caveat key.
  4. S03, S04 and S17 without `purpose` → `428 purpose_required`; with it → data, and a `purpose_log` row (R2).
  5. Sole-trader companies get no S18 (R5); every report DTO with personal data has `containsPersonalData: true` (R6 input).
  6. Export holds no `redistribution: false` value, no `personal` value and no suppressed entity (R4, L5).
  7. `POST /disputes` stores the dispute and the disputed values disappear from the next read (R10).
  8. No route path contains a person segment (L2).
  9. `docs/api/openapi.json` is current.
  10. p95 of `GET /companies/:id` under 150 ms on the `core` profile on a laptop.
- **Tests:** `domain/src/report/assemble.test.ts`, `domain/src/export/export.test.ts`, `server/src/routes/v1/**/route.contract.test.ts` (one per route), `server/src/routes/v1/companies/[id]/sections/[section]/route.contract.test.ts` (R2 cases), `server/src/routes/v1/disputes/route.contract.test.ts`, `server/src/route-table.test.ts` (L2 assertion), `api-contract/src/openapi.test.ts`, `server/src/perf/report.perf.test.ts`.
- **Demo:** `curl "http://127.0.0.1:3000/api/v1/search?q=example"`, then `curl .../companies/<id>`, then `curl .../companies/<id>/sections/S03` (428) and again with `?purpose=business_partner_check`.

### S13 MCP server
- **Owner:** architect · **Depends on:** S12
- **Scope:** `packages/agent-tools` (the read tools of architecture §5.2, Zod input and output, `sources` in every result, `purpose` input on person sections); `apps/mcp` (stdio `finora mcp`, Streamable HTTP at `/mcp` behind the same guards); `docs/mcp.md`.
- **Acceptance:**
  1. An MCP client lists exactly the six tools (snapshot); none returns persons outside a company (L2, R4).
  2. Each tool returns schema-valid output with `sources` on the fixtures store (R3).
  3. Person sections without `purpose` return a tool error `purpose_required`; with it, a `purpose_log` row with surface `mcp` (R2).
  4. Invalid input returns a tool error with a machine code, never a crash.
  5. The HTTP transport refuses a foreign `Host` or `Origin`.
  6. A desktop MCP client configured per `docs/mcp.md` can search and read a company.
- **Tests:** `mcp/src/tools.contract.test.ts`, `mcp/src/purpose.test.ts`, `mcp/src/errors.test.ts`, `mcp/src/http-guard.test.ts`.
- **Demo:** add `finora mcp` to an MCP-capable desktop client, ask it to look up a company, see cited answers.

### S14 Explorer UI
- **Owner:** frontend · **with:** designer, architect · **Depends on:** S03, S12
- **Scope:** search page (search-as-you-type, country filter, keyboard navigation; empty, loading, error and no-results states); company report (server component, sections S01-S18 per policy with source chips and attribution, per-section states, purpose prompt for person sections showing the chosen purpose, "Report a problem" on every section, `PersonDisclaimer` when personal data shows, financial charts, officers and owners in company context only, links to the original record); sources page; `noindex` and title rules. **[pending: screens and states from DESIGN.md]**
- **Acceptance:**
  1. Every DESIGN.md screen and state for search, report and sources matches its mockup at the four viewports.
  2. A report's first contentful paint is under 1 s on the `core` profile, locally.
  3. Every value shows its source, licence and attribution on hover or focus; the Sources page lists every source's licence and attribution (R16).
  4. Person sections ask for a purpose before showing data, and show the purpose afterwards (R2).
  5. Every page showing a natural person shows the disclaimer (R6).
  6. Every section has "Report a problem" (R10).
  7. Report and investigation pages send `X-Robots-Tag: noindex`; the `<title>` holds only the company name (L3).
  8. All text localised in four locales; numbers and dates follow the locale; axe clean; full keyboard path from search to a section.
- **Tests:** `web/e2e/search.spec.ts`, `web/e2e/report-sources.spec.ts`, `web/e2e/sources-page.spec.ts`, `web/e2e/people-purpose.spec.ts`, `web/e2e/disclaimer.spec.ts`, `web/e2e/dispute.spec.ts`, `web/e2e/seo-headers.spec.ts`, `web/e2e/explorer.visual.spec.ts`, `web/e2e/explorer.a11y.spec.ts`.
- **Demo:** `pnpm dev`, search a real Latvian, Estonian, Lithuanian and US company, open each report, hover a value, open the people section with a purpose, follow a source link.

**M2 demo (council session 3b):** `pnpm finora` on the `core` profile; look up one real company per country; compare the report with the display matrix; ask the same questions from an MCP client.

---

## M3 Agentic search

### S15 Agent runtime core
- **Owner:** architect (runtime integration) + data-osint (agent behaviour) · **Depends on:** S12, S13, `docs/plan/agents.md`
- **Scope:** `packages/agents`: investigation tables, orchestrator (plan → parallel specialists with dependencies → synthesis), `LlmProvider` (`fake`, `anthropic`), tool loop with parallel tool calls, `ask_human` park and resume, `record_finding` with citation verification, documents store, cost ledger (hold and settle), caps and reserves, timeouts, retries and stop (architecture §7.6a), restart recovery, event log; server routes for investigations, questions, stop, follow-ups and SSE; job runner in `boot()`.
- **Acceptance (all with the `fake` provider):**
  1. Six specialists run concurrently; per-run event order holds; SSE replays from any `Last-Event-ID` with no gap or duplicate.
  2. `ask_human` parks a run; dependants wait; independent runs finish; an answer resumes it as the tool result; an unanswered question resolves to its default after the timeout and is marked so.
  3. A finding without a citation, or with a quote absent from its document, is rejected (R7).
  4. With a cap that the third call would cross, no call crosses it even with six parallel runs; the investigation ends `budget_exceeded` with its findings and a synthesis inside the reserve.
  5. Retryable errors retry up to 3 times with backoff; non-retryable errors fail only their run with a machine code; tool errors go back to the model; per-call, per-run and per-investigation timeouts fire as specified.
  6. Stop aborts every in-flight call within 5 s and keeps partial results.
  7. Killing the server mid-investigation and restarting resumes every unfinished run from its last persisted turn.
  8. An unknown model price refuses to start (`price_unknown`).
  9. A natural-person or sole-trader subject is refused with `subject_is_natural_person` (R5).
  10. Every finding, verdict and follow-up DTO carries `generatedBy: "ai"` (R9).
  11. `POST /investigations/estimate` returns low, typical and high USD with its basis (`defaults` until 10 investigations have settled, then `history`) (H2).
- **Tests:** `agents/src/orchestrator.parallel.test.ts`, `agents/src/questions.test.ts`, `agents/src/citations.test.ts`, `agents/src/budget.test.ts`, `agents/src/runner.retry.test.ts`, `agents/src/runner.errors.test.ts`, `agents/src/runner.timeout.test.ts`, `agents/src/tools.errors.test.ts`, `agents/src/orchestrator.timeout.test.ts`, `agents/src/orchestrator.stop.test.ts`, `agents/src/recovery.test.ts` (kills a child process), `agents/src/orchestrator.subject.test.ts`, `agents/src/estimate.test.ts`, `server/src/routes/v1/investigations/**/route.contract.test.ts`, `server/src/sse.resume.test.ts`, `api-contract/src/investigations.test.ts`; a security-engineer review of tool and fetch paths.
- **Demo:** `FINORA_DEMO=1 pnpm dev`; `curl -X POST .../api/v1/investigations` on a fixture company; `curl -N .../events` streams parallel runs; answer the question with `curl`; see the `verdict` event.

### S16 Agent tools and specialists
- **Owner:** data-osint · **with:** architect · **Depends on:** S15
- **Scope:** the specialists, prompts and tools of `docs/plan/agents.md` (registry and ownership, financials, legal and insolvency, sanctions and watchlists, web presence, news and reputation, people in company context, red flags); web search and fetch per that spec; synthesis; follow-ups. **[pending: agents.md]**
- **Acceptance:** **[pending: agents.md]**, at minimum:
  1. Five fixture scenarios (clean, tax debt, insolvency, sanctions candidate, ambiguous name) produce the expected rating per agent and overall from their recorded transcripts.
  2. With a real key, one real company per country finishes inside the default cap and time budget, every verdict sentence is cited, and the cost is recorded.
  3. No tool has a side effect outside the store; fetches refuse private addresses.
- **Tests:** `agents/src/scenarios.test.ts` (replays `fixtures/agents/*.json`), `agent-tools/src/**/*.test.ts`, `agent-tools/src/web-fetch.ssrf.test.ts`; a manual recorded real run per country (costs logged; transcripts in `research/.cache/`, never committed).
- **Demo:** start a real investigation from a company report and watch it end in a cited verdict.

### S17 Investigation UI
- **Owner:** frontend · **with:** designer, data-osint · **Depends on:** S14, S15
- **Scope:** "Investigate" from a report and from free text (with a stated purpose, the cost estimate and the cap shown before Start); the live view (agent cards with status, current step, sources read, progress; overall progress and spend; skip to report); questions (highlighted card, options, dependants shown waiting); the report (verdict, per-agent ratings, key findings, advice, evidence by agent with citation chips that open the quoted span, dig deeper, re-run, `AiLabel` on all AI text); follow-up panel; library; stop; budget-exceeded, error and reconnect states. **[pending: screens from DESIGN.md]**
- **Acceptance:**
  1. Every DESIGN.md screen and state for investigations matches its mockup at four viewports (empty, loading, streaming, partial, error, question, report).
  2. Events show within 500 ms of emission; a reload mid-run restores the same state.
  3. Answering a question in the UI resumes the waiting agents.
  4. Every verdict sentence has citation chips; a chip opens the source with the quoted span highlighted; a sentence without a citation is not rendered (R7).
  5. All AI-written text carries the AI label (R9).
  6. Status changes reach screen readers through one `aria-live` announcement per run status change.
- **Tests:** `web/e2e/investigation.flow.spec.ts` (full flow on `FINORA_DEMO=1`), `web/e2e/investigation.reload.spec.ts`, `web/e2e/investigation.question.spec.ts`, `web/e2e/investigation.stop.spec.ts`, `web/e2e/investigation.budget.spec.ts`, `web/e2e/ai-label.spec.ts`, `web/src/components/verdict-text.test.tsx`, `web/e2e/investigation.visual.spec.ts`, `web/e2e/investigation.a11y.spec.ts`.
- **Demo:** from a real company report press Investigate, answer the question, read the cited verdict, ask a follow-up.

### S18 Profile templates (if the council keeps them in v1)
- **Owner:** frontend · **with:** data-osint · **Depends on:** S17
- **Scope:** reusable investigation briefs (contractor, supplier, employer, investment) that preset specialists and emphasis. **[pending: council decision; acceptance, tests and demo follow it]**

**M3 demo (council session 3c):** investigate one real company per country end to end, live, answer one question, read the cited verdicts, show the spend per investigation.

---

## M4 Crash monitor and one command

### S19 Market connectors and maths
- **Owner:** data-markets · **with:** architect · **Depends on:** S04, `docs/research/markets.md`
- **Scope:** `packages/markets` connectors per markets.md, tile configuration M01-M09, peak and drawdown maths, refresh jobs, connector cache, `GET /api/v1/markets/crash`. **[pending: connectors]**
- **Acceptance:**
  1. The maths matches hand-computed results on synthetic series (peak, drawdown, value lost, carry-forward, currency conversion).
  2. Licensed series live only in `connector-cache.db`, never in exports (R17).
  3. A tile whose connector has no key returns `needs_key`, not an error.
  4. The endpoint answers in under 100 ms from cache.
- **Tests:** `markets/src/calc.test.ts`, `markets/src/connectors.test.ts`, `markets/src/<connector>.live.test.ts` (nightly), `server/src/routes/v1/markets/crash/route.contract.test.ts`.
- **Demo:** `curl http://127.0.0.1:3000/api/v1/markets/crash` with and without keys.

### S20 Crash monitor UI
- **Owner:** frontend · **with:** designer, data-markets · **Depends on:** S03, S19
- **Scope:** tile grid, live refresh, market-open state, needs-key state with setup steps, sources and attribution. **[pending: screens]**
- **Acceptance:** screens and states match the mockups at four viewports; refresh every 60 s without layout shift; localised; axe clean.
- **Tests:** `web/e2e/crash.spec.ts`, `web/e2e/crash.visual.spec.ts`, `web/e2e/crash.a11y.spec.ts`.
- **Demo:** open `/en/crash`, watch a tile update.

### S21 The one command and refresh scheduling
- **Owner:** architect · **Depends on:** S06-S10, S19
- **Scope:** `pnpm finora` and `pnpm finora --demo` (architecture §16); scheduled source refreshes per cadence, market refresh and the retention job in `boot()`; the Settings page (key status, data status, default cost cap); README quick start; `docs/running.md`.
- **Acceptance:**
  1. On a fresh clone on Windows and Linux, `pnpm finora` ends with the app on `127.0.0.1:3000` and real data for LV, EE, LT and US companies, with no manual step besides optional keys.
  2. `pnpm finora --demo` works offline in under 60 s.
  3. A second run is incremental: unchanged sources download nothing.
  4. Refresh and retention jobs run while the app is open and show their reports on the Settings page.
- **Tests:** `scripts/finora.test.mjs`; CI job `demo-boot` runs `pnpm finora --demo` and checks `/api/v1/health`; `server/src/jobs.test.ts`; `web/e2e/settings.spec.ts`.
- **Demo:** delete the clone, clone again, run `pnpm finora`, use the app.

**M4 demo (council session 3d):** a day of use: morning Crash monitor, two company look-ups, one investigation, all from `pnpm finora`.

---

## M5 Done

### S22 Hardening and sign-off
- **Owner:** architect · **with:** every seat · **Depends on:** all
- **Scope:** security-engineer full review and fixes; a qa-codebase sweep; performance on the `full` profile; e2e and visual coverage of every DESIGN.md state; docs pass (README, running, MCP, contributing); the risk register in `docs/plan/prototype.md` closed or accepted.
- **Acceptance:** phase 6 exit criteria in `docs/plan/README.md`; no open MUST-FIX from any review; CI green on the hub PR.
- **Tests:** everything above, green in CI.
- **Demo:** the demo script in `docs/plan/prototype.md`, run by the council.

---

## Legal rule coverage

Every rule has a slice that builds its enforcement point and a named test (architecture §10).

| Rule | Slice | Test file |
|---|---|---|
| R1 | S06 | `sources/src/lv/policy.test.ts` |
| R2 | S04, S12, S13, S14 | `store/src/purpose.test.ts`, sections route contract test, `mcp/src/purpose.test.ts`, `web/e2e/people-purpose.spec.ts` |
| R3 | S04, S12, S13 | `store/src/statements.test.ts`, `domain/src/report/assemble.test.ts`, route and MCP contract tests |
| R4 | S12, S13 | `domain/src/export/export.test.ts`, `mcp/src/tools.contract.test.ts` |
| R5 | S04, S12, S15 | `domain/src/policy/persons.test.ts`, `agents/src/orchestrator.subject.test.ts` |
| R6 | S03, S14 | `web/e2e/disclaimer.spec.ts` |
| R7 | S15, S17 | `agents/src/citations.test.ts`, `web/src/components/verdict-text.test.tsx` |
| R8 | S11 | `resolve/src/sanctions.test.ts` |
| R9 | S15, S17 | `api-contract/src/investigations.test.ts`, `web/e2e/ai-label.spec.ts` |
| R10 | S04, S12, S14 | `store/src/disputes.test.ts`, disputes route contract test, `web/e2e/dispute.spec.ts` |
| R11 | S04, S21 | `store/src/retention.test.ts`, `server/src/jobs.test.ts` |
| R12, R13 | S05, S10 | `sources/src/licences.test.ts` |
| R14 | S05, S09 | `sources/src/fetcher.test.ts`, `server/src/env.test.ts`, `sources/src/us/sec-user-agent.test.ts` |
| R15 | none in v1 (no maps) | lands with any map slice |
| R16 | S14 | `web/e2e/report-sources.spec.ts`, `web/e2e/sources-page.spec.ts` |
| R17 | S19 | `markets/src/connectors.test.ts` |
| L1 | S05 | `sources/src/pipeline.test.ts` |
| L2 | S04, S12, S13 | `store/src/search.test.ts`, `server/src/route-table.test.ts`, `mcp/src/tools.contract.test.ts` |
| L3 | S14 | `web/e2e/seo-headers.spec.ts` |
| L4 | S04 | `store/src/personal-codes.test.ts` |
| L5 | S04, S12 | `store/src/suppressions.test.ts`, `domain/src/export/export.test.ts` |
| L6 | S04, S05 | `store/src/purge.test.ts`, `sources/src/pipeline.test.ts` |

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
