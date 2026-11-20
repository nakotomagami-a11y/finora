# Finora architecture

> **Status: phase 3, in revision.** Milestone A (§3 data model, §4 loaders) is revised against council session 1 and is the contract the loader specs implement. Milestone B (every other section and `docs/plan/slices.md`) follows. Remaining **[pending: ...]** markers belong to milestone B.

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
           LLM provider                        packages/store   packages/markets ──► market connectors (user keys)
           (user's key)                         (SQLite file)
                                                  ▲
          packages/sources (loaders) ─────────────┘ ◄── official bulk files and APIs
```

- **One process locally.** `pnpm finora` starts Next.js; Next mounts `apps/server` under `/api` and calls its `boot()` from the instrumentation hook, which starts the job runner (agent investigations, scheduled source refreshes, market refresh). Nothing else needs to run: no Docker, no database server, no Python.
- **The same server runs standalone** (`pnpm server`) for hosting or for an MCP-over-HTTP client with the UI closed.
- **One SQLite file** (`<data dir>/finora.db`) holds registry data, investigations and settings. A second file (`<data dir>/connector-cache.db`) holds data we may not redistribute (market prices fetched with the user's key); it is never exported and never served to anyone but its owner.
- **One tool definition, three surfaces.** A capability such as "search companies" or "get a company's officers" is defined once in `packages/agent-tools` and exposed to the research agents, the MCP server and (through domain services) the HTTP API. They cannot drift.

### Why these choices

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Language | TypeScript everywhere (Node 24 LTS) | Python loaders: two toolchains for one maintainer, and the useful Python libraries (register parsers, entity resolution) are small enough to port or not needed for v1 |
| Store | SQLite through Node's built-in `node:sqlite` (FTS5 with the `trigram` and `unicode61 remove_diacritics` tokenizers verified on Node 24) | Postgres: a server to install for a local, single-user app. DuckDB: great for analytics, weaker for many small transactional writes from agents. A native SQLite addon: a C++ toolchain on Windows when no prebuild matches |
| Entity model | A FollowTheMoney subset (schema and property names), stored as **statements** with provenance | A bespoke relational schema per country: every new source would mean a migration, and per-value provenance and licence would be bolted on |
| Agent loop | Our own loop on the Messages API, behind an `LlmProvider` interface | A hosted agent service: beta, investigation history (which contains personal data) would live off the user's machine, our tools read a local SQLite file anyway, and an open-source app should not require one vendor's hosted runtime. A batteries-included coding-agent SDK: built around file and shell tools we must not give a research agent |
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
  agents/         Agent runtime: orchestrator, LLM providers, budget ledger, event bus, citation verifier
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
| `i18n` | nothing internal |
| `ui` | `i18n` (types only) |
| `api-contract` | `domain` |
| `store` | `domain` |
| `sources` | `domain` |
| `resolve` | `domain`, `store` |
| `ingest` | `domain`, `store`, `sources`, `resolve` |
| `markets` | `domain` |
| `agent-tools` | `domain`, `store`, `resolve`, `markets` |
| `agents` | `domain`, `store`, `agent-tools` |
| `apps/server` | all packages except `ui` |
| `apps/mcp` | `domain`, `store`, `agent-tools`, `api-contract` |
| `apps/cli` | `domain`, `store`, `ingest` |
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

Never stored, whatever the source offers (policy P3, legal rules 1 and 5): personal codes (masked or not), birth dates or ages derived from them, the EE person hash, gender, personal emails, home addresses, sole-trader addresses finer than the country, natural-person insolvency, and tax or arrears lines tied to a natural person.

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
  row_hash             BLOB NOT NULL,     -- sha256 truncated to 16 bytes, over the record's hash input (per-key collisions are not a practical risk)
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
  type_id    INTEGER NOT NULL,            -- interned: 'register.ruling', 'filing.8k.5.02', 'finora.renamed', 'finora.role_ended', 'finora.debtor_listed', ...
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
- **Disputes survive any reload (R10, qa M1).** A dispute's target is the company eid + source + item + a content hash of the disputed line (its normalised fields, the same normalisation as the hash input). Because a change to any role replaces the whole set, the suppression is never tied to a row: after every load, and at every read, any line whose content hash matches an open dispute stays suppressed. Test: `store/src/disputes.test.ts` (open a dispute on officer A, then add officer B so the set is replaced: A stays suppressed, B shows; a later reload changes nothing).
- **Detecting a role end without a person key (qa S1).** Each role line's identity inside the set is the source's own row-local role-row id where it has one (LV officer `id`, EE `kirje_id`, per `baltics.md`; row-local and not code-derived, so it meets PS1), used only inside the diff, never in any output. Without one, the identity is the pair (role, start date). A `finora.role_ended` event fires only when a line identity disappears, never by comparing names or content, so a corrected name spelling or a changed role title on the same row id is not a role end. Test: `ingest/src/role-ended.test.ts` (a spelling fix on the same row id emits no `role_ended`; a removed row does).
- **No HMAC is computed in v1.** `PERSON_ROWS=names_no_id` is the v1 default (council 7029625427, legal 7029620896). The per-company pseudonym (an install-local HMAC, legal light Y on five conditions, `legal.md` "Per-company person pseudonym") is the later mode `PERSON_ROWS=pseudonym`, a **P13 LAWYER row, `LAW-PSEUDONYM`**, unbuilt in v1. A switch to `pseudonym` needs the lawyer's answer, the five conditions enforced (PS1 the input is a row-local key, never code-derived; PS3 the key is install-local, never exported, logged or backed up; plus PS2, PS4, PS5 below), and a new slice.
- **Latvian scope limit, LAWYER (`LAW-LV-OFFICERS`):** whether Latvian board and officer data stays public after the 9 Nov 2026 ruling. Interim: LV officer names are shown behind the purpose gate, as above. `LV_PERSON_ROWS=names_no_id` (interim) or `role_counts`, which falls back to role counts and start dates without names, with no code change. If the lawyer rules against names, the switch flips and council's branch 3 applies to LV: the LOCK variant with "Officer names: pending a legal review", check 3 runs on counts and dates, officer sanctions screening counts as not run ("Officers not screened: names not loaded"), and the promise reads "the full counterparty check, except who runs it".

Conditions that hold in v1, each with an enforcement point and a test:

| # | Condition | Enforcement | Test |
|---|---|---|---|
| PS2 | No cross-company join of person rows: no output, query, index or API | person rows are excluded from `entities_fts`, `links` and `judgements`; the store exposes them only through `readPurposeSection(companyEid, ...)`, which filters on that one company; no repository method takes a person eid as input | `store/src/person-scope.test.ts` (the same fixture human in two companies yields two unrelated rows, and no repository call returns both) |
| PS4 | Current roles only; nothing is kept when a role ends (P4, 0 days interim) | the role-set record is replaced whole; the removed line leaves only a `finora.role_ended` event with no name and no id | `ingest/src/history.test.ts` (after the role disappears, no row, event or log line carries the old name or id) |
| PS5 | No person id, internal hash or personal code in any API, MCP, export, log or agent output, and a fixture code never reaches the store | person DTOs carry a per-response index (`p1`, `p2`, ...) instead of the eid; the role-set row hash, the dispute content hash and the source's role-row id are internal only (legal 7029642009, 7029662017); the P3 canary scanner covers the eid pattern, these hashes and ids, and the code patterns | `apps/server/src/canary.contract.test.ts`, `apps/mcp/src/canary.test.ts`, `domain/src/export/canary.test.ts`, `agents/src/canary.test.ts` (scan every surface for the fixture eids and codes), `store/src/canary.test.ts` (the fixture codes are absent from every table) |
| PS6 | The source's own person code is read only to be dropped | the field map marks it `dropped: personal_code`; the role-set hash input excludes it | `sources/src/person-fields.test.ts` (each LV and EE person loader's hash input and stored fields contain no code-pattern field) |
| PS7 | LV names follow `LV_PERSON_ROWS` | `assembleReport` reads the switch; `role_counts` renders role counts and start dates only, and no LV name reaches the UI, API, MCP, export or agent tools | `domain/src/report/lv-people.test.ts` (both modes, all surfaces) |

### 3.4 Entity IDs

| Entity | `eid` | Fixture rule (qa #9) |
|---|---|---|
| LV company | `lv-<11-digit registration number>` | fixture variant of the check digit if data-baltics confirms one, else reserved prefix |
| EE company | `ee-<8-digit registry code>` | fixture variant of the official check digit (fails the real algorithm) |
| LT company | `lt-<9-digit company code>` | as LV |
| US SEC filer | `us-cik-<10-digit CIK>` | reserved range `99xxxxxxxx` |
| US state record | `us-<state>-<state id>` | prefix `FX` |
| LEI-only entity | `lei-<LEI>` | fixture variant of ISO 7064 mod 97 |
| Person in company context | `p-<record id>-<position>`, internal only, never output (§3.3; no HMAC in v1) | follows the company's fixture id |

The nightly `live` job asserts the reserved ranges stay unassigned in the real registers. `fixtures/ids.test.ts` checks every fixture id against its rule.

### 3.5 Storage classes

Every source's registry entry (§4.2) has exactly one storage class. The class decides where rows may exist; CI tests each class's guarantee.

| Class | Where | Used for | Guarantee and test |
|---|---|---|---|
| `store` | `finora.db` | open-licence registers, GLEIF, official sanctions lists, SEC | the default; licence invariants (§4.2) |
| `share-alike-store` | `finora-sa.db`, attached read-only at query time | EE tax board (S07.EE.01, S08.EE.01), switchable | P1: the main store never holds a share-alike row **or anything derived from one** (history events included). Its tables mirror the main ones but key every row on the entity's public `eid` (text), never on `finora.db` integer ids, so a rebuild of either file cannot break the join (A6). Export, bulk API and bulk MCP exclude it; single-company responses carry its attribution and licence link. Tests: `ingest/src/share-alike.test.ts` (no main-store row or event references a share-alike sync, in both modes), `store/src/share-alike-rebuild.test.ts` (rebuild `finora.db`; the share-alike rows still attach), `domain/src/export/export.test.ts` |
| `live-no-store` | memory only | the share-alike sources when `SHARE_ALIKE_MODE=live-no-store`; small daily lists | the file is read into memory at refresh and never written: no store row, no cache row, no file, no log line containing its values. Test: `ingest/src/live-no-store.test.ts` with sentinel values and a spied filesystem and logger (legal condition 1). Large files in this mode (EE taxes paid) show `not_checked{reason: "later"}` with "Not checked: licence question pending" |
| `live-cached` | `finora.db`, rows with a cache marker | US state registries (NY, CO, CT, PA) | written only for an entity the user opens; re-fetched on view when older than `LIVE_CACHE_REFETCH_HOURS` (24); purged when not viewed for `PERSON_DATA_TTL_DAYS` (30); a withdrawn or corrected upstream record is removed at the next fetch (CT terms). Tests: `ingest/src/live-cache.test.ts` (fake clock: day 29 survives, day 30 deleted; 24 h re-fetch; CT withdrawal) |
| `agent-only` | investigation `documents` only | courts, WHOIS-free web checks, live national sanctions lists, UN list, news | fetched by agents at query time, cited, kept only as investigation documents under the R11 TTL |
| `connector-cache` | `connector-cache.db` | licensed market series (user keys) | never exported, never served to another user (R17) |

`SHARE_ALIKE_MODE` (`store` default, or `live-no-store`) switches the EE share-alike sources with no code change (legal's condition for clearing the share-alike store). CI runs the EE loader tests in both modes.

### 3.6 Items: the one list behind load rule 2

`scripts/gen-items.mjs` parses the Part G table in `docs/plan/council/01-data.md` into `packages/domain/src/items/items.generated.ts`:

```ts
type Item = {
  id: ItemId;                       // "S08.EE.01a"
  section: SectionId;               // "S08"
  country: "lt" | "lv" | "ee" | "us" | "all" | "x";
  call: "show" | "caveat" | "later" | "hide";
  caveatKey: string | null;         // i18n key for the caveat line
  emptyState: EmptyStateKey;        // NP | CN | NC | PAID | LOCK | KEY | MANUAL | AGENT | none
  personal: boolean;                // natural-person data: purpose gate, disclaimer, TTL
  accessTier: "open" | "purpose";
};
```

A test fails when the generated file is stale against `01-data.md`. Items marked `personal` and the restricted-section rules (country, legal form, section, legal basis key) live next to it in `packages/domain/src/items/policy.ts`, hand-written, reviewed by legal. Consumers:
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
| `judgements` | resolution decisions (same / different / unsure), by rule, agent or human; never overridden by a reload |
| `live_cache_views` | last view time per `live-cached` entity (P5) |
| `disputes`, `suppressions` | R10, L5: applied at read time on every surface |
| `purpose_log` | P2: append-only, one row per company whose person data is opened, with the purpose in force; never updated |
| `investigations`, `agent_runs`, `run_events`, `questions`, `findings`, `citations`, `documents`, `cost_ledger` | agent runtime (§7) |
| `jobs`, `settings` | background work; local settings (fund tickers, P12) |

Pragmas: WAL, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000`. Migrations are forward-only and numbered, each in a transaction, tracked with `PRAGMA user_version`. Secondary indexes on `statements`, `facts` and the FTS tables are built after the first load of a source, not row by row.

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
  purgeScope: "full" | "window" | "none"; // full: a complete file defines the source; window: a full-history pull purges only inside its date window; none: incremental sources never purge (data-markets)
  deepLink: string | null;          // URL pattern with {recordKey}
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
  fetch(ctx: FetchContext): Promise<FetchResult>;              // raw artifacts into the raw cache, or { unchanged: true }
  parse(raw: RawArtifact[], ctx: ParseContext): AsyncIterable<ParsedRecord>;
}

