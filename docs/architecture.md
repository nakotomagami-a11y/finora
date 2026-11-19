# Finora architecture

> **Status: draft (phase 3 input).** Written during phase 1 so the build never waits. Everything that depends on the data research (which sources, which fields, what is shown) is marked **[pending: ...]** and is filled from `docs/research/display-matrix.md`, `docs/research/legal.md` and `docs/plan/council/01-data.md` once they land. The slice plan is `docs/plan/slices.md`.

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
  sources/        Loaders (one module per source), licence registry, polite fetcher, raw-file cache
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
| `markets` | `domain` |
| `agent-tools` | `domain`, `store`, `resolve`, `markets` |
| `agents` | `domain`, `store`, `agent-tools` |
| `apps/server` | all packages except `ui` |
| `apps/mcp` | `domain`, `store`, `agent-tools`, `api-contract` |
| `apps/cli` | `domain`, `store`, `sources`, `resolve` |
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
| A loader | `packages/sources/src/<country>/<source-id>/` |
| An agent tool | `packages/agent-tools/src/<tool-name>.ts` |
| A product tool's pages | `apps/web/src/app/[locale]/(tools)/<tool-id>/` + `apps/web/src/tools/<tool-id>/manifest.ts` |

---

## 3. Data model

### 3.1 Entities and statements

Entities follow a subset of the FollowTheMoney (FtM) schema: the same schema names (`Company`, `Organization`, `LegalEntity`, `Person`, `Address`, `Directorship`, `Ownership`, `Membership`, `Sanction`, `Security`, `Identification`, `Representation`) and the same property names (`name`, `registrationNumber`, `leiCode`, `jurisdiction`, `incorporationDate`, `dissolutionDate`, `status`, `director`, `organization`, `owner`, `asset`, `percentage`, `startDate`, `endDate`, `role`, ...). That buys interoperability (FtM JSON export, existing tooling) without depending on any FtM runtime. The subset and our few extensions live in `packages/domain/src/schema/` as data, with a test that every property we use exists in the upstream FtM model or is listed as an extension.

**Every value is a statement.** We never store "the company's name"; we store "source X said, on date D, that entity E has `name` = V".

```ts
// packages/domain/src/types/statement.ts (shape, not final code)
type Statement = {
  id: string;              // hash(entityId, schema, prop, value, sourceId)
  entityId: string;        // see 3.3
  schema: SchemaName;      // FtM schema of the entity
  prop: PropName;          // FtM property
  value: string;           // normalised; dates ISO-8601, countries ISO-3166 alpha-2 lower
  lang: string | null;     // BCP 47 for text that has one (activity descriptions)
  sourceId: SourceId;      // registry entry in packages/sources, carries the licence
  sourceRecord: string;    // the row/record key inside the source, for "show me the original"
  sourceUrl: string | null;// deep link to the official page when one exists
  accessTier: AccessTier;  // "open" | "purpose" (natural-person data: shown only after a stated purpose, R2)
  personal: boolean;       // true when the value is about a natural person or a sole trader (R4, R5, R11)
  firstSeen: string;       // ISO timestamp the value first appeared in a load
  lastSeen: string;        // ISO timestamp of the latest load that still had it
  retrievedAt: string;     // when the raw file was downloaded
};
```

The licence is not copied onto each row: `sourceId` is a foreign key to the source registry, which carries the licence (§4.2). The store refuses a statement whose `sourceId` is unknown, so **no value can exist without a licence**.

**Provenance survives every hop (R3).** Each value leaves the store as a `SourcedValue`:

```ts
type SourceRef = { sourceId; sourceName; licenceId; licenceUrl; attribution; retrievedAt; sourceUrl; accessTier };
type SourcedValue<T> = { value: T; sources: SourceRef[] };   // sources.length >= 1, enforced by the Zod schema
```

| Hop | Where | Test |
|---|---|---|
| loader → store | `StatementInput` schema requires `sourceId`, `retrievedAt`; FK to `sources` | `packages/store/src/statements.test.ts` |
| store → report DTO | `assembleReport` builds `SourcedValue` for every field | `packages/domain/src/report/assemble.test.ts` |
| DTO → API / MCP | response schemas in `api-contract` require `sources.min(1)` | `apps/server/src/routes/**/route.contract.test.ts`, `apps/mcp/src/tools.contract.test.ts` |
| API → UI | `SourceChip` renders from `SourceRef`; a value without one is not rendered | `apps/web/e2e/report-sources.spec.ts` |

### 3.2 Facts (time series)

Financial statements, employee counts, taxes paid and debts are numbers by period, which FtM models poorly. They live in a `facts` table with the same provenance columns:

