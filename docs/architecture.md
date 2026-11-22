# Finora architecture

> **Status: phase 3, milestone B.** §3-§4 (milestone A) are the contract the loader specs implement and were verified by qa. §5-§17 are revised against council session 1, `docs/plan/agents.md`, `docs/plan/ui-build-plan.md` and the loader specs. The slice plan is `docs/plan/slices.md`.

> **v1 runs locally only.** There is no hosted build until the publication-related LAWYER rows in `docs/plan/lawyer-register.md` (including `LAW-AGPL-HOSTED` and the share-alike rows) are cleared by a lawyer (legal; council Part E).

This document is for the people and agents who build Finora. It says where code goes, which way dependencies point, how data flows from a public registry to a sentence in a verdict, and which rules the code enforces. A builder should never have to guess; if this document leaves you guessing, that is a bug in the document.

---

## 1. Shape of the system

```
                ┌─────────────────────── apps/web (Next.js) ───────────────────────┐
 Browser ──────►│ server components ──render seam──┐    client components ──fetch/SSE──┐ │
                └───────────────────────────────────┼──────────────────────────────────┼─┘
                                                    ▼                                  ▼
 MCP client ──stdio / HTTP──► apps/mcp ──►  apps/server: handle(Request) · boot() · jobs · SSE
 CLI ───────────────────────► apps/cli ──►        │
                                                  ▼
          packages/agents ──► packages/agent-tools ──► packages/domain services
                │                                         │          │
                ▼                                         ▼          ▼
     Claude Code CLI (local)                   packages/store   packages/markets ──► market connectors (keyless)
     (the user's own sign-in)                   (SQLite file)
                                                  ▲
          packages/sources (loaders) ─────────────┘ ◄── official bulk files and APIs
```

