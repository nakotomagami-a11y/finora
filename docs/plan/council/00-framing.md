# Council session 0: framing (2026-11-19)

Posted by the `council` seat on the hub; committed by the coordinator. The panel (CEO, CFO, CPO, CMO, COO, then critic and synthesis) met in isolation; all five returned. `cto` is a peer seat and was not convened; it owns the feasibility and cost columns. These decisions set the rubric and intake format for session 1 and the lens for v1. The human can override any line.

## Decision 1: the session 1 gates

Applied in order. The first gate an item fails decides it.

| # | Gate | Outcome |
|---|---|---|
| 1 | Legal (`docs/research/legal.md`) | Red → HIDE. Yellow → at most SHOW WITH CAVEAT, and only if the safeguard is enforced in code |
| 2 | Licence | Share-alike or non-commercial → HIDE from our store. Not verified on the official page → LATER until verified |
| 3 | Use | Doesn't change the go/no-go call for a primary job → LATER |
| 4 | Quality (reality-check fill rate, per country) | ≥70% and current for its cycle → SHOW. 30-69%, stale or self-reported → SHOW WITH CAVEAT. Under 30% → LATER |
| 5 | Cost and effort | Paid-only → LATER, shown as a labelled gap. Free per-query API: ≥100 calls/day → SHOW on demand, cached; 10-99 → CAVEAT, behind a button; under 10 → LATER. Effort can only move an item down, never up |

- **Exception:** risk signals ship at any fill rate, with coverage text: tax arrears, insolvency, pledges and securing measures, court rulings, sanctions, struck off. Saying what was checked is the product.
- **Tie-break:** an item that feeds the verdict beats a nice-to-know item.
- **Calls:**
  - SHOW: built in v1, always with source and as-of date.
  - CAVEAT: as SHOW, plus one line with source, as-of date, coverage and "missing does not mean clean".
  - HIDE: never appears in UI, API, MCP or export. Gets a negative test.
  - LATER: not built in v1. Backlog with a named trigger. If a primary job needs it, the UI shows a labelled gap.
- **Never a blank section.** Three distinct states: "Not published in [country]"; "Checked [source] as of [date]: none found"; "Not checked".

**Reasons:** without gates, session 1 becomes hundreds of separate debates (CEO, COO). Usefulness never buys back legal risk (CEO). A confident "clean" that really meant "no data" is the failure that ends trust (CEO, CPO, CMO).

**Dissent:** CEO wanted SHOW at ≥80%; the council took CPO's 70%, because CPO owns usefulness. CPO wanted under-30% items hidden; kept as LATER so HIDE keeps one meaning. CFO wanted paid-only items as HIDE with a gap label; recorded as LATER so it carries a trigger.

**What would change it:** the real fill-rate distribution. If most primary-job items land at 60-80%, session 1 revisits the 70% line.

## Decision 2: the display-matrix intake format (withdrawn, see amendment 1)

One row per item × country × source. Any row with an empty cell is decided LATER in session.

| Column | Owner |
|---|---|
| item_id, report section, country | coordinator |
| source; access (bulk / API / per-query / paid / user key); refresh cadence and lag | data seat |
| licence as stated, attribution text, verified Y/N + official URL | data seat |
| legal light G/Y/R + memo rule number; personal-data class (none / person in company context / restricted) | legal |
| fill rate n/N, sample date | data seat |
| feeds verdict Y/N | data seat proposes, council confirms |
| effort S/M/L in slices; load size and refresh time; blocking dependency (key, contract, human-task) | data seat; cto confirms |
| empty-state text; proposed call; draft caveat (one line) | data seat |
| final call | council |

**Dissent:** none. **What would change it:** a column that can't be measured for real becomes "estimated" and is marked as such.

## Decision 3: the v1 product frame

- **Primary job:** "Before I pay or sign with a company I don't know: will it still exist and deliver?" Secondary: "An unknown company sent an offer or invoice: is it real?" Employer checks reuse the same data. US filings and Crash monitor cover public-company curiosity.
- **Two speeds:**
  - Instant official profile: $0, no LLM key, runs on locally loaded data.
  - Agentic deep dive: the user's own keys, under hard caps (defaults $1.50 per investigation, $0.25 per follow-up, $10 per day). Each agent card shows its cost live.
- **The verdict:** deterministic rules on hard flags set its level; the LLM writes the explanation and cannot change the level. Same inputs, same verdict. It shows coverage ("8 of 11 checks ran"), and every claim cites a source and a date. "Not enough data" is a valid outcome. Banned wording: "Clear", "Safe", "Avoid", "Scam", "Fraud", letter grades, anything that reads like a credit score. The designer owns final wording inside this list.
- **The worst failure is the wrong company:** every finding is pinned to a registry ID. An uncertain match makes the agent ask the human; that is the showcase question back.
- **Agents in v1:** registry and people (company context only); money and tax; legal, insolvency and sanctions; web, domain and news; a verdict step.
- **Social-media and reviews agents: LATER** (platform terms, cost, highest wrong-company risk). Any agent can return if sample runs show at least one cited finding per run on average, at $0.30 or less per run.
- **Open-web person dossiers: HIDE**, pending the legal memo. Officers are checked against sanctions lists and news only in the company's context.
- **Network:** one hop, from registry links (shared officers, owners, addresses). Browsing it never starts agent runs. Multi-hop is LATER.
- **Profile templates:** one in v1 (counterparty).
- **Crash monitor:** one screen, no alerts. Works with zero keys on official series. Price tiles use the user's own key, with an explicit "add your key" state.