```ts
type Fact = {
  entityId: string;
  concept: ConceptId;       // our concept list: revenue, net_profit, total_assets, equity, employees, avg_salary, taxes_paid, tax_debt, ...
  periodStart: string | null;
  periodEnd: string;        // instant facts use periodEnd only
  value: number;
  unit: "EUR" | "USD" | "persons" | ...;
  sourceId: SourceId;
  sourceRecord: string;
  sourceConcept: string;    // the source's own field or XBRL tag, for audit
  retrievedAt: string;
};
```

`packages/domain/src/config/concepts.ts` maps each source's field (an LV statement line, an EE key figure, a US-GAAP XBRL tag) to a concept. **[pending: concept list from the display matrix rows S06, S07, S08]**

### 3.3 Entity IDs

Deterministic and readable, so a loader re-run produces the same IDs and URLs are stable:

| Entity | ID | Example (made up) |
|---|---|---|
| Company with a national registry code | `<cc>-<registry>-<code>` | `lv-ur-40000000000`, `ee-ar-10000000`, `lt-jar-100000000` |
| US SEC filer | `us-cik-<10-digit CIK>` | `us-cik-0000000001` |
| US state registry entity | `us-<state>-<registry id>` | `us-ny-0000000` |
| Entity known only by LEI | `lei-<LEI>` | `lei-00000000000000000000` |
| Person | `p-` + hash of (source, source person key) | `p-3f9c...` |
| Relationship (Directorship, Ownership) | `r-` + hash of its endpoints, role and source | |

Person IDs are opaque hashes on purpose: no name or personal code appears in a URL, a log line or an API path.

### 3.4 Tables (initial migration)

| Table | Purpose |
|---|---|
| `sources` | Mirror of the source registry: id, licence id, last sync, row counts, status. Upserted from code at boot |
| `statements` | §3.1. Indexes: `(entity_id)`, `(prop, value)` for ID lookups, `(source_id, last_seen)` for purges |
| `entities` | Materialised view per entity: id, schema, caption, country, status, `search_text`; rebuilt from statements per affected entity after each load |
| `entities_fts` | FTS5 over `entities.search_text`, `unicode61 remove_diacritics 2` (word search) |
| `entities_trigram` | FTS5 `trigram remove_diacritics 1` over names (substring and typo-tolerant search) |
| `facts` | §3.2 |
| `links` | Official-ID links between entities from different sources (§6) |
| `judgements` | Resolution decisions: same / different / unsure, by rule, agent or human |
| `suppressions` | Data-subject restrictions applied at read time (§10) |
| `disputes` | Corrections and objections from the entity page; open disputes suppress their statements (R10) |
| `purpose_log` | Every access to `purpose`-tier data: actor, entity, section, stated purpose, surface (UI, API, MCP, agent), time (R2) |
| `investigations`, `agent_runs`, `run_events`, `questions`, `findings`, `citations`, `documents`, `cost_ledger` | Agent runtime (§7) |
| `jobs` | Scheduled and queued background work |
| `settings` | Key-value app settings (no secrets in v1) |

Migrations are forward-only, numbered, each in a transaction, tracked with `PRAGMA user_version`. Pragmas: WAL, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000`. Loaders write in batches of 5,000 rows per transaction.

---

## 4. Data loaders

### 4.1 The loader contract

```ts
// packages/sources/src/types.ts (shape)
interface SourceLoader {
  meta: SourceMeta;                                   // 4.2
  fetch(ctx: FetchContext): Promise<RawArtifact[]>;   // download into the raw cache; conditional (ETag / Last-Modified / checksum)
  parse(raw: RawArtifact[], ctx: ParseContext): AsyncIterable<LoaderRecord>; // pure given the files
}
type LoaderRecord =
  | { kind: "statement"; statement: StatementInput }
  | { kind: "fact"; fact: FactInput }
  | { kind: "link"; link: LinkInput }                 // an official-ID equivalence the source asserts
  | { kind: "skip"; reason: SkipReason };             // counted, never silent
