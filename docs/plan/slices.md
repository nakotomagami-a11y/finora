# Slice plan

> **Status: phase 3, milestone B.** Read with `docs/architecture.md` (the contract), `docs/plan/agents.md` (agent behaviour), `docs/plan/ui-build-plan.md` (UI components and states), the loader specs in `docs/plan/loaders/`, and `docs/plan/council/01-data.md` (the calls). Rule numbers: `R1`-`R18` legal, `P1`-`P14` council policy, `L1`-`L6` other, `PS2`-`PS7` the person-row conditions (architecture §3.3, §10).

## How slices work

- A slice is one vertical, demoable piece. It lands as **one commit** on the hub branch (more only if the guard or a review forces a split), with its tests.
- **Done means:** every acceptance criterion holds; `pnpm lint`, `pnpm typecheck`, `pnpm test` and (from S02) `pnpm e2e` are green locally and in CI; qa has reviewed the commit range with no open MUST-FIX; UI slices also have a web-qa pass with no open MUST-FIX; the security-engineer review has no open finding on the slices marked **security**; the demo step works for someone who only reads this file; and the tree holds no outside company (H4): `node scripts/guard/guard.mjs tree` is clean at the slice's head, and `scripts/check-outside-names.mjs` over the slice's range has 0 unresolved hits (until that script lands, qa's manual sweep of hostnames, organisation names, tickers and real-shaped ids), recorded by qa as one counts-only line in the slice's review record.
- **Tests are named.** Each slice lists its test files (package-relative: `store/src/x.test.ts` is `packages/store/src/x.test.ts`; `web/e2e/x.spec.ts` is `apps/web/e2e/x.spec.ts`; `server/` and `mcp/` are under `apps/`). A criterion with no test next to it is not done.
- **Loader slices** implement their specs in `docs/plan/loaders/` exactly; the spec's Tests and Size-and-time sections are part of the slice's acceptance. Each reports records per source, bytes per record, statements, facts and events, and its P10 budget share in `docs/plan/benchmarks.md`.
- **Every SHOW and CAVEAT item** in Part G is mapped to a data slice, a UI slice and an acceptance test in the appendix. Every HIDE item has negative tests on every surface (architecture §10.4), built in S04 and extended by each loader slice's fixtures.
- **Order:** the council's walking skeleton. Latvia goes end to end (search → official profile → agents → sourced verdict) from one command (M2) before a second country's loaders are built (M3). Specs for every country exist already; building them waits.
- **Owner** builds; **with** reviews the parts in their domain before qa.
- Fixtures are synthetic only (architecture §13).

## Milestones

| Milestone | Slices | Council session 3 asks | Gate |
|---|---|---|---|
| **M1 Foundation** | S01-S04u | Can a contributor clone, run, test and add a loader without asking anyone? | CI green; the fixture world loads; the UI builds against contracts |
| **M2 Walking skeleton: Latvia end to end** | S05-S12 | Would we check a Latvian counterparty here instead of on the registry site? Does an investigation earn its cost? | `scripts/milestone-gate.mjs` on the LV regression set: 0 wrong-company findings, 100% cited claims, fill rate within 10 points |
| **M3 Every country** | S13-S21 | What is missing per country? Is the US promise honest? | milestone gate on all four countries; the CEO's US-private test (council Part A) |
| **M4 Crash monitor and the daily app** | S22-S25 | Is this the app the maintainer opens every day? | milestone gate; a day-of-use demo |
| **M5 Done** | S26 | Phase 6 exit criteria, signed off | everything above |

## Who builds what

One owner per slice (council session 2, item 14); **with** seats review.

| Seat | Slices |
|---|---|
| architect | S01, S02, S04a, S04i, S04f, S04b, S07, S09a, S09b, S12, S15r, S19, S20s, S24s, S25, S26 |
| frontend | S03 (U1), S04u (U2), S08 (U3, U4), S11 (U5, U6), S20u (U8), S21 (U7), S23 (U9), S24u (U10) |
| data-baltics | S05, S13, S14 |
| data-us | S15g, S16, S17, S18 |
| data-osint | S06, S10 |
| data-markets | S15f, S22 |
| designer | reviews S03, S08, S11, S20u, S21, S23, S24u against DESIGN.md and the mockups |
| qa | every slice |
| web-qa | S02, S03, S08, S11, S13, S14, S17, S20u, S21, S23, S24u, S25 |
| security-engineer | S02, S07, S09a, S09b, S10, S17, S19, S25 (the login start) |

## Parallel lane (council session 2, item 3)

The critical path is M1 → M2 (Latvia end to end). While its seats wait, these slices may run in parallel; they never pull a critical-path seat away (K10):
- S22 (markets data) after S04f; S23 (Crash monitor UI) and S24s/S24u after S22. This puts Crash monitor in the daily-use trial early.
- S19 (MCP) after S09a.
- S21 (library) after S11.
- S17 (US states) before S16 if `SEC_USER_AGENT` is late.

The U-numbers are frontend's names in `ui-build-plan.md` §14; this table is the mapping.

---

## M1 Foundation

### S01 Workspace, toolchain and CI
- **Owner:** architect · **Depends on:** nothing (licence decided: AGPL-3.0, `LICENSE` committed)
- **Scope:**
  - pnpm workspace (`apps/*`, `packages/*`); `packageManager` pinned; Node ≥ 24 in `engines`; `"license": "AGPL-3.0-or-later"` in every `package.json`.
  - `packages/tooling`: tsconfig base (`strict`), ESLint flat config with the import rules of architecture §2, the denylist lint rule (architecture §13), Vitest preset.
  - Root scripts `lint`, `typecheck`, `test`, `build`, `e2e`, `finora`, `finora-cli`, `fixtures:gen`.
  - `scripts/check-deps.mjs` (the dependency table), `scripts/check-tokens.mjs` (stub until S03), `scripts/check-lawyer-register.mjs` with `docs/plan/lawyer-register.md` (rows from architecture §10.2; legal owns them), `scripts/gen-items.mjs` (Part G → `items.generated.ts`).
  - `pnpm-workspace.yaml` with `minimumReleaseAge` and `allowBuilds`; `.env.example`; `.data/` gitignored.
  - `ci.yml` jobs `check`, `test` (Linux and Windows), `audit` (architecture §14); later slices add theirs.
- **Acceptance:**
  1. A fresh clone runs `pnpm install && pnpm lint && pnpm typecheck && pnpm test` green on Windows and on Linux CI.
  2. `check-deps` fails when a package declares a dependency its table row forbids.
  3. ESLint fails on `any`, on `process.env` outside `env.ts`, on a Node built-in in `packages/domain`, and on a forbidden cross-package import. SHOULD (not blocking): the denylist rule flags a denylisted identifier fed through `FINORA_GUARD_DENYLIST`.
  4. `check-lawyer-register` fails on a `[pending: lawyer]` marker with no register row.
  5. `gen-items` produces 155 items with their calls, stripping the labels in brackets after an id (`S01.US.03a (PA)`); the generated file is checked current in CI.
  6. `ci` runs on the hub PR beside `guard`; both green.
  7. Every row of `docs/plan/lawyer-register.md` has the test below that holds its interim value; `check-lawyer-register` fails if a row has no entry here.

     | LAWYER id | Interim enforced by |
     |---|---|
     | LAW-BO-LV-EE | `ingest/src/hide.negative.test.ts`, `domain/src/report/restricted.test.ts` |
     | LAW-PSEUDONYM | `store/src/person-scope.test.ts`, `sources/src/person-fields.test.ts` (no HMAC computed, no person key) |
     | LAW-LV-OFFICERS | `domain/src/report/lv-people.test.ts` |
     | LAW-LLC-MEMBERS | `ingest/src/party-gate.test.ts` |
     | LAW-RETENTION-ROLES | `ingest/src/history.test.ts` |
     | LAW-CACHE-TTL | `store/src/retention.test.ts`, `ingest/src/live-cache.test.ts` |
     | LAW-SOLE-ADDRESS | `ingest/src/natural-person.test.ts` |
     | LAW-SECURING-SOLE | `ingest/src/natural-person.test.ts` (sole traders' securing measures and suspensions dropped) |
     | LAW-PERSON-INSOLVENCY | `ingest/src/natural-person.test.ts` (natural-person insolvency dropped) |
     | LAW-PERSON-LINKS | `domain/src/network/build.test.ts` |
     | LAW-ANON-COUNT | `domain/src/checks/checks.test.ts` (check 4 not run where S04 is LOCK) |
     | LAW-LV-NP-PROCUREMENT | `sources/src/field-maps.test.ts` (S12 is LATER: nothing mapped) |
     | LAW-WHOIS-LT | `agent-tools/src/output-filter.test.ts` (holder never shown) |
     | LAW-WHOIS-LV-EE | `agents/src/items.agent.test.ts` (LATER ids never queried) |
     | LAW-NATIONAL-LISTS | `agent-tools/src/check-live-list.test.ts` (live, cited, never stored) |
     | LAW-LV-FIU-PERSON | `sources/src/intl/sanctions-lv-fiu.test.ts` (the listed person's name is dropped; only proven companies load) |
     | LAW-SANCTIONS-PERSONS | `resolve/src/person-index.test.ts`, `sources/src/intl/sanctions-no-persons.test.ts` (no listed person stored; a match keeps only list, entry id, list date and status) |
     | LAW-UN-LIVE | `agent-tools/src/check-live-list.test.ts`, `sources/src/licences.test.ts` (never stored) |
     | LAW-COURTS-LT, LAW-COURTS-LV | `agents/src/items.agent.test.ts` (no Baltic court portal is queried; MANUAL link rendered) |
     | LAW-SAM | `agents/src/items.agent.test.ts` (S11.US.01; v1: manual link only, no SAM.gov request; the keyed loader is not built, H5) |
     | LAW-FINRA | `agent-tools/src/check-live-list.test.ts` (link-out, no request) |
     | LAW-CO-DISCLAIMER | `web/e2e/co-disclaimer.spec.ts` |
     | LAW-SHARE-ALIKE | `ingest/src/share-alike.test.ts`, `ingest/src/live-no-store.test.ts` |
     | LAW-SODRA-LICENCE | `agent-tools/src/read-live-source.test.ts` (read live, nothing written), `sources/src/licences.test.ts` |
     | LAW-SINGLE-COUNTS | no surface in v1: sole traders get no agents (R5), so no insured count is read for them; a check is added with any slice that shows one |
     | LAW-ACCOUNTS-DEADLINE | dormant: needed only before a statutory date is ever shown as a deadline; `domain/src/checks/filing-window.test.ts` proves v1 never shows one |
     | LAW-P7-SCOPE | `domain/src/policy/purposes.test.ts` |
     | LAW-DEFAMATION | `agents/src/orchestrator.subject.test.ts` |
     | LAW-BACKUP-RETENTION | `store/src/backup-classes.test.ts`, `cli/src/backup.test.ts` (no person-level table or row in any backup; 3 kept) |
     | LAW-DISPUTE-WINDOW | `store/src/disputes.test.ts` |
     | LAW-MARKET-CAP | `markets/src/items.test.ts` (no value lost without quoted terms) |
     | LAW-AGPL-HOSTED | no hosted build in v1; `web/e2e/source-link.spec.ts` (R18) |
- **Tests:** `scripts/check-deps.test.mjs`, `scripts/check-lawyer-register.test.mjs`, `scripts/gen-items.test.mjs`, `tooling/eslint/rules.test.ts`, `tooling/eslint/rules/denylist.test.ts`, `domain/src/items/items.generated.test.ts`.
- **Demo:** clone into a new folder, run the four commands, see them pass; open the hub PR checks and see `ci` and `guard` green.

### S02 Next.js shell, server mount, locales, security headers
- **Owner:** architect · **with:** frontend · **Depends on:** S01 · **security**
- **Scope:** `apps/web` (App Router, `[locale]`, `next-intl` with `en`, `lt`, `lv`, `et`); `packages/i18n` (catalogues, parity and banned-terms tests, `Intl` helpers); `apps/server` (`handle`, `boot`, route-table generator, `env.ts`, host and origin guard, CSP and security headers, error-code helpers, `GET /api/v1/health`, `GET /api/v1/about`); the `api/[...path]` mount; `instrumentation.ts` calling `boot()`; tool manifests (explorer, crash placeholders) driving the tool rail; the footer with the source-code link (R18) and the terms link (P7); `pnpm dev`/`pnpm start` bound to `127.0.0.1`; `import "server-only"` in `env.ts` and every seam file; `scripts/check-bundle-secrets.mjs`; Playwright with axe; CI jobs `build` and `e2e`.
- **Acceptance:**
  1. `/en`, `/lt`, `/lv`, `/et` render; `/` redirects by `Accept-Language`; the locale switcher keeps the path.
  2. `GET /api/v1/health` and `GET /api/v1/about` validate against their schemas; `about` carries the source-code URL, which the footer shows (R18).
  3. `Host: evil.example` gets `403 host_not_allowed`; a `POST` with a foreign `Origin` gets `403 forbidden`, on pages and API.
  4. A route file added without regenerating the table fails a test.
  5. The parity test fails on a missing key or ICU argument; the banned-terms test fails on a banned word in any catalogue string.
  6. An invalid env value fails boot naming the variable.
  7. A build with sentinel key values has no sentinel in any client chunk.
  8. Responses carry CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`.
- **Tests:** `server/src/router.test.ts`, `server/src/route-table.test.ts`, `server/src/guard.test.ts`, `server/src/env.test.ts`, `server/src/routes/v1/health/route.contract.test.ts`, `server/src/routes/v1/about/route.contract.test.ts`, `i18n/src/parity.test.ts`, `i18n/src/banned-terms.test.ts`, `scripts/check-bundle-secrets.test.mjs`, `web/e2e/smoke.spec.ts`, `web/e2e/security-headers.spec.ts`, `web/e2e/source-link.spec.ts`, `web/e2e/terms-link.spec.ts`.
- **Demo:** `pnpm dev`, open `/lv`, switch to `/et`, click Crash monitor in the rail (placeholder), follow the footer's source link; `curl -H "Host: evil.example" http://127.0.0.1:3000/api/v1/health` → 403.

### S03 Design system and state gallery (U1)
- **Owner:** frontend · **with:** designer · **Depends on:** S02, `DESIGN.md`
- **Scope:** `ui-build-plan.md` U1: tokens (CSS variables, dark first, light variant), Tailwind v4 `@theme`, `scripts/check-tokens.mjs` for real, self-hosted fonts (packages and licences verified), the `packages/ui` primitives, the `/design` state gallery with `?state=`, visual baselines at the four viewports, axe checks, CI job `visual`.
- **Acceptance and tests:** as U1 in `ui-build-plan.md` §14, at minimum: every primitive in every DESIGN.md state on `/design`; keyboard reachability and visible focus; axe with no serious or critical violation; WCAG AA contrast of text tokens in both themes; baselines committed and reviewed with `guard review`. Test files: `ui/src/tokens.contrast.test.ts`, `web/e2e/design.visual.spec.ts`, `web/e2e/design.a11y.spec.ts`, `web/e2e/design.keyboard.spec.ts`, `scripts/check-tokens.test.mjs`.
- **Demo:** open `/en/design`, tab through it, toggle the theme, switch states by URL.

### S04a Domain and store
- **Owner:** architect · **Depends on:** S01
- **Scope:**
  - `packages/domain`: schema subset, value sets, entity ids, error codes, purposes (no blocked use, P7), legal forms per country with `natural_person`, items and `items/policy.ts` (restriction rules), concepts, `SourcedValue` and `SourceRef`, the person-data canary patterns (P3, PS5).
  - `packages/store`: `node:sqlite`, pragmas, migrations (additive only on the large tables), `finora.db` and the attached `finora-user.db` and `finora-sa.db`, every table of architecture §3.8 except the agent and market tables, intern tables, repositories, word and trigram FTS (companies only), `leases`, `readPurposeSection` with the append-only `purpose_log` (P2), disputes with content-hash targets (R10), suppressions and `restrictions.log` (L5), `deletions.log`, the retention job (P4, P5), backup classes.
- **Acceptance:**
  1. Migrations run from an empty file, are idempotent, every migration path is tested, and a migration that rewrites a large table fails its test.
  2. A statement whose record has no sync, or whose sync has no licence, is refused (R3); a licence change keeps old rows on the old licence.
  3. Search finds a diacritic name by its ASCII form, by a substring and with a one-letter typo, ranked deterministically; a person's name and a sole trader's name return nothing (L2, L3).
  4. Leases: two holders of one resource, one wins; an expired lease is taken over.
  5. P2: 3 companies opened in one session → 3 log rows; after 12 h + 1 min → `needs_purpose`; a purpose change gives a new row and leaves the first unchanged.
  6. R10: a dispute on officer A survives the replacement of A's role set; B shows.
  7. P3 and PS5: no fixture code or person eid in any table.
  8. Every table and column has a backup class; `deletions.log` and `restrictions.log` fail closed; `restrictions.log` holds no hash, name or code, and compaction removes lifted entries.
- **Tests:** `store/src/migrations.test.ts`, `store/src/leases.test.ts`, `store/src/provenance.test.ts`, `store/src/licence-history.test.ts`, `store/src/search.test.ts`, `store/src/purpose.test.ts`, `store/src/disputes.test.ts`, `store/src/suppressions.test.ts`, `store/src/person-scope.test.ts`, `store/src/person-targets.test.ts`, `store/src/retention.test.ts`, `store/src/canary.test.ts`, `store/src/share-alike-rebuild.test.ts`, `store/src/backup-classes.test.ts`, `store/src/deletions-log.test.ts`, `store/src/restrictions-log.test.ts`, `domain/src/policy/persons.test.ts`, `domain/src/policy/purposes.test.ts`, `domain/src/schema/ftm-subset.test.ts`.
- **Demo:** `pnpm --filter @finora/store test` green; a short script in the README of `packages/store` opens an empty store, inserts one fixture company through a fake sync and searches it by a substring.

### S04i The ingest pipeline
- **Owner:** architect · **Depends on:** S04a
- **Scope:** `packages/sources` (the loader contract, licence registry and invariants, polite fetcher, `AsOfRule` strategies) and `packages/ingest`: the pipeline of architecture §4.4 with every gate (field map, personal code, proven company, natural person), staging, row-hash writes in time-bounded transactions, purge by set difference with the purge guard (floor, windows, change feeds), history events (§3.7), `parserVersion`, raw cache and `rawCache: false`, storage classes incl. `live-no-store` and `live-cached`, the person view, class changes, sync reports, every sync in a worker thread under its `sync:<source>` lease.
- **Acceptance:**
  1. Every pipeline test of architecture §4.4 passes: purge (1,000 records, 1 changed, 1 removed), unchanged, partial, stale, as-of strategies, parser version, purge guard (boundary, the 5-record floor, a 50% feed page, a window source), class change, party gate (one case per type value), history, role-ended.
  2. P1 in both `SHARE_ALIKE_MODE`s; `live-no-store` writes nothing (spied filesystem and logger, sentinel values).
  3. P5: the live-cache fake-clock and per-dataset miss cases.
  4. HIDE: every HIDE item in the raw-layout fixtures is dropped at load and counted (§10.4 loader suite).
  5. Two concurrent syncs of one fixture source: one runs, the other ends `already_running`, no rows lost.
  6. A sole trader's id refused as a possible personal code (the per-country rule, `lv-register.md`) is never dropped silently: the sync report counts it as `dropped: personal_code` with the prop and the source's row-local id (never the value), and the profile shows that field as not loaded, never as empty (legal 7058881476). `ingest/src/natural-person.test.ts`, one fixture row per country.
- **Tests:** `sources/src/licences.test.ts`, `sources/src/fetcher.test.ts`, `sources/src/field-maps.test.ts`, `sources/src/person-fields.test.ts`, `ingest/src/purge.test.ts`, `ingest/src/unchanged.test.ts`, `ingest/src/partial.test.ts`, `ingest/src/stale.test.ts`, `ingest/src/as-of.test.ts`, `ingest/src/parser-version.test.ts`, `ingest/src/purge-guard.test.ts`, `ingest/src/class-change.test.ts`, `ingest/src/party-gate.test.ts`, `ingest/src/natural-person.test.ts`, `ingest/src/history.test.ts`, `ingest/src/role-ended.test.ts`, `ingest/src/share-alike.test.ts`, `ingest/src/live-no-store.test.ts`, `ingest/src/live-cache.test.ts`, `ingest/src/install-key.test.ts`, `ingest/src/hide.negative.test.ts`, `ingest/src/regression-budget.test.ts`, `ingest/src/concurrency.test.ts` (acceptance 5, two worker threads).
- **Demo:** run the pipeline on a fake source twice; the second run writes one `unchanged` sync row and nothing else.

### S04f Fixture world and CLI
- **Owner:** architect · **Depends on:** S04i
- **Scope:** `fixtures/`: `pnpm fixtures:gen` (seeded, deterministic, ≈ 2,000 entities in four countries, fixture-only ids per §3.4) and `fixtures/README.md`; a fake loader per storage class; raw-layout fixtures holding every HIDE item. `apps/cli`: `data sync --profile fixtures`, `data status`, `search`, `show`, `doctor`, `backup`.
- **Acceptance:**
  1. `pnpm fixtures:gen` is byte-identical for the same seed; `fixtures/ids.test.ts` checks every fixture id (and every fixture ticker) against its rule.
  2. The fixture world loads in under 5 s on `dev-desktop-1` (recorded in `benchmarks.md`; relative budget in CI).
  3. `data status` shows each fixture source's sync report with drops by reason; `doctor` reports disk, `quick_check` and leases.
- **Tests:** `fixtures/gen.test.ts`, `fixtures/ids.test.ts`, `fixtures/load.test.ts` (the whole profile, HIDE rows dropped, the relative load budget), `cli/src/commands.test.ts`.
- **Demo:** `pnpm finora-cli data sync --profile fixtures`, then `pnpm finora-cli search "example compa"` prints ranked companies from all four countries.

### S04b API contracts and the demo responses
- **Owner:** architect · **Depends on:** S04a
- **Scope:** every schema in `packages/api-contract` listed in architecture §5.1 (`report`, `search`, `network`, `investigations` with `offerDomain`, `events`, `markets`, `settings`, `purpose`, `disputes`, `sources`, `health`, `about`, `export`), the `SectionResult` union (§5.4), the event union (§7.6), the `Verdict` with `coverage.total: 11` and `keyFindingIds`, `MarketRow` (§8), `API_ROUTES`, OpenAPI generation; a fixture-backed `FINORA_DEMO` mode that serves those DTOs from the real routes before the real services exist.
- **Acceptance:**
  1. Every schema has a valid and an invalid fixture; an empty `data` value array is rejected; `generatedBy: "ai"` is required on findings and explanations (R9); `coverage.total` can only be 11.
  2. `docs/api/openapi.json` is generated and current.
- **Tests:** `api-contract/src/*.test.ts` (one per schema file), `api-contract/src/openapi.test.ts`.
- **Demo:** `FINORA_DEMO=1 pnpm dev`, `curl http://127.0.0.1:3000/api/v1/companies/<fixture eid>` returns a schema-valid fixture profile.

### S04u UI fixtures and client plumbing (U2)
- **Owner:** frontend · **Depends on:** S04b, S03
- **Scope:** `fixtures/ui/<screen>/<state>.json` validated against the S04b schemas; the client plumbing of U2 (fetch layer, TanStack Query setup, the fetch-stream SSE client with `Last-Event-ID` and the `?lastEventId=` fallback, the idempotent investigation reducer).
- **Acceptance:** U2 in `ui-build-plan.md`; every `fixtures/ui` file validates; the `/design` gallery renders from them; the SSE client resumes from the last id after a dropped connection with no gap or duplicate.
- **Tests:** `fixtures/ui.test.ts`, `web/src/lib/sse.test.ts`, `web/src/lib/investigation-reducer.test.ts`.
- **Demo:** open `/en/design?state=report`.

**M1 demo (council session 3a, run by qa from a fresh clone):** clone → `pnpm install` → `pnpm test` green → `pnpm dev` shows the localised shell and `/design` → `finora-cli data sync --profile fixtures` loads the fixture world → `finora-cli search` finds a company in each country.

---

## M2 Walking skeleton: Latvia end to end

### S05 Latvia loaders
- **Owner:** data-baltics · **with:** architect · **Depends on:** S04f
- **Scope:** every `docs/plan/loaders/lv-*.md` spec (register, officers, members, insolvency, securing measures, suspensions, financial statements, VID tax files and rating), each with its field map, party gate, role-set records for officers (PS6, no person code read except to drop it), tombstone or delete rules, history events, layout fixture writer and live check; `LV_PERSON_ROWS` both modes.
- **Acceptance:** each spec's Tests section; plus: **HIDE at the raw layout (qa F2 on S04f):** the slice's committed raw-layout fixture carries every HIDE column of its source file, and a test proves the field map never reads them: nothing of them reaches the store, and each is counted.
  1. Every LV SHOW and CAVEAT item in the appendix renders from the fixture world with its sources and caveat (`domain/src/report/items.test.ts`).
  2. HIDE: S04.LV.02 and S04.LV.03 and natural-person members are never read; LV `JOINT_OWNERS` and other unproven members are counted, not loaded.
  3. P10 on `dev-desktop-1`: LV ≤ 2.5 GB, the register searchable in ≈ 2 min, a daily refresh ≤ 5 min, an unchanged reload writes 0 statements; records and bytes per record recorded in `benchmarks.md`.
  4. `LV_PERSON_ROWS=role_counts` removes every LV name from every surface (PS7).
- **Tests:** the spec files' named tests under `sources/src/lv/`, plus `sources/src/lv/*.live.test.ts` (nightly) and `domain/src/report/lv-people.test.ts`.
- **Demo:** `pnpm finora-cli data sync --country lv`, then `pnpm finora-cli show lv-<a real code>` lists the sections it fills with their sources and licences.

### S06 Stored sanctions lists and screening
- **Owner:** data-osint · **with:** architect · **Depends on:** S04f, `docs/plan/loaders/sanctions.md`
- **Scope:** the stored official lists (EU, OFAC, UK, LV FIU) per `sanctions.md`; `screen_sanctions` in `packages/resolve` with the second-identifier rule (R8); the live-only lists as `agent-only` sources (fetched by S10's `check_live_list`, never stored).
- **Acceptance:** the spec's Tests; plus a name-only match is `possible_match`, an official-ID match is `listed`, a different id is no match; the UN list and the national lists without a licence are never stored (licence invariants); S11.ALL.01-03 and S11.LV.01-02 render with their dates (`items.test.ts`).
- **Tests:** `resolve/src/sanctions.test.ts`, `resolve/src/person-index.test.ts`, `sources/src/intl/sanctions-*.test.ts` (per spec), `sources/src/intl/sanctions-no-persons.test.ts`, `sources/src/intl/raw-cache.test.ts`, `sources/src/licences.test.ts` rows for each list.
- **Demo:** `pnpm finora-cli data sync --source eu-fsf`, then `pnpm finora-cli resolve --sanctions "<fixture name>"` shows a possible match with the entry's identifiers.

### S07 Report assembly, checks and the read API
- **Owner:** architect · **Depends on:** S04b, S04f, S05, S06 · **security**
- **Scope:** `assembleReport` (every section as a `SectionResult`, the coverage line, restricted sections by rule, facts-only branch for natural persons, `containsPersonalData`, `derived` values, the stale rule, P14 `not_evaluated`); `computeChecks` (the 11 checks; 10-11 `not_run` outside an investigation); routes `search` (bulk groups), `companies/:eid`, `sections/:section`, `export`, `sources`, `purpose`, `disputes`; the render seam; the API HIDE and canary suites; the field-registry API test.
- **Acceptance:**
  1. Every route's response validates on the fixture world (contract test per route).
  2. Every value carries ≥ 1 `SourceRef` with source, licence, retrieval date, as-of, checked-at and access tier (R3).
  3. Each `SectionResult` state and reason has a fixture case; an LV LOCK section is identical for a covered entity with and without hidden records (`restricted.test.ts`).
  4. Person sections without a purpose return `needs_purpose`; with one they return data and write a `purpose_log` row (P2); a blocked purpose id is `400 purpose_blocked` (P7).
  5. A sole trader gets the facts-only profile: no checks verdict, the disclaimer flag, country-only address, no tax or arrears lines (P6); every row and check whose data is dropped for natural persons renders the rule-based lock, so a bankrupt and a non-bankrupt fixture sole trader give byte-identical DTOs (council item 11).
  10. Every user-visible coverage string reads "of 11" (council item 8).
  6. Export holds no share-alike, connector-cache, personal or suppressed value (R4, P1, L5).
  7. A dispute suppresses the value at the next read and survives a reload (R10).
  8. No route has a person path (L2); HIDE and canary suites pass on the API.
  9. `GET /companies/:eid` p95 within the relative budget on the fixture world; absolute number recorded for the LV `core` load in `benchmarks.md`.
  11. A field refused at load (`main.withheld`, reason `personal_code`: the fixture LV sole trader's id) renders as not loaded on every surface, never as empty and never with a value (legal on S04i, condition 2).
- **Tests:** `domain/src/report/assemble.test.ts`, `domain/src/report/section-result.test.ts`, `domain/src/report/restricted.test.ts`, `domain/src/report/facts-only.test.ts`, `domain/src/report/sole-trader-lock.test.ts`, `domain/src/checks/coverage-copy.test.ts`, `domain/src/report/items.test.ts`, `domain/src/checks/checks.test.ts`, `domain/src/verdict/history-window.test.ts`, `domain/src/export/export.test.ts`, `domain/src/export/canary.test.ts`, `domain/src/export/hide.negative.test.ts`, `server/src/routes/v1/**/route.contract.test.ts`, `server/src/field-registry.test.ts`, `server/src/hide.negative.test.ts`, `server/src/canary.contract.test.ts`, `server/src/perf/report.perf.test.ts`.
- **Demo:** `curl "http://127.0.0.1:3000/api/v1/search?q=<LV name>"`, then `curl .../companies/lv-<code>`; `curl .../sections/S03` shows `needs_purpose`, then again after `POST /purpose`.

### S08 Explorer UI: shell, search, profile, sources (U3, U4)
- **Owner:** frontend · **with:** designer, architect · **Depends on:** S03, S04u, S07 · **web-qa**
- **Scope:** `ui-build-plan.md` U3 and U4: the shell and command bar, search with groups (bulk now, live US groups in S17), the company profile (server component, every section through `FieldRow` with `itemId`, every state and reason with its own icon and copy, source chips with licence and attribution, "Derived by Finora", the coverage line, the purpose gate with the purpose shown above person sections, the disclaimer, "Report a problem", the facts-only variant, the CO disclaimer slot), the sources page, `noindex` and title rules.
- **Acceptance:** U3 and U4 in `ui-build-plan.md` §14, plus:
  1. Every DESIGN.md state of these screens matches its mockup at the four viewports.
  2. The field-registry UI test passes: no untagged value, no unknown id, every LV SHOW/CAVEAT id with fixture data renders.
  3. The HIDE UI suite and the UI canary pass.
  4. R6, R9 (no AI text yet), R10, R16, L3 e2e tests pass.
  5. The checks panel shows the fixed line "No verdict yet. These checks use official data only; the rest run when you investigate. Missing does not mean clean."; a check past its cycle shows a clock, not a check mark (council item 13).
- **Tests:** `web/e2e/search.spec.ts`, `web/e2e/report-sources.spec.ts`, `web/e2e/sources-page.spec.ts`, `web/e2e/field-states.spec.ts`, `web/e2e/people-purpose.spec.ts`, `web/e2e/disclaimer.spec.ts`, `web/e2e/facts-only.spec.ts`, `web/e2e/dispute.spec.ts`, `web/e2e/seo-headers.spec.ts`, `web/e2e/hide.spec.ts`, `web/e2e/canary.spec.ts`, `web/src/field-registry.test.ts`, `web/e2e/explorer.visual.spec.ts`, `web/e2e/explorer.a11y.spec.ts`.
- **Demo:** `pnpm dev`, search a real Latvian company, open its profile, state a purpose to open People, hover a value to see its source and licence, follow the link to the register.

### S09a Agent runtime and ledger
- **Owner:** architect · **with:** data-osint · **Depends on:** S07 · **security**
- **Scope:** architecture §7.1-§7.4, §7.7-§7.8 and `agents.md` §3, §8: investigation tables in `finora-user.db`, orchestrator (lead → four parallel specialists → verdict), `LlmProvider` (`fake`, `anthropic`), tool loop with parallel tool calls, tasks before the first turn, the ledger (hold with search-result tokens, settle per attempt, the four caps, the reserve, the cap flow, `hold_underestimate`, the estimate), limits, ceilings, retries, timeouts, stop; the shared store tools of `agents.md` §4.1 incl. `get_checks`; `prices.ts`.
- **Acceptance (all with the `fake` provider):**
  1. Four specialists start within 2 s of the pin and run concurrently.
  2. Six runs at the cap together produce one `cap_reached` question and at most +$0.50; a second hit ends `budget_exceeded`; two investigations cannot jointly pass the daily cap.
  3. A call that settles above its hold logs `hold_underestimate`; no new call starts; the verdict still runs (council item 6). Holds are per call (`max_uses` ≤ 2): under the default cap the four specialists start within the stagger and none waits on the ledger.
  4. Every rule in architecture §7.8 ends its run with its machine code; Stop aborts within 5 s.
  5. A natural-person subject is refused (R5); unknown price refuses to start.
  6. **Merges marked "pending the measured run"** when green on `fake`; **M2 cannot pass** until data-osint's measured run (`agents.md` §12) has replaced the modelled costs and the estimate is calibrated (architecture §7.7: ≥ 90% at or under `high`, median within ±30% of `typical`).
- **Tests:** `agents/src/orchestrator.parallel.test.ts`, `agents/src/orchestrator.subject.test.ts`, `agents/src/orchestrator.timeout.test.ts`, `agents/src/orchestrator.stop.test.ts`, `agents/src/budget.test.ts`, `agents/src/budget.parallel.test.ts`, `agents/src/estimate.test.ts`, `agents/src/runner.limits.test.ts`, `agents/src/runner.retry.test.ts`, `agents/src/runner.errors.test.ts`, `agents/src/runner.timeout.test.ts`, `agents/src/tools.errors.test.ts`, `agent-tools/src/*.test.ts` (store tools).
- **Demo:** `FINORA_DEMO=1 pnpm dev`; `curl -X POST .../api/v1/investigations` on a fixture company; the run log shows four specialists in parallel and the cost ledger's holds and settles.

### S09b Questions, findings, events and recovery
- **Owner:** architect · **with:** data-osint · **Depends on:** S09a · **security**
- **Scope:** architecture §7.5, §7.6, §7.9, §7.10 and `agents.md` §5, §7, §9, §11: `ask_human` park and resume with the kind table, `record_finding` with the rejection codes and citation verifier, documents filtered before storage, follow-ups, the share-alike rows in `finora-sa.db`, the event log and SSE with resume, rerun of one specialist, restart recovery under the `recover` lease; server routes for investigations, questions, stop, rerun, follow-ups and events.
- **Acceptance (all with the `fake` provider):**
  1. A question blocks only its own run; `entity_choice` has no default and its timeout ends `not_enough_data`; a model-supplied default is ignored; `cap_reached` from the model is refused.
  2. A finding citing another company's statement is rejected; a 39-character quote is rejected; follow-ups follow the same rules.
  3. Share-alike: no main-store row holds a share-alike value, in both modes.
  4. Restart: kill the process mid-run; on boot the run resumes exactly once from its last persisted turn, and SSE resumes from `Last-Event-ID` with no gap.
- **Tests:** `agents/src/questions.test.ts`, `agents/src/findings.test.ts`, `agents/src/citations.test.ts`, `agents/src/followup.test.ts`, `agents/src/share-alike.test.ts`, `agents/src/recovery.test.ts`, `agents/src/events.test.ts`, `server/src/sse.resume.test.ts`, `server/src/routes/v1/investigations/**/route.contract.test.ts`.
- **Demo:** `curl -N .../events` streams four lanes in parallel; answer the question with `curl`; the `verdict` event arrives; kill and restart the app mid-run and watch the stream resume.

### S10 Specialists, open-web tools and the verdict
- **Owner:** data-osint · **with:** architect · **Depends on:** S09b, S06 · **security**
- **Scope:** `agents.md` §2, §4.2-§4.6, §5, §6, §9, §10, §13: the four specialists and their pre-run tasks, the open-web tools (`domain_report`, `homepage_facts`, `fetch_page`, `news_search`, `check_live_list`, `search_courts` for the US only; Baltic court checks are MANUAL in v1), the money agent's `read_live_source` tool for the LT social-insurance files (S07.LT.01, S08.LT.02, S18.LT.02; `docs/plan/loaders/lt-sodra.md` and `agents.md` §4.4b; read at query time, never stored), anchors, signals, the rule table `computeVerdict` and the explanation with the banned-term branches, the P8 output filter and canary, the twelve fake-provider scenarios. The v1 investigation **is** the one profile template the council kept (counterparty, session 0): the plan always runs the four specialists; other templates are LATER (the `plan` event already carries the roles, so a template only changes the plan).
- **Acceptance:** `agents.md` §14 "Agent tools and specialists" items 1-5, the O2 rule rows as council session 2 changed them, plus:
  0. Council session 2: the web agent checks the `offerDomain` against the register, with one `fake` scenario (item 7); every signal of severity `point_to_check` or above maps to a rule, including `status_not_active` and `no_officers_on_record` (item 9); key findings are chosen by rule (concerns, then points to check, then check number; never inferred, name-only or context; fewer than three when fewer qualify; item 10).
  1. One test per rule in the rule table; the determinism test (same inputs, three explanation texts, same level and fired rules).
  2. The three banned-term branches (pass, regenerate, fallback).
  3. P8 canary on the agent path.
  4. Every agent-filled SHOW/CAVEAT item in the appendix has its `items.agent.test.ts` case rendering its caveat and AGENT empty state.
  5. With a real key, one real Latvian company finishes inside the default cap and time budget, every verdict sentence is cited, and its cost is recorded (transcript in `research/.cache/`, not committed).
- **Tests:** `domain/src/verdict/rules.test.ts`, `domain/src/verdict/rules.determinism.test.ts`, `agents/src/verdict.banned.test.ts`, `agents/src/p8.canary.test.ts`, `agents/src/scenarios.test.ts`, `agents/src/items.agent.test.ts`, `agent-tools/src/output-filter.test.ts`, `agent-tools/src/web-fetch.ssrf.test.ts`, `agent-tools/src/check-live-list.test.ts`, `agent-tools/src/search-courts.test.ts`, `resolve/src/court-party.test.ts`.
- **Demo:** `pnpm finora --demo`, open the fixture company `agents.md` §14 names, press Investigate, watch four lanes, answer the sanctions question, read the cited verdict.

### S11 Investigation UI: live agents, verdict and report (U5, U6)
- **Owner:** frontend · **with:** designer, data-osint · **Depends on:** S08, S09b (S10 for real agents) · **web-qa**
- **Scope:** `ui-build-plan.md` U5 and U6: the Investigate sheet (purpose, estimate with `typicalSeconds`, cap, daily left, "add your key" without a key, "No agents run on a private individual" for natural persons), six lanes (lead, the four specialists, verdict; the header counts "4 agents") with tasks and per-lane cost, question cards per kind (no countdown on `entity_choice`), cap reached and daily cap sheets, stop, reconnecting, the `VerdictBlock` (rule-based level and coverage separate from the AI-written explanation), findings in their sections with citation chips opening the quoted span, rerun one agent, follow-ups.
- **Acceptance:** U5 and U6 in `ui-build-plan.md` §14, plus:
  1. Every DESIGN.md investigation state matches its mockup at four viewports (empty, loading, streaming, partial, error, each question kind, cap reached, report).
  2. Events show within 500 ms; a reload mid-run restores the same state from snapshot + stream.
  3. Every verdict sentence has a citation chip; a sentence without one is not rendered (R7); all AI text carries `AiLabel` and the level never sits inside it (R9).
  4. The Investigate sheet has the optional offer-domain field (council item 7); the one fallback line is "No written explanation for this report", for both the banned-term fallback and an explanation with no cited sentence (item 12).
- **Tests:** `web/e2e/investigation.flow.spec.ts`, `web/e2e/investigation.reload.spec.ts`, `web/e2e/investigation.question.spec.ts`, `web/e2e/investigation.cap.spec.ts`, `web/e2e/investigation.stop.spec.ts`, `web/e2e/ai-label.spec.ts`, `web/src/components/verdict-block.test.tsx`, `web/e2e/investigation.visual.spec.ts`, `web/e2e/investigation.a11y.spec.ts`.
- **Demo:** from a real Latvian company's profile press Investigate, answer the question, read the cited verdict, ask a follow-up.

### S12 The one command for Latvia and the milestone gate
- **Owner:** architect · **Depends on:** S05-S11
- **Scope:** `pnpm finora` and `pnpm finora --demo` (architecture §16) with the LV sources as the `core` profile for now: disk preflight, production build when stale, `next start`; the background first load with per-country progress in search groups; scheduled refresh jobs per cadence and the retention and backup jobs in `boot()`, every sync in a worker thread under its lease (architecture §1); `finora-cli backup` and `doctor`; `scripts/milestone-gate.mjs`; `README.md` quick start; `docs/running.md`; CI job `demo-boot`.
- **Acceptance:**
  1. On a fresh clone (Windows and Linux), `pnpm finora` ends with a production build on `127.0.0.1:3000`, with no manual step besides optional keys; LV is searchable ≈ 2 min after the app is up (P10); the cold path (clone → install → build → app up) is recorded as a number on `dev-desktop-1` in `benchmarks.md`.
  5. A CLI `data sync` started while the app's scheduler syncs the same source ends `already_running`, and no rows are lost; two app starts run one job runner; during a sync, an investigation event is written and broadcast with no `SQLITE_BUSY` and no heartbeat gap above 3 s in CI; the absolute targets (health p95 < 100 ms, heartbeats < 1 s late) are recorded on `dev-desktop-1`.
  6. With less than 15 GB free, `pnpm finora` refuses the core load and says why; `doctor` detects and repairs a corrupted fixture store from the latest backup and the raw cache; an investigation deleted before the corruption stays deleted; backups copy only the allowlisted tables with legal's three filters (no person-level table, no dispute on a person line, no sole-trader judgement, no unpinned investigation); a missing `deletions.log` or `restrictions.log` makes `--repair` refuse; a suppressed LV officer line stays hidden after a repair and is in no backup file; a suppressed US principal line keeps that role's lines hidden with "Show again".
  2. `pnpm finora --demo` works offline in under 60 s.
  7. The install is known good before the app starts (architecture §16): a changed lockfile, or a `node_modules` without the `.finora-install` marker (an interrupted install), triggers `pnpm install --frozen-lockfile`; a `node_modules` that pnpm calls up to date but that is missing a transitive package fails the entry-point check or the boot smoke and triggers exactly one clean reinstall; a second failure stops with a message naming the module; a matching marker and a passing smoke skip the install. `doctor` runs the entry-point check and reports the last boot smoke. `scripts/finora.test.mjs`.
  3. A second run is incremental: unchanged sources download nothing and write nothing.
  4. `milestone-gate.mjs` follows architecture §13 (council item 5): the regression set from `research/.cache/regression/set.json`, scripted question answers, `--budget-usd` with its own ledger, a fixed aggregate table, exit 0 or 1; its LV run meets the M2 gate.
  8. `scripts/finora.mjs` refuses to boot with any heap, inspect or report flag in `NODE_OPTIONS` or its own `execArgv`, and no sync worker starts with one in its `execArgv` (`--heapsnapshot-signal`, `--heapsnapshot-near-heap-limit`, `--heap-prof`, `--inspect*`, `--report-on-*`); `--report-exclude-env` is the only exception (cto, legal, qa). Each flag has a test in `scripts/finora.test.mjs`.
  9. `docs/running.md` (final in S25) notes the V8 `jit_page_` check failure seen with many short-lived worker isolates, its trigger and the Node version (24.20), and why the CLI keeps one worker per lane; and that the sanctions lists download about 178 MB at each start.
- **Tests:** `scripts/finora.test.mjs`, `scripts/milestone-gate.test.mjs`, `server/src/jobs.test.ts`, `server/src/jobs.main-thread.test.ts`, `store/src/leases.test.ts`, `cli/src/backup.test.ts`, `cli/src/doctor.test.ts`, `store/src/deletions-log.test.ts`, `store/src/restrictions-log.test.ts`, `store/src/backup-classes.test.ts`, CI `demo-boot` (Linux and Windows).
- **Demo:** delete the clone, clone again, run `pnpm finora`, look up a Latvian counterparty, investigate it, then run `node scripts/milestone-gate.mjs --country lv`.

**M2 demo (council session 3b):** the Latvian walking skeleton end to end from one command, live, with one question answered and a cited verdict; the milestone-gate output pasted into `docs/plan/council/03-m2.md`. **No second country's loaders start before this demo passes.**

---

## M3 Every country

### S13 Estonia loaders, with the share-alike store
- **Owner:** data-baltics · **with:** architect · **Depends on:** M2
- **Scope:** every `docs/plan/loaders/ee-*.md` spec, incl. the streamed general-data file, annual-report zips from the download page, the person files as role-set records, tombstones, the share-alike sources in both `SHARE_ALIKE_MODE`s with their derived events in `finora-sa.db`, and the debtor loader rule (keep only register codes with a non-sole-trader form).
- **Acceptance:** each spec's Tests; every EE SHOW/CAVEAT item renders (`items.test.ts`); HIDE S04.EE.02 and natural-person members never read; legal's debtor condition (a fixture with a bare personal name and a foreign sole proprietorship is dropped); P10: EE ≤ 3 GB + ≤ 0.25 GB share-alike, searchable in ≈ 6 min. **HIDE at the raw layout (qa F2 on S04f):** the slice's committed raw-layout fixture carries every HIDE column of its source file, and a test proves the field map never reads them: nothing of them reaches the store, and each is counted.
- **Memory (cto on S04i):** the EE general-data load (4.6 GB of JSON) and the zipped files stream with bounded memory; each sync's peak RSS stays ≤ 1 GB on `dev-desktop-1`, recorded in `benchmarks.md`. The architect delivers streamed artifacts in the loader contract (fetch to a file, a streamed content hash and raw cache) before this slice starts.
- **Share-alike layout (cto on S04i):** `finora-sa.db` gets the narrow layout of the main store, keyed on `eid` per A6: `sa_fact_reports(eid, kind, period_start, period_end, sync_id)` and `sa_facts(report_id, concept_id, value) WITHOUT ROWID`, replacing the interim `<concept>@<period end>` statements. `sa_syncs` stays the provenance table and keeps `records`, so the share-alike purge guard still fires (assert it). The slice reports the share-alike store's measured size against the 0.25 GB cap.
- **Tests:** the spec files' named tests under `sources/src/ee/`, `ingest/src/share-alike.test.ts` and `ingest/src/live-no-store.test.ts` on the EE fixtures, `sources/src/ee/*.live.test.ts`, the share-alike case of `ingest/src/purge-guard.test.ts` on the narrow layout.
- **Demo:** `pnpm finora-cli data sync --country ee`, open an Estonian company in the UI, see the tax-debtor line with its CC BY-SA attribution; set `SHARE_ALIKE_MODE=live-no-store` and see the same line with no row in any file.

### S14 Lithuania loaders
- **Owner:** data-baltics · **with:** architect · **Depends on:** M2
- **Scope:** every `docs/plan/loaders/lt-*.md` spec: the daily register files with the classifier and address joins, the tax-authority datasets and the arrears change feed (purge guard on deletes), statements grouped per report, `paid_only` people with the register's own ordering page, the Statistics Lithuania activity table with English labels into `labels`, share capital as an optional S01 field.
- **Acceptance:** each spec's Tests; every LT SHOW/CAVEAT item renders; S03.LT names render `paid_only` with the official order link only; no social-insurance data is loaded or stored (it is the money agent's live tool in S10); the 180-day arrears rule runs from the list's entry date (`domain/src/verdict/lt-arrears-age.test.ts`); P10: LT ≤ 2 GB, searchable in ≈ 2 min. **HIDE at the raw layout (qa F2 on S04f):** the slice's committed raw-layout fixture carries every HIDE column of its source file, and a test proves the field map never reads them: nothing of them reaches the store, and each is counted.
- **Tests:** the spec files' named tests under `sources/src/lt/`, `sources/src/lt/*.live.test.ts`.
- **Demo:** `pnpm finora-cli data sync --country lt`, open a Lithuanian company, see arrears, insured counts and the paid-extract line for names.

### S15r Entity resolution
- **Owner:** architect · **Depends on:** S13, S14, S15g
- **Scope:** `packages/resolve`: official-ID links (`same_as` only), name normalisation per country, candidate scoring and the benchmark, judgements; search results with distinguishing facts for name collisions.
- **Acceptance:**
  1. A company with an LEI and a national code is one profile with both sources.
  2. The 200-query benchmark ranks the right company first in ≥ 95%.
  3. A human judgement survives every reload.
  4. **Linking in the sync:** §4.4 step 7 links the entities a sync touched (S04i review, D5). Until this slice lands, `same_as` returns none and `Finding.entityId` is the pin; S05 and M2 ship unlinked, as intended.
  5. **Backfill and relink:** `finora-cli resolve --relink-all` links every entity already in the store (cto). It runs once when linking first ships, and again automatically whenever the linking rules' version changes (keyed like `parserVersion`), under the leases, in a worker. Test: fixture companies and GLEIF records naming their codes are loaded before linking exists; after `--relink-all`, every `same_as` link is present, with no re-sync of the country source.
- **Tests:** `resolve/src/links.test.ts`, `resolve/src/normalise.test.ts`, `resolve/src/benchmark.test.ts`, `resolve/src/judgements.test.ts`, `resolve/src/relink.test.ts`.
- **Demo:** `pnpm finora-cli resolve "example companu sia"` shows ranked candidates with scores and reasons.

### S15g GLEIF
- **Owner:** data-us · **Depends on:** M2
- **Scope:** `docs/plan/loaders/gleif.md` (weekly full load, country filter, links by registration authority).
- **Acceptance:** the spec's Tests; S01.ALL.01-02 render.
- **Tests:** the spec's named tests under `sources/src/intl/gleif*`.
- **Demo:** a Baltic company's profile shows its LEI.

### S15f ESMA FIRDS
- **Owner:** data-markets · **Depends on:** M2
- **Scope:** `docs/plan/loaders/esma-firds.md`.
- **Acceptance:** the spec's Tests; S14.LTLVEE.01 renders as "Listed on [venue] since [date]".
- **Tests:** the spec's named tests under `sources/src/intl/esma-firds*`.
- **Demo:** a listed Baltic company's profile shows its listing row.

### S16 US public companies (SEC)
- **Owner:** data-us · **with:** architect · **Depends on:** S15r, `SEC_USER_AGENT` from the human (O5)
- **Scope:** `docs/plan/loaders/us-sec.md`: submissions, company facts, the tickers list (S14.US.02), Forms 3/4/5 quarterly sets (S14.US.01), Form D related persons (S03.US.02), Schedules 13D/G (S04.US.01), 8-K item 5.02 events, insiders in company context only (the reporting owner's CIK is dropped, PS6), `needs_key` without the contact setting.
- **Acceptance:** the spec's Tests; every SEC SHOW/CAVEAT item renders; without `SEC_USER_AGENT` the US public profile is `needs_key` and no SEC request is made; ≤ 10 requests/s (R14).
- **Tests:** the spec's named tests under `sources/src/us/sec-*`, `sources/src/us/sec-user-agent.test.ts`.
- **Demo:** set the SEC contact setting `SEC_USER_AGENT` (a contact header, not a key: C14), open a US public company, see filings, financials and insider trades behind the purpose gate.

### S17 US state registries, live, with fan-out search
- **Owner:** data-us · **with:** architect, frontend · **Depends on:** S15r · **security** · **web-qa**
- **Scope:** `docs/plan/loaders/us-states.md`: one Socrata client, NY, CO, CT, PA (OR and WA blocked by P11), `live-cached` entities on view, `GET /search/live/:register` with a 3 s timeout, the live groups in the search UI, the CO disclaimer, CT withdrawal handling.
- **Acceptance:** the spec's Tests; a slow or failing portal renders "Not checked: [state] registry did not answer" without blocking other groups; P5 fake-clock tests; the CO disclaimer appears wherever CO data does; a withdrawn CT record is gone after the next fetch; OR and WA cannot be enabled.
- **Tests:** the spec's named tests under `sources/src/us/state-*`, `ingest/src/live-cache.test.ts`, `server/src/routes/v1/search/live/route.contract.test.ts`, `web/e2e/search-live.spec.ts`, `web/e2e/co-disclaimer.spec.ts`.
- **Demo:** search a common US company name and watch the four state groups arrive one by one; open one; it is cached and shows its retrieval date.

### S18 US federal sources
- **Owner:** data-us · **with:** data-osint · **Depends on:** S16
- **Scope:** `us-fdic.md`, `us-fmcsa.md`, `us-sam-exclusions.md`, `us-enforcement.md`, `us-courts.md` (FJC stored where the spec says). Off in v1 under H5 (no keys): the SAM.gov exclusions loader and the keyed docket search; S11.US.01 and S10.US.02 render `not_checked{reason: "manual_lookup"}` with the official link.
- **Acceptance:** each spec's Tests; each item renders (stored) or has its agent case (live); bank-only and carrier-only rows appear only for those entities; S11.US.01 renders the manual SAM.gov link ("Check federal exclusions on SAM.gov") and no SAM.gov request is ever made (`LAW-SAM`); S10.US.02 renders the manual docket-search link (`us-courts.md`) and `search_courts` queries the FJC index only; FINRA is link-out only (`manual_lookup`, `LAW-FINRA`).
- **Tests:** the specs' named tests under `sources/src/us/`, `agents/src/items.agent.test.ts` cases for S10.US and S11.US.03-04.
- **Demo:** open a fixture bank and a fixture carrier and see their federal rows; the exclusions row reads "Check federal exclusions on SAM.gov" with the official link; investigate a US company and see the court search lane.

### S19 MCP server
- **Owner:** architect · **Depends on:** S07, S09a · **security**
- **Scope:** architecture §5.2: the read tools from `packages/agent-tools`, stdio (`finora-cli mcp`, the `finora` binary) and Streamable HTTP at `/mcp`, purpose on every person-section call, `serverInfo` with the source link, `docs/mcp.md`.
- **Acceptance:** the tool list is exactly the seven tools (snapshot); no person tool (L2); schema-valid output with sources on the fixture world; `purpose_required` without a purpose and a log row with surface `mcp` with one (P2); a blocked purpose refused (P7); HIDE and canary suites pass; the HTTP transport refuses a foreign Host or Origin; a desktop MCP client configured per `docs/mcp.md` can search and read a company.
- **Tests:** `mcp/src/tools.contract.test.ts`, `mcp/src/purpose.test.ts`, `mcp/src/errors.test.ts`, `mcp/src/http-guard.test.ts`, `mcp/src/hide.negative.test.ts`, `mcp/src/canary.test.ts`, `mcp/src/server-info.test.ts`.
- **Demo:** add `finora` to an MCP-capable desktop client, ask it to look up a Latvian company, see cited answers.

### S20s Network service
- **Owner:** architect · **Depends on:** S07, S13, S14
- **Scope:** architecture §5.5: `GET /companies/:eid/network`, registered offices only, no address shared with a natural person, hubs collapsed after 20, member edges with `share`.
- **Acceptance:** a fixture sole trader at a company address creates no edge; every edge carries a `SourceRef`; a hub collapses at 21.
- **Tests:** `domain/src/network/build.test.ts`, `server/src/routes/v1/companies/[eid]/network/route.contract.test.ts`.
- **Demo:** `curl .../companies/<eid>/network` on a fixture company with a shared office.

### S20u Network explorer UI (U8)
- **Owner:** frontend · **Depends on:** S08, S20s · **web-qa**
- **Scope:** `ui-build-plan.md` U8: the canvas graph with the list twin (default under 768 px), no agent runs on browse, no Network action on a sole trader's profile.
- **Acceptance:** U8; S17 items render with their caveat; member edges show their `share` where stated.
- **Tests:** `web/e2e/network.spec.ts`, `web/e2e/network.visual.spec.ts`, `web/e2e/network.a11y.spec.ts`.
- **Demo:** open a company's network, follow a shared-address hub to another company.

### S21 Library (U7)
- **Owner:** frontend · **Depends on:** S11 · **web-qa**
- **Scope:** `ui-build-plan.md` U7: the list with level, coverage, cost and status; reopening a report; delete (R11).
- **Acceptance:** U7 in `ui-build-plan.md`; delete removes the investigation and its documents (`DELETE /investigations/:id`); documents of old investigations expire under the TTL.
- **Tests:** `web/e2e/library.spec.ts`, `server/src/routes/v1/investigations/[id]/route.contract.test.ts` (delete), `store/src/retention.test.ts` (documents).
- **Demo:** run two investigations, open the library, reopen one, delete the other.

**M3 demo (council session 3c):** one real company per country, including a US public and a US private one, end to end; the milestone gate on all four countries; the CEO's US-private test (council Part A).

---

## M4 Crash monitor and the daily app

### S22 Markets data layer
- **Owner:** data-markets · **with:** architect · **Depends on:** S04f
- **Scope:** `docs/plan/loaders/markets.md`: the series tables, every source in Part 2, the maths, the schedule and request budget, the 13 fund slots, the Taiwan peak rule, `GET /markets/crash` from the server cache.
- **Acceptance:** the spec's Tests; every M SHOW/CAVEAT item has its `markets/src/items.test.ts` case; licensed series only in `connector-cache.db` and never exported (R17); a simulated day never exceeds any source's free limit; the endpoint answers from cache within its relative budget.
- **Tests:** the spec's named tests, `markets/src/calc.test.ts`, `markets/src/connectors.test.ts`, `markets/src/schedule.test.ts`, `markets/src/settings.test.ts`, `markets/src/items.test.ts`, `server/src/routes/v1/markets/crash/route.contract.test.ts`.
- **Demo:** `curl http://127.0.0.1:3000/api/v1/markets/crash` with no keys (official rows filled, price rows `needs_key` or `needs_symbol`), then with a key and a fund slot set.

### S23 Crash monitor UI (U9)
- **Owner:** frontend · **with:** designer, data-markets · **Depends on:** S03, S04u, S22 · **web-qa**
- **Scope:** `ui-build-plan.md` U9: tiles with several rows each, every row state (`ok`, `stale`, `needs_key`, `needs_symbol`, `peak_unknown`, `error`), cadence and delay labels, `peakBasis` labels, `totalWiped` above the grid, the 60 s poll without layout shift.
- **Acceptance:** U9; every state matches its mockup at four viewports; localised; axe clean.
- **Tests:** `web/e2e/crash.spec.ts`, `web/e2e/crash.visual.spec.ts`, `web/e2e/crash.a11y.spec.ts`.
- **Demo:** open `/en/crash`, watch a crypto row update; clear a fund slot and see "Choose a fund in settings".

### S24s Settings API
- **Owner:** architect · **Depends on:** S04b, S22
- **Scope:** `GET`/`PUT /settings/startup` (the opt-in start at login, council item 15), `GET /settings/status` (key presence, the SEC contact setting, data status per source with sync reports and purge-guard warnings, history size against P9, the LAWYER switches in force, month-to-date spend) and `PUT /settings/fund-slots`.
- **Acceptance:** no key value in any response; fund slots validated against `^[A-Z0-9.\-]{1,10}$`.
- **Tests:** `server/src/routes/v1/settings/**/route.contract.test.ts`.
- **Demo:** `curl .../settings/status` shows key presence without values.

### S24u Settings and connectors UI (U10)
- **Owner:** frontend · **Depends on:** S24s, S03 · **web-qa**
- **Scope:** `ui-build-plan.md` U10.
- **Acceptance:** U10; key values never reach the client (bundle check); a purge-guard sync shows its warning.
- **Tests:** `web/e2e/settings.spec.ts`.
- **Demo:** open Settings, add a fund symbol, see the Crash tile fill on the next refresh.

### S25 The one command, all countries, and scheduling
- **Owner:** architect · **Depends on:** S13-S22 · **web-qa**
- **Scope:** `pnpm finora` with the full `core` profile (architecture §4.6), every country's background first load and daily refresh, the market jobs, the health page, `docs/running.md` final.
- **Acceptance:**
  1. On a fresh clone (Windows and Linux), `pnpm finora` ends with the app running and real data for LV, EE, LT and US companies, with no manual step besides optional keys (phase 6 criterion 1).
  2. First core load ≤ 30 min, daily refresh ≤ 5 min, whole data dir ≤ 12 GB on `dev-desktop-1` (P10), recorded in `benchmarks.md`.
  3. Refresh and retention jobs run while the app is open and report on Settings.
  4. `pnpm finora --install-startup` adds an opt-in start at login on Windows (127.0.0.1 only, in the security review), and `--remove-startup` removes it; at boot a catch-up refresh runs every missed refresh, with values Stale until it finishes (council item 15).
- **Tests:** `scripts/finora.test.mjs`, `scripts/startup.test.mjs`, `server/src/jobs.catch-up.test.ts`, `server/src/jobs.test.ts`, CI `demo-boot`.
- **Demo:** a day of use: the morning Crash monitor, two company look-ups in different countries, one investigation, all from `pnpm finora`.

**M4 demo (council session 3d):** the day-of-use demo; the milestone gate on all four countries.

---

## M5 Done

### S26 Hardening and sign-off
- **Owner:** architect · **with:** every seat · **Depends on:** all
- **Scope:** security-engineer full review and fixes; a qa-codebase sweep; performance on the `full` profile; e2e and visual coverage of every DESIGN.md state; docs pass (README, running, MCP, contributing); the risk register in `docs/plan/prototype.md` closed or accepted; the LAWYER register reviewed with legal.
- **Acceptance:** phase 6 exit criteria in `docs/plan/README.md`; no open MUST-FIX from any review; CI green on the hub PR.
- **Tests:** everything above, green in CI; the milestone gate output.
- **Demo:** the demo script in `docs/plan/prototype.md`, run by the council.

---

## Rule coverage

Every rule's enforcement point is in architecture §10; this table says which slice builds it.

| Rules | Slice |
|---|---|
| R3, R4, R10, L1, L2, L4/P3, L5, L6, P1, P2, P4, P5, P13 | S04a (store), S04i (ingest), S07 (API), S19 (MCP), S08 (UI) |
| R1 | S05 |
| R5, P6, P7 | S04a, S07, S09a, S08 |
| R6, R16, L3 | S08 |
| R7, R9 | S04b (schemas), S09b, S10, S11 |
| R8 | S06, S10 |
| R11 | S04a, S21 |
| R12, R13, R14, P11 | S04i (invariants, fetcher), each loader slice |
| R15 | none in v1 |
| R17, P12 | S22, S24s |
| R18 | S02, S19 |
| P8 | S10 |
| P9 | S04a, S24s |
| P10 | every loader slice, S25 |
| P14 | S07 |
| PS2-PS7 | S04a, S04i, S05, S13 |

---

## Appendix: every SHOW and CAVEAT item

Generated from Part G of `docs/plan/council/01-data.md` (155 rows: 41 SHOW, 56 CAVEAT, 5 HIDE, the rest LATER), with the council's later calls applied: S07.LT.01, S08.LT.02 and S18.LT.02 on the agent path (`758a916`), and S10.LT.01, S10.LV.01 and S10.EE.01 moved to LATER with a MANUAL link (council 7029979738; to be recorded in Part G by the coordinator). **Data slice** loads it; **UI slice** renders it; the **acceptance test** is the parameterised case for that id, which asserts the value renders with its sources, its caveat when CAVEAT, and its empty state when there is no data. `domain/src/report/items.test.ts` and `agents/src/items.agent.test.ts` iterate `items.generated.ts`, so an id added to Part G without a case fails CI. The UI side is covered for every id by the field-registry test (architecture §10.5). HIDE ids are in architecture §10.4.

| item_id | Call | Data slice | UI slice | Acceptance test |
|---|---|---|---|---|
| S01.LT.01 | SHOW | S14 | S14 | `domain/src/report/items.test.ts › S01.LT.01` |
| S01.LV.01 | SHOW | S05 | S08 | `domain/src/report/items.test.ts › S01.LV.01` |
| S01.EE.01 | SHOW | S13 | S13 | `domain/src/report/items.test.ts › S01.EE.01` |
| S01.US.01 | SHOW | S16 | S08 | `domain/src/report/items.test.ts › S01.US.01` |
| S01.US.02 | SHOW | S17 | S17 | `domain/src/report/items.test.ts › S01.US.02` |
| S01.US.03a | CAVEAT | S17 | S17 | `domain/src/report/items.test.ts › S01.US.03a` |
| S01.US.07 | CAVEAT | S18 | S08 | `domain/src/report/items.test.ts › S01.US.07` |
| S01.ALL.01 | SHOW | S15g | S08 | `domain/src/report/items.test.ts › S01.ALL.01` |
| S01.ALL.02 | SHOW | S15g | S08 | `domain/src/report/items.test.ts › S01.ALL.02` |
| S02.LT.01 | SHOW | S14 | S14 | `domain/src/report/items.test.ts › S02.LT.01` |
| S02.LV.01 | SHOW | S05 | S08 | `domain/src/report/items.test.ts › S02.LV.01` |
| S02.EE.01 | SHOW | S13 | S13 | `domain/src/report/items.test.ts › S02.EE.01` |
| S02.US.01 | SHOW | S17 | S17 | `domain/src/report/items.test.ts › S02.US.01` |
| S02.US.02 | CAVEAT | S17 | S17 | `domain/src/report/items.test.ts › S02.US.02` |
| S02.US.03 | SHOW | S18 | S08 | `domain/src/report/items.test.ts › S02.US.03` |
| S03.LT.01 | CAVEAT | S14 | S14 | `domain/src/report/items.test.ts › S03.LT.01` |
| S03.LV.01 | CAVEAT | S05 | S08 | `domain/src/report/items.test.ts › S03.LV.01` |
| S03.EE.01 | CAVEAT | S13 | S13 | `domain/src/report/items.test.ts › S03.EE.01` |
| S03.US.01 | CAVEAT | S16 | S08 | `domain/src/report/items.test.ts › S03.US.01` |
| S03.US.02 | CAVEAT | S16 | S08 | `domain/src/report/items.test.ts › S03.US.02` |
| S03.US.03 | CAVEAT | S17 | S17 | `domain/src/report/items.test.ts › S03.US.03` |
| S04.LV.01 | CAVEAT | S05 | S08 | `domain/src/report/items.test.ts › S04.LV.01` |
| S04.EE.01 | CAVEAT | S13 | S13 | `domain/src/report/items.test.ts › S04.EE.01` |
| S04.US.01 | CAVEAT | S16 | S08 | `domain/src/report/items.test.ts › S04.US.01` |
| S04.US.02 | CAVEAT | S16 | S08 | `domain/src/report/items.test.ts › S04.US.02` |
| S06.LT.01 | SHOW | S14 | S14 | `domain/src/report/items.test.ts › S06.LT.01` |
| S06.LV.01 | SHOW | S05 | S08 | `domain/src/report/items.test.ts › S06.LV.01` |
| S06.EE.01 | SHOW | S13 | S13 | `domain/src/report/items.test.ts › S06.EE.01` |
| S06.US.01 | SHOW | S16 | S08 | `domain/src/report/items.test.ts › S06.US.01` |
| S06.US.02 | SHOW | S18 | S08 | `domain/src/report/items.test.ts › S06.US.02` |
| S07.LT.01 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S07.LT.01` |
| S07.LV.01 | CAVEAT | S05 | S08 | `domain/src/report/items.test.ts › S07.LV.01` |
| S07.EE.01 | CAVEAT | S13 | S13 | `domain/src/report/items.test.ts › S07.EE.01` |
| S07.US.02 | SHOW | S18 | S08 | `domain/src/report/items.test.ts › S07.US.02` |
| S07.US.03 | CAVEAT | S16 | S08 | `domain/src/report/items.test.ts › S07.US.03` |
| S08.LT.01 | SHOW | S14 | S14 | `domain/src/report/items.test.ts › S08.LT.01` |
| S08.LT.02 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S08.LT.02` |
| S08.LV.01 | CAVEAT | S05 | S08 | `domain/src/report/items.test.ts › S08.LV.01` |
| S08.EE.01a | SHOW | S13 | S13 | `domain/src/report/items.test.ts › S08.EE.01a` |
| S08.EE.01b | CAVEAT | S13 | S13 | `domain/src/report/items.test.ts › S08.EE.01b` |
| S09.LT.01 | CAVEAT | S14 | S14 | `domain/src/report/items.test.ts › S09.LT.01` |
| S09.LV.01 | SHOW | S05 | S08 | `domain/src/report/items.test.ts › S09.LV.01` |
| S09.EE.01 | SHOW | S13 | S13 | `domain/src/report/items.test.ts › S09.EE.01` |
| S09.US.01 | CAVEAT | S17 | S17 | `domain/src/report/items.test.ts › S09.US.01` |
| S10.US.01 | CAVEAT | S18 | S11 | `agents/src/items.agent.test.ts › S10.US.01` |
| S10.US.02 | CAVEAT | S18 | S11 | `agents/src/items.agent.test.ts › S10.US.02` |
| S11.LT.01 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S11.LT.01` |
| S11.LT.02 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S11.LT.02` |
| S11.LV.01 | SHOW | S06 | S08 | `domain/src/report/items.test.ts › S11.LV.01` |
| S11.LV.02 | SHOW | S06 | S08 | `domain/src/report/items.test.ts › S11.LV.02` |
| S11.LV.03 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S11.LV.03` |
| S11.EE.01 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S11.EE.01` |
| S11.EE.02 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S11.EE.02` |
| S11.US.01 | SHOW | S18 | S08 | `domain/src/report/items.test.ts › S11.US.01` |
| S11.US.02 | SHOW | S18 | S08 | `domain/src/report/items.test.ts › S11.US.02` |
| S11.US.03 | CAVEAT | S18 | S11 | `agents/src/items.agent.test.ts › S11.US.03` |
| S11.US.04 | CAVEAT | S18 | S11 | `agents/src/items.agent.test.ts › S11.US.04` |
| S11.ALL.01 | SHOW | S06 | S08 | `domain/src/report/items.test.ts › S11.ALL.01` |
| S11.ALL.02 | SHOW | S06 | S08 | `domain/src/report/items.test.ts › S11.ALL.02` |
| S11.ALL.03 | SHOW | S06 | S08 | `domain/src/report/items.test.ts › S11.ALL.03` |
| S11.ALL.05 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S11.ALL.05` |
| S13.LT.01 | SHOW | S14 | S14 | `domain/src/report/items.test.ts › S13.LT.01` |
| S13.LV.01 | SHOW | S05 | S08 | `domain/src/report/items.test.ts › S13.LV.01` |
| S13.EE.01 | SHOW | S13 | S13 | `domain/src/report/items.test.ts › S13.EE.01` |
| S13.US.01 | SHOW | S16 | S08 | `domain/src/report/items.test.ts › S13.US.01` |
| S13.US.02 | CAVEAT | S17 | S17 | `domain/src/report/items.test.ts › S13.US.02` |
| S13.US.03 | CAVEAT | S17 | S17 | `domain/src/report/items.test.ts › S13.US.03` |
| S14.US.01 | CAVEAT | S16 | S08 | `domain/src/report/items.test.ts › S14.US.01` |
| S14.US.02 | SHOW | S16 | S08 | `domain/src/report/items.test.ts › S14.US.02` |
| S14.LTLVEE.01 | SHOW | S15f | S08 | `domain/src/report/items.test.ts › S14.LTLVEE.01` |
| S15.LT.01 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S15.LT.01` |
| S15.LV.02 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S15.LV.02` |
| S15.EE.01 | SHOW | S13 | S13 | `domain/src/report/items.test.ts › S15.EE.01` |
| S15.EE.02 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S15.EE.02` |
| S15.US.01 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S15.US.01` |
| S15.LT.whois | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S15.LT.whois` |
| S16.ALL.01 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S16.ALL.01` |
| S17.LT.01 | CAVEAT | S14 | S20u | `domain/src/report/items.test.ts › S17.LT.01` |
| S17.LV.01 | CAVEAT | S05 | S20u | `domain/src/report/items.test.ts › S17.LV.01` |
| S17.EE.01 | CAVEAT | S13 | S20u | `domain/src/report/items.test.ts › S17.EE.01` |
| S18.LT.01 | SHOW | S14 | S14 | `domain/src/report/items.test.ts › S18.LT.01` |
| S18.LT.02 | CAVEAT | S10 | S11 | `agents/src/items.agent.test.ts › S18.LT.02` |
| S18.LV.01 | SHOW | S05 | S08 | `domain/src/report/items.test.ts › S18.LV.01` |
| S18.EE.01 | SHOW | S13 | S13 | `domain/src/report/items.test.ts › S18.EE.01` |
| S18.US.01 | CAVEAT | S16 | S08 | `domain/src/report/items.test.ts › S18.US.01` |
| M01.X.01 | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M01.X.01` |
| M01.X.02 | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M01.X.02` |
| M02.X.01 | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M02.X.01` |
| M03.X.01 | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M03.X.01` |
| M03.X.02 | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M03.X.02` |
| M04.X.01 | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M04.X.01` |
| M05.X.01 | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M05.X.01` |
| M05.X.02b | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M05.X.02b` |
| M06.X.01b | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M06.X.01b` |
| M06.X.02 | CAVEAT | S22 | S23 | `markets/src/items.test.ts › M06.X.02` |
| M07.X.01 | SHOW | S22 | S23 | `markets/src/items.test.ts › M07.X.01` |
| M08.X.01 | SHOW | S22 | S23 | `markets/src/items.test.ts › M08.X.01` |