**Dissent:** CPO: daily use will be Crash monitor, not investigations; answered by the two speeds. CEO: cut open-web digging on key people entirely; partly adopted. CPO: linked entities as a list, no network view; overruled for v1. **Suspicious unanimity:** all five cut the social and reviews agents; designer and data-osint may challenge this with sample-run evidence.

**What would change it:** the legal memo's people rules per country; data-osint's measured cost per investigation; a reality check showing the instant profile is thin for a country.

## Kill criteria: reverse within 90 days if

- A primary-job section fills under 50% for a country: re-scope that country's v1 promise.
- Measured cost on the expected case exceeds the cap: cut agents before raising the cap.
- Any wrong-company finding in the regression set at a milestone: stop feature work and fix matching first.
- Legal rates people-in-company-context red for a country: hide people for that country.

## Gates session 2 will check in the plan

- `01-data.md` ends in a machine-readable table: item_id, call, caveat text, empty-state text.
- The architect maps every SHOW and CAVEAT id to a slice with an acceptance test, and every HIDE id to a negative test across UI, API, MCP and export. A plan with an unmapped id is not approved.
- CI compares the rendered-field registry with that table. For qa, an untagged field or a leaking HIDE item is a MUST-FIX.
- **Walking skeleton first:** one country end to end (search → official profile → agents → sourced verdict) from one command, before a second country starts.
- **Milestone gate:** on the regression set (the reality-check entities, kept in `research/.cache/`), zero wrong-company findings and 100% cited verdict claims; on a fresh random sample of 10 companies per country, fill rate within 10 points of the reality check.

## Human-only items (advice to the coordinator)

Each with the council's default; the mission runs on the default until the human answers. The licence is the only hard stop, before the first code commit.

1. Code licence: AGPL-3.0.
2. LLM API: the user's own key, never shared or hosted. Estimated cost per investigation (CFO, low confidence): about $0.40-1.00 with a cheap model for agents and a mid-tier model for the verdict; about $2.40-8.20 with a mid-tier model throughout. Live demo runs during the build: roughly $50 in total. Until answered, the runtime is provider-agnostic and built and tested against recorded responses.
3. Web search API: free tier with the human's own key; one option costs about $5 per 1,000 searches with a monthly free credit, others $10-14.
4. Hosting: local only for v1. Nothing published outside the repo; this also keeps EU person data off the public web.
5. Crash monitor prices: official free series by default; stock and crypto tiles optional through a connector with the human's own free-tier key.
6. SEC EDGAR contact for the User-Agent, set in a local env var.

**Dissent:** CPO wanted the human to confirm the primary job and set the tax-arrears thresholds; the council keeps both under the charter and re-checks them at the first session 3 demo.

## Amendments and clarifications (2026-11-19, chair; panel not re-convened, so no dissent recorded)

### Amendment 1: one display-matrix format
Decision 2 is withdrawn. The only format is the one in `docs/research/README.md`: `Section | Country | Sources | Grade | Fill rate | Notes`, plus the source-entry template. Notes carry the access type and "licence verified Y/N". The council derives the legal light (from `legal.md`), effort and cost (from `cto`), and "feeds verdict" in session. **Reason:** two formats on the hub cost more than the round-trips they save. **Dissent (COO):** the longer format would have let session 1 decide in one pass. **What would change it:** if the assembled matrix leaves more than a handful of rows undecidable, the council asks for the missing column on those rows only.

### Clarification 1: "current for its cycle" (gate 4)
- **Source level** (decides SHOW vs CAVEAT): a source with a set cadence is current if its latest file or record date is no older than 2x the cadence (daily 2 days, weekly 14, monthly 62, quarterly 184). Annual data is current if it includes the latest fiscal year whose filing deadline has passed; how many companies filed is the fill rate. No stated cadence: use the cadence observed over two pulls; if that can't be measured, CAVEAT.
- **Record level** (decides the UI): a single value older than its source's cycle shows the Stale state with its as-of date.
- **What would change it:** a source whose normal lag is longer than its stated cadence; the matrix then records the observed lag and the rule uses it.

### Clarification 2: banned wording
- Scope: Finora's own voice (labels, finding statements, message catalogues, all LLM prose). Exempt: verbatim excerpts from a cited source, shown in the quote component.
- LLM prose with a banned term is rejected, regenerated once, and otherwise falls back to the sourced facts with no prose. Never silently rewritten.
- UI controls avoid the banned words too ("Reset", not "Clear"), so the test runs case-insensitive and whole-word over every catalogue string with no exception list.

### Clarification 3: noted for session 1
- `cto`'s store and load calls (embedded SQLite, load budgets, content-hash refresh, a licence id required on every record) are technical calls owned by `cto`; no council objection.
- Product requirement: each country becomes searchable as soon as its own load finishes.
- Which US states load by default is a session 1 call, from data-us's fill rates.

### Decision 4: verdict wording (accepted from the designer, `docs/design/display-options.md` §3.15)
Levels: **No concerns found** / **Points to check** / **Serious concerns** / **Not enough data**, with per-agent outcomes and the "N agents · N tasks · N sources" header. "No concerns found" never appears without its coverage line; the rule-based level and the AI-written explanation never share a sentence.
- **Guardrail 1:** the cost-cap extension is one-shot: at most one "allow $0.50 more" per run, never past the daily cap, and the daily cap can't be raised from inside a run.
- **Guardrail 2:** "Not enough data" is a rule in the verdict rule table: it fires when the entity isn't pinned to a registry ID, or fewer than half the applicable checks ran. Session 1 sets the final threshold.
- **Dissent:** none (designer's remit, granted in session 0). **What would change it:** the human reading "No concerns found" as a clean bill at the first session 3 demo; level 1 then becomes "Nothing found in N of M checks".