```

`fetch` and `parse` are separate so `parse` is tested on committed synthetic fixtures with no network, and so a re-parse after a code fix needs no download.

The pipeline that runs a loader (`finora data sync <source>`) is shared code, not per loader:

1. `fetch` through the polite fetcher: per-host rate limit from `meta.limits` (SEC: 10 requests/s, with `User-Agent` from the `SEC_USER_AGENT` environment variable, refused at boot if unset when an SEC source is enabled), retries with backoff, a host allowlist per source, size caps.
2. `parse` streams records.
3. **Policy filter** (§10): drops every statement whose `(sourceId, prop)` the display policy marks `hide`, and every person statement a legal rule excludes. Dropped values are counted per reason, never stored. Data minimisation happens here, before the store.
4. Validate each record against the schema subset (Zod); invalid records become `skip` with a reason.
5. Write in batches; set `last_seen` on every statement seen.
6. Purge: after a **complete** load, statements of this source with `last_seen` older than the load start are deleted (a value the registry removed disappears here too). A partial load (an incremental feed) never purges.
7. Rebuild `entities` rows and FTS for affected entities; run official-ID linking (§6) for them.
8. Record a sync report: rows read, written, skipped by reason, purged, duration, upstream date. `finora data status` and the Sources page show it.

### 4.2 Source metadata and licences

```ts
type SourceMeta = {
  id: SourceId;                 // "lv-ur-register", "ee-ar-open-data", "us-sec-submissions", ...
  country: "lt" | "lv" | "ee" | "us" | "intl";
  publisher: string;            // official body (registries may be named)
  homepage: string;
  licence: LicenceId;           // key into LICENCES
  attribution: string | null;   // exact wording the licence or publisher asks for
  cadence: "daily" | "weekly" | "monthly" | "quarterly" | "on-demand";
  storage: "store" | "connector-cache" | "agent-only";
  limits: { requestsPerSecond?: number; dailyRequests?: number };
  requires: EnvKey[];           // e.g. ["SEC_USER_AGENT"]
  sections: SectionId[];        // S01..S18 it fills
};
```

`packages/sources/src/licences.ts` lists every licence we accept, with flags:

```ts
type Licence = {
  id: LicenceId;                // "cc0-1.0", "cc-by-4.0", "us-public-domain", "sec-reuse", "eu-reuse-2011-833", ...
  url: string;
  attributionRequired: boolean;
  shareAlike: boolean;          // must be false for storage: "store"
  nonCommercial: boolean;       // must be false for storage: "store"
  redistribution: boolean;      // false => storage must be "connector-cache" or "agent-only"
  verifiedOn: string;           // date the official page was read, from docs/research
};
```

Enforced by a unit test over the registry, so a pull request that adds a share-alike or non-commercial source to the store fails CI:
- `storage: "store"` requires `shareAlike = false`, `nonCommercial = false`, `redistribution = true`.
- `redistribution = false` requires `storage: "connector-cache"` (user's key, user's machine) or `"agent-only"` (fetched live by an agent, cited, not persisted beyond the investigation's `documents`).
- Every `meta.licence` exists in `LICENCES`, and every licence has a `verifiedOn` date.

**[pending: the source list and each licence from the phase-1 catalogs.]** Expected candidates from desk research: LV Enterprise Register files, LV annual-report financial data, LV tax authority data; EE e-Business Register open data, EE tax authority data; LT JAR, LT tax authority datasets, LT social-insurance files; US SEC submissions, company facts (XBRL), insider and Form D data sets, selected state registries, federal court data; GLEIF; the official EU, UN, OFAC and UK sanctions lists.

### 4.3 Load profiles

A full US load (all EDGAR filers, all XBRL facts) is large; Baltic registers are small. `finora data sync --profile <name>`:

| Profile | What | Used by |
|---|---|---|
| `fixtures` | The synthetic datasets in `fixtures/` | tests, CI, e2e, offline demo |
| `core` | Every Baltic register source in full; GLEIF for LT/LV/EE/US; sanctions lists; US SEC submissions (all filers' identities) + company facts and insider data for the most recent N years **[pending: N from data-us sizing]** | the default `pnpm finora` |
| `full` | Everything every enabled loader offers | a long first run, then incremental |

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
| `POST /api/v1/investigations` | Start an investigation (subject: a company ID or free text; locale; cost cap) |
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
- **[pending: H2, the human's answer on paid LLM and search APIs.]** Without a key, the explorer works fully and the Investigate button explains what is needed.

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
- Before each model call the runner **holds** the call's worst case (input tokens × input price + `max_tokens` × output price + the server-tool fees it may incur) in `cost_ledger`; after the call it **settles** the real cost from the usage block. A call that would push held + settled spend over the cap is not made. Holding the worst case is what stops parallel agents from all passing the check at once.
- An unknown price for a configured model refuses to start the investigation (`price_unknown`), never "free".
- On reaching the cap the investigation ends `budget_exceeded`; finished findings are kept and the synthesis step runs if its own held cost still fits (it has a reserved share of the cap, `SYNTH_RESERVE`, default 15%).
- Per-run limits on top: max model turns, max tool calls, wall-clock timeout.

### 7.6a Timeouts, retries and cancel

| Event | Rule | Test |
|---|---|---|
| A model call takes too long | per-call timeout `AGENT_CALL_TIMEOUT` (default 120 s, streaming keeps it alive while tokens arrive); counts as retryable | `packages/agents/src/runner.timeout.test.ts` |
| Retryable error (429, 5xx, overloaded, network, timeout) | up to 3 retries per call with exponential backoff and jitter, honouring `retry-after`; the hold is kept across retries and settled once | `packages/agents/src/runner.retry.test.ts` |
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
| A7 | Code licence header and `license` fields | human answer H1 |