- **One process locally.** `pnpm finora` starts Next.js (a production build, §16); Next mounts `apps/server` under `/api` and calls its `boot()` from the instrumentation hook, which starts the job runner (agent investigations, scheduled source refreshes, market refresh). Nothing else needs to run: no Docker, no database server, no Python.
- **Sync work never runs on the main thread** (cto B2). `node:sqlite` is synchronous, so a parse or a 5,000-record write batch on the main thread would freeze SSE streams, heartbeats and page renders. The job runner runs every source sync in a worker thread with its own database connection (the CLI runs it in its own process); the main thread serves requests and does only the small investigation writes. Test: `server/src/jobs.main-thread.test.ts` (during a fixture sync sized to run ≥ 10 s, an investigation event is written and broadcast with no `SQLITE_BUSY`, and no SSE heartbeat gap exceeds 3 s on CI runners; the absolute targets, `/api/v1/health` p95 under 100 ms and heartbeats under 1 s late, are recorded on `dev-desktop-1` in `benchmarks.md`, as qa #23 settled for timing).
- **One holder per resource, across processes** (cto B1). The job runner in the app, a CLI `data sync`, `next dev` restarting its instrumentation, and boot-time recovery can all overlap. A `leases` table (resource, holder = pid + boot id, heartbeat, expiry), taken inside `BEGIN IMMEDIATE`, decides: every sync takes `sync:<source>`, the job runner takes `runner`, investigation recovery takes `recover`. A second taker ends `already_running` (CLI, exit code 3) or skips the tick (scheduler); a lease whose holder missed its heartbeats past expiry is taken over. Tests: `store/src/leases.test.ts` (two concurrent syncs of one fixture source: one runs, the other ends `already_running`, no rows lost; two `boot()` calls start one runner; a killed holder's lease is taken over after expiry), `agents/src/recovery.test.ts` (a dead process's runs resume exactly once).
- **The same server runs standalone** (`pnpm server`) for hosting or for an MCP-over-HTTP client with the UI closed.
- **One SQLite file** (`<data dir>/finora.db`) holds registry data, investigations and settings. A second file (`<data dir>/connector-cache.db`) holds data we may not redistribute (market series from coded providers, fetched keyless); it is never exported and never served to anyone but its owner. A small JSON file, `<data dir>/providers.json` (the local provider map, C15, C17), holds the hosts, URL templates, licence, attribution and terms URL of each coded market source; it is user configuration, not data, so no backup, log line, error or API response ever carries it (§15).
- **One tool definition, three surfaces.** A capability such as "search companies" or "get a company's officers" is defined once in `packages/agent-tools` and exposed to the research agents, the MCP server and (through domain services) the HTTP API. They cannot drift.

### Why these choices

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Language | TypeScript everywhere (Node 24 LTS) | Python loaders: two toolchains for one maintainer, and the useful Python libraries (register parsers, entity resolution) are small enough to port or not needed for v1 |
| Store | SQLite through Node's built-in `node:sqlite` (FTS5 with the `trigram` and `unicode61 remove_diacritics` tokenizers verified on Node 24) | Postgres: a server to install for a local, single-user app. DuckDB: great for analytics, weaker for many small transactional writes from agents. A native SQLite addon: a C++ toolchain on Windows when no prebuild matches |
| Entity model | A FollowTheMoney subset (schema and property names), stored as **statements** with provenance | A bespoke relational schema per country: every new source would mean a migration, and per-value provenance and licence would be bolted on |
| Agent loop | The local Claude Code CLI (`claude -p`, stream-json), one process per run, on the user's own subscription sign-in, behind an `AgentBackend` interface (`cli`, `local`); Finora's tools reach it over a per-run MCP endpoint (the human, H5; C18) | The Messages API with a user key: no keys at all in v1 (H5). A hosted agent service: investigation history (which contains personal data) would live off the user's machine. Finora's own loop on a local open-weights model: kept as the `local` backend, built only if the human chooses it (H6) |
| Web framework | Next.js App Router | Separate SPA + API server: two deployables. The API stays a plain web-standard `handle(Request): Response`, so it is not tied to Next |
| Styling | Tailwind CSS v4 with design tokens as CSS variables; accessible behaviour from unstyled primitives (Radix) | CSS-in-JS runtime: slower server rendering. A component kit with its own look: the design is ours |

---

## 2. Repository layout

pnpm workspace, package scope `@finora/*`, ESM, TypeScript `strict`.

```
apps/
  web/            Next.js UI. Mounts apps/server under /api. Pages per tool.
  server/         HTTP API (handle), boot(), job runner, SSE, guards, route table
  mcp/            MCP server: stdio binary + an HTTP handler the server mounts at /mcp
  cli/            `finora` CLI: data sync, data status, suppress, doctor, export
packages/
  domain/         Pure: types, entity schema subset, value sets, policies, report assembly, verdict rules. No IO
  store/          SQLite: migrations, statement/fact/entity repositories, search, investigations, jobs
  sources/        Loaders (one module per source: meta, fetch, parse, field map), licence registry, polite fetcher
  ingest/         The sync pipeline: change detection, gates, writes, purge, history events, linking, sync reports
  resolve/        Entity resolution: official-ID linking, name normalisation, candidate scoring, judgements
  agents/         Agent runtime: orchestrator, agent backends (the CLI, the fake CLI), usage ledger, event bus, citation verifier
  agent-tools/    Tool definitions shared by agents and MCP
  markets/        Crash monitor: connectors, peak/drawdown maths, tile assembly
  api-contract/   Zod schemas, API_ROUTES, error codes, OpenAPI generation
  i18n/           Locales, message catalogues, formatting helpers, parity tests
  ui/             Design tokens and primitives (from DESIGN.md)
  tooling/        Shared tsconfig, ESLint, Vitest presets
fixtures/         Synthetic datasets for tests and the demo seed (no real entities, ever)
docs/             This file, conventions, plan, research
scripts/guard/    The publish guard (unchanged)
```

### Dependency direction

Each package may import only the packages in its row. The row **is** its `package.json` `dependencies` list; pnpm's strict resolution then refuses an undeclared import, and `scripts/check-deps.mjs` (run in CI) fails if a `package.json` grows an edge this table does not allow.

| Package | May depend on |
|---|---|
| `domain` | nothing internal |
| `formats` | nothing internal (zip, XLSX, XML and CSV readers with one set of archive limits; Node built-ins allowed) |
| `i18n` | nothing internal |
| `ui` | `i18n` (types only) |
| `api-contract` | `domain` |
| `store` | `domain` |
| `sources` | `domain`, `formats` |
| `resolve` | `domain`, `store` |
| `ingest` | `domain`, `store`, `sources`, `resolve` |
| `markets` | `domain`, `formats` |
| `agent-tools` | `domain`, `store`, `resolve`, `markets` |
| `agents` | `domain`, `store`, `agent-tools` |
| `apps/server` | all packages except `ui`, plus `apps/mcp` (its HTTP handler, mounted at `/mcp`) |
| `apps/mcp` | `domain`, `store`, `agent-tools`, `api-contract` |
| `apps/cli` | `domain`, `store`, `ingest`, `sources` (the core loaders), `resolve` (`finora-cli resolve --sanctions`), `fixtures` (the `fixtures` profile) |
| `fixtures` | `domain`, `sources`; for its tests also `ingest`, `store` |
| `apps/web` | `api-contract`, `ui`, `i18n`, `domain` (types and pure helpers only), `apps/server` (seam files only) |

Lint rules on top of the graph:
- `apps/web` imports `@finora/server` only in the seam files listed in §5.3.
- `apps/web` imports `@finora/domain` with `import type` or from `@finora/domain/pure/*` (formatters, value sets), never services.
- `packages/domain` imports no Node built-ins (it must run in the browser and in tests without IO).
- No `any`. `unknown` only at a trust boundary, narrowed immediately by a Zod schema.
- Read the environment through `apps/server/src/env.ts` (Zod-validated once at boot), never `process.env`.

### Where things go

| Concern | Home |
|---|---|
| A fixed set of strings (section IDs, error codes, statuses, roles) | `packages/domain/src/config/<name>.ts` as `const X = [...] as const` + derived type + `isX` guard |
| Request/response schemas | `packages/api-contract/src/<area>.ts`, never inline in a route |
| API paths | `API_ROUTES` in `packages/api-contract/src/routes.ts`; UI paths in `apps/web/src/lib/page-routes.ts` |
| Business logic | `packages/domain` if pure, else the package that owns the IO (`store`, `sources`, `agents`, `markets`) |
| HTTP plumbing (SSE, guards, body limits) | `apps/server/src/lib/` |
| A loader | `packages/sources/src/<country>/<source-id>/` (spec: `docs/plan/loaders/<source-id>.md`) |
| The sync pipeline, gates, history events | `packages/ingest/src/` |
| An agent tool | `packages/agent-tools/src/<tool-name>.ts` |
| A product tool's pages | `apps/web/src/app/[locale]/(tools)/<tool-id>/` + `apps/web/src/tools/<tool-id>/manifest.ts` |

---

## 3. Data model

> Revised in phase 3 (milestone A) against council session 1 (`docs/plan/council/01-data.md` Parts E, G, H), cto's calls (`01-data-cto.md`) and the early plan review (`docs/plan/reviews/00-early-plan-review.md`). Loader specs in `docs/plan/loaders/` implement this section and §4.

### 3.1 What is stored, and what is not

Four rules decide everything the store holds (cto load rules 1-4, adopted by the council):

1. **Statements hold entity attributes and relationships only** (name, code, legal form, status, address, roles, members). Numbers by period go to **facts**; dated register entries and our own change records go to **events**.
2. **Every stored value maps to an `item_id`** from Part G whose call is SHOW or CAVEAT, or to a **resolution key** that linking or a verdict rule needs (registry code, LEI, VAT, CIK, legal form). Nothing else is read from a source file. One generated list (§3.6) drives this rule, the rendered-field registry (qa checklist 9) and the HIDE negative tests.
3. **Financials: the latest 5 fiscal years** at load. Deregistered and struck-off companies keep identity properties only (name, code, form, status, dates).
4. **HIDE and LATER items are never loaded.** A field mapped to one is dropped in the parser, counted in the sync report, and has a negative test.

Never stored, whatever the source offers (policy P3, legal rules 1 and 5): personal codes (masked or not), birth dates or ages derived from them, the EE person hash, gender, personal emails, home addresses, sole-trader addresses finer than the country, natural-person insolvency, tax or arrears lines tied to a natural person, sole traders' securing measures and tax suspensions, and sole traders' VAT numbers (an LV VAT number embeds the personal code; the profile shows "VAT registered: yes / no" only). Council, `01-data.md` Part H, calls from the Baltic loader specs.

### 3.2 Provenance: syncs and records

Every value carries its provenance through two rows, not through columns repeated on every value (that is what makes the lean layout 3x smaller):

```sql
-- one row per attempt to refresh a source, whatever happened
syncs(
  id            INTEGER PRIMARY KEY,
  source_id     INTEGER NOT NULL REFERENCES sources(id),
  kind          TEXT NOT NULL,   -- 'content' | 'unchanged' | 'stale_skipped' | 'partial' | 'failed'
  licence_id    TEXT NOT NULL,   -- the licence in force for this sync (R3; a later licence change never rewrites old rows)
  storage       TEXT NOT NULL,   -- storage class in force (§3.5)
  started_at    TEXT NOT NULL,   -- ISO 8601 UTC
  finished_at   TEXT,
  upstream_as_of TEXT,           -- the as-of date, from the strongest strategy the source offers (§4.2 AsOfRule)
  as_of_basis   TEXT,            -- which strategy produced it: in_file_field | in_file_name | max_date_in_data | portal_metadata | http_last_modified
  content_hash  TEXT,            -- sha256 of the raw artifact(s)
  parser_version TEXT NOT NULL,  -- hash of the loader module + its field map + the generated item list (A1)
  report_json   TEXT             -- counts: read, written, unchanged, deleted, dropped by reason, duration
);

-- one row per source record: the unit of change, not the file row (cto, measured). A wide source's record is one row or object;
-- a long-format source (EE annual-report elements, LT P&L and balance lines, LT social-insurance months) groups its rows into
-- one record per report or company-period. Every loader spec states its record unit and the sort order it relies on.
records(
  id                   INTEGER PRIMARY KEY,
  source_id            INTEGER NOT NULL,
  record_key           TEXT NOT NULL,     -- the source's own stable key, or a documented derivation (loader spec)
  row_hash             BLOB NOT NULL,     -- sha256 truncated to 16 bytes, over what the gate keeps of the record (per-key collisions are not a practical risk)
  first_sync_id        INTEGER NOT NULL,
  last_changed_sync_id INTEGER NOT NULL,  -- the sync that wrote the current values: licence and retrieval come from it
  UNIQUE (source_id, record_key)
);
```

Every statement, fact report and event points at its `record_id`. From the record the read path derives the full `SourceRef` (R3, R16):

| `SourceRef` field | Derived from |
|---|---|
| `sourceId`, `sourceName`, `attribution`, `licenceUrl` | `sources` row + the source registry (§4.2) |
| `licenceId` | `syncs.licence_id` of `last_changed_sync_id` |
| `retrievedAt` | `syncs.started_at` of `last_changed_sync_id` |
| `asOf`, `asOfBasis` | `upstream_as_of` and `as_of_basis` of the source's latest `content` sync (a live record was confirmed by it). The stale rule uses `asOf`. A weaker basis (`portal_metadata`, `http_last_modified`) renders as "as published by the portal" |
| `checkedAt` | `started_at` of the source's latest `content` or `unchanged` sync: "Checked [source] as of [date]" uses it, so a list confirmed today reads as checked today even if its file is a week old (A5) |
| `sourceUrl` | the source's deep-link pattern applied to `record_key`, when the source has one |
| `accessTier`, `personal` | the value's `item_id` (§3.6) plus the entity's `natural_person` flag |
| `derived` | true for values Finora computes (events of kind `finora.*`, shared-address counts, parent links): rendered with the "Derived by Finora" chip, citing the records they were computed from |

`SourcedValue<T> = { value: T; sources: SourceRef[] }` with `sources.min(1)` in the Zod schema, so no value can reach the API, MCP or UI without one. The hop tests are unchanged in intent: `store/src/provenance.test.ts`, `domain/src/report/assemble.test.ts`, the route and MCP contract tests, `web/e2e/report-sources.spec.ts`. Added test: `store/src/licence-history.test.ts` (change a source's licence; rows written before keep the old licence, rows written after carry the new one).

### 3.3 Entities, statements, facts and events

**Entities** use FollowTheMoney schema and property names for a small subset (`Company`, `Organization`, `LegalEntity`, `Person`, `Address`, `Directorship`, `Ownership`, `Membership`, `Sanction`, `Security`), defined as data in `packages/domain/src/schema/`; `schema/ftm-subset.test.ts` checks every name exists upstream or is a listed extension. FtM JSON export is generated from the same rows.

```sql
entities(
  id              INTEGER PRIMARY KEY,
  eid             TEXT NOT NULL UNIQUE,   -- public id, §3.4
  schema_id       INTEGER NOT NULL,       -- interned FtM schema
  country         TEXT NOT NULL,          -- 'lt' | 'lv' | 'ee' | 'us' | 'intl'
  legal_form      TEXT,                   -- normalised code, per-country table in domain/config/legal-forms.ts
  natural_person  INTEGER NOT NULL,       -- 1 for persons and sole traders (legal rule 5), from the legal form
  status          TEXT,                   -- normalised: active | liquidating | insolvent | struck_off | ...
  caption         TEXT NOT NULL,          -- display name; for natural_person = 1: legal form + registry code, never the name (title, search, URL)
  tombstone_since TEXT,                   -- set when the entity left the source's open data (EE), identity kept
  first_sync_id   INTEGER NOT NULL
);

statements(
  id         INTEGER PRIMARY KEY,
  entity_id  INTEGER NOT NULL,
  prop_id    INTEGER NOT NULL,            -- interned FtM property
  value      TEXT NOT NULL,               -- normalised: ISO dates, ISO 3166 lower-case, trimmed text
  lang       TEXT,                        -- BCP 47 where the source states one
  item_id    INTEGER NOT NULL,            -- §3.6; NOT NULL is the load-rule-2 guarantee
  record_id  INTEGER NOT NULL
);

-- facts: narrow, provenance on the report row (16 B per figure measured, vs 123 B as statements)
fact_reports(
  id           INTEGER PRIMARY KEY,
  entity_id    INTEGER NOT NULL,
  kind         TEXT NOT NULL,             -- 'annual_accounts' | 'quarterly_tax' | 'monthly_insured' | ...
  period_start TEXT, period_end TEXT NOT NULL,
  currency     TEXT, unit_scale INTEGER NOT NULL DEFAULT 1,  -- "reported in thousands" stays visible
  record_id    INTEGER NOT NULL
);
facts(report_id INTEGER NOT NULL, concept_id INTEGER NOT NULL, value REAL NOT NULL, PRIMARY KEY (report_id, concept_id)) WITHOUT ROWID;

-- events: dated register entries, and our own change records
events(
  id         INTEGER PRIMARY KEY,
  entity_id  INTEGER NOT NULL,
  type_id    INTEGER NOT NULL,            -- interned: 'register.ruling', 'filing.8k.5.02', 'finora.name_changed', 'finora.role_ended', 'finora.debtor_listed', ...
  date       TEXT NOT NULL,
  data       TEXT,                        -- small JSON: old and new value for company attributes; never a person name or key
  item_id    INTEGER NOT NULL,
  record_id  INTEGER                      -- NULL for finora.* events, which cite the records they compare in data
);
```

Concepts (`revenue`, `net_profit`, `equity`, `total_assets`, `employees`, `taxes_paid`, `tax_arrears`, `insured_persons`, ...) live in `packages/domain/src/config/concepts.ts`, each mapped to its `item_id`. Every loader spec maps its source fields to concepts in its field map.

**People exist only inside a company** (legal rules 1-2, P4, the HMAC withdrawal). Legal's answer to the coordinator (comment 7029602696): names of **current** officers in company context are CAVEAT (rule 2, light Y), shown behind the purpose gate with the rule 6 disclaimer. Only a *persistent pseudonymous id* needs a lawyer. So v1 stores people with **no persistent person id at all**:

- **Record unit: one role set per company.** A person source's record is a company's whole set of current roles in that source (`recordKey` = company eid + source table), and its hash input is every role line in a fixed order. A change to any role replaces the set. The person's code, hash or any value derived from them is never a key, never a hash input and never stored.
- **Person rows** are `Person` entities whose `eid` is `p-` + the record's integer id + the line's position in source order (`p-81231-2`). Position follows the source file's order within the set, never a sort by name, so the id is not derived from the name. It is internal, never in any URL, title, log line, FTS index, export or MCP bulk list, and changes whenever the set changes. That is the "non-persistent row id" legal asked for. The same human in two companies is two unrelated rows.
- **Stable targets.** Nothing that must survive a reload points at a person row id. Findings and citations point at the company eid, source, item and the citation snapshot (value, source, licence, retrieval time, qa #18); `purpose_log` records the company eid only. Test: `store/src/person-targets.test.ts` (reload the source; an existing citation still resolves).
- **Disputes and restrictions survive any reload and any repair (R10, L5, qa M1, qa S04a Q-2 and Q-3).** No content hash of a person's line exists anywhere (council session 2 addendum 5, legal). A person's line is targeted by company eid + item + the source's row-local role-row id (`records.line_ids`, LV and EE), or + its role where the source has none (US people sources: that role's lines). Only a company's own line (a corporate officer or member) is targeted by a content hash of its normalised fields. An open dispute or a suppression on a person's line is written first to the fail-closed `restrictions.log` (`reason: "dispute"` or `"suppression"`), which no backup holds and every read applies, so a repair never shows the line again; `user.disputes` keeps the workflow row. Because a change to any role replaces the whole set, nothing is tied to a person row: after every load, and at every read, a matching line stays hidden. Tests: `store/src/disputes.test.ts` (a dispute on officer A survives the replacement of the set and B shows; a later reload changes nothing; a repair that lost the dispute row keeps A hidden; no hash, name or person id is stored; a US principal by role; a corporate officer by hash), `store/src/purpose.test.ts` (an LV officer restricted by row id and a US principal by role are absent from `readPurposeSection`; a missing `restrictions.log` refuses the read).
- **Detecting a role end without a person key (qa S1).** Each role line's identity inside the set is the source's own row-local role-row id where it has one (LV officer `id`, EE `kirje_id`, per `baltics.md`; row-local and not code-derived, so it meets PS1), used only inside the diff, never in any output. The previous sync's line identities are kept in an internal `records.line_ids` blob (one per role-set record), never output, logged or exported, and covered by the PS5 canary. Without one, the identity is the pair (role, start date); without a start date either (CT principals, PA parties, the NY CEO, SEC insiders, Form D), it is (role, occurrence), and `finora.role_ended` fires when the number of lines with that role falls (data-us). A `finora.role_ended` event fires only when a line identity disappears or a role's count falls, never by comparing names or content, so a corrected name spelling or a changed role title on the same row id is not a role end. Test: `ingest/src/role-ended.test.ts` (a spelling fix on the same row id emits no `role_ended`; a removed row does).
- **No HMAC is computed in v1.** `PERSON_ROWS=names_no_id` is the v1 default (council 7029625427, legal 7029620896). The per-company pseudonym (an install-local HMAC, legal light Y on five conditions, `legal.md` "Per-company person pseudonym") is the later mode `PERSON_ROWS=pseudonym`, a **P13 LAWYER row, `LAW-PSEUDONYM`**, unbuilt in v1. A switch to `pseudonym` needs the lawyer's answer, the five conditions enforced (PS1 the input is a row-local key, never code-derived; PS3 the key is install-local, never exported, logged or backed up; plus PS2, PS4, PS5 below), and a new slice.
- **Latvian scope limit, LAWYER (`LAW-LV-OFFICERS`):** whether Latvian board and officer data stays public after the 9 Nov 2026 ruling. Interim: LV officer names are shown behind the purpose gate, as above. `LV_PERSON_ROWS=names_no_id` (interim) or `role_counts`, which falls back to role counts and start dates without names, with no code change. If the lawyer rules against names, the switch flips and council's branch 3 applies to LV: the LOCK variant with "Officer names: pending a legal review", check 3 runs on counts and dates, officer sanctions screening counts as not run ("Officers not screened: names not loaded"), and the promise reads "the full counterparty check, except who runs it".

Conditions that hold in v1, each with an enforcement point and a test:

| # | Condition | Enforcement | Test |
|---|---|---|---|
| PS2 | No cross-company join of person rows: no output, query, index or API | person rows are excluded from `entities_fts`, `links` and `judgements`; the store exposes them only through `readPurposeSection(companyEid, ...)`, which filters on that one company; no repository method takes a person eid as input | `store/src/person-scope.test.ts` (the same fixture human in two companies yields two unrelated rows, and no repository call returns both) |
| PS4 | Current roles only; nothing is kept when a role ends (P4, 0 days interim) | the role-set record is replaced whole; the removed line leaves only a `finora.role_ended` event with no name and no id | `ingest/src/history.test.ts` (after the role disappears, no row, event or log line carries the old name or id) |
| PS5 | No person id, internal hash or personal code in any API, MCP, export, log or agent output, and a fixture code never reaches the store | person DTOs carry a per-response index (`p1`, `p2`, ...) instead of the eid; the role-set row hash, the dispute content hash and the source's role-row id are internal only (legal 7029642009, 7029662017); the P3 canary scanner covers the eid pattern, these hashes and ids, and the code patterns | `apps/server/src/canary.contract.test.ts`, `apps/mcp/src/canary.test.ts`, `domain/src/export/canary.test.ts`, `agents/src/canary.test.ts` (scan every surface for the fixture eids and codes), `store/src/canary.test.ts` (the fixture codes are absent from every table) |
| PS6 | No person identifier is ever a record key, hash input or stored value: the source's person code, the EE hash, an SEC reporting owner's CIK, and any id that embeds one (an SEC accession number filed by an individual starts with that person's CIK) | the field map marks them `dropped: personal_code`; records of individual filers are keyed on issuer + filing date + sequence (qa 15, legal) | `sources/src/person-fields.test.ts` (each person loader's record keys, hash inputs and stored fields contain no code-pattern field and no accession number whose prefix is not the issuer's CIK) |
| PS7 | LV names follow `LV_PERSON_ROWS` | `assembleReport` reads the switch; `role_counts` renders role counts and start dates only, and no LV name reaches the UI, API, MCP, export or agent tools | `domain/src/report/lv-people.test.ts` (both modes, all surfaces) |

### 3.4 Entity IDs

| Entity | `eid` | Fixture rule (qa #9) |
|---|---|---|
| LV company | `lv-<11-digit registration number>` | LV, EE and LT codes carry a mod-11 check digit (data-baltics): a fixture code with true check digit c is written with (c + 1) mod 10, so no register can ever assign it |
| EE company | `ee-<8-digit registry code>` | as LV |
| LT company | `lt-<9-digit company code>` | as LV |
| Foreign holder or officer known only by name (a company, not a person) | `org-<20 hex>`: sha256 of (source, company eid, record key, the line's row id, e.g. `kirje_id` or the officer `id`), scoped to the company that lists it, so two foreign holders in one role set never collide; never merged across companies | the fixture key |
| Relationship row (Directorship, Ownership, Membership) | `rel-<record id>-<position>`, internal, like person rows | the fixture key |
| LV legacy 9-digit code | skipped, counted as `legacy_code` | - |
| US SEC filer | `us-cik-<10-digit CIK>` | reserved range `99xxxxxxxx` |
| US state record | `us-<state>-<state id>` | prefix `FX` |
| LEI-only entity | `lei-<LEI>` | fixture variant of ISO 7064 mod 97 |
| Sanctions list entry (company) | `sanc-<list>-<entry id>` | reserved ranges (`sanctions.md`): OFAC `90000000`-`90000099`; EU `900000`-`900099` and `EU.FX.*`; UK `FX0001`-`FX0099`; IMO numbers `99000xx` |
| Person in company context | `p-<record id>-<position>`, internal only, never output (§3.3; no HMAC in v1) | follows the company's fixture id |

The nightly `live` job asserts the reserved ranges stay unassigned in the real registers. `fixtures/ids.test.ts` checks every fixture id against its rule.

### 3.5 Storage classes

Every source's registry entry (§4.2) has exactly one storage class. The class decides where rows may exist; CI tests each class's guarantee.

| Class | Where | Used for | Guarantee and test |
|---|---|---|---|
| `store` | `finora.db` | open-licence registers, GLEIF, official sanctions lists, SEC | the default; licence invariants (§4.2) |
| `share-alike-store` | `finora-sa.db`, attached read-only at query time | EE tax board (S07.EE.01, S08.EE.01), switchable | P1: the main store never holds a share-alike row **or anything derived from one** (history events included). Its tables mirror the main ones but key every row on the entity's public `eid` (text), never on `finora.db` integer ids, so a rebuild of either file cannot break the join (A6). Export, bulk API and bulk MCP exclude it; single-company responses carry its attribution and licence link. **Investigations too (qa MUST-FIX 1, legal):** any signal, finding or citation snapshot derived from a share-alike value is written to `finora-sa.db` (tables `sa_signals`, `sa_findings`, `sa_citations`, keyed on investigation id and finding id); the main store keeps only a reference row (finding id, check id, `licenceClass: "share_alike"`, no value, no text). The verdict's fired rule ids stay in the main store: they are Finora's rules, not the source's data, and a rule id never embeds a value from the source (legal). In `live-no-store` mode an investigation keeps nothing derived from the share-alike value: the finding renders during the run from memory, and a reopened report shows "EE tax-debtor list: re-checked when you open the report" and re-fetches. Tests: `agents/src/share-alike.test.ts` (both modes: no main-store row holds a share-alike value or paraphrase, and no stored fired-rule id contains one; in `live-no-store` mode nothing derived is written), `ingest/src/share-alike.test.ts` (no main-store row or event references a share-alike sync, in both modes), `store/src/share-alike-rebuild.test.ts` (rebuild `finora.db`; the share-alike rows still attach), `domain/src/export/export.test.ts` |
| `live-no-store` | memory only | the share-alike sources when `SHARE_ALIKE_MODE=live-no-store`; small daily lists | the file is read into memory at refresh and never written: no store row, no cache row, no file, no log line containing its values. The sync still writes its one `syncs` row with counts only (no values), so health and Settings can report it. Test: `ingest/src/live-no-store.test.ts` with sentinel values and a spied filesystem and logger (legal condition 1). Large files in this mode (EE taxes paid) show `not_checked{reason: "later"}` with "Not checked: licence question pending" |
| `live-cached` | `finora.db`, rows with a cache marker | US state registries (NY, CO, CT, PA) | written only for an entity the user opens; re-fetched on view when older than `LIVE_CACHE_REFETCH_HOURS` (24); purged when not viewed for `PERSON_DATA_TTL_DAYS` (30). A re-fetch that returns the company replaces its lines, and a withdrawn or corrected record is removed (CT terms). **An empty response is not proof of removal** (cto, data-us, legal): on the first miss (HTTP 200, empty, while the portal answers other queries) nothing is deleted, the cached values are withheld from every surface, and the profile reads "[State] registry did not return this company on [date]", naming no principal and implying no status; a second miss at least 24 h later deletes the rows, withdrawn principals included. 5xx, timeouts and 429 never count as a miss. **The miss rule applies per dataset query** (the master record, principals, UCC filings each count their own misses), so an empty answer from one dataset never deletes that dataset's rows or emits `role_ended` on its own (qa 16, legal). Tests: `ingest/src/live-cache.test.ts` (fake clock: day 29 survives, day 30 deleted; 24 h re-fetch; CT withdrawal; an empty re-fetch withholds and keeps the rows; a second miss 24 h later deletes them; a 5xx is not a miss) |
| `agent-only` | investigation `documents` only | web checks, live national sanctions lists, UN list, news, US enforcement feeds, and the LT social-insurance files (S07.LT.01, S08.LT.02, S18.LT.02: read live by the money agent's `read_live_source` tool (`agents.md` §4.4b), never stored; council and legal, `LAW-SODRA-LICENCE`; the instant profile shows "Social-insurance data: checked when you investigate") | fetched by agents at query time, cited, kept only as investigation documents under the R11 TTL |
| `store`, agent-read only | `finora.db` `court_index` | the FJC civil court index (1.56 M organisation-party rows, ≈ 0.2 GB, measured) | stored, read only by the legal agent's court tool, never rendered without an accepted agent finding |
| `connector-cache` | `connector-cache.db` | licensed market series (keyless; coded providers configured in `<data dir>/providers.json`, §15) | never exported, never served to another user (R17) |

**One declared exception to "exactly one class": a person view.** A source whose file mixes companies and natural persons may declare, besides its class for company rows, an in-memory `live-no-store` person view of the same download (today only the EU, OFAC and UK sanctions lists: `resolve/src/person-index.ts`, officer screening behind the purpose gate, `LAW-SANCTIONS-PERSONS`). The person rows are dropped at parse from the stored path (`person_entry`), the source sets `rawCache: false`, and the view obeys every `live-no-store` guarantee above. Test: `resolve/src/person-index.test.ts`.

`SHARE_ALIKE_MODE` (`store` default, or `live-no-store`) switches the EE share-alike sources with no code change (legal's condition for clearing the share-alike store). CI runs the EE loader tests in both modes.

### 3.6 Items: the one list behind load rule 2

`scripts/gen-items.mjs` parses the Part G table in `docs/plan/council/01-data.md` into `packages/domain/src/items/items.generated.ts`:

```ts
type Item = {
  id: ItemId;                       // "S08.EE.01a"
  section: SectionId;               // "S08"
  country: "lt" | "lv" | "ee" | "us" | "all" | "x";
  call: "show" | "caveat" | "later" | "hide";
  caveatKey: string | null;         // "items.<id>.caveat", the i18n key for the caveat line
  emptyStates: EmptyStateKey[];     // in Part G order; [] = none (the field does not render when absent)
  personal: boolean;                // natural-person data: purpose gate, disclaimer, TTL
  accessTier: "open" | "purpose";
};
type EmptyStateKey = "NP" | "CN" | "NC" | "PAID" | "LOCK" | "KEY" | "MANUAL" | "AGENT" | "PURPOSE"; // PURPOSE = needs_purpose
```

Part G's empty-state cell often names more than one state (`AGENT / CN`, `needs_purpose; then NP`), so the generator keeps every key in order and drops the quoted copy. `personal` is true exactly where Part G gives `needs_purpose`, and `accessTier` follows it. The English caveat lines are generated beside the items as `ITEM_CAVEATS_EN`, the source of the `items.<id>.caveat` catalogue keys. A test fails when the generated file is stale against `01-data.md`. The restricted-section rules (country, legal form, section, legal basis key) live next to it in `packages/domain/src/items/policy.ts`, hand-written, reviewed by legal, and land with the report assembly in S09a. Consumers:
- `ingest`: a field map entry whose target item is `hide` or `later` fails `sources/src/field-maps.test.ts`; every target must be a `show`/`caveat` item or a resolution key.
- `domain/report`: section states and caveats come from the item (`assembleReport`).
- the rendered-field registry: every UI value renders through `FieldRow itemId=...`; `web/src/field-registry.test.ts` compares the ids rendered on `/design` and the fixture pages with the `show`/`caveat` ids (qa checklist 9).
- the HIDE negative tests: one per HIDE id, on UI, API, MCP, export and the agent path (§10).

### 3.7 History: our own snapshots (P9, P4, P14)

The registers publish current state only, so history exists from install day. It is stored as events, never as full daily copies.

| Change seen between two content syncs | Stored as |
|---|---|
| A company attribute changed (name, address, status, legal form, capital) | `finora.<attribute>_changed` event with old and new value; the statement holds the new value |
| A person role disappeared | `finora.role_ended`: "a board member's role ended on [date]", with no name and no person key (P4, legal condition 2). The person row is deleted |
| An entity entered or left a debtor list (LT, EE) | `finora.debtor_listed` / `finora.debtor_cleared`, with amount band only for companies. Events derived from a share-alike source (the EE debtor list) are written to `finora-sa.db`, never the main store; in `live-no-store` mode they do not exist, because there is nothing to compare against without writing (A4) |
| An EE company vanished from the open files | `tombstone_since` set; identity statements kept; "Not in the register's open data since [date]" |
| A sole trader vanished | identity fields only, company context, purpose note (legal condition 3) |

`HISTORY_MAX_GB` (1) only warns, in the health check and on Settings; history is never deleted silently (P9). Rules that need a window of history (renamed in 6 months, the LT 180-day arrears age, "no longer on the debtor list since") return `not_evaluated{trackedSince}` until our snapshots cover the window (P14); `domain/src/verdict/history-window.test.ts` proves a 10-day-old install cannot report "no rename in 6 months".

### 3.8 Tables

| Table | Purpose |
|---|---|
| `sources` | mirror of the source registry: id, storage class, last content sync, status |
| `syncs`, `records` | §3.2 |
| `entities`, `statements`, `fact_reports`, `facts`, `events` | §3.3 |
| `props`, `schemas`, `concepts`, `event_types`, `items` | intern tables (integer ids for repeated strings) |
| `entities_fts` | FTS5 `unicode61 remove_diacritics 2` over company names, codes and former names; never person names, never `natural_person = 1` names (sole traders are found by code only) |
| `entities_trigram` | FTS5 `trigram remove_diacritics 1` over the same names, for substring and typo search |
| `links` | official-ID links between entities (LEI ↔ registry code, CIK ↔ LEI, VAT ↔ code), with the asserting record |
| (in `finora-user.db`) `judgements` | resolution decisions (same / different / unsure), by rule, agent or human; never overridden by a reload |
| `live_cache_views` | last view time per `live-cached` entity (P5) |
| `labels` | classifier labels too large for generated config (LT's 2,302 activity labels, per language); legal forms and statuses stay generated config in `domain/config/` |
| `court_index` | US federal court index (FJC): one row per case and organisation party, 10 years (5 if it passes 0.3 GB), read only by the legal agent's `search_courts` tool, never rendered directly (`docs/plan/loaders/us-courts.md`) |
| (in `finora-user.db`) `disputes`, `suppressions` | R10, L5: applied at read time on every surface |
| (in `finora-user.db`) `purpose_log` | P2: append-only, one row per company whose person data is opened, with the purpose in force; never updated |
| (in `finora-user.db`) `investigations`, `agent_runs`, `run_tasks`, `run_events`, `questions`, `signals`, `findings`, `citations`, `documents`, `cost_ledger`, `verdicts` | agent runtime (§7) |
| `market_series`, `market_obs`, `market_latest` | Crash monitor series (§8; DDL in `docs/plan/loaders/markets.md` §1.2); the same tables in `connector-cache.db` for licensed series |
| `jobs`; (in `finora-user.db`) `settings` | background work; local settings (fund tickers, P12) |
| `leases` | cross-process locks: resource (`sync:<source>`, `runner`, `recover`), holder (pid + boot id), heartbeat, expiry (§1) |

Pragmas: WAL, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000` (60 s while a connection opens and migrates, since another process may be migrating a fresh store). Every connection sets `temp_store=MEMORY`. **One write path** (cto on S05, no second first-load path): the sync worker's connection (`openStore({ sync: true })`) adds a 64 MB page cache and a prepared-statement cache, which is emptied at the end of every sync and finalized when the worker closes the connection at batch end; no other connection caches a statement, so no bound value outlives its sync. A batch is sized from the last one's rate (`nextBatchSize`: about `maxMs` of write lock, 50 to 5000 records). `writeParsed` compares the record hash before reading any snapshot. A sync writes captions inline, deletes inline the search rows of an entity that is no longer searchable (a company rewritten as a sole trader is never found by name, not even before the pass; `searchCompanies` also returns a natural person only for a registry-code match), and marks touched entities in `main.search_dirty`; their search rows are written in one pass at the sync's end, 5,000 per fenced transaction, and a sync or boot finishes any marks a cut-off sync left (`rebuildSearch`). **The record hash is what the gate keeps** (J2 on S05, legal): `row_hash` is sha256 over a key-sorted JSON of the gated record (its entities, reports, events, withheld markers, line ids, period, and one slot per party, loaded or not), never the loader's raw input. A refused or withheld value, an unproven party's name included, is in no hash, so none can be confirmed against one, and two equal withheld names reveal nothing; a change only to such a value writes nothing, and every stored change writes. A record waiting for a reference adds the retry marker. Migrations are forward-only and numbered, each in a transaction, tracked with `PRAGMA user_version`. **On the three large tables (`statements`, `facts`, `records`) a migration is additive only** (new nullable columns, new indexes, new tables); anything that would rebuild them is a re-derive through `parserVersion` instead, because a rebuild doubles disk use and takes minutes on a ~7 GB store (cto S3). `store/src/migrations.test.ts` fails on a migration that rewrites one of them. Secondary indexes on `statements`, `facts` and the FTS tables are built after the first load of a source, not row by row.

---

## 4. Data loaders

### 4.1 Packages

- `packages/sources`: one module per source (`src/<country>/<source-id>/`): metadata, `fetch`, `parse`, and its field map. Depends on `domain` only, so parsers are pure and testable on fixtures.
- `packages/ingest`: the pipeline that runs a loader against the store: change detection, the gates, writes, purge, history events, linking, sync reports, the scheduler entry points. Depends on `domain`, `store`, `sources`, `resolve`. Used by `apps/cli` (`finora-cli data sync`) and by `apps/server` (`boot()` jobs). This closes qa #10.

### 4.2 Source registry and licences

```ts
type SourceMeta = {
  id: SourceId;                     // "lv-ur-register"
  country: "lt" | "lv" | "ee" | "us" | "intl";
  publisher: string; homepage: string;
  officialHosts: string[];          // every host the loader, deep links and orderUrl may use (R14)
  licence: LicenceId;               // key into LICENCES
  attribution: string | null;       // wording recorded in docs/research, shown in the UI (R16)
  storage: StorageClass;            // §3.5
  cadence: "daily" | "weekly" | "monthly" | "quarterly" | "on-view";
  publishedAtUtc: string | null;    // observed publication time; the scheduler runs after it
  asOf: AsOfRule;                   // ordered strategies, strongest first (below)
  maxPurgeShare: number;            // largest share of records one sync may delete: max(0.02, 5 x the measured removal share per refresh period); the spec states the measurement
  purgeScope: "full" | "window" | "periods_in_file" | "none"; // full: a complete file defines the source; window: purges only inside its date window; periods_in_file: rolling files (LV VID, LT and EE taxes) purge only periods present in the file, so older periods stay as our history (counted against HISTORY_MAX_GB; EE share-alike quarters that roll out collapse into one annual report per company, cto); none: incremental sources never purge
  deepLink: string | null;          // URL pattern with {recordKey} or {entityCode} (most LV record keys are not company codes)
  rawCache?: boolean;               // default true; false for sources whose files hold natural persons who are never stored (the EU, OFAC and UK sanctions lists): a parserVersion change then re-downloads
  changeToken?: ChangeTokenRule;    // optional cheap upstream check (for example the LT statements API change-log id): unmoved token => { unchanged: true } without the download
  orderUrl: string | null;          // paid_only target; official register page only
  cacheTtl?: { refetchHours: number; purgeUnviewedDays: number }; // live-cached only
  requires: EnvKey[];               // e.g. ["SEC_USER_AGENT"]
  limits: { requestsPerSecond?: number; dailyRequests?: number };
  items: ItemId[];                  // every item it fills; must equal the item_ids in its field map
};
```

**`AsOfRule`** is an ordered list of documented strategies; the first that yields a date wins, and its name is recorded as `syncs.as_of_basis`:

| Strategy | Meaning | Example |
|---|---|---|
| `in_file_field` | a date field inside the data or a header row | an export date column |
| `in_file_name` | a date in the artifact's file name | EE annual-report zips |
| `max_date_in_data` | the latest date of a named field across all rows | LV files without an export date |
| `portal_metadata` | the open-data portal's own modified date for the dataset | CKAN `last_modified` |
| `http_last_modified` | the HTTP header, last resort | EE daily files |

A source lists only the strategies its spec proved on real files. Test: `ingest/src/as-of.test.ts`, one case per strategy, and the LV and EE fixtures sync successfully.

`packages/sources/src/licences.ts` lists every licence with `attributionRequired`, `shareAlike`, `nonCommercial`, `redistribution`, `verifiedOn` (date and URL from docs/research). Invariants, checked by `sources/src/licences.test.ts` (R12, R13, P1, P11):

1. `storage: "store"` requires `shareAlike = false`, `nonCommercial = false`, `redistribution = true`.
2. `shareAlike = true` requires `share-alike-store` or `live-no-store`.
3. `nonCommercial = true` or `redistribution = false` requires `agent-only`, `live-no-store` or `connector-cache`.
4. Every source has a licence with a `verifiedOn` date; a `live-cached` source without one cannot be enabled (P11: OR and WA stay off).
5. `orderUrl`, `deepLink` and every fetch host are in `officialHosts`.
6. `items` equals the set of item ids in the field map, and every one is `show` or `caveat`.

**Changing a source's storage class or licence class** (for example `store` to `share-alike-store`, or a licence that turns non-commercial) is a migration, not a setting: the next sync is a full reload into the new class, followed by a purge of every row of that source from the old location, and the class in force is recorded on each sync. Test: `ingest/src/class-change.test.ts` flips the class on a fixture source; afterwards no row of it remains in the old store (A7).

### 4.3 The loader contract

```ts
interface SourceLoader {
  meta: SourceMeta;
  fetch(ctx: FetchContext): Promise<FetchResult>;              // raw artifacts into the raw cache (a source may fetch several, e.g. the LT UUID-to-code map beside its dataset), or { unchanged: true }
  parse(raw: RawArtifact[], ctx: ParseContext): AsyncIterable<ParsedRecord>;
}

type ParsedRecord = {
  recordKey: string;                // stable key per loader spec: the row's key, or the report / company-period key for long-format sources
  hashInput: string[];              // no longer hashed (J2 on S05): row_hash is built from the gated record, see below; kept until the loader contract drops it
  entity?: EntityInput;             // eid, schema, country, legal form, natural_person, status, caption
  statements: StatementInput[];     // { prop, value, lang?, itemId }
  reports: FactReportInput[];       // { kind, period, currency, unitScale, facts: { concept, value }[] }
  events: EventInput[];             // { type, date, data?, itemId }
  parties: PartyRef[];              // members, debtors, insolvency subjects, sanctions links: go through the party gate
  dropped: DropReason[];            // fields dropped by rule: 'hide_item' | 'later_item' | 'personal_code' | ...
};
```

`parse` is pure given the artifacts, so `sources/src/<cc>/<id>/<id>.test.ts` runs it on committed synthetic fixtures with no network.

**Entities another source owns (S05).** A dependent source (LV former names, share capital, VAT and NACE from the tax authority) attaches statements to a register entity through an entity marked `ref: true`. The store looks it up by `eid` and never creates or changes it: legal form, status and the person flag stay the register's. An `eid` the store lacks is refused as `entity_missing`, counted. Facts and events need no entity: they name `entityEid`. For such an entity the gates read the person flag and status from the store, so the natural-person rules (P6) and load rule 3 apply to it as to the register's own rows. Load rule 3 there means a struck-off or reorganised entity takes no S03, S04, S06, S07, S08 or S13 data from another source (`struck_off_identity_only`); its identity, status history and risk history (S09-S11) stay. Tests: `ingest/src/ref-entity.test.ts`.

Contract rules from the S04i security review:
- **Strict records.** Every object in a `ParsedRecord` is validated strictly, so a key the contract doesn't name makes the record invalid. A drop's `reason` is one of `DROP_REASONS` (`domain/config/drop-reasons.ts`), and a loader slice adds its own reasons there.
- **Keys hold no codes.** A record key or line id that holds a personal code or a person row id refuses the record (`person_field`), and so do a person record's hash input and row reference.
- **Archives are capped.** A loader that unpacks an archive caps the decompressed size (the raw cache uses `RAW_MAX_BYTES`), and its parser is reviewed in its slice for entity expansion and prototype keys.
- **Large files stream** (owed before S13 and S15g). A loader whose file may not fit in memory fetches with `fetcher(url, { toFile: join(ctx.workDir, name) })`: the body goes to disk with its size and sha256 taken on the way (cap `maxFileBytes`: in a sync worker the source's own `limits.maxBytes`, as for a buffered body, since a streamed file can hold person data; the fetcher's 8 GiB default applies only to a source with no cap; a partial file is removed on any failure), and `streamedArtifact(name, res, ctx.now)` returns a `RawArtifact` with empty `bytes` and a `file`. It parses through `artifactStream`, and reads an as-of near the top with `artifactHead`; it never reads the file whole. The content hash uses the file's sha256. The raw cache gzips the file as a stream and restores it into the sync's work dir, checking size and sha256; a mismatch counts as no cache. The work dir is one fresh directory per sync under `SyncOptions.workDir`, removed when the sync ends, on every path. The CLI and the sync worker use the store's own `<data dir>/work`; only such a base is swept, since a lease covers one store and the fallback in the OS temp dir may be shared by several. A downloaded file can hold person data, so a work dir that outlives its sync is removed three more ways: by the parent when it terminates a worker (timeout, hang, crash, out of memory), at the start of that source's next sync (it holds the source's lease), and at boot by `sweepWorkDirs` for every source with no live lease (the CLI's `data sync`, and the server's `boot()` from S12). The path is never logged. Tests: `sources/src/streamed.test.ts`, `ingest/src/streamed.test.ts`. A zipped streamed file still needs a reader that works from the file, which is that loader slice's work in `@finora/formats`.
- **Source ids are safe names.** A source id matches `^[a-z0-9][a-z0-9-]{1,63}$`, because it names folders.
- **Workers trust a fixed registry.** A sync worker resolves a source id against a registry fixed in its entry module, never a module named in its job.

### 4.4 The pipeline (`packages/ingest`)

For one source, one sync:

1. **Fetch.** Through the polite fetcher: `officialHosts` allowlist, private-address refusal after DNS, per-source rate limit (SEC ≤ 10 requests/s with `SEC_USER_AGENT`), retries with backoff, size caps. The artifact's sha256 and the loader's `parserVersion` are compared with the last content sync; **unchanged means both are equal** (HTTP validators are only a hint: LV's ETag changes on every regeneration). Unchanged → write one `syncs` row of kind `unchanged`, touch nothing else, stop. Same artifact but a new `parserVersion` (a release changed the parser, the field map or an item's call, for example a new HIDE) → re-parse from the raw cache as a content sync, in the background under the source's lease with the UI usable (an edit to Part G re-parses every source: about the first-load time; cto S4), so the change reaches every install without waiting for the upstream file to change (A1). The raw cache keeps only each source's latest artifact, gzip-compressed (EE zips kept as downloaded; GLEIF's weekly full file kept gzip-compressed, so a `parserVersion` change re-parses it instead of re-downloading about 0.5 GB), within the raw-cache budget in §4.5. If the raw cache is missing or disabled, a new `parserVersion` re-downloads instead (LV takes about 6 min): slower, never wrong.
2. **As-of check.** Apply the `meta.asOf` strategies in order. A date older than the last content sync's → `stale_skipped`, stop. No strategy yields a date → `failed` with `as_of_missing`.
3. **Parse and gate**, streaming, per record:
   - **Field-map gate:** every value targets a `show`/`caveat` item or a resolution key (load rule 2); everything else was never read.
   - **Personal-code gate (P3):** person properties are scanned against the country patterns (`domain/policy/personal-codes.ts`); a match is dropped and counted. Organisation `registrationNumber` is never scanned (qa #20).
   - **Proven-company gate (council, final round):** every party row (members, debtor-list rows, social-insurance debts, insolvency rows, sanctions links) goes through `ingest/src/party-gate.ts`. A party is loaded only if it is proven to be a company: the register's own type field says so (LV `LEGAL_ENTITY`, `FOREIGN_ENTITY`; EE `J`), or its code resolves to a register entity with a non-natural-person legal form. Everything else (LV `JOINT_OWNERS`, bare personal names, the ~298 EE debtor codes not in the register) is not loaded and is counted by reason. Court-party masking (P8) calls the same function.
   - **Natural-person rules (rule 5, Part H 6-9):** a sole trader's address is reduced to the country; its tax and arrears lines are dropped; natural-person insolvency is dropped.
   - Zod validation of every record; an invalid record is a counted `skip`, never silent.
4. **Stage.** `(recordKey, rowHash)` pairs go into a temp table.
5. **Write**, one writer, in batches of up to 5,000 records per transaction, **each transaction bounded to about 250 ms** (the batch size adapts down on a slow disk), so a main-thread investigation write never waits long for the WAL write lock; main-thread writes also retry with backoff on `SQLITE_BUSY` (qa session 2):
   - new or changed `rowHash` → upsert the record (`last_changed_sync_id` = this sync), replace its statements, reports and events, and emit the history events of §3.7 by comparing old and new company attributes;
   - unchanged `rowHash` → nothing.
6. **Purge** (per `meta.purgeScope`; `none` skips this step, `window` limits it to the pulled date range), only if the sync completed (`content`, never `partial` or an interrupted run): records whose key is absent from the temp table are deleted with their rows. **Purge guard (A2):** `maxPurgeShare = max(2%, 5 x the source's measured removal share per refresh period)`, and the guard always allows at least 5 records (`max(ceil(share x records), 5)`), so a tiny source (for example a 58-record file) can still lose one record a day (boundary test: 5 removals on a 58-record source purge, 6 end `purge_guard`) (cto, measured: about 2% for the registers, whose daily removals are 0.04-0.1%; about 22% for the LT tax-arrears change feed, which removes 4.3% a day; a flat 5% would block it on a normal day). If a sync would delete more than that share of the source's records (an empty, header-only or cut-off file, an upstream export bug), nothing is deleted and the sync ends `partial` with reason `purge_guard`, shown on Settings; only `finora-cli data sync <source> --allow-mass-purge` overrides it. **Window sources** (`purgeScope: "window"`: the SEC insider and Form D data sets, the FJC court index, full-history market series): records whose period has aged out of the window are expected deletions and do not count against the guard; records missing **inside** the window count against `maxPurgeShare` like any other source, so a truncated quarterly file cannot pass (cto). Test: a new quarter that drops the oldest one passes; a quarter half missing inside the window ends `purge_guard`. **Change feeds** (a source whose sync is a list of explicit inserts and deletes, such as the LT tax-arrears API) apply the same guard to the deletes of one feed sync: a page that would delete more than `maxPurgeShare` of the source's records applies nothing and ends `purge_guard` (qa). If the record held an entity's identity and the source's spec says "tombstone" (EE), the entity keeps its identity statements and gets `tombstone_since`; person rows are deleted with a `finora.role_ended` event (P4).
7. **Derive.** Rebuild `entities` rows and FTS for touched entities; run official-ID linking (§6) for them; recompute derived values (shared-address counts, registered offices only, never addresses shared with a natural person: Part H 3).
8. **Report.** Close the `syncs` row with counts by outcome and drop reason, duration and upstream as-of. `finora-cli data status` and the Sources page show it.

Tests (S04i/S05 acceptance; names from the early review): `ingest/src/purge.test.ts` (1,000 records, 1 changed, 1 removed → 999 live, 1 updated, 1 deleted, 998 untouched), `ingest/src/unchanged.test.ts` (content sync then unchanged sync: everything live, nothing purged, as-of kept), `ingest/src/partial.test.ts` (interrupted sync purges nothing), `ingest/src/stale.test.ts` (an older as-of is skipped), `ingest/src/parser-version.test.ts` (unchanged artifact plus a field map that newly drops an item: re-parsed, the item is gone), `ingest/src/purge-guard.test.ts` (an empty file and a half-size file delete nothing and report `purge_guard`; a removal share just under `maxPurgeShare` purges, just over it does not; a change-feed page that deletes 50% of records is refused), `ingest/src/class-change.test.ts` (A7), `ingest/src/party-gate.test.ts` (one case per type value; a fixture sole trader at a company address creates no S17 link), `ingest/src/history.test.ts` (rename event; role ended without a name), `store/src/retention.test.ts` (a source unchanged for 40 days keeps its current officers).

### 4.5 Scheduling and budgets

- **Cadence** per source from cto's table (`01-data-cto.md` §2): daily registers, officers, debtor lists and sanctions; weekly LV financial statements and VID files, EE general data, and GLEIF as a full load (deltas cannot define removals; cto accepted, data-us). **Weekly jobs** (LV financial statements, about 5 min to parse; EE general data; GLEIF) each get their own night, outside the 5-minute daily budget and never in the same window as another weekly job or the daily refresh; reads are never blocked (WAL, one writer); monthly EE annual reports, LT statements, EE taxes paid; on view for SEC and the live US states. Each job runs after the source's `publishedAtUtc`.
- **Extending shared config:** a loader spec adds its own drop reasons, FtM extension properties and event types to `domain/config/drop-reasons.ts`, `domain/schema/extensions.ts` and `domain/config/event-types.ts` in its slice; the schema-subset test and the sync-report schema read those lists.
- **First load:** one long-lived worker thread per lane, started once per run: LV, EE, LT, sanctions and other cross-border lists, and GLEIF (streamed, in its own lane). A source's lane is `meta.lane`, else its country. Lanes run in parallel; within a lane the sources run by `meta.order` (the register is 0, default 100), so the register goes first whatever order a profile lists them in (`lanesOf`, used by the CLI and the scheduler alike), so a country is searchable as soon as its register lands and financials and the rest follow. Leases (`sync:<source>`, one writer per source) and the watchdog stay per source: a hung or crashed source fails only its own sync. Never one worker per source: many short-lived worker isolates crashed V8 on Node 24 (S04i).
- **Budgets (P10, loader acceptance criteria)**, measured on the named machine profile in `docs/plan/benchmarks.md` with cto's probes (`research/probes/cto/`). Each loader slice also reports records per source and bytes per record:

| Budget | Value |
|---|---|
| Disk, per country | LV ≤ 2.5 GB · EE ≤ 3 GB (+ ≤ 0.25 GB share-alike) · LT ≤ 2 GB · cross-border ≤ 1 GB · US ≤ 1 GB · **whole store ≤ 10 GB, the binding cap**, with our own history (P9) inside it. The per-source caps are limits, not allocations (cto). If the FJC court index alone passes 0.3 GB, it drops to 5 years first |
| First core load | ≤ 30 min end to end; LV and LT searchable in ≈ 2 min, EE in ≈ 6 min |
| Daily refresh | ≤ 5 min, in the background, never blocking reads |
| Unchanged reload | one `syncs` row, 0 statement writes |
| Raw cache | ≤ 1.5 GB (latest artifact per source, gzip) |
| Whole data dir | ≤ 12 GB (store + share-alike store + user store + raw cache + connector cache + backups) |
| Memory | a sync worker's peak RSS ≤ 1 GB on `dev-desktop-1` (cto on S04i), measured and recorded per loader slice (`finora-cli data sync <source>` prints the peak). Each sync worker also runs under a 768 MB old-generation heap cap (`SYNC_WORKER_HEAP_MB`, `resourceLimits`): a runaway loader or reader ends its lane's syncs `failed` with `worker_out_of_memory`, its open write transaction never commits, and the parent and the other lanes run on (SEC-1 on S06). The cap is the crash guard only: buffers are external memory, so the RSS budget above stays the real bound. A file too large to hold in memory (EE general data, 4.6 GB of JSON; the zipped annual-report and person files) is streamed from the download or the raw cache with bounded memory, never through an in-memory gunzip; the architect adds streamed artifacts to the loader contract before S13 |

  CI cannot hold absolute times, so CI checks relative regression budgets against a stored baseline on the fixture world (qa #23); the absolute numbers are recorded per release in `docs/plan/benchmarks.md`.

### 4.6 Load profiles

| Profile | What | Used by |
|---|---|---|
| `fixtures` | the synthetic world generated at test time from a seed (≈ 2,000 entities, never committed; qa #22) plus the small per-source layout fixtures (< 50 KB each, committed) | tests, CI, e2e, `pnpm finora --demo` |
| `core` | every Baltic source with a SHOW or CAVEAT row, GLEIF filtered to LT/LV/EE/US, the stored sanctions lists; SEC when `SEC_USER_AGENT` is set | the default `pnpm finora` |
| `full` | `core` plus anything a loader marks optional | a longer first run |

### 4.7 What a loader spec must give the builder

The template in `docs/plan/loaders/README.md`. In terms of this section: the `SourceMeta` values (§4.2), the field map with item ids and personal flags (§3.6), the record key and hash input (§4.3), the party-gate rule (§4.4 step 3), tombstone or delete on removal (§4.4 step 6), the history events it produces (§3.7), the fixture layout writer and fixture id rule (§3.4), its budget share (§4.5), and the named tests.

---

## 5. Apps

> Revised in phase 3 (milestone B) against council session 1, `docs/plan/agents.md`, `docs/plan/ui-build-plan.md` and the loader specs.

### 5.1 apps/server: the API

One web-standard handler, `handle(request: Request): Promise<Response>`, plus `boot()` for background work.

- **Routes** live at `apps/server/src/routes/<path>/route.ts` with Next's handler signature (`export async function GET(request, { params })`, `params` is a `Promise`). `src/route-table.ts` is generated by `pnpm --filter @finora/server routes`; `route-table.test.ts` fails while it disagrees with the tree. Nothing in `apps/server` imports `next`.
- **Every handler, in this order:** validate path params → validate body or query with a schema from `api-contract` → call a service → shape the response. A route stays under one screen; logic beyond that moves into a package.
- **Errors are machine codes** (`snake_case`, listed once in `packages/domain/src/config/errors.ts`), never sentences: `{ "error": { "code": "entity_not_found", "detail"?: "..." } }`. The UI maps codes to localised text.
- **Services return tagged results** (`{ ok: true, value } | { ok: false, code, status }`); routes map them to HTTP.
- **Versioned:** `/api/v1/...`. A breaking change adds `/api/v2` routes.
- **Usage** has one shape everywhere (per lane, run, investigation and day; cto 7070446775): `usage { unit: "st", used, held, cap, extensionGranted, turns?, perModel? }`. `used` is settled st, `held` reserved and not yet settled, `cap` the cap in force including a granted extension. All values are integers, rounded down from the CLI's meter. The UI shows `(used + held) / cap` while running and `used / cap` once settled. `turns` and `perModel: { model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }[]` are for the disclosure only. **No DTO carries a currency**, the CLI's `total_cost_usd` or `costUSD`: the st conversion happens in the server's ledger, and a contract test fails on any field of any `usage` schema matching `/usd|cost|price|eur/i`. `plan_limit`, `overage`, "Waiting: Claude is busy" and `runtime_unsafe` are states of the run or investigation, never `usage` fields. Dates are ISO 8601 strings; times are UTC.

**Endpoints (v1).** Every schema lives in `packages/api-contract/src/<area>.ts` and lands in slice S04b, before the routes, so the UI builds against the real contract from day one.

| Method and path | Purpose | Schema file |
|---|---|---|
| `GET /api/v1/health` | Liveness, store version, per-source freshness, history size against `HISTORY_MAX_GB` (P9), last job runs | `health.ts` |
| `GET /api/v1/about` | Version, commit, source-code URL (R18), licence | `about.ts` |
| `GET /api/v1/search?q=&country=` | Company search over the stored registers, as groups: `{ groups: { id, kind: "bulk", country, state: "ready" \| "loading", percent?, results[] }[] }`. A country still on its first load is `loading` with a percent (§4.5) | `search.ts` |
| `GET /api/v1/search/live/:register?q=` | One live US state register (`ny`, `co`, `ct`, `pa`): one group, `kind: "live"`, fetched from the portal with a 3 s timeout, never stored; on failure `state: "error"`, rendered "Not checked: [state] registry did not answer". The client fires one per register in parallel, so a slow portal never blocks the rest | `search.ts` |
| `GET /api/v1/companies/:eid` | The company profile: identity header, the coverage line, every section S01-S18 as a `SectionResult` (§5.4), the 11 checks (S18), `isNaturalPerson`, `containsPersonalData` | `report.ts` |
| `GET /api/v1/companies/:eid/sections/:section?purpose=` | One section, paginated where long. Sections with `purpose`-tier items (S03, S04, S14.US.01, S06 and S07 of a sole trader) need `purpose` on every call from API and MCP clients (P2), else the section is `not_checked{reason: "needs_purpose"}` | `report.ts` |
| `GET /api/v1/companies/:eid/network` | One hop, company to company (§5.5) | `network.ts` |
| `GET /api/v1/companies/:eid/export?format=json\|ftm` | Redistributable, non-personal values only; never share-alike or connector-cache rows (R4, P1, R17) | `export.ts` |
| `POST /api/v1/purpose` | The UI's purpose session: `{ purposeId }` → an HTTP-only session cookie valid `PURPOSE_SESSION_HOURS` (12) or until restart (P2). The cookie is the only purpose store for the UI (never `sessionStorage`), so the server-component profile can read it. Blocked purposes do not exist in the list; a blocked id is `400 purpose_blocked` (P7) | `purpose.ts` |
| `POST /api/v1/disputes` | Report a problem with a value or section: `{ companyEid, itemId, kind: "correction" \| "objection", note }`; the target is pinned by content hash (§3.3) | `disputes.ts` |
| `GET /api/v1/sources` | Source registry: licence, attribution, storage class, freshness, last sync report | `sources.ts` |
| `POST /api/v1/investigations/estimate` | `{ subject, roles[] }` → `{ low, typical, high, basis, drivers[], typicalSeconds: Record<Role, number>, cap: usage, daily: usage, dailyResetsAt }`, every figure an integer in st` (`agents.md` §8.3) | `investigations.ts` |
| `POST /api/v1/investigations` | Start: `{ subject: { eid, offerDomain? } \| { text, offerDomain? }, purposeId, locale }`. A second start while an investigation runs answers `409 investigation_running` (C18); with the backend `off` or no signed-in CLI it answers `agents_unavailable`. `offerDomain` is the domain on the offer or invoice the user received (council session 2, item 7): the web agent checks it against the register (DNS, certificates, homepage, the RDAP or .lt creation date) as well as the register-listed domain | `investigations.ts` |
| `GET /api/v1/investigations` | Library: subject, country, eid, level, coverage, usage (st), status, started, finished | `investigations.ts` |
| `GET /api/v1/investigations/:id` | Snapshot: plan, runs, tasks, findings, questions, verdict, usage, and `lastEventId` | `investigations.ts` |
| `GET /api/v1/investigations/:id/events` | SSE stream (§7.5). Resumes from the `Last-Event-ID` header, or `?lastEventId=` (the UI's fetch-stream client sends the header; the query parameter is the fallback) | `events.ts` |
| `POST /api/v1/investigations/:id/questions/:qid/answer` | Answer a question; validated against its kind | `investigations.ts` |
| `POST /api/v1/investigations/:id/resume` | Resume an investigation paused at the plan's limit; a user action only, never automatic (C18) | `investigations.ts` |
| `POST /api/v1/investigations/:id/stop` | Stop; keeps partial results | `investigations.ts` |
| `POST /api/v1/investigations/:id/runs/:runId/rerun` | Re-run one finished or failed specialist; held against the investigation's cap; offered per `agents.md` §2.7 | `investigations.ts` |
| `POST /api/v1/investigations/:id/follow-ups` | A follow-up question answered from the stored findings and documents (cap `AGENT_FOLLOWUP_CAP_ST`) | `investigations.ts` |
| `DELETE /api/v1/investigations/:id` | Delete an investigation with its documents (R11 lets the user delete earlier than the TTL) | `investigations.ts` |
| `GET /api/v1/markets/crash` | Crash monitor rows and tiles from the server cache (§8) | `markets.ts` |
| `GET /api/v1/settings/status` | The agent backend and the CLI's state (`off`, not installed, not signed in, ready), the SEC contact setting's presence (never its value), which coded market providers the local provider map configures (codes only); data status; `SHARE_ALIKE_MODE`; the LAWYER switches in force | `settings.ts` |
| `GET`/`PUT /api/v1/settings/startup` | The opt-in start at login (council item 15): `{ enabled }`; `PUT` creates or removes the per-user Task Scheduler entry on Windows (other systems: `not_supported` until built) and never enables it without the user's action | `settings.ts` |
| `GET /api/v1/agents/status` | `{ backend: "off" \| "cli" \| "local", cli: "ready" \| "missing" \| "signed_out" \| "unsafe" \| null, cliVersion?, provenVersion?, overage: "off" \| "permitted" \| "in_use" \| "unknown", running: investigationId \| null }` for the Investigate sheet's states (agents-off, cli-missing, cli-signed-out, busy, unsafe) and the C19 warning; cheap, cached briefly, never starts the core load or a model turn | `agents.ts` |

There is deliberately **no person endpoint**, no person search and no bulk person list (L2, R4). Officers and owners appear only inside one company's sections.

OpenAPI 3.1 is generated from the Zod schemas (`z.toJSONSchema`) by `pnpm --filter @finora/api-contract openapi` into `docs/api/openapi.json`; `openapi.test.ts` fails when it is stale.

### 5.2 apps/mcp: the MCP server

Built on the official MCP TypeScript SDK. Read-only tools, generated from the definitions in `packages/agent-tools` (`agents.md` §4.1), so agents and MCP clients share one implementation:

| Tool | Returns |
|---|---|
| `search_companies` | ranked company candidates; natural persons and sole traders flagged, never as person results |
| `get_company` | S01, S02 with sources; `isNaturalPerson` |
| `get_company_section` | one `SectionResult`; person sections require `purpose` on every call, logged with `surface: "mcp"` (P2) |
| `get_financials` | facts by concept and period |
| `get_checks` | the 11 checks with outcomes and statement ids |
| `screen_sanctions` | possible matches with identifiers; `listed` only on an official-ID match (R8) |
| `list_sources` | the source registry with licences |

- Transports: **stdio** (`pnpm finora-cli mcp`, also the `finora` binary for MCP client configs) and **Streamable HTTP** at `/mcp`, behind the same host and origin guards as the API.
- No bulk tool returns share-alike, connector-cache or personal rows (P1, R17, R4). Agent-only tools (`ask_human`, `record_finding`, open-web tools) are not exposed.
- The server's `serverInfo` carries the source-code URL (R18). Every result carries `sources[]` with licence and attribution; AI-written text never appears in MCP output (MCP returns stored data only).

### 5.3 apps/web: the UI

`docs/plan/ui-build-plan.md` is the UI's own plan (component inventory, states, keyboard, accessibility, streaming). This section fixes its seams with the rest of the system.

**Routing.** Locale-prefixed App Router; each product tool is a route group with a manifest that drives the left tool rail on desktop and the bottom bar on mobile:

```
app/
  [locale]/
    layout.tsx                                   html lang, providers, tool rail from manifests, footer (source link R18, terms P7)
    page.tsx                                     the explorer search
    (tools)/
      explorer/
        [country]/[code]/layout.tsx              shared company layout: sections do not remount when a run opens
        [country]/[code]/page.tsx                the official profile (server component)
        [country]/[code]/network/page.tsx        network explorer (S17)
        [country]/[code]/runs/[id]/page.tsx      the same layout plus the agent panel, verdict and follow-ups
        [country]/[code]/runs/[id]/network/page.tsx
        investigations/page.tsx                  library
        investigations/[id]/page.tsx             free-text runs only, until the lead pins an id; then router.replace to the company route
      crash/page.tsx                             Crash monitor
    sources/page.tsx                             sources, licences, attribution, freshness
    settings/page.tsx                            connections (CLI status, SEC contact setting), usage, data status, LAWYER switches (read-only)
    design/page.tsx                              the state gallery (ui-build-plan §12); every state reachable by URL
  api/[...path]/route.ts                         mounts apps/server handle()
  mcp/route.ts                                   mounts the MCP HTTP handler
src/tools/<tool-id>/manifest.ts                  { id, navKey, href, icon, enabled }
```

Adding a tool means: a manifest, a route group, its API routes and contract schemas, and its i18n keys. Nothing central is edited except the manifest list.

**Server components vs API routes.**

| Use | When |
|---|---|
| Server component reading through the render seam (`@finora/server/render`) | Read-only first paint: the company profile, the sources page, the library list. No HTTP hop, streamed with `Suspense` per section |
| Client component calling `/api/v1` | Anything interactive or live: search-as-you-type, live state groups, the purpose prompt, starting and watching an investigation (SSE), answering questions, the 60 s Crash monitor poll, follow-ups, disputes |
| Server actions | Not used. Every mutation goes through the API, so MCP, the CLI and the UI share one contract and one CSRF rule |

The render seam returns the same DTOs as the API. Seam files in `apps/web` (lint-enforced, each starting with `import "server-only"`): `app/api/[...path]/route.ts`, `app/mcp/route.ts`, `instrumentation.ts`, `lib/server-data.ts`, and `proxy.ts`, which imports only `@finora/server/env` and `@finora/server/guard` (the Host and Origin guard and the security headers, S02). Server components read the render seam through `lib/server-data.ts`, never by importing `@finora/server` themselves.

**Components (ui-build-plan D1-D4, accepted).**
- `packages/ui`: presentation primitives with no DTO knowledge (Button, Input, Combobox, Dialog, Popover, Tooltip, Tabs, Skeleton, StatusLine, Chip, ...). It may import only `i18n` types and receives finished strings as props.
- `apps/web/src/components`: everything that takes a DTO: `FieldRow`, `SourceChip`, `Quote`, `AiLabel`, `PersonDisclaimer`, `PurposeGate`, `VerdictBlock`, `AgentLane`, `QuestionCard`, `NetworkGraph`, `CrashTile`.
- **Every displayed value renders through `FieldRow` (or `KeyFigureTable` / `EventList`) with a typed `itemId: ItemId`** from `items.generated.ts` (§3.6); an unknown id fails typecheck, and a lint rule bans raw data text outside those components. This is the rendered-field registry (qa checklist 9).
- `VerdictBlock` renders the rule-based level and the AI-written explanation as separate children, so `AiLabel` never wraps the level.
- UI fixture DTOs live in `fixtures/ui/<screen>/<state>.json`, validated against the `api-contract` schemas by `fixtures/ui.test.ts`; the state gallery, `?state=` mode and e2e tests read them.

**State and fetching.** TanStack Query for requests. One `useReducer` per open investigation, fed by one fetch-stream SSE client (`apps/web/src/lib/sse.ts`); the reducer applies events with `id > lastEventId` only, so replays are idempotent. No global client store.

**Design system.** `DESIGN.md` is the source. Tokens live in `packages/ui/src/tokens.css` as CSS variables (dark first, light as a variant), exposed to Tailwind v4 through `@theme`; `scripts/check-tokens.mjs` bans raw colours in code. Viewports for every visual and e2e test: 390×844, 768×1024, 1280×800, 1920×1080, plus 1024 as the panel-to-sheet breakpoint.

### 5.4 The section DTO

Every report section is one of these states, so no section can be blank and an empty list can never mean "none found" (council session 0; qa checklist 10):

```ts
type SectionResult<T> =
  | { state: "not_published"; country: Country }                                        // NP
  | { state: "checked_none"; source: SourceRef; checkedAt: string; asOf: string }       // CN
  | { state: "not_checked"; reason: NotCheckedReason }                                  // NC, PAID, LOCK, KEY, MANUAL, AGENT
  | { state: "disputed"; disputeId: string }
  | { state: "data"; value: SourcedValue<T>[]; freshness: "current" | "stale"; asOf: string;
      completeness: "full" | "partial"; missing?: string[]; caveatKey?: string };

type NotCheckedReason =
  | { reason: "later" } | { reason: "error"; code: ErrorCode } | { reason: "skipped" }
  | { reason: "paid_only"; orderUrl: string | null }        // official register page only (§4.2)
  | { reason: "needs_key"; key: "SEC_USER_AGENT" }           // the one optional setting left (H5, C14)
  | { reason: "needs_source" }                                // a coded source with no entry in the local provider map (C15)
  | { reason: "needs_purpose"; purposes: PurposeId[] }
  | { reason: "restricted"; basis: LegalBasisKey }          // LOCK: decided by country and legal form only (§3.6)
  | { reason: "agent_only"; agentId: Role }                 // AGENT: "checked when you investigate", with an Investigate action
  | { reason: "manual_lookup"; url: string };               // MANUAL: official host allowlist, like orderUrl
```

- `SourceRef` includes `derived: boolean`; values Finora computes render the "Derived by Finora" chip and cite the records they came from.
- `stale` is a record-level state (council): `asOf` older than twice the source's cadence.
- **"None found" comes only from `checked_none{source, asOf}`.** A `data` result with an empty list is a contract error (rejected by the schema), and no component renders "none found" from an empty list (qa 12).
- **`disputed`:** a disputed line is dropped from its section, which becomes `data` with `completeness: "partial"` and a "1 value under review" note; a section whose every line is disputed is `disputed`.
- **Natural persons and sole traders are never named in a title, search result or header:** they show as legal form + registry code (L3, P6; qa 14).
- **A sole trader never reads "none found" for data we do not load** (council session 2, item 11): every row and check whose data is dropped for natural persons (insolvency, securing measures, suspensions, tax and arrears) renders the rule-based lock `not_checked{reason: "restricted", basis}`, the same for every sole trader. Test: `domain/src/report/sole-trader-lock.test.ts` (a bankrupt and a non-bankrupt fixture sole trader give byte-identical report DTOs).
- Tests: `domain/src/report/section-result.test.ts` (one case per state and reason, including the disputed rules), `api-contract/src/report.test.ts` (an empty `value` array is rejected by the schema for `data`), `web/e2e/field-states.spec.ts` (every state renders its own icon and copy at the four viewports).

### 5.5 Network (S17)

Company to company only, one hop, from stored data (council Part C, Part H item 3):

```ts
type Network = {
  nodes: { eid: string; name: string; code: string; status: string; country: Country }[];
  edges: { from: string; to: string; relation: "shared_address" | "corporate_member"; source: SourceRef; since?: string;
           share?: number }[];                     // percent held, corporate_member edges only, where the member file states it
  hubs: { addressKey: string; companyCount: number; collapsed: boolean }[];   // a hub collapses after 20 companies
  truncated: boolean;
};
```

- Shared addresses are **registered offices only**; an address shared with a sole trader or a natural person is suppressed with any count tied to it. No person nodes, so no purpose gate inside the network.
- Browsing the network never starts agents. Caveat line (S17 items): "A shared address can be an office building or a registered-agent address".
- Tests: `domain/src/network/build.test.ts` (a fixture sole trader at a company address creates no edge; a hub collapses at 21), `server/src/routes/v1/companies/[eid]/network/route.contract.test.ts`.

---

## 6. Entity resolution

Most identity in this domain is official. Resolution goes in this order and stops at the first tier that decides:

1. **Same source, same key.** A registry row's code is its identity.
2. **Official cross-source ids.** GLEIF links an LEI to a national registry code (registration authority + entity id); SEC filings carry the CIK and sometimes an LEI; Baltic VAT numbers map to registry codes. These produce rows in the store's **`links` table: official-ID `same_as` links only** (`kind: "same_as"`, the asserting record); nothing else is ever written there (not addresses, not shared officers, not URLs). A company's profile merges the values of its linked entities, each still citing its own source.
3. **The proven-company gate** (§4.4 step 3) decides whether a party row (member, debtor, insolvency subject, sanctions link, court party) is a company. The same function masks court parties as "a private individual" unless proven to be a company by a registry-ID match in the store or a legal-form token (SIA, AS, UAB, OÜ, Inc, LLC and the like); a company name without a form token is masked (P8; fixture test `resolve/src/court-party.test.ts`).
4. **Candidates, never silent merges.** Free text (an agent's lead step, search) goes through candidate scoring: normalise the name (case, diacritics, legal-form tokens, punctuation, transliteration), then score name + country + address + dates + ids. Name collisions are common (active companies sharing a name: LT 6.6%, LV 0.82%, EE 0.1%, `baltics.md`), so search results always show the distinguishing facts (code, legal form, status, city, registration year), and the lead asks `entity_choice` rather than guess. A US company registered in several states is several entities; results group them by name with the state shown, never merged.
5. **Human judgements** are stored in `judgements` with who and when; a later reload never overrides one.

**Sanctions (R8, `agents.md` §2.4).** Screening returns candidates with the list entry's identifiers. `listed` requires an official-ID match (registration number, LEI, IMO, tax id) between the list entry and the company; an entry whose own registration number differs from the company's code is `ruled_out`; a name-only match is `possible_match`, rendered "possible match, needs review", and becomes a `sanctions_match` question when the legal agent cannot settle it. Tests: `resolve/src/sanctions.test.ts` (name only → possible; id match → listed; the entry's own different registration number → ruled out). The lists, fields and data minimisation are in `docs/plan/loaders/sanctions.md`. **Listed individuals are never stored** (legal): the parser routes them to an in-memory person index (`packages/resolve/src/person-index.ts`, a `live-no-store` view of the same download, rebuilt at each refresh), used only to screen a company's current officers behind the purpose gate; a match stores only `{list, entryId, listDate}` and its status. Tests: `resolve/src/person-index.test.ts` (spied store, filesystem and logger see no listed person), `sources/src/intl/sanctions-no-persons.test.ts`, `sources/src/intl/raw-cache.test.ts` (no raw artifact kept for these sources).

Tests: `resolve/src/links.test.ts`, `resolve/src/normalise.test.ts` (per-country legal forms and diacritics), `resolve/src/benchmark.test.ts` (200 synthetic queries with typos, form variants, missing diacritics and transliterations; the right company first in ≥ 95%), `resolve/src/judgements.test.ts`, `ingest/src/party-gate.test.ts`.

---

## 7. Agent runtime

`docs/plan/agents.md` (data-osint) is the behavioural spec: roles, pre-run tasks, tools, signals, citation rules, the rule table, questions, costs, prompts, fixtures. This section fixes the runtime's structure and its contracts with the rest of the system; where the two overlap, `agents.md` owns behaviour and this section owns types, tables and seams.

### 7.1 Shape of an investigation

```
Investigation (subject, purpose, locale, cap, status)
  ├─ lead run: pins the subject to one registry id, or asks entity_choice, or refuses a natural person (R5)
  ├─ 4 specialist runs in parallel: registry (checks 2-4), money (5-7), legal (8-10, live lists), web (11, news)
  │    ├─ tasks (deterministic, run before the first model turn, one run.task each)
  │    ├─ steps (model tool calls), documents (everything fetched), signals (typed, from tools only)
  │    └─ findings (signal | context, each pinned to an entity, ≥ 1 verified citation)
  ├─ verdict: level + fired rules + coverage from the rule table (code), then the explanation (model)
  └─ follow-ups (≤ 85k st each), reruns of one specialist
```

Tables (all in `finora-user.db`, §16, written **before** anything is broadcast): `investigations`, `agent_runs`, `run_tasks`, `run_events`, `questions`, `signals`, `findings`, `citations`, `documents`, `usage_ledger`, `verdicts`. A browser refresh, a crash or a restart loses nothing that was accepted: the CLI keeps no session (`--no-session-persistence`), so on boot a run that was `running` in a dead process settles at its hold and restarts once, under the `recover` lease, with its accepted findings, answered questions and task results in its first message (`agents/src/recovery.test.ts`).

### 7.2 Types the rest of the system relies on

```ts
type RunStatus = "queued" | "running" | "waiting" | "done" | "failed" | "stopped" | "budget_exceeded";
// "waiting" carries waitingOn: "question" | "cap" | "cli_retry" | "plan_limit". At a cap hit every run waits ("paused at cap").
// "cli_retry": the CLI is retrying on its own; the lane reads "Waiting: Claude is busy", never failed or done (C18).
// "plan_limit" / "overage": the investigation is paused at the plan's limit, or because paid extra usage is on, until the user resumes it (C18, C19).

type Finding = {
  id: string; investigationId: string; runId: string;
  entityId: string;                    // the pin, or an entity joined to the pin by a `same_as` row in the store's `links` table (§6); nothing else (qa #12, qa 7)
  checkId: CheckId | null; itemId: ItemId;               // itemId must be SHOW or CAVEAT (P8)
  kind: "signal" | "context"; signalIds: string[];       // signal findings explain ≥ 1 tool signal
  severity: "none_found" | "point_to_check" | "concern" | null;  // set by the rule table from the signals; null for context
  statement: string; anchor?: Anchor; citations: Citation[]; generatedBy: "ai";
};

type Citation =
  | { kind: "statement"; statementIds: string[]; snapshot: CitedValue[] }   // snapshot survives purges (qa #18)
  | { kind: "document"; documentId: string; quote: string; snapshot: { url; title; retrievedAt; sourceId; licenceId } };

type Verdict = {
  level: "no_concerns_found" | "points_to_check" | "serious_concerns" | "not_enough_data";  // rule table only
  firedRules: { ruleId: string; findingIds: string[] }[];
  coverage: { ran: number; total: 11; skipped: { checkId: CheckId; reason: SkipReason }[] };   // one denominator, always 11 (council session 2, item 8); checks a country cannot run are skipped with reason not_possible_in_country or not_published and named in the coverage line
  sourceCount: number;
  explanation: { text: string; findingIds: string[] }[] | null;
  keyFindingIds: string[];                                          // chosen by rule, at most 3 (agents.md §6.5; council item 10)
  explanationFallbackReason?: "banned_term_fallback" | "no_cited_sentence";             // set when explanation is null (agents.md §6.4)
  explanationGeneratedBy: "ai";
};

type QuestionKind = "entity_choice" | "sanctions_match" | "scope" | "cap_reached" | "free_text";
```

```ts
type Check = { checkId: CheckId;
  state: "ran" | "not_run" | "not_possible" | "not_evaluated";   // not_evaluated{trackedSince}: P14, our history does not cover the window yet
  trackedSince?: string; outcome?: "none_found" | "point_to_check" | "concern"; signals: string[]; statementIds: string[]; reason?: SkipReason };
```

**Check inputs decided by the council** (`01-data.md` Part H):
- **Check 5, labelled "Accounts filed"** (council accepted the designer's label: "on time" would claim a deadline we only estimate) compares the latest annual report in the register with the end of its fiscal year against Finora's estimate of the usual filing window (`domain/config/filing-windows.ts`: LV 7 months, EE 6, LT 5, each plus 30 days of grace for register processing). It reads "Annual report for [year] not in the register, [N] months after the year ended", with the window labelled "Finora's estimate of the usual filing window". It never says "late", "overdue" or "deadline" (enforced by `domain/src/checks/filing-window.test.ts` and the banned-terms catalogue test).
- **The LT 180-day arrears age** is evaluated from day one from the arrears list's own entry date ("On the arrears list since [date]", a lower bound for the debt's age); cto verified the date does not reset while a debt continues, so P14 does not apply to it. Tests: `domain/src/verdict/lt-arrears-age.test.ts` (cto's two fixtures: a change-feed patch never moves the entry date; a delete then insert resets it; plus a sole trader, whose lines are never loaded).
- **Check 7 in LT** runs on the tax-authority arrears (S08.LT.01); the social-insurance debts (S08.LT.02) join it only in an investigation.
- **Check 10 ("Court cases") is not possible in LT, LV and EE in v1** (council, after `agents.md` §4.5a: EE's court portal disallows automated access in `robots.txt`, and the LT and LV portals have no readable terms and no legal light; `LAW-COURTS-LT`, `LAW-COURTS-LV`). S10.LT.01, S10.LV.01 and S10.EE.01 are LATER with a MANUAL link to the official portal; the coverage line reads "Court cases: check manually at [portal]", never "none found". LV case numbers already loaded with S09 events link to the portal but do not count as running check 10. Check 10 runs in the US only, on the FJC civil index; the federal docket search is a manual link in v1 (H5).

The same `computeChecks(entity)` (`packages/domain/src/checks/`) serves the instant profile's 11-check list (S18) and the investigation. The instant profile shows the checks and the coverage line but no verdict level: the level is produced only by an investigation, after checks 10 and 11 had their chance to run (O1, confirmed by council session 2). The checks panel carries a fixed line: "No verdict yet. These checks use official data only; the rest run when you investigate. Missing does not mean clean." A check whose data is past its cycle shows a clock, not a check mark (council item 13). **Every user-visible coverage string reads "of 11"**, including screen-reader announcements, the library and MCP (item 8; test `domain/src/checks/coverage-copy.test.ts`).

### 7.3 Orchestration

- The lead runs first; after the pin, the four specialists start within 2 s, staggered by 1 s, under `AGENT_CONCURRENCY` (4, ceiling 6). No specialist depends on another; a question blocks only its own run, except `entity_choice`, `free_text` and `cap_reached`, which block everything.
- **Tools first, model second** (`agents.md` §1.1, §3.2): each role's deterministic pre-run tasks run in parallel, then the model reads their compact results. Signals come from tools only; the model cannot create, upgrade or remove one.
- The verdict waits for all four runs to end; a failed or stopped run counts its checks as not run.
- **Natural persons and sole traders get no agents** (R5, P6): the lead refuses with `subject_is_natural_person`, and the UI shows the facts-only report.
- Global per-host rate limiters live in `packages/agent-tools/src/limits.ts` (the news source, SEC, DOJ, TED, certificate logs, WHOIS, any fetched host); a tool that would wait over 60 s returns `rate_limited`.

### 7.4 Agent backends (H5, C18)

```ts
interface AgentBackend {
  id: "cli" | "local";
  start(run: RunSpec, signal: AbortSignal): RunProcess;  // one process per run
}
interface RunProcess {
  events: AsyncIterable<CliEvent>;   // init, assistant, user, permission_denied, api_retry, result
  send(message: string): void;       // the next stream-json user message
  interrupt(): Promise<void>;        // stream-json interrupt, then SIGINT, then kill after 5 s
  close(): Promise<void>;
}
```

- **`FINORA_AGENT_BACKEND`** is `cli`, `local` or `off`; **the default is `off`** until the human's H6 decision is recorded in `docs/plan/README.md`. With `off`, Investigate shows its not-enabled state, and the instant profile works as before.
- **`cli`** spawns `FINORA_CLAUDE_BIN` (default `claude` on the PATH) once per run (lead, each specialist, the verdict explanation, each follow-up) with the flags of `agents.md` §3.4: stream-json in and out, the role's system prompt from a file, **`--tools ""`** (no CLI built-in tool in any investigation, C18), `--allowedTools mcp__finora__*` only, `--strict-mcp-config` with Finora's endpoint only, `--setting-sources ""`, `--restricted`, `--disable-slash-commands`, `--no-session-persistence`, `--max-turns`, and `--max-budget-usd` at the run's allocation minus one response (C16).
- **The sign-in stays the CLI's.** Finora never reads, stores, forwards or asks for a credential. The child's environment is an **allowlist** built like `run-next.mjs`: the path, home and profile variables, the temp dirs, the locale, `CLAUDE_CONFIG_DIR` only if the user set it, and the values Finora sets (`CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096`, `CLAUDE_CODE_MAX_TURNS`, `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1`, `DISABLE_AUTOUPDATER=1`). Nothing else passes, so no key or provider switch in the user's shell can reach the child (test: a sentinel in the server's environment is absent in the child's).
- **The run dir** is a fresh `mkdtemp` in the OS temp dir, never under the repo or the data dir (the default data dir sits inside the repo, whose instruction files a CLI would find in the parent chain). It is owner-only (mode 0700 on POSIX; an explicit owner-only ACL on Windows, tested), holds only the system prompt and the MCP config with the run's token, is removed at run end, and leftovers are swept at boot without logging their path.
- **Fail closed on start.** The first `system/init` must show `apiKeySource: "none"`; tools exactly the role's `mcp__finora__*` tools and no built-in; MCP servers exactly `finora`, connected; no plugin beyond the built-ins; no skills, slash commands or agents; and `cwd` the run dir. Anything else kills the process before the first message and ends the run `failed: runtime_unsafe` (`agents/src/cli.init.test.ts`, one case per field).
- **Finora's tools over MCP.** The server opens a Streamable HTTP endpoint per run on `127.0.0.1` at a random port, closed when the run ends. Its token is 256-bit random, single-run, compared in constant time, and lives only in the owner-only MCP config file: never on a command line, in a log, a transcript, a finding or a backup. It refuses a request with any `Origin` header and any `Host` other than `127.0.0.1:<port>`, and serves Finora's read and investigation tools only; person data comes back only inside the run's purpose context (the same path as `readPurposeSection`). Tests: no token 401, a browser Origin 403, a foreign Host 403, refused after the run, the bind address, a person section without purpose `needs_purpose`, and a canary scan for the token.
- **`local`** (H6 option 3): Finora's own tool loop against a local model endpoint, behind the same interface, with the same tools, caps, citation verifier and fixtures. In v1 it is the interface and its config only; it is built only if the human chooses it, and the model's licence is recorded like a dataset licence (legal).
- **The fake CLI** (`fixtures/agents/fake-claude.mjs`, `agents.md` §13) is a binary that speaks the same stream-json protocol, replays a transcript and calls the real per-run MCP tools. Every test, CI, `FINORA_DEMO=1` and `pnpm finora --demo` run the `cli` backend against it (`FINORA_CLAUDE_BIN` points at it), and only there: with real data loaded and no demo flag, boot refuses the fake CLI, because a fake on real data would print invented findings (C19). So the spawn line, the environment, the init check, the caps, stop and pause are exercised with no subscription use. It asserts its own argv, environment and cwd before replaying. No test starts the real CLI.
- **Transcripts are fixtures:** hand-written against the fixture world, or recorded on the fixture profile with every web read answered by a fake. A test fails on any hostname in a committed transcript outside the reserved test domains and the official allowlist; the H4 check covers them.
- **The isolation proof** (C18 (7), council): `scripts/agents-isolation-proof.mjs`, run once by the human at S09a's acceptance against the real CLI in a throwaway `CLAUDE_CONFIG_DIR` with one sign-in, never the real config. It plants canary instruction files, a hook, a skill and an MCP server at user level and in the run dir's parent chain, and passes when no canary reaches the transcript, no hook runs and the init lists only Finora's tools. It records counts and the CLI version only and checks the dir's deletion; a CLI version change re-opens it, and `doctor` warns.
- `doctor` and `pnpm finora` report whether the CLI is installed and signed in, never starting the core load on that probe.

### 7.5 Questions back to the human

`ask_human` writes a `questions` row and a `question` event, sets the run to `waiting`, and tells the model to end its turn; the turn's `result` ends it, and the CLI process stays alive on its open stream-json input. `POST .../answer` validates the answer against the kind and writes it; the runner sends the answer as the next user message, which runs as a new turn of the same process.

| Kind | Default and timeout |
|---|---|
| `entity_choice` | no default, no countdown; after `QUESTION_TIMEOUT` (30 min) the investigation ends `not_enough_data`, reason "company not confirmed" |
| `free_text` (the lead's country question) | no default; the lead cannot pin without the answer, so after 30 min the investigation ends `not_enough_data` with reason "country not given" |
| `sanctions_match`, `scope` | "Not sure" after 30 min, marked "answered by default" |
| `cap_reached` | "Stop and write the report" after 10 min |

At most 3 questions per investigation from agents (`cap_reached` not counted); at most 1 per specialist run and 2 for the lead (a country question can precede an entity choice); a further call returns `question_limit`.

**The runtime, not the model, owns a question's rules** (qa MUST-FIX 3). The model supplies only the kind and the entity-specific text; the defaults, the blocking scope and the timeout come from the kind table above. `entity_choice` options are the candidates `search_companies` returned in this run (natural persons excluded), plus "None of these", which ends the investigation `not_enough_data` with reason "company not in the loaded registers". `cap_reached` is raised only by the runtime; `ask_human` refuses it. Tests: `agents/src/questions.test.ts` (one case each: a model-supplied default is ignored; an option not returned by `search_companies` is refused; `cap_reached` from the model is refused; "None of these" ends the investigation).

### 7.6 Events (SSE)

`GET /api/v1/investigations/:id/events`. Every event has a monotonic `id` (the `run_events` row id), so `Last-Event-ID` resumes exactly; heartbeat every 20 s.

```ts
type Envelope<T extends string, D> = { id: number; at: string; investigationId: string; type: T; data: D };
```

| Type | Data |
|---|---|
| `investigation.status` | `status` (`planning`, `running`, `waiting`, `paused`, `synthesising`, `done`, `stopped`, `budget_exceeded`, `failed`), `code?` (`plan_limit` with `resetsAt?`, or `overage`, when paused) |
| `plan` | runs with role ids, `dependsOn: []` |
| `run.status` | `runId`, `RunStatus`, `waitingOn?`, `code?` |
| `run.task` | `runId`, `taskId`, `labelKey`, `params`, `sourceId?`, `status` (`queued`, `running`, `done`, `failed`, `skipped`), `startedAt?`, `endedAt?`, `sourcesRead` |
| `run.step` | `runId`, `stepKey`, `params`; model text never reaches a lane |
| `run.source` | `runId`, `documentId`, `domain`, `title`, `kind`, `sourcesRead` |
| `finding` | the `Finding` |
| `question`, `question.answered` | the question with options, `defaultOptionId`, `timeoutAt`, `blocks`, `cap?`; the answer with `by: "human" \| "default"` |
| `usage` | `runId \| null` and the `usage` object (§5) |
| `verdict` | the `Verdict` |
| `error` | a machine code, `runId?` |

The `labelKey` and `stepKey` catalogues live in `packages/i18n/messages/<locale>.json` under `agents.*` and are listed in `agents.md` §11. Tests: `server/src/sse.resume.test.ts` (resume from any id with no gap or duplicate), `agents/src/events.test.ts` (per-run order holds under parallelism).

### 7.7 Usage caps (C16)

- **The unit is the standard token (st):** one Sonnet-class uncached input token. A run's usage in st is the CLI's own `total_cost_usd` divided by 3 x 10⁻⁶, plus 3,333 st per web search counted from `tool_use` blocks unless the measured run shows the fee is already counted (no investigation has web search in v1). The dollar figure is an internal meter only, in a private field that no DTO schema carries: no UI, API, MCP or log string shows a currency (test: one scan over the DOM, API, MCP and log output).
- **Hold, then settle, per run.** Before a run's process starts, its allocation (the role's `high` from `agents.md` §8, clipped to the caps) is held on the investigation ledger, the daily ledger and, for follow-ups, the follow-up ledger; a run that would push held plus settled past any cap does not start. The CLI's `--max-budget-usd` is the hard stop inside a run, at the allocation **minus H** (one response, about 25k st at `CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096`, later the measured p95), never above it. Finora's backstops read the stream: at the role's turn cap, or when the per-step input and cache tokens alone pass the allocation, it interrupts the run. The run settles from the CLI's `total_cost_usd`; a zeroed or missing result (a crash) settles at the hold and logs `settled_at_hold`. A run that settles above its hold logs `hold_underestimate`; after it no new specialist run starts, and the verdict still runs from its reserve. The global daily hold stays, so parallel runs cannot jointly pass a cap. The ledger holds counts and st only: never prompts, responses or the account's identity (legal).
- **Caps** (`agents.md` §8.2, C16): 500k st per investigation, 85k st per follow-up, 3.3M st per day (`AGENT_CAP_ST`, `AGENT_FOLLOWUP_CAP_ST`, `AGENT_DAILY_CAP_ST`). The verdict's reserve (`SYNTH_RESERVE`, 15%) is never held by specialists. **"Calibrated"** means at least 90% of the measured run and the M2 gate runs settle at or under the estimate's `high`, with the median within ±30% of `typical`.
- **Cap flow:** the first time held plus settled usage reaches the cap, every run goes to `waiting` (`waitingOn: "cap"`) and one `cap_reached` question offers "Stop and write the report" (default) or "Allow up to a third more of the cap" (`AGENT_EXTENSION_ST`, 170k st), clipped to what is left of the daily cap. It is offered once per investigation; the extension raises the allocation, and so the backstop, only of runs started after it is granted. A second hit ends the investigation `budget_exceeded`. The daily cap cannot be raised from inside a run.
- **The plan's own limit** is invisible to Finora until the CLI reports it. A limit result, a `rate_limit` retry at its last attempt, or a retry delay over 60 s **pauses the whole investigation** (`paused`, `plan_limit`, with the reset time if the stream gives one): every running process of it is interrupted, accepted findings stay, and resume is a user action that restarts the runs as boot recovery does. Short of that, the CLI's own retry runs and the lane reads "Waiting: Claude is busy". Finora retries nothing, and starts no new process while the CLI waits or to get round a limit (C18, legal). Stop writes the report with the unrun checks counted as not run.
- **Paid extra usage is refused, not just warned about** (C19). The runner reads `rate_limit_event.rate_limit_info` from the stream. `isUsingOverage: true` interrupts every run of the investigation at once and pauses it (`paused`, `overage`) with "Paid extra usage is on in your Claude account. Turn it off to continue."; overage permitted **and** a plan window exhausted (status `rejected`, or `utilization` at 100%) gives the same pause before the first paid request; overage permitted with every window inside the plan gives a warning only ("Paid extra usage is on in your Claude account; Finora will stop before using it"); no event means the status is unknown, and only the one-time notice shows. A pause never resets itself: Resume is a user action after a later event shows overage off or a window reset. The residual exposure (the request in flight, at most 4,096 output tokens) is measured first in S09a and stated in `docs/running.md`. The CLI's plan-window `utilization` may appear only as a secondary line labelled as Claude's own figure: in the pause message, and before a start at 90% or more of the 5-hour window ("Claude reports your 5-hour window at [N]%; this investigation may pause."); Finora's cap share stays primary.
- **One investigation at a time** (legal): an `investigation` lease; follow-ups only on a user action; no scheduled or unattended agent work exists.
- **The runtime slice is not accepted until data-osint's measured run** (`agents.md` §12, on the CLI backend after the human's H6 decision) replaces the modelled defaults and the estimate is calibrated on it.
- Tests: `agents/src/budget.test.ts` and `budget.parallel.test.ts` on fake-CLI transcripts (st from `total_cost_usd`; a zeroed crash result settles at the hold; the spawn carries the backstop at allocation minus H, the output and turn caps and no built-in tool; a meter that undercounts still settles at or under the allocation; six runs at the cap produce one question and at most the extension; two investigations cannot jointly pass the daily cap), `agents/src/plan-limit.test.ts` (a limit result pauses; a short CLI retry shows waiting and starts nothing; resume restarts), `agents/src/estimate.test.ts`.

### 7.8 Limits, timeouts, retries and stop

Per-role limits and timeouts are in `agents.md` §3.3; the architecture adds two hard ceilings, **40 turns and 80 tool calls per run**, as a safety net. Every limit ends its run with a machine code and keeps its findings:

| Event | Rule | Test |
|---|---|---|
| Turn or tool-call limit | run ends `done` with `turn_limit` / `tool_limit` | `agents/src/runner.limits.test.ts` |
| The CLI retrying (`system/api_retry`) | the CLI's own retries only; the run is `waiting` (`cli_retry`); no new process starts meanwhile; a plan limit pauses the investigation (§7.7) | `agents/src/runner.retry.test.ts` |
| An error result, a CLI that exits without a result, or a failed init check | run `failed` with `model_error`, `cli_exited` or `runtime_unsafe`; it settles (at the hold if the result is missing); other runs continue | `agents/src/runner.errors.test.ts`, `agents/src/cli.init.test.ts` |
| No CLI, or not signed in | the investigation does not start: `agents_unavailable`, and Investigate shows the sign-in state | `agents/src/backends/cli.test.ts` |
| Tool error | returned as an `is_error` tool result, never dropped; 3 consecutive tool errors end the run `failed` | `agents/src/tools.errors.test.ts` |
| Run wall clock (`AGENT_RUN_TIMEOUT`, 6 min, web 8 min), **time spent `waiting` excluded** (qa 2) | `failed: run_timeout` | `agents/src/runner.timeout.test.ts` (a run waiting 30 min on `sanctions_match` reaches its default and continues) |
| Investigation wall clock (`INVESTIGATION_TIMEOUT`, 20 min, question waits excluded) | open runs stop; the verdict runs on what exists | `agents/src/orchestrator.timeout.test.ts` |
| Stop | every run process gets the stream-json interrupt, then SIGINT, then is killed after 5 s; runs end `stopped` and settle from their result, or at the hold without one; the verdict is offered, not automatic | `agents/src/orchestrator.stop.test.ts` |

### 7.9 Citations, the verdict and banned words

- `record_finding` rejects (`agents.md` §5.2): no citation; a quote not found in its document; a quote under 40 characters or 8 words; over 300 characters, or over 125 for a press article; a document not read in this investigation; a statement of an entity that is neither the pin nor linked to it (`statement_other_entity`); a HIDE or LATER `itemId` (`item_not_allowed`); an unknown signal; a P8 match (`hidden_content`); a banned term in Finora's voice. Tests: `agents/src/citations.test.ts`, `agents/src/findings.test.ts`.
- **The level comes from `computeVerdict(checks, signals, answers, coverage)`** in `packages/domain/src/verdict/rules.ts`, a pure table (`agents.md` §6.2; entries marked "proposed" are confirmed by council in session 2). One test per rule in `domain/src/verdict/rules.test.ts`; `rules.determinism.test.ts` runs the five scenarios with three different explanation texts each and asserts the same `level` and `firedRules`.
- **The explanation** is structured output, at most 8 sentences, each citing ≥ 1 finding id; sentences without one are dropped by the server and by the renderer (R7). If any sentence uses a banned term (`packages/domain/src/config/banned-terms.ts`, per locale), it is regenerated once; if the second attempt fails too, `explanation: null` with reason `banned_term_fallback`, never silently rewritten. Tests: `agents/src/verdict.banned.test.ts` (pass, regenerate, fallback).

### 7.10 Untrusted content and the agent path for HIDE (P8)

- Web pages and documents are data, not instructions: tool results wrap fetched text in a delimited block and the system prompt says so (`agents.md` §10.3). Agents have **no tool with a side effect** outside Finora's own store and **no CLI built-in tool at all** (`--tools ""`): no email, posting, file system, shell, web search or web fetch of the CLI's own.
- **No general web search in v1** (legal's P8 ruling, the council, 80890a0): no model may read search snippets before Finora's filter, and no keyless search backend exists. Check 11 runs on a known domain only (the user's input or the register); website discovery (route 1, route 2) was measured below the council's bar and is LATER (council 7070598246).
- Fetching (`cite_page`, `homepage_facts`, `check_live_list`): `https` only; candidate hosts only from the register or the user's input; DNS resolved once and the connection pinned to that address; public addresses only (no loopback, private, link-local, CGNAT, unique-local, `0.0.0.0`, `::` or IPv4-mapped IPv6), re-checked on every redirect; size and time caps; per-host limits; fetched text escaped so it cannot close the untrusted-content delimiter (`agents.md` §4.6, §10.3). Test: `agent-tools/src/web-fetch.ssrf.test.ts`.
- **P8, four points** (`agents.md` §9): tool outputs pass `agent-tools/src/output-filter.ts` **before** a `documents` row is written, and quotes are verified against the filtered text, so no masked content is ever stored, even briefly (qa 4, legal); `record_finding` rejects HIDE/LATER items and canary patterns; documents are never exported and live under the person-data TTL; the report DTO is assembled only from accepted findings. Canary test: `agents/src/p8.canary.test.ts` iterates every HIDE id in `items.generated.ts` and every Part H category, over fake pages and court decisions that "reveal" each one plus a personal code, a birth date and a natural-person party; none reaches a tool result, a `documents` row, a finding, a follow-up answer, an SSE event, the API, MCP or the export (qa 6).
- **Follow-ups follow the same rules as findings** (qa 5, legal): every sentence cites a finding or a stored document; quotes pass the §7.9 span and verification rules; the banned-term check and regenerate-once apply; the P8 filter applies; the cap is `AGENT_FOLLOWUP_CAP_ST`. Tests: `agents/src/followup.test.ts` (uncited sentence dropped, quote not found rejected, banned term regenerated then fallback, cap enforced), and follow-up scenarios in `fixtures/agents/`.

---

## 8. Crash monitor

`docs/plan/loaders/markets.md` (data-markets) is the data spec: series, sources, maths, settings, schedule and request budget. This section fixes the seams.

- **Tables:** `market_series`, `market_obs`, `market_latest` (§3.8; DDL in `markets.md` §1.2), in `finora.db` for open sources and in `connector-cache.db` (same DDL) for licensed ones. Provenance through `sync_id` → `syncs`; no `records` row per observation. Values Finora computes (drawdown, value lost, the debt ticker, bitcoin supply) are `derived: true`.
- **Licensed data (R17):** `redistribution = false` ⇒ `connector-cache`. v1 takes no keys (H5): every market source is keyless, and a coded provider is configured only through the local provider map (§15, C17); removing its entry stops its fetches, and its rows read `not_configured`. The connector cache is never exported, listed in bulk or served to another user.
- **Cadence** (cto §7, `markets.md` §1.6): official series every 6 h; crypto quotes every 5 min while a Crash monitor client is connected and for 30 min after, otherwise hourly; stocks hourly in US trading hours only; never a 60 s upstream refresh. The page polls `GET /api/v1/markets/crash` (the server cache) every 60 s while visible, which also marks a client as connected. No FX in v1.
- **Tiles (H5):** M01, M03, M05, M06, M07 and M08. The fund slots, M02 and M04 have no keyless source and are LATER (Part G); a row with nothing to show is never drawn as 0%.
- **The row DTO** (`markets.md` §1.4 plus frontend's additions):

```ts
type MarketRow = {
  itemId: ItemId; label: string; state: "loading" | "ok" | "stale" | "not_configured" | "peak_unknown" | "error"; // loading: no sync yet (fresh install), never "error"; not_configured: no provider-map entry, no number
  value?: number; unit: string; peak?: { value: number; date: string; basis: "since" | "all_time" | "seeded" };
  rowKey: string;                                        // stable per row, e.g. "M03.X.02:japan" (one item can have up to 7 rows)
  trackingSince?: string;                                // peak_unknown: "Peak not known yet: tracking since [date]"
  dayChangePct?: number;                                 // change since the previous close
  drawdownPct?: number; valueLostUsd?: number;          // whole US dollars as a float (micro-USD overflowed above ~$9 bn); only where the source's terms allow it
  ticker?: { total: number; anchor: string; perSecond: number }; // M08 only: the client ticks the estimate from these
  cadence: "quarterly" | "monthly" | "daily_exchange" | "daily_7d" | "live"; delayed: boolean;
  asOf: string; sources: SourceRef[];
  attribution?: string;                                  // the provider's line from the local provider map, shown on the row; required on M01.X.03 (personal use, legal)
};
type TileId = "M01" | "M03" | "M05" | "M06" | "M07" | "M08";
type CrashResponse = { tiles: { tileId: TileId; rows: MarketRow[] }[];
  totalWiped?: { valueUsd: number; rowItemIds: ItemId[]; excludedItemIds: ItemId[]; oldestAsOf: string } };
// totalWiped sums only rows whose tile config has countInTotal: true (US corporate equities, total crypto market);
// a counted row with no value is named in excludedItemIds, never replaced by adding its parts (markets.md step 8).
```

- **Taiwan peak:** seeded once from a cited official figure if legal clears it; until then "Peak not known yet: tracking since [date]", never 0%.
- Tests: `markets/src/calc.test.ts` (peak, drawdown, value lost, day change, on synthetic series), `markets/src/connectors.test.ts` (connector-cache only, never exported), `markets/src/schedule.test.ts` (the request budget per source is never exceeded over a simulated day), `markets/src/items.test.ts` (one case per M item), `server/src/routes/v1/markets/crash/route.contract.test.ts`.

---

## 9. Internationalisation

- Locales: `en` (default), `lt`, `lv`, `et`. URL prefix (`/en/...`), negotiated from `Accept-Language` on `/`, remembered in a cookie.
- `next-intl`. Catalogues in `packages/i18n/messages/<locale>.json`, namespaced (`explorer.*`, `crash.*`, `agents.*`, `rules.*`, `errors.*`, `items.*`, `common.*`). ICU message format.
- **Parity test** (`i18n/src/parity.test.ts`): every key in every locale with the same ICU arguments; no empty strings.
- **Banned terms** have **one home**: `packages/domain/src/config/banned-terms.ts` (council clarification 2; DESIGN.md §4): the words (Clear, Safe, Avoid, Scam, Fraud), letter-grade patterns and credit-score wording, case-insensitive and whole-word, per locale (LT, LV and ET as stems, marked for native review: the English test fails the build, the other locales warn until reviewed). `i18n/src/banned-terms.test.ts` scans every catalogue string; the runtime check covers model output (§7.9); a verbatim excerpt inside `Quote` with its citation is the only exemption. Tests: `domain/src/config/banned-terms.test.ts` (grade and score patterns).
- Numbers, currency, dates and relative times through `Intl` with the active locale; money keeps its own currency; "reported in thousands" stays visible.
- Register words (statuses, legal forms, roles) show in the register's language with an English gloss from `domain/config/legal-forms.ts` and the dictionaries.
- Error codes map to `errors.<code>`, fired rules to `rules.<ruleId>`, caveats to `items.<itemId>.caveat`, empty states to `items.empty.<key>`.
- Agents receive the investigation locale; verdict levels and severities are keys, never model text.
- Lithuanian, Latvian and Estonian strings are drafted by the team and listed for native review in `packages/i18n/REVIEW.md`.
- Source-specific notices render verbatim where a source requires them: the Colorado disclaimer wherever CO data appears (`web/e2e/co-disclaimer.spec.ts`).

---

## 10. Legal and policy rules, enforced in code

Three rule sets apply, each rule with exactly one enforcement point and at least one named test. A rule that only lives in docs does not count (qa checklist 3).
- `R1`-`R18`: the product rules of `docs/research/legal.md` (same numbers).
- `P1`-`P14`: the council's policy table (`docs/plan/council/01-data.md` Parts E and H).
- `L1`-`L6`: rules from the desk research and the early reviews.

### 10.1 Legal product rules (R1-R18)

| # | Rule (short) | Enforcement point | Test |
|---|---|---|---|
| R1 | LV natural-person shareholders not shown; company-level facts only | HIDE items S04.LV.02, S04.LV.03 never loaded (load rule 4); natural-person members HIDE + LOCK (Part H item 2); restriction rules in `items/policy.ts` | `sources/src/lv/*.test.ts` (dropped and counted); `domain/src/report/restricted.test.ts` |
| R2 | Natural-person register data behind a stated purpose, logged per access | P2 below | P2 tests |
| R3 | Every record carries source, licence, retrieval date and access tier | `syncs` + `records` (§3.2), `SourcedValue` with `sources.min(1)` | `store/src/provenance.test.ts`, `store/src/licence-history.test.ts`, `domain/src/report/assemble.test.ts`, route and MCP contract tests, `web/e2e/report-sources.spec.ts` |
| R4 | No bulk redistribution of natural-person data | export filters personal items; no list endpoint or MCP tool returns persons across companies; fixtures hold only made-up people | `domain/src/export/export.test.ts`, `mcp/src/tools.contract.test.ts` |
| R5 | Sole traders are natural persons; no score for a natural person | `entities.natural_person` from the legal form; P6; the lead refuses natural-person subjects | `domain/src/policy/persons.test.ts`, `agents/src/orchestrator.subject.test.ts` |
| R6 | "Not a credit report..." on any page about a person | `PersonDisclaimer`, rendered wherever the DTO has `containsPersonalData: true` | `web/e2e/disclaimer.spec.ts` |
| R7 | Every verdict claim links to a primary source; unsourced claims not rendered | §7.9 | `agents/src/citations.test.ts`, `web/src/components/verdict-block.test.tsx` |
| R8 | A sanctions match reads "possible match, needs review"; "sanctioned" only with a primary list entry | §6 sanctions | `resolve/src/sanctions.test.ts` |
| R9 | AI-written text labelled on every surface | `generatedBy: "ai"` required by the schemas of findings, explanations and follow-ups; `AiLabel` renders from it; MCP carries no AI text | `api-contract/src/investigations.test.ts`, `web/e2e/ai-label.spec.ts` |
| R10 | Correction and objection channel; disputed values suppressed | `POST /disputes`; content-hash targets re-applied after every load (§3.3); "Report a problem" on every section | `store/src/disputes.test.ts`, `server/src/routes/v1/disputes/route.contract.test.ts`, `web/e2e/dispute.spec.ts` |
| R11 | Natural-person cache TTL | P5 below; ended roles P4 | P4, P5 tests |
| R12 | Only official sanctions lists bundled; aggregated non-commercial lists connector-only | licence invariants (§4.2) | `sources/src/licences.test.ts` |
| R13 | CC BY-NC and ODbL never committed or published | licence invariants; the guard blocks data files; fixtures synthetic | `sources/src/licences.test.ts`, `scripts/guard` tests |
| R14 | No scraping where terms forbid; official APIs within limits; EDGAR User-Agent from env, ≤ 10/s | polite fetcher (§4.4 step 1); boot refuses SEC sources without `SEC_USER_AGENT` | `sources/src/fetcher.test.ts`, `server/src/env.test.ts` |
| R15 | Map data: lat/lng only, ≤ 30 days | no maps in v1; a map slice adds its own test | n/a in v1 |
| R16 | Each source's licence and attribution shown | `SourceChip`, the Sources page | `web/e2e/report-sources.spec.ts`, `web/e2e/sources-page.spec.ts` |
| R17 | Licensed market data only through user keys | `connector-cache` class (§3.5, §8) | `markets/src/connectors.test.ts` |
| R18 | The source-code link is visible in the UI and the API | footer link; `GET /api/v1/about`; MCP `serverInfo` | `web/e2e/source-link.spec.ts`, `server/src/routes/v1/about/route.contract.test.ts`, `mcp/src/server-info.test.ts` |

### 10.2 Council policies (P1-P14)

| # | Policy | Enforcement point | Test |
|---|---|---|---|
| P1 | Share-alike data in its own store; switchable to `live-no-store` | §3.5; `SHARE_ALIKE_MODE` | `ingest/src/share-alike.test.ts`, `ingest/src/live-no-store.test.ts`, `store/src/share-alike-rebuild.test.ts`, `domain/src/export/export.test.ts` |
| P2 | Purpose gate: once per session (12 h or restart) from a fixed list in the UI; every API and MCP call names a purpose; one append-only log row per company opened, with the purpose in force | `store/src/purpose.ts` (`readPurposeSection` writes the log row before returning), `POST /purpose`, `domain/config/purposes.ts` | `store/src/purpose.test.ts` (3 companies → 3 rows; 12 h + 1 min → `needs_purpose`; a purpose change between two companies gives two rows and the first is unchanged), `mcp/src/purpose.test.ts`, `web/e2e/people-purpose.spec.ts` |
| P3 | No personal codes, derived birth dates or ages, EE person hash or gender, ever | dropped at load (§4.4 step 3); canary scanner on every surface | `store/src/canary.test.ts`, `server/src/canary.contract.test.ts`, `mcp/src/canary.test.ts`, `domain/src/export/canary.test.ts`, `agents/src/canary.test.ts`, `web/e2e/canary.spec.ts` |
| P4 | Ended person roles not retained; "a board member's role ended on [date]" with no name | §3.7, §3.3 role-set records; `PERSON_ROLE_RETENTION_DAYS=0` | `ingest/src/history.test.ts`, `ingest/src/role-ended.test.ts` |
| P5 | Natural-person TTL and the US live cache: re-fetch after 24 h, purge entries not viewed in 30 days | retention job (`ingest/src/retention.ts`), `live-cached` class | `store/src/retention.test.ts`, `ingest/src/live-cache.test.ts` (fake clock: day 29 survives, day 30 deleted) |
| P6 | Facts-only variant for natural persons and sole traders: no verdict, disclaimer at top, people behind the purpose gate, sole-trader address country only, sole-trader money CAVEAT behind the gate, sole-trader tax and arrears lines HIDE, natural-person insolvency HIDE | `assembleReport` branch on `isNaturalPerson`; loader gates (§4.4 step 3) | `domain/src/report/facts-only.test.ts`, `ingest/src/natural-person.test.ts`, `web/e2e/facts-only.spec.ts` |
| P7 | Blocked uses for natural-person and sole-trader subjects (credit, employment, insurance, tenancy, licensing, credit servicing): not in the purpose list, stated in the terms | `domain/config/purposes.ts` has no blocked purpose; a blocked id is refused on every surface; footer links the terms | `domain/src/policy/purposes.test.ts`, `server/src/routes/v1/purpose/route.contract.test.ts`, `mcp/src/purpose.test.ts`, `web/e2e/terms-link.spec.ts` |
| P8 | HIDE holds on the agent path; court parties masked unless proven a company | §7.10; §6 tier 3 | `agents/src/p8.canary.test.ts`, `resolve/src/court-party.test.ts` |
| P9 | Our own snapshots as events; cap `HISTORY_MAX_GB` warns, never deletes | §3.7; health check | `server/src/routes/v1/health/route.contract.test.ts` (warning above the cap), `ingest/src/history.test.ts` |
| P10 | Store budgets and load times | §4.5, `docs/plan/benchmarks.md` | loader slice acceptance; `ingest/src/regression-budget.test.ts` (relative, CI) |
| P11 | A state's live query is blocked until its licence is recorded (NY, CO, CT, PA on; OR, WA off) | licence invariant 4 (§4.2) | `sources/src/licences.test.ts` |
| P12 | No real ticker in the tree | v1 has no fund slots (H5); any ticker-shaped value in `fixtures/` uses the reserved prefix `ZZFX` (`ZZFX01`-`ZZFX99`), and the H4 sweep treats any other as a hit | `fixtures/ids.test.ts` (every ticker in `fixtures/` starts with `ZZFX`) |
| P13 | LAWYER register: id, question, affected items, interim value, config key, test; CI fails on a `[pending: lawyer]` with no row | `docs/plan/lawyer-register.md` (legal owns the rows); `scripts/check-lawyer-register.mjs` | `scripts/check-lawyer-register.test.mjs` |
| P14 | Snapshot-dependent rules read "Not evaluated: tracked since [date]" until our history covers the window | the check-level state `not_evaluated{trackedSince}` on `Check` (§7.2), not a section state; verdict rules treat it as not evaluated, never as clean | `domain/src/verdict/history-window.test.ts` (a 10-day-old install cannot report "no rename in 6 months") |

LAWYER rows (P13) are the rows of `docs/plan/lawyer-register.md` (legal owns them; the coordinator commits). This document does not copy the list, so the two cannot drift: `check-lawyer-register` matches every `[pending: lawyer <id>]` marker against that file's ids, and fails when a register row has no enforcing test in `slices.md` S01 acceptance 7. Config keys named in the register (`PERSON_ROWS`, `LV_PERSON_ROWS`, `PERSON_ROLE_RETENTION_DAYS`, `PERSON_DATA_TTL_DAYS`, `DISPUTE_SUPPRESS_AFTER`, `SHARE_ALIKE_MODE`) are validated in `env.ts` (§15). Each interim is the safe value, and nothing is upgraded without the lawyer's answer.

### 10.3 Other rules (L1-L6)

| # | Rule | Enforcement point | Test |
|---|---|---|---|
| L1 | Hidden data is never stored | load rule 4 (§3.1), field-map gate | `sources/src/field-maps.test.ts` |
| L2 | No person pages, person search, person endpoint or person MCP tool | no route, endpoint or tool exists; search indexes companies only | `server/src/route-table.test.ts`, `mcp/src/tools.contract.test.ts`, `store/src/search.test.ts` |
| L3 | No search-engine indexing of people | `X-Robots-Tag: noindex` and `robots` meta on profile and investigation pages; a sole trader's title is its legal form and code, never the name | `web/e2e/seo-headers.spec.ts` |
| L4 | = P3 | | |
| L5 | Restriction requests and disputes honoured on every surface | suppressions and disputes applied in report assembly, search, export, MCP and agent tools | `store/src/suppressions.test.ts` + one assertion per surface test |
| L6 | Removed upstream means removed here | purge by set difference (§4.4 step 6) | `ingest/src/purge.test.ts` |

### 10.4 Every HIDE item has a negative test on every surface

Part G's HIDE ids (`S04.LV.02`, `S04.LV.03`, `S04.EE.02`, `S16.ALL.04`, `OUT.US.01`) plus Part H's HIDE categories (natural-person members in LV and EE, sole-trader tax and arrears lines, natural-person insolvency, EE natural-person bankruptcy notices). One parameterised suite per surface iterates the HIDE list from `items.generated.ts` and `items/policy.ts`, over fixtures that contain every hidden item in its source's raw layout:

| Surface | Test |
|---|---|
| Loader (never stored, counted as dropped) | `ingest/src/hide.negative.test.ts` |
| API (no field, no value, no count) | `server/src/hide.negative.test.ts` |
| MCP | `mcp/src/hide.negative.test.ts` |
| Export | `domain/src/export/hide.negative.test.ts` |
| Agent path | `agents/src/p8.canary.test.ts` |
| UI (absent from the DOM in every fixture state) | `web/e2e/hide.spec.ts` |

A new HIDE id in Part G enters every suite automatically through the generated list.

### 10.5 The rendered-field registry (CI job `field-registry`)

- `server/src/field-registry.test.ts`: every value in every API response on the fixture world carries an `itemId`; every id is a SHOW or CAVEAT item; no HIDE or LATER id appears.
- `web/src/field-registry.test.ts`: renders every state on `/design` and the fixture pages, collects the `itemId`s rendered by `FieldRow` and its siblings, and fails on an untagged value, an unknown id, or a SHOW/CAVEAT id with fixture data that never renders.
- `domain/src/items/items.generated.test.ts`: the generated list matches Part G in `01-data.md`.

---

## 11. Auth, hosting and deployment

**v1 is local and single-user.** The server binds `127.0.0.1` only. There are no accounts. Every service takes an `Actor` in its context (`{ kind: "local" }` today; `agent:<role>` and `mcp` for logs), so adding users later changes the edge, not the services.

No hosted build while any publication-related LAWYER item is open (council Part E). Hosting is the human's decision. Options, recommendation first:

| Option | Fit | Notes |
|---|---|---|
| A. One small VM or container host with a persistent volume | Best | Long-lived process for agents and SSE, SQLite on a volume, nightly loader jobs. Add auth (passkey or email link), per-user investigations, per-user keys encrypted at rest, rate limits, the purpose log per user |
| B. Public read-only explorer, agents only in local installs | Good first public step | No user keys held by us; requires every person rule (R2, R6, L2, L3), the correction channel (R10) and the source link (R18) |
| C. Serverless platform | Poor | Agent runs outlive request limits, SSE fights the platform, SQLite needs a network database |

---

## 12. Security

| Threat | Control |
|---|---|
| A web page calling the local API (DNS rebinding, CSRF) to start investigations on the user's plan | Host allowlist (`localhost`, `127.0.0.1`, `[::1]`) on every request, pages and API; on unsafe methods a present `Origin` must match `Host`; every launch script binds `127.0.0.1`. Tests: `server/src/guard.test.ts`, `web/e2e/security-headers.spec.ts` |
| Prompt injection from fetched pages | §7.10: no side-effect tools, delimited untrusted content, citations verified against stored text, caps on cost and turns |
| SSRF through agent fetches or loaders | public-address check after DNS (and after each redirect); per-source host allowlists |
| Secrets leaking | keys only from the environment (`.env.local`, gitignored; `.env.example` documents names); never logged or returned; `import "server-only"` in `env.ts` and every seam file; CI builds with sentinel key values and `scripts/check-bundle-secrets.mjs` fails if one appears in `.next/static` (`scripts/check-bundle-secrets.test.mjs`); the guard blocks committed secrets |
| Personal data leaking | the canary scanners (P3, PS5); the logger's redaction list (names, codes, the install key, internal hashes); logs carry company eids, never person rows |
| XSS from data or model output | React escaping; model text as Markdown with HTML disabled and an `http`/`https` link allowlist; strict CSP (`default-src 'self'`, nonce-based scripts), `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy` |
| Oversized or malicious inputs | Zod on every boundary; body size caps; FTS query sanitising (no raw `MATCH` syntax from users) |
| Supply chain | lockfile, `pnpm install --frozen-lockfile`, `minimumReleaseAge` and explicit `allowBuilds` in `pnpm-workspace.yaml`, `pnpm audit --audit-level high` with a reviewed ignore list, Dependabot |
| Runaway spend | §7.7 caps, unknown price refuses, the daily cap |

The `security-engineer` review runs on the slices that add the API, the agent runtime, the MCP server and any fetcher.

---

## 13. Testing

| Layer | Tool | What | Where |
|---|---|---|---|
| Unit | Vitest | pure logic: normalisation, scoring, checks, verdict rules, peak maths, policies, report assembly, ledger | next to the code, `*.test.ts` |
| Loader contract | Vitest | each loader's `parse` on its synthetic layout fixture: records, field map, provenance, party gate, HIDE drops, budgets per record | `packages/sources/src/<cc>/<id>/*.test.ts` |
| Pipeline | Vitest | purge, unchanged, partial, stale, purge guard, parser version, class change, history, retention, share-alike modes | `packages/ingest/src/*.test.ts` |
| Live source check | Vitest, tagged `live` | fetches a small real slice and asserts the upstream shape (columns, types, encodings, as-of field); stores nothing | nightly CI only |
| Store | Vitest | migrations from zero and every prior version; FTS diacritics; suppressions; disputes; purpose log; canary | `packages/store` |
| API contract | Vitest | every route on the fixture world validates against its schema; error codes; OpenAPI current; field registry; HIDE negatives | `apps/server` |
| MCP contract | Vitest + MCP SDK client, in-memory transport | tool list snapshot; each tool on fixtures; purpose; canary; HIDE negatives | `apps/mcp` |
| Agent runtime | Vitest + the fake CLI | the twelve scenarios of `agents.md` §13; parallelism; questions; caps; retries; limits; stop; recovery; citations; P8 | `packages/agents` |
| E2E | Playwright (Chromium) + axe | the real app on the `fixtures` profile with `FINORA_DEMO=1`: search → profile → purpose → investigate → answer → verdict → follow-up → library; network; Crash monitor; settings; locale switch; security headers; HIDE; canary | `apps/web/e2e/` |
| Visual | Playwright `toHaveScreenshot` | every DESIGN.md state at the four viewports in the default theme; key screens in the second theme | Linux CI only (fonts differ by OS) |
| Benchmarks | cto's probes | P10 budgets on the named profile | `docs/plan/benchmarks.md` |
| Guard | node:test | unchanged | `scripts/guard` |

**Fixtures** are synthetic: obviously fictional names from `fixtures/wordlists/`, fixture-only ids per §3.4, source files written in each source's real layout by the generator. `pnpm fixtures:gen` (seeded, deterministic) builds the ≈ 2,000-entity world at test time; only per-source layout fixtures under 50 KB are committed. Agent transcripts in `fixtures/agents/*.json`, UI states in `fixtures/ui/`. Recordings against real data stay in `research/.cache/`; screenshots in docs come from the fixtures profile only. The recipe is `fixtures/README.md`.

**Visual baselines** are committed, rendered from fixtures only; an update runs `pnpm e2e:visual --update`, then `node scripts/guard/guard.mjs review` on each changed image.

**Denylist at lint time (SHOULD, S01).** `packages/tooling/eslint/rules/denylist.ts` reuses the guard's denylist loader (the private file or `FINORA_GUARD_DENYLIST`) on identifiers and string literals, so a builder sees a denylisted name at lint time, not only at commit, without any entry appearing in a committed config. No test-naming convention is needed (coordinator register C12). Test: `packages/tooling/eslint/rules/denylist.test.ts`, fed through `FINORA_GUARD_DENYLIST`.

**Milestone gate** (council sessions 0 and 2; qa checklist 13). `scripts/milestone-gate.mjs` runs locally through the running app's API:
- **Input:** the regression set at `research/.cache/regression/set.json` in the main checkout (country, registry id; never committed), built and owned by the coordinator before S12.
- **What it runs:** investigations on the regression set only, with question cards answered by script (`agents.md` §12); profile-only checks (fill rate, no agent usage) on a fresh random sample of 10 companies per country.
- **Wrong-company finding:** a citation or anchor that resolves to an eid other than the subject or an entity linked to it by a `same_as` row.
- **Usage:** `--budget-st` keeps its own ledger and never starts an investigation whose estimate `high` exceeds what is left; usage in st is printed in the totals, and gate runs feed the estimate history.
- **Output:** a fixed table of aggregates only (wrong-company findings, must be 0; cited verdict claims, must be 100%; fill rate per country against the reality check, within 10 points; usage in st), exit 0 on pass and 1 on fail. It is pasted into each `docs/plan/council/03-*.md`.
- Test: `scripts/milestone-gate.test.mjs` on a synthetic set: the fixed table, the exit codes, the budget ledger, and that no entity name, code or id is printed.

---

## 14. CI

`guard.yml` stays as it is. `ci.yml` runs on every pull request and push to `main`; one run per branch, older runs cancelled. Jobs:

| Job | Steps |
|---|---|
| `check` | `pnpm install --frozen-lockfile` (Node 24, pnpm from `packageManager`); `pnpm lint` (incl. the denylist rule); `pnpm typecheck`; `node scripts/check-deps.mjs`; `node scripts/check-tokens.mjs`; `node scripts/check-lawyer-register.mjs`; generated files current (`items.generated.ts`, `route-table.ts`, `openapi.json`) |
| `test` | on `ubuntu-latest` and `windows-latest` (the human runs Finora on Windows): `pnpm test` (unit, loader contract, pipeline, store, API, MCP, agent runtime), both `SHARE_ALIKE_MODE`s, both `LV_PERSON_ROWS` modes |
| `field-registry` | §10.5 |
| `build` | `pnpm build` with sentinel key values, then `node scripts/check-bundle-secrets.mjs` |
| `e2e` | Playwright on the fixtures profile with `FINORA_DEMO=1`; traces uploaded on failure |
| `visual` | Playwright screenshots in the pinned official Playwright container |
| `demo-boot` | on `ubuntu-latest` and `windows-latest`: `pnpm finora --demo` (production build), then `/api/v1/health` answers |
| `audit` | `pnpm audit --audit-level high` |

`live-sources.yml` runs nightly and on demand: the `live` loader checks and the reserved fixture-id check (§3.4), with `SEC_USER_AGENT` from a repository secret. It opens an issue when a source's format changes; it never fails a pull request. `ci` and `guard` are required checks for `main`. E2E never touches live sources or paid APIs.

---

## 15. Configuration

`.env.example` (committed, placeholders only) documents every variable; `apps/server/src/env.ts` validates them once at boot (Zod) and fails naming the variable.

| Variable | Default | Purpose |
|---|---|---|
| `FINORA_DATA_DIR` | `./.data` (gitignored), resolved against the repository root, not the working directory | SQLite files, raw cache, install key |
| `FINORA_PORT` | `3000` | port, bound to 127.0.0.1 |
| `FINORA_DEMO` | unset | `1` = the fake CLI and fixture data |
| `FINORA_AGENT_BACKEND` | `off` | `cli`, `local` or `off`; `off` until the human's H6 decision is recorded (C18) |
| `FINORA_CLAUDE_BIN` | `claude` on the PATH | the CLI binary; tests and the demo point it at the fake CLI |
| `SEC_USER_AGENT` | none | the SEC contact header ("app name contact-email", SEC policy); a contact setting, not a key (C14), and the only optional setting in v1 (H5) |
| `AGENT_*` | `agents.md` §15 | models, effort, concurrency, turn caps, timeouts; the usage caps `AGENT_CAP_ST` (500000), `AGENT_FOLLOWUP_CAP_ST` (85000), `AGENT_DAILY_CAP_ST` (3300000), `AGENT_EXTENSION_ST` (170000) |
| `QUESTION_TIMEOUT` | `30m` (`cap_reached` 10 min) | §7.5 |
| `SHARE_ALIKE_MODE` | `store` | `store` or `live-no-store` (P1) |
| `PERSON_ROWS`, `LV_PERSON_ROWS` | `names_no_id` | §3.3; LAWYER rows |
| `PURPOSE_SESSION_HOURS` | `12` | P2 |
| `PERSON_ROLE_RETENTION_DAYS` | `0` | P4 (LAWYER) |
| `PERSON_DATA_TTL_DAYS` | `30` | P5 (LAWYER) |
| `LIVE_CACHE_REFETCH_HOURS` | `24` | P5 |
| `DISPUTE_SUPPRESS_AFTER` | `0` (immediately) | R10 (LAWYER) |
| `HISTORY_MAX_GB` | `1` | P9, warns only |
| `CRASH_PEAK_SINCE` | `2025-01-01` | start date for "peak" |
| `FINORA_PROVIDERS_FILE` | `<data dir>/providers.json`, absent | the local provider map: each coded market source's hosts, https URL templates on those hosts, licence (registered from the entry), attribution, publisher and terms URL, and for a cited series its owner slot, which holds the copyright holder's name only; no licence terms (C15, C17, legal 7070802248). Validated strictly by `packages/markets/src/providers.ts` (bare hostnames, no IP literal, localhost or wildcard; unknown keys refused; a size cap), loaded once; a broken or missing file configures nothing, and those Crash monitor rows read `not_configured`, never 0. Never backed up (backups copy allowlisted tables only; `cli/src/commands.test.ts`), logged or served |

---

## 16. The one command

```bash
pnpm finora
```

runs `scripts/finora.mjs`, which: checks Node ≥ 24 and pnpm; **checks free disk (refuses the core load with less than 15 GB free: the data dir's 12 GB plus temporary space)**; **installs when the install is not known good** (cto, qa, from qa's stale `node_modules` on 2026-11-21): it runs `pnpm install --frozen-lockfile` when `node_modules/.finora-install` (the lockfile's sha256, written only after an install and the checks below pass) is missing or differs; then resolves the runtime entry points from `apps/web` with `createRequire` (`next`, `react`, `react-dom`, the `@finora/*` packages) as the fast check; after the build, a boot smoke starts the server and requests `/api/v1/health` and `/en` within 30 s, which catches a missing transitive package that entry points miss; on a failure it removes `node_modules` once, reinstalls, rebuilds and retries, and on a second failure stops with a message naming the failing module, never looping; creates `.env.local` from `.env.example` on first run and says which keys are optional and what each unlocks; runs migrations; **runs `next build` when `.next` is missing or stale (keyed on the commit, the lockfile hash and a hash of uncommitted changes to tracked files; `pnpm finora --rebuild` forces it), then `next start`** on `http://127.0.0.1:3000` and prints the URL (daily use never runs `next dev`, cto B3); then runs `finora-cli data sync --profile core` in the background (each country searchable as its register lands, progress on Settings and in the search groups, safe to interrupt and resume, incremental after the first run). `pnpm finora --demo` uses the fixtures profile and the fake provider, starts in seconds and needs no network.

**A daily way in** (council session 2, item 15): `pnpm finora --install-startup` adds an opt-in start at login (Windows first: a per-user Task Scheduler entry; it binds 127.0.0.1 and is inside the security review), and `--remove-startup` removes it. At boot, a catch-up refresh runs every refresh missed while the app was closed; until it finishes, the affected values show Stale.

The CLI (`apps/cli`) runs as `pnpm finora-cli <command>`: `data sync [source|--profile p] [--allow-mass-purge]`, `data status`, `search`, `show <eid>`, `resolve`, `suppress`, `doctor` (disk preflight, `PRAGMA quick_check`, lease status), `backup`, `mcp` (the stdio MCP server, also the `finora` binary for MCP client configs).

**Integrity and backup** (session 2: cto's allowlist design with legal's conditions, `LAW-BACKUP-RETENTION`; qa's fail-closed log).
- **User data lives in its own file:** `finora-user.db` holds what cannot be re-derived (investigations and everything under them, `purpose_log`, disputes, suppressions, judgements, settings). It is attached like the share-alike store, and every reference across files uses the public `eid` (the A6 rule). `leases` stay in `finora.db`. The registry store is never backed up: it re-derives from the raw cache.
- **Every table has exactly one backup class:** `backed_up`, `person_excluded` or `derivable`. `store/src/backup-classes.test.ts` fails on an unclassified table or column, and asserts every filter below by name, so nothing can drift into a backup unnoticed.
- **Backup by allowlist, never by file:** `finora-cli backup` creates a fresh `backups/backup-<date>.db` and copies only the `backed_up` tables with `INSERT ... SELECT`. It never uses `VACUUM INTO`, which copies the whole file and cannot exclude rows.

  | Table | Class | What is copied |
  |---|---|---|
  | `settings` | backed_up | all |
  | `purpose_log` | backed_up | company eid, purpose id, surface, time |
  | `disputes` | backed_up | only disputes whose item is non-personal **and** whose entity has `natural_person = 0`; content hash, item, kind, status, dates (legal 1) |
  | `judgements` | backed_up | company pairs only: `eid_a`, `eid_b`, `decision`, `by`, `at`; no row where either entity is a natural person; no note column (legal 2) |
  | investigation index | backed_up | id, subject eid, status, level, coverage, cost, dates; **only pinned investigations** (a pinned subject is always a company, R5); never the typed subject text; unpinned free-text investigations are excluded entirely (legal 3, cto) |
  | findings text, citation snapshots, `documents`, questions and answers, follow-ups, run events and tasks, signals | person_excluded | nothing |
  | `suppressions` | backed_up | company-level only: a non-personal item on a `natural_person = 0` entity (legal); a suppression on a person line is never backed up and lives in `restrictions.log` instead (below) |
  | registry tables, `leases`, `jobs` | derivable | nothing |

  The app runs it daily and keeps **3** backups; older ones are deleted whole. Backups are a few MB and count inside the 12 GB data dir.
- **Deletions survive a restore, and fail closed** (qa): every deletion of user data (a user delete, a TTL expiry under P5/R11, a resolved dispute, a lifted suppression) appends an opaque `{table, id, deletedAt}` line to `<data dir>/deletions.log` and **fsyncs it before the deletion is acknowledged**; a failed append fails the deletion. The same deletion is applied to every existing backup at once. The log is never inside a backup and never restored.
- **Person-line restrictions survive a repair without a backup copy, and without any derived value of the person's data** (legal 7048910097, 7048919634; cto; qa; coordinator). A suppression whose target is a personal item is appended to `<data dir>/restrictions.log`, fsynced before the suppression is acknowledged, never inside a backup, never shared between installs:
  - **Sources with a row-local role id** (LV officer `id`, EE `kirje_id`; PS1, PS6): `{op: "suppress" | "lift", companyEid, itemId, sourceRowId, at}`. After a repair, that line stays hidden.
  - **Sources without one** (CT principals, PA parties, the NY CEO, SEC insiders, Form D): `{op, companyEid, itemId, role, at}` (council, legal rated the role field Y). After a repair, **every line of that role at that company** stays hidden and reads "Hidden after a data repair", with a "Show again" action that appends a lift entry: it may over-hide, it never re-shows a line on its own.
  - **Sole traders** (the entity itself is a natural person): no entry at all. After a repair, every personal item of every natural-person entity stays hidden until a re-run (hide by default; they get no agents anyway).
  - No content hash of a line, no name, no code and no value is written anywhere. A lift appends a lift entry, and a daily compaction job removes lifted entries, so the file holds active restrictions only.
- **Repair:** if `PRAGMA quick_check` fails at boot, the app refuses writes and tells the user. `finora-cli doctor --repair` refuses to restore if `deletions.log` or `restrictions.log` is missing or unreadable; otherwise it restores the allowlisted tables from the newest backup, replays `deletions.log` and `restrictions.log`, runs the retention job and re-applies suppressions and disputes **before reads resume**, then re-derives the registry from the raw cache. A repaired investigation keeps its level, coverage and dates and reads "Details not restorable after repair: re-run to see findings".
- Tests: `store/src/backup-classes.test.ts` (every table and column classified; each filter by name; no `person_excluded` table in a backup file), `cli/src/backup.test.ts` (a fixture dispute on an officer line, a sole-trader judgement and an unpinned free-text investigation are absent; a pinned company investigation keeps its index row; size budget; a deletion is pruned from existing backups; 3-day expiry), `cli/src/doctor.test.ts` (corruption detected and repaired; a deleted investigation stays gone; a dispute resolved after the backup stays resolved; a missing or corrupt `deletions.log` or `restrictions.log` makes `--repair` refuse with nothing restored; an LV officer-line suppression is absent from every backup file and still hidden after corrupt and repair; a US principal-line suppression keeps that role's lines hidden after repair until "Show again"; a sole trader's personal items are hidden after repair), `store/src/restrictions-log.test.ts` (no hash, name or code in the file; a lifted entry is gone after compaction), `store/src/deletions-log.test.ts` (a failed append fails the deletion).

---

## 17. Open items

| # | Item | Waits on |
|---|---|---|
| O1 | Whether the instant profile shows a verdict level (today: checks and coverage only) | council session 2 |
| O2 | The rule-table entries `agents.md` marks "proposed" | council session 2 |
| O3 | The LAWYER rows of §10.2 | a lawyer; interim values ship |
| O4 | data-osint's measured run, which calibrates usage and accepts the runtime slice | the runtime slice, on the CLI backend after the human's H6 decision |
| O5 | `SEC_USER_AGENT` (the contact setting), before the US slices start | the human |
| O6 | Token values and the final component inventory | `DESIGN.md`, the mockups, `ui-build-plan.md` draft 2 |