type ParsedRecord = {
  recordKey: string;                // stable key per loader spec: the row's key, or the report / company-period key for long-format sources
  hashInput: string[];              // the normalised fields the field map read, in a fixed order; for a grouped record, every line of the group in a fixed order
  entity?: EntityInput;             // eid, schema, country, legal form, natural_person, status, caption
  statements: StatementInput[];     // { prop, value, lang?, itemId }
  reports: FactReportInput[];       // { kind, period, currency, unitScale, facts: { concept, value }[] }
  events: EventInput[];             // { type, date, data?, itemId }
  parties: PartyRef[];              // members, debtors, insolvency subjects, sanctions links: go through the party gate
  dropped: DropReason[];            // fields dropped by rule: 'hide_item' | 'later_item' | 'personal_code' | ...
};
```

`parse` is pure given the artifacts, so `sources/src/<cc>/<id>/<id>.test.ts` runs it on committed synthetic fixtures with no network.

### 4.4 The pipeline (`packages/ingest`)

For one source, one sync:

1. **Fetch.** Through the polite fetcher: `officialHosts` allowlist, private-address refusal after DNS, per-source rate limit (SEC ≤ 10 requests/s with `SEC_USER_AGENT`), retries with backoff, size caps. The artifact's sha256 and the loader's `parserVersion` are compared with the last content sync; **unchanged means both are equal** (HTTP validators are only a hint: LV's ETag changes on every regeneration). Unchanged → write one `syncs` row of kind `unchanged`, touch nothing else, stop. Same artifact but a new `parserVersion` (a release changed the parser, the field map or an item's call, for example a new HIDE) → re-parse from the raw cache as a content sync, so the change reaches every install without waiting for the upstream file to change (A1). The raw cache keeps only each source's latest artifact, gzip-compressed (EE zips kept as downloaded; the GLEIF full file is dropped after the first load, deltas suffice), within the raw-cache budget in §4.5. If the raw cache is missing or disabled, a new `parserVersion` re-downloads instead (LV takes about 6 min): slower, never wrong.
2. **As-of check.** Apply the `meta.asOf` strategies in order. A date older than the last content sync's → `stale_skipped`, stop. No strategy yields a date → `failed` with `as_of_missing`.
3. **Parse and gate**, streaming, per record:
   - **Field-map gate:** every value targets a `show`/`caveat` item or a resolution key (load rule 2); everything else was never read.
   - **Personal-code gate (P3):** person properties are scanned against the country patterns (`domain/policy/personal-codes.ts`); a match is dropped and counted. Organisation `registrationNumber` is never scanned (qa #20).
   - **Proven-company gate (council, final round):** every party row (members, debtor-list rows, social-insurance debts, insolvency rows, sanctions links) goes through `ingest/src/party-gate.ts`. A party is loaded only if it is proven to be a company: the register's own type field says so (LV `LEGAL_ENTITY`, `FOREIGN_ENTITY`; EE `J`), or its code resolves to a register entity with a non-natural-person legal form. Everything else (LV `JOINT_OWNERS`, bare personal names, the ~298 EE debtor codes not in the register) is not loaded and is counted by reason. Court-party masking (P8) calls the same function.
   - **Natural-person rules (rule 5, Part H 6-9):** a sole trader's address is reduced to the country; its tax and arrears lines are dropped; natural-person insolvency is dropped.
   - Zod validation of every record; an invalid record is a counted `skip`, never silent.
4. **Stage.** `(recordKey, rowHash)` pairs go into a temp table.
5. **Write**, one writer, batches of 5,000 records per transaction:
   - new or changed `rowHash` → upsert the record (`last_changed_sync_id` = this sync), replace its statements, reports and events, and emit the history events of §3.7 by comparing old and new company attributes;
   - unchanged `rowHash` → nothing.
6. **Purge** (per `meta.purgeScope`; `none` skips this step, `window` limits it to the pulled date range), only if the sync completed (`content`, never `partial` or an interrupted run): records whose key is absent from the temp table are deleted with their rows. **Purge guard (A2):** `maxPurgeShare = max(2%, 5 x the source's measured removal share per refresh period)` (cto, measured: about 2% for the registers, whose daily removals are 0.04-0.1%; about 22% for the LT tax-arrears change feed, which removes 4.3% a day; a flat 5% would block it on a normal day). If a sync would delete more than that share of the source's records (an empty, header-only or cut-off file, an upstream export bug), nothing is deleted and the sync ends `partial` with reason `purge_guard`, shown on Settings; only `finora-cli data sync <source> --allow-mass-purge` overrides it. **Change feeds** (a source whose sync is a list of explicit inserts and deletes, such as the LT tax-arrears API) apply the same guard to the deletes of one feed sync: a page that would delete more than `maxPurgeShare` of the source's records applies nothing and ends `purge_guard` (qa). If the record held an entity's identity and the source's spec says "tombstone" (EE), the entity keeps its identity statements and gets `tombstone_since`; person rows are deleted with a `finora.role_ended` event (P4).
7. **Derive.** Rebuild `entities` rows and FTS for touched entities; run official-ID linking (§6) for them; recompute derived values (shared-address counts, registered offices only, never addresses shared with a natural person: Part H 3).
8. **Report.** Close the `syncs` row with counts by outcome and drop reason, duration and upstream as-of. `finora-cli data status` and the Sources page show it.

Tests (S04/S05 acceptance; names from the early review): `ingest/src/purge.test.ts` (1,000 records, 1 changed, 1 removed → 999 live, 1 updated, 1 deleted, 998 untouched), `ingest/src/unchanged.test.ts` (content sync then unchanged sync: everything live, nothing purged, as-of kept), `ingest/src/partial.test.ts` (interrupted sync purges nothing), `ingest/src/stale.test.ts` (an older as-of is skipped), `ingest/src/parser-version.test.ts` (unchanged artifact plus a field map that newly drops an item: re-parsed, the item is gone), `ingest/src/purge-guard.test.ts` (an empty file and a half-size file delete nothing and report `purge_guard`; a removal share just under `maxPurgeShare` purges, just over it does not; a change-feed page that deletes 50% of records is refused), `ingest/src/class-change.test.ts` (A7), `ingest/src/party-gate.test.ts` (one case per type value; a fixture sole trader at a company address creates no S17 link), `ingest/src/history.test.ts` (rename event; role ended without a name), `store/src/retention.test.ts` (a source unchanged for 40 days keeps its current officers).

### 4.5 Scheduling and budgets

- **Cadence** per source from cto's table (`01-data-cto.md` §2): daily registers, officers, debtor lists, sanctions and GLEIF deltas; weekly LV financial statements and VID files, EE general data; monthly EE annual reports, LT statements, EE taxes paid; on view for SEC and the live US states. Each job runs after the source's `publishedAtUtc`.
- **First load:** countries parse in parallel (worker threads), one writer. Each country's register file loads first, and the country is searchable as soon as it lands; financials and the rest follow in the background.
- **Budgets (P10, loader acceptance criteria)**, measured on the named machine profile in `docs/plan/benchmarks.md` with cto's probes (`research/probes/cto/`). Each loader slice also reports records per source and bytes per record:

| Budget | Value |
|---|---|
| Disk, per country | LV ≤ 2.5 GB · EE ≤ 3 GB (+ ≤ 0.25 GB share-alike) · LT ≤ 2 GB · cross-border ≤ 1 GB · whole store ≤ 10 GB |
| First core load | ≤ 30 min end to end; LV and LT searchable in ≈ 2 min, EE in ≈ 6 min |
| Daily refresh | ≤ 5 min, in the background, never blocking reads |
| Unchanged reload | one `syncs` row, 0 statement writes |
| Raw cache | ≤ 1.5 GB (latest artifact per source, gzip) |
| Whole data dir | ≤ 12 GB (store + share-alike store + raw cache + connector cache) |

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

### 5.1 apps/server: the API

One web-standard handler: `handle(request: Request): Promise<Response>`, plus `boot()` for background work.

- **Routes** live at `apps/server/src/routes/<path>/route.ts` with Next's handler signature (`export async function GET(request, { params })`, `params` is a `Promise`). `src/route-table.ts` is generated by `pnpm --filter @finora/server routes`; a test fails while it disagrees with the tree. Nothing in `apps/server` imports `next`.
- **Every handler, in this order:** validate path params → validate body or query with a schema from `api-contract` → call a service → shape the response. A route stays under one screen; logic beyond that moves into a package.
- **Errors are machine codes** (`snake_case`, listed once in `packages/domain/src/config/errors.ts`), never sentences: `{ "error": { "code": "entity_not_found", "detail"?: "..." } }`. The UI maps codes to localised text.
- **Services return tagged results** (`{ ok: true, value } | { ok: false, code, status }`); routes map them to HTTP.
- **Versioned:** `/api/v1/...`. A breaking change adds `/api/v2` routes.

Endpoints (v1):

| Method and path | Purpose |
|---|---|
| `GET /api/v1/health` | Liveness, store version, source freshness summary |
| `GET /api/v1/search?q=&country=&limit=` | Company search (FTS + trigram, ranked; §6.3) |
| `GET /api/v1/companies/:id` | The company report: sections S01-S18 assembled from statements and facts, each value with its sources |
| `GET /api/v1/companies/:id/sections/:section?purpose=` | One section, paginated where long (officers, filings, network). Sections holding `purpose`-tier data (S03, S04, S17) need `purpose` from the fixed list in `domain/config/purposes.ts`, else `428 purpose_required` (R2) |
| `POST /api/v1/disputes` | Report a problem with a statement or section: correction or objection (R10) |
| `GET /api/v1/companies/:id/export?format=json\|ftm` | Export of redistributable, non-personal statements only (R4) |
| `GET /api/v1/sources` | Source registry: licence, attribution, freshness, last sync report |
| `POST /api/v1/investigations/estimate` | Cost estimate (low, typical, high) before starting (§7.6) |
| `POST /api/v1/investigations` | Start an investigation (subject: a company ID or free text; stated purpose; locale; cost cap) |
| `GET /api/v1/investigations` | Library: list with verdicts |
| `GET /api/v1/investigations/:id` | Snapshot: agents, findings, questions, verdict, spend |
| `GET /api/v1/investigations/:id/events` | SSE event stream (§7.5), resumable with `Last-Event-ID` |
| `POST /api/v1/investigations/:id/questions/:qid/answer` | Answer an agent's question |
| `POST /api/v1/investigations/:id/stop` | Stop; keeps partial results |
| `POST /api/v1/investigations/:id/follow-ups` | Ask a follow-up question answered from the evidence |
| `GET /api/v1/markets/crash` | Crash monitor tiles M01-M09 |
| `GET /api/v1/settings/status` | Which keys are configured (names and presence only, never values) |

There is deliberately **no person endpoint** (§10). Officers and owners appear only inside a company's sections.

OpenAPI 3.1 is generated from the Zod schemas (`z.toJSONSchema`) by `pnpm --filter @finora/api-contract openapi` into `docs/api/openapi.json`; a test fails when it is stale.

### 5.2 apps/mcp: the MCP server

Built on the official MCP TypeScript SDK. Read-only tools, generated from `packages/agent-tools` (the same definitions the agents use):

| Tool | Returns |
|---|---|
| `search_companies` | Ranked candidates with ID, name, country, status, registry code |
| `get_company` | Sections S01-S02 with sources |
| `get_company_section` | Any one section S03-S18 for a company; S03, S04 and S17 require a `purpose` input, logged (R2) |
| `get_financials` | Facts by concept and year |
| `screen_sanctions` | Matches against the official lists, with match scores and list entries |
| `list_sources` | Source registry with licences |

Transports: **stdio** (`finora mcp`, for desktop MCP clients on the same machine) and **Streamable HTTP** mounted by the server at `/mcp` (same host and origin guards as the API; hosted mode adds auth, §11). Agent-only tools (`ask_human`, `record_finding`, web tools) are not exposed over MCP. Every tool result carries `sources[]` with licence and attribution, so a client agent can cite.

### 5.3 apps/web: the UI

**Routing.** Locale-prefixed App Router; each product tool is a route group with a manifest:

```
app/
  [locale]/
    layout.tsx                         html lang, providers, top navigation built from tool manifests
    page.tsx                           home = the explorer search
    (tools)/
      explorer/
        page.tsx                       search results
        [country]/[code]/page.tsx      company report (server component)
        investigations/page.tsx        library
        investigations/[id]/page.tsx   live investigation and its report
      crash/page.tsx                   Crash monitor
    sources/page.tsx                   sources, licences, attribution, freshness
    settings/page.tsx                  keys status, cost cap default, data status
    design/page.tsx                    design-system kitchen sink (dev and visual tests only)
  api/[...path]/route.ts               mounts apps/server handle()
  mcp/route.ts                         mounts the MCP HTTP handler
src/tools/<tool-id>/manifest.ts        { id, navKey, href, icon, enabled }
```

Adding a tool means: a manifest, a route group, its API routes and contract schemas, and its i18n keys. Nothing central is edited except the manifest list.

**Server components vs API routes.**

| Use | When |
|---|---|
| Server component reading through the render seam (`@finora/server/render`) | Read-only, first paint, SEO-irrelevant or cacheable pages: the company report, sources page, library list. No HTTP hop, streamed with `Suspense` per section |
| Client component calling `/api/v1` | Anything interactive or live: search-as-you-type, starting and watching an investigation (SSE), answering questions, Crash monitor refresh, follow-ups |
| Server actions | Not used. Every mutation goes through the API, so the MCP server, the CLI and other clients share one contract and one CSRF rule |

The render seam is a small module in `apps/server` exporting read functions that return the same DTOs as the API. Seam files in `apps/web` (lint-enforced): `app/api/[...path]/route.ts`, `app/mcp/route.ts`, `instrumentation.ts`, and the `lib/server-data.ts` wrapper that page components call.

**State and fetching.** TanStack Query for client data; one `EventSource` per open investigation. No global client store.

**Design system integration.** `DESIGN.md` (designer) is the source. Tokens live in `packages/ui/src/tokens.css` as CSS variables (colour, type scale, spacing, radius, motion; dark theme first, light theme as a variant) and are exposed to Tailwind v4 through `@theme`. Primitives (Button, Input, Card, Badge, Tabs, Dialog, Tooltip, Table, Skeleton, Toast, StatusPill, SourceChip, Citation) live in `packages/ui`; product composites (AgentCard, VerdictBanner, SectionCard, EvidenceList, TileGrid) live in `apps/web/src/components`. The `/design` page renders every primitive in every state and is the visual-test target. **[pending: token values and the component inventory from designer and frontend]**

---

## 6. Entity resolution

Most identity in this domain is official. Resolution goes in this order and stops at the first tier that decides:

1. **Same source, same key.** A registry row's code is its identity.
2. **Official cross-source IDs.** GLEIF records link an LEI to a national registry code (registration authority + entity ID) and give parent relationships; SEC filings carry CIK and sometimes LEI; Baltic VAT numbers embed or map to registry codes. These produce `links` rows (`kind: "same_as"`, the asserting source, confidence 1.0). An entity's report merges statements of all linked IDs.
3. **People inside one register.** A person is the same across companies of one register only on that register's own person key (for example a masked personal code plus name). Never across registers or countries by name alone.
4. **Candidates, not merges.** Free-text queries (an agent's "is this the same company?", a sanctions screen) go through candidate scoring: normalise the name (case, diacritics, legal-form tokens such as SIA / AS / UAB / OÜ / LLC / Inc, punctuation, transliteration), then score name similarity + country + address + dates + IDs. Scores are shown, never silently merged. An agent that cannot decide asks the human (§7.4); the answer is stored as a `judgements` row (`by: "human"`) and reused.

`judgements` keep the decision, who made it, and when; a later loader run never overrides a human judgement. Sanctions screening returns candidates with scores and the matched list entry; a "hit" in the report requires either an official-ID match or a human-confirmed judgement, and is otherwise shown as "possible match, unconfirmed".

---

## 7. Agent runtime

`docs/plan/agents.md` (data-osint) specifies the agents, their tools, prompts, the question rules and the cost model. This section fixes the seams the runtime is built on.

### 7.1 Model of an investigation

```
Investigation (subject, locale, cap, status)
  ├─ Plan (from the lead agent: which specialists, with what brief, which depend on which)
  ├─ AgentRun × N (specialist; status: queued | running | waiting | done | failed | stopped | budget_exceeded)
  │    ├─ RunEvent* (step, tool call, tool result summary, source read, progress)
  │    ├─ Question* (to the human; blocks this run and the runs that depend on it)
  │    └─ Finding* (claim, severity: clear | caution | risk, citations ≥ 1)
  ├─ Documents* (every fetched page or record an agent read, content-addressed, with URL and retrieval time)
  ├─ Citations* (finding → document + exact quoted span, or → statement IDs from the store)
  ├─ CostLedger* (every model call: model, tokens, cost, held/settled)
  └─ Verdict (from the synthesis step: overall rating, per-agent rating, key findings, advice; every sentence cites)
```

Everything above is a row in the store, written **before** it is broadcast. The UI and late subscribers rebuild state from the rows, so a browser refresh, a crash or a restart loses nothing; on boot, runs that were `running` in a dead process resume from their last persisted model turn.

### 7.2 Orchestration

- The **lead** step reads the subject (a resolved company or free text), resolves it through `search_companies` (asking the human when several match), and writes a plan: a list of specialist briefs with dependencies.
- **Specialists run in parallel** under a concurrency limit (`AGENT_CONCURRENCY`, default 6). A run whose dependency is waiting on a question waits too; independent runs keep going.
- Each specialist is a tool loop: call the model → run the requested tools (in parallel where the model asked for several) → append all results in one message → repeat until the model ends its turn, a limit is hit, or the run is stopped.
- The **synthesis** step reads the findings (not the transcripts) and produces the verdict in a structured output. It cannot add a claim that is not a finding.
- **Follow-ups** after the verdict are answered by a step that sees only the findings and their documents, and cites them.

### 7.3 LLM providers

```ts
interface LlmProvider {
  id: "anthropic" | "fake";
  call(req: ModelRequest, signal: AbortSignal): AsyncIterable<ModelEvent>; // streamed
  price(model: string): ModelPrice | null;                                 // null => unknown => refuse to start under a cap
}
```

- `anthropic`: the official TypeScript SDK on the Messages API, the user's own key (`ANTHROPIC_API_KEY`). Model per role is configuration (`AGENT_MODEL_LEAD`, `AGENT_MODEL_SPECIALIST`, `AGENT_MODEL_SYNTH`), with an effort level per role; defaults and measured costs come from `docs/plan/agents.md`. Prompt caching on the stable prefix (tool definitions + system prompt). Web search and web fetch, if `agents.md` chooses the provider's server tools, are declared per specialist with `max_uses` and domain allow or block lists.
- `fake`: replays scripted transcripts from `fixtures/agents/*.json`. Used by every test and by `FINORA_DEMO=1`, so the full flow, e2e tests and a demo run with **no key and no spend**.
- Paid LLM and search APIs are allowed with the user's own keys from a local `.env` (human decision H2). Without a key, the explorer works fully and the Investigate button explains what is needed.

### 7.4 Questions back to the human

`ask_human` is an agent tool with a structured input: question text, kind (`choose_one` with options | `confirm` | `free_text`), why it matters, and what the agent will do with each answer. Calling it:
1. writes a `questions` row and a `question` event;
2. sets the run to `waiting` (and its dependants stay `queued`);
3. ends the run's current turn without a tool result; the loop parks.

`POST .../answer` validates the answer against the kind, writes it, and requeues the run; the runner appends the answer as the pending tool result and continues. A question unanswered for `QUESTION_TIMEOUT` (default 30 minutes, configurable) resolves to the agent's stated default and is marked "answered by default" in the report.

### 7.5 Events (SSE)

`GET /api/v1/investigations/:id/events`. Each event has a monotonic `id` (the `run_events` row ID), so `Last-Event-ID` resumes exactly. Event types (fixed set in `domain/config/run-events.ts`):

`investigation.status` · `plan` · `run.status` · `run.step` · `run.source` (a document read: domain, title) · `finding` · `question` · `question.answered` · `cost` · `verdict` · `error` (machine code). Heartbeat comment every 20 s. Text deltas of the model are not streamed to the UI; steps are (the UI shows what an agent is doing, not its token stream).

### 7.6 Cost caps

- Every investigation has a cap in USD (`AGENT_COST_CAP_USD` default, overridable per investigation up to `AGENT_COST_CAP_MAX_USD`).
- **Estimate before start (human decision H2).** `POST /api/v1/investigations/estimate` returns `{ low, typical, high, basis }` in USD for the subject and the chosen specialists: per-role averages from this install's settled `cost_ledger` once it holds at least 10 finished investigations, else the per-role defaults in `docs/plan/agents.md` (`basis: "defaults"`). The UI shows it next to the cap before the user presses Start; the cap, not the estimate, is what the code enforces.
- Before each model call the runner **holds** the call's worst case (input tokens × input price + `max_tokens` × output price + the server-tool fees it may incur) in `cost_ledger`; after the call it **settles** the real cost from the usage block. A call that would push held + settled spend over the cap is not made. Holding the worst case is what stops parallel agents from all passing the check at once.
- An unknown price for a configured model refuses to start the investigation (`price_unknown`), never "free".
- On reaching the cap the investigation ends `budget_exceeded`; finished findings are kept and the synthesis step runs if its own held cost still fits (it has a reserved share of the cap, `SYNTH_RESERVE`, default 15%).
- Per-run limits on top: max model turns, max tool calls, wall-clock timeout.

### 7.6a Timeouts, retries and cancel

| Event | Rule | Test |
|---|---|---|
| A model call takes too long | per-call timeout `AGENT_CALL_TIMEOUT` (default 120 s, streaming keeps it alive while tokens arrive); counts as retryable | `packages/agents/src/runner.timeout.test.ts` |
| Retryable error (429, 5xx, overloaded, network, timeout) | up to 3 retries per call with exponential backoff and jitter, honouring `retry-after`. Each attempt settles on its own (its usage if the provider returned one, else its held worst case, since a call cut mid-stream may already be billed), and each retry takes a new hold (qa N2) | `packages/agents/src/runner.retry.test.ts` (a retry after a partial stream records both attempts; no attempt settles twice) |
| Non-retryable error (400, 401, 403, 404, refusal) | the run ends `failed` with a machine code (`model_bad_request`, `model_auth`, `model_refused`, ...); the hold is released; other runs continue | `packages/agents/src/runner.errors.test.ts` |
| A tool call fails | returned to the model as an error tool result (`is_error`), never dropped; three consecutive tool failures end the run `failed` | `packages/agents/src/tools.errors.test.ts` |
| A run exceeds its wall clock (`AGENT_RUN_TIMEOUT`, default 10 min) | the run ends `failed: run_timeout`; its findings so far are kept | `packages/agents/src/runner.timeout.test.ts` |
| The investigation exceeds `INVESTIGATION_TIMEOUT` (default 30 min, questions' waiting time excluded) | open runs stop, synthesis runs on what exists | `packages/agents/src/orchestrator.timeout.test.ts` |
| The user presses Stop | every in-flight request is aborted through its `AbortSignal` within 5 s; runs end `stopped`; in-flight calls settle at their held worst case; synthesis is offered, not automatic | `packages/agents/src/orchestrator.stop.test.ts` |

### 7.7 Citations are enforced

- A finding without at least one citation is rejected by `record_finding` (tool error back to the agent).
- A citation is either a set of store statement IDs, or a document ID plus a quoted span. The **verifier** checks that the quoted span occurs in the stored document text (whitespace- and case-normalised); a citation that fails is dropped, and a finding left with none is rejected.
- The verdict's structured output references finding IDs only. The UI renders every sentence with its citation chips; a sentence with none is not rendered (and a test asserts the renderer drops it).

### 7.8 Untrusted content

Web pages and documents are data, not instructions. Tool results wrap fetched text in a clearly delimited block, the system prompt says so, and the agents have **no tool with a side effect** outside Finora's own store (no email, no posting, no file system, no shell). Fetching is limited to `http(s)` on public addresses (private, loopback and link-local ranges are refused, after DNS resolution), with size and time caps.

---

## 8. Crash monitor

`packages/markets`:

```ts
interface MarketConnector {
  meta: SourceMeta;                 // licence; storage "store" for open data, "connector-cache" for licensed prices
  series(symbol: string, since: string): Promise<DailyClose[]>;
  quote(symbol: string): Promise<Quote>;
}
```

- Tiles M01-M09 are configuration (`packages/markets/src/tiles.ts`): symbol, connector, market-cap-per-point constant with its source note and date, currency, FX pair.
- Pure maths in `packages/markets/src/calc.ts`: peak (highest daily close since `CRASH_PEAK_SINCE`), drawdown %, value lost, carry-forward for a lagging index. Unit-tested with synthetic series.
- A job refreshes quotes every 60 s while a client is subscribed and daily closes once a day; results go to `connector-cache.db` for licensed series and the main store for open ones (US Treasury debt, open macro series).
- Price connectors use the user's own key and never ship data in the repo. **[pending: connectors and their terms from `docs/research/markets.md`; which tiles are possible without any key]**

---

## 9. Internationalisation

- Locales: `en` (default), `lt`, `lv`, `et`. URL prefix (`/en/...`), negotiated from `Accept-Language` on `/`, remembered in a cookie.
- `next-intl`. Catalogues in `packages/i18n/messages/<locale>.json`, namespaced per tool (`explorer.*`, `crash.*`, `common.*`, `errors.*`). ICU message format for plurals and gender.
- **Parity test:** every key exists in every locale with the same ICU arguments; no empty strings. CI fails otherwise.
- Numbers, currency, dates and relative times through `Intl` with the active locale; a company's money values keep their own currency.
- Data values carry their language (`Statement.lang`); where a source publishes official translations (activity code titles), the report shows the active locale's, else the original with its language marked.
- Error codes map to `errors.<code>` keys; the API never sends prose.
- Agents receive the investigation locale and write findings and the verdict in it; rating labels (Clear / Caution / Risk) are i18n keys, not model text.
- Lithuanian, Latvian and Estonian strings are drafted by the team and marked for native review in `packages/i18n/REVIEW.md`.

---

## 10. Legal product rules, enforced in code

`R1`-`R17` are the numbered product rules of `docs/research/legal.md` (same numbers). `L1`-`L6` are further rules from the desk research and the legal addendum that the council confirms or drops in session 1 **[pending: 01-data.md]**. Each rule has exactly one enforcement point and at least one named test. A rule that only lives in docs does not count.

| # | Rule (short) | Enforcement point | Test |
|---|---|---|---|
| R1 | Latvian shareholders who are natural persons are not shown; company-level facts only | `display-policy.ts`: LV member/shareholder properties of `Person` owners are `hide`, so the loader policy filter drops them before the store | `packages/sources/src/lv/policy.test.ts` (fixture with a person shareholder → not stored, counted as `policy_hide`) |
| R2 | Natural-person register data behind a stated purpose, logged per access, purpose shown | `purpose`-tier statements are returned only by `readPurposeSection(entityId, section, purpose, actor)` in `packages/store`, which writes `purpose_log` first; the API returns `428 purpose_required` without `?purpose=`; MCP tools for S03/S04 require a `purpose` input; an investigation's stated purpose is logged for its agents; the UI shows the chosen purpose on the section | `packages/store/src/purpose.test.ts`; `apps/server/src/routes/v1/companies/[id]/sections/[section]/route.contract.test.ts`; `apps/mcp/src/purpose.test.ts`; `apps/web/e2e/people-purpose.spec.ts` |
| R3 | Every record carries source name, licence, retrieval date and access tier | `SourcedValue` (§3.1) and its Zod schema with `sources.min(1)` | the hop tests in §3.1 |
| R4 | No bulk redistribution of natural-person data | export (`companies/:id/export`, any future bulk dump) filters `personal = true`; no list endpoint or MCP tool returns persons across companies; fixtures hold only made-up people | `packages/domain/src/export/export.test.ts`; MCP tool-list snapshot |
| R5 | Sole traders are natural persons; no credit, character or eligibility score for a natural person | `isNaturalPerson(entity)` in `packages/domain/src/policy/persons.ts` (sole-trader legal forms per country); report assembly omits S18 and the verdict for them; the orchestrator refuses a person or sole-trader subject with `subject_is_natural_person` and offers the facts-only report (legal addendum default: no verdict on any natural person) | `packages/domain/src/policy/persons.test.ts`; `packages/agents/src/orchestrator.subject.test.ts` |
| R6 | "Not a credit report. Not for credit, employment, tenancy or insurance decisions." on any page about a person | `PersonDisclaimer` in `packages/ui`, rendered by every layout whose DTO has `containsPersonalData: true` (the report, investigation and export views) | `apps/web/e2e/disclaimer.spec.ts` |
| R7 | Every verdict claim links to a primary source; unsourced claims are not rendered | `record_finding` rejects uncited findings; the citation verifier (§7.7); `VerdictText` renders only sentences with citations | `packages/agents/src/citations.test.ts`; `apps/web/src/components/verdict-text.test.tsx` |
| R8 | A sanctions match reads "possible match, needs review"; "sanctioned" only with a primary list entry | `screenSanctions` returns `status: "possible_match"` unless an official ID matches a primary list entry; the i18n key for `sanctioned` is only reachable from `status: "listed"` | `packages/resolve/src/sanctions.test.ts` |
| R9 | AI-written text labelled AI-generated on every surface | DTOs for findings, verdicts and follow-ups carry `generatedBy: "ai"`, required by schema; `AiLabel` renders from it; API, MCP and export include it | `packages/api-contract/src/investigations.test.ts`; `apps/web/e2e/ai-label.spec.ts` |
| R10 | A correction and objection channel on every entity page; disputed statements suppressed pending review | "Report a problem" on every report section → `POST /api/v1/disputes`; open disputes join `suppressions` at read time after `DISPUTE_SUPPRESS_AFTER` (default immediately; window **[pending: lawyer]**) | `packages/store/src/disputes.test.ts`; `apps/web/e2e/dispute.spec.ts` |
| R11 | The natural-person cache has a TTL | job `purge-personal` deletes `personal = true` statements whose `retrievedAt` is older than `PERSON_DATA_TTL_DAYS` (default 35 **[pending: lawyer]**), and documents of finished investigations after the same TTL | `packages/store/src/retention.test.ts` |
| R12 | Only official sanctions lists are bundled, with attribution; aggregated non-commercial datasets are connector-only | licence-registry invariants (§4.2): `nonCommercial` ⇒ not `storage: "store"` | `packages/sources/src/licences.test.ts` |
| R13 | CC BY-NC and ODbL data are never committed or published | same invariants; the guard blocks data files; fixtures are synthetic | `packages/sources/src/licences.test.ts`; `scripts/guard` tests |
| R14 | No scraping where terms forbid; official APIs within limits; EDGAR User-Agent from env, ≤ 10 requests/s | polite fetcher: per-source host allowlist and rate limit; boot refuses SEC sources without `SEC_USER_AGENT` | `packages/sources/src/fetcher.test.ts`; `apps/server/src/env.test.ts` |
| R15 | Map data: cache only lat/lng, at most 30 days | no maps in v1. If a map slice is added, its geocode cache stores lat/lng only with a 30-day TTL, tested like R11 | n/a in v1 (a test lands with any map slice) |
| R16 | Each source's licence and attribution shown in the UI | `SourceChip` and the Sources page render `licenceId`, `attribution` | `apps/web/e2e/report-sources.spec.ts`, `apps/web/e2e/sources-page.spec.ts` |
| R17 | Licensed market data only through user-supplied keys | `MarketConnector` with `redistribution = false` needs a key from env and writes only to `connector-cache.db` | `packages/markets/src/connectors.test.ts` |
| L1 | Hidden data is never stored (data minimisation) | loader policy filter (§4.1 step 3) | `packages/sources/src/pipeline.test.ts` |
| L2 | People appear only in a company's context: no person pages, person search, person endpoint or person MCP tool | no route, endpoint or tool exists; search indexes companies only | `apps/server/src/route-table.test.ts` (no person path); `apps/mcp/src/tools.contract.test.ts` (snapshot); `packages/store/src/search.test.ts` |
| L3 | No search-engine indexing of people | `X-Robots-Tag: noindex` and `robots` meta on report and investigation pages; person names never in `<title>`, URLs or metadata | `apps/web/e2e/seo-headers.spec.ts` |
| L4 | Personal codes are never stored unmasked | loaders mask or drop; the store rejects values matching a full personal-code pattern per country | `packages/store/src/personal-codes.test.ts` |
| L5 | Restriction requests honoured on every surface | `suppressions` applied in report assembly, search, export, MCP and agent tools; `finora suppress` CLI | `packages/store/src/suppressions.test.ts` + one assertion per surface test |
| L6 | Removed upstream means removed here | purge after each complete load (§4.1 step 6) | `packages/sources/src/pipeline.test.ts` |

`packages/domain/src/policy/display-policy.ts` is generated from the council's decision table (one row per source property: `show`, `caveat` + caveat key, `hide`, `later`, plus `accessTier` and `personal`), and `packages/sources/src/policy-coverage.test.ts` fails if any loader emits a property that has no policy row. That makes "the council decided X" executable.

---

## 11. Auth, hosting and deployment

**v1 is local and single-user.** The server binds `127.0.0.1` only. There are no accounts. Every service takes an `Actor` in its context (`{ kind: "local" }` today), so adding users later changes the edge, not the services.

Hosting needs the human's decision (publishing outside the repo). Options, recommendation first:

| Option | Fit | Notes |
|---|---|---|
| A. One small VM or container host with a persistent volume, running `pnpm server` + `next start` (or the combined process) | Best | Long-lived process for agents and SSE, SQLite on a volume, nightly loader jobs. Add auth (passkey or email link), per-user investigations, per-user BYOK keys encrypted at rest, rate limits |
| B. Public read-only explorer, agents only in local installs | Good first public step | No user keys held by us; the cheapest legal surface. Requires the person rules (R2, R6, L2, L3) and the correction channel (R10) |
| C. Serverless platform | Poor | Agent runs outlive request limits, SSE fights the platform, SQLite needs a network database |

The MCP HTTP endpoint and the API share the same auth in hosted mode (bearer tokens per user). Local stdio MCP needs no auth.

---

## 12. Security

| Threat | Control |
|---|---|
| A web page calling the local API (DNS rebinding, CSRF) to spend the user's key | Host allowlist (`localhost`, `127.0.0.1`, `[::1]`) on every request, pages and API; on unsafe methods an `Origin` that is present must match `Host`; bind `127.0.0.1` in every launch script |
| Prompt injection from fetched pages | §7.8: no side-effect tools, delimited untrusted content, citations verified against stored text, cost and turn caps |
| SSRF through agent fetches or loaders | Public-address check after DNS resolution; per-source host allowlists for loaders |
| Secrets leaking | Keys only from the environment (`.env.local`, gitignored; `.env.example` documents names); never logged, never returned (status endpoint reports presence only); the guard blocks committed secrets. **Bundle check:** CI builds with sentinel values (`ANTHROPIC_API_KEY=sentinel-key-do-not-ship`, the same for every key) and `scripts/check-bundle-secrets.mjs` fails if any sentinel appears under `.next/static` or in any client chunk; only `NEXT_PUBLIC_*` names on an allowlist may reach the client |
| XSS from data or model output | React escaping; model text rendered as Markdown with HTML disabled and a link allowlist (`http`, `https`); strict CSP (`default-src 'self'`, nonce-based scripts) and security headers, asserted by an e2e test |
| Oversized or malicious inputs | Zod on every boundary; body size caps; FTS query sanitising (no raw `MATCH` syntax from users) |
| Personal data in logs | Structured logger with a redaction list; logs carry entity IDs, not names |
| Supply chain | Lockfile, `pnpm install --frozen-lockfile` in CI, `minimumReleaseAge` in `pnpm-workspace.yaml`, explicit `allowBuilds`, `pnpm audit --audit-level high` in CI with a reviewed ignore list, Dependabot |
| Runaway spend | §7.6 caps, unknown price refuses, a global daily cap `AGENT_DAILY_CAP_USD` |

The `security-engineer` review runs on the slices that add the API, the agent runtime, the MCP server and any fetcher.

---

## 13. Testing

| Layer | Tool | What | Where |
|---|---|---|---|
| Unit | Vitest | Pure logic: normalisation, scoring, peak maths, policy, report assembly, budget ledger | next to the code, `*.test.ts` |
| Loader contract | Vitest | Each loader's `parse` on its synthetic fixture → snapshot of records and the sync report; schema validation; policy drops counted | `packages/sources/src/**/<id>.test.ts`, fixtures in `fixtures/sources/<id>/` |
| Live source check | Vitest, tagged `live` | Fetches a small real slice and checks the upstream format has not drifted (columns, types, encodings). Stores nothing, asserts shape only | nightly CI job; never on pull requests |
| Store | Vitest | Migrations from zero and from every previous version; FTS diacritics; purge; suppressions | `packages/store` |
| API contract | Vitest | Every route against the fixture store: response validates against its `api-contract` schema; error codes; OpenAPI is current | `apps/server` |
| MCP contract | Vitest + MCP SDK client over an in-memory transport | Tool list snapshot; each tool against fixtures; no person tool | `apps/mcp` |
| Agent runtime | Vitest + `fake` provider | Parallel runs, dependency waits, question park and resume, cost hold and cap, citation verifier, restart recovery, SSE resume | `packages/agents` |
| E2E | Playwright (Chromium) | Real app on the `fixtures` profile with `FINORA_DEMO=1`: search → report → investigate → answer a question → verdict with citations → library; Crash monitor with fixture series; locale switch; security headers; axe accessibility checks | `apps/web/e2e/` |
| Visual | Playwright `toHaveScreenshot` | `/design` and every screen state from DESIGN.md at 4 viewports (360, 768, 1280, 1920), dark and light | Linux CI only (fonts differ by OS); baselines updated with `pnpm e2e:visual --update` |
| Guard | node:test | Unchanged | `scripts/guard` |

Fixtures are synthetic: companies named "Example Company A", made-up codes in each country's format, and source files that mimic the real column layout. No downloaded data, no real entity, ever (publishing checklist §6).

**Making a fixture.** `fixtures/README.md` is the recipe; in short:
1. `pnpm fixtures:gen` (seeded, deterministic) writes the canonical synthetic world: about 2,000 companies across the four countries, people with made-up names from `fixtures/wordlists/` (never real names), relationships, facts, sanctions-list entries and edge cases (liquidated, tax debtor, sole trader, ambiguous names, diacritics).
2. Per-source raw fixtures in `fixtures/sources/<source-id>/` are **written by the generator in the source's real file layout** (same columns, encodings, quirks), never cut from a real download. A loader author adds a layout writer next to the loader's spec.
3. Agent transcripts in `fixtures/agents/<scenario>.json` are written by hand or recorded against fixtures only; a recording against real data stays in `research/.cache/`.
4. HTTP replays for `live`-style tests are never committed; the `live` checks hit the network and assert shapes only.
5. Screenshots in docs come from the fixtures profile only.

---

## 14. CI

The existing `guard.yml` stays as it is. A new `ci.yml` runs on every pull request and push to `main`:

1. `pnpm install --frozen-lockfile` (Node 24, pnpm via `packageManager`, store cached)
2. `pnpm lint` · `pnpm typecheck` · `node scripts/check-deps.mjs`
3. `pnpm test` (unit, loader contract, store, API and MCP contract, agent runtime)
4. `pnpm build` with sentinel key values, then `node scripts/check-bundle-secrets.mjs` (§12)
5. `pnpm e2e` (Playwright, fixtures profile, demo provider; traces uploaded on failure)
6. `pnpm e2e:visual` (in the official Playwright container image, pinned)
7. `pnpm audit --audit-level high`

`live-sources.yml` runs nightly and on demand: the `live` loader checks, with `SEC_USER_AGENT` from a repository secret. It opens an issue when a source's format changes; it never fails a pull request.

Concurrency: one run per branch, older runs cancelled. `ci` and `guard` are required checks for `main`.

---

## 15. Configuration

`.env.example` (committed, placeholders only) documents every variable; `apps/server/src/env.ts` validates them at boot.

| Variable | Default | Purpose |
|---|---|---|
| `FINORA_DATA_DIR` | `./.data` (gitignored) | SQLite files and the raw download cache |
| `FINORA_PORT` | `3000` | Port (bound to 127.0.0.1) |
| `FINORA_DEMO` | unset | `1` = fake agent provider and fixture market series |
| `SEC_USER_AGENT` | none | Required for SEC sources: "app name contact-email" per SEC policy |
| `ANTHROPIC_API_KEY` | none | The user's own key for agent investigations |
| `AGENT_MODEL_LEAD`, `AGENT_MODEL_SPECIALIST`, `AGENT_MODEL_SYNTH` | from `agents.md` | Model per role |
| `AGENT_CONCURRENCY` | `6` | Parallel specialists |
| `AGENT_COST_CAP_USD`, `AGENT_COST_CAP_MAX_USD`, `AGENT_DAILY_CAP_USD` | from `agents.md` | Spend limits |
| `QUESTION_TIMEOUT` | `30m` | Default-answer timeout |
| `CRASH_PEAK_SINCE` | `2025-01-01` | Start date for "peak" |
| `AGENT_CALL_TIMEOUT`, `AGENT_RUN_TIMEOUT`, `INVESTIGATION_TIMEOUT` | `120s`, `10m`, `30m` | §7.6a |
| `PERSON_DATA_TTL_DAYS` | `35` (lawyer to confirm) | R11 |
| `DISPUTE_SUPPRESS_AFTER` | `0` (immediately; lawyer to confirm) | R10 |
| market connector keys | none | **[pending: markets.md]** |

---

## 16. The one command

```bash
pnpm finora
```

runs `scripts/finora.mjs`, which: checks Node ≥ 24 and pnpm; installs if `node_modules` is missing; creates `.env.local` from `.env.example` on first run and says which keys are optional; runs migrations; runs `finora data sync --profile core` (incremental after the first run, progress per source, safe to interrupt and resume); builds once if needed; starts the app on `http://127.0.0.1:3000` and prints the URL. `pnpm finora --demo` uses the fixtures profile and the fake provider, starts in seconds and needs no network.

The CLI (`apps/cli`) runs as `pnpm finora-cli <command>`: `data sync [source|--profile p]`, `data status`, `search`, `show <id>`, `resolve`, `suppress`, `doctor`, `mcp` (the stdio MCP server, also published as the `finora` binary for MCP client configs).

---

## 17. Open items

| # | Item | Waits on |
|---|---|---|
| A1 | Final source list, licences, sizes and the `core` profile contents | phase-1 catalogs |
| A2 | Display policy table (`show` / `caveat` / `hide` / `later` per source property) | council session 1 |
| A3 | Legal rules renumbered to the memo | `docs/research/legal.md` |
| A4 | Models, effort per role, web tools, default caps | `docs/plan/agents.md`, human answer H2 |
| A5 | Market connectors and which tiles need a key | `docs/research/markets.md` |
| A6 | Tokens and component inventory | `DESIGN.md`, frontend plan |
| A7 | ~~Code licence~~ decided: AGPL-3.0 code, CC BY 4.0 docs (H1); S01 adds the `license` fields | done |
