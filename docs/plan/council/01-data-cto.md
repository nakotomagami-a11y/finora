# Council session 1: cto's feasibility, cost and scaling calls (2026-11-20)

Posted by the `cto` seat on the hub; committed by the coordinator. `cto` owns these technical calls; the council's data decisions are in `01-data.md`. Tags: 🟢 measured · 🟡 extrapolated. Scripts are local to the cto seat unless noted.

**Bottom line:** everything the council is likely to SHOW fits one laptop at $0 data cost, under four load rules. The 10 GB budget stays. The Baltic overflow (23.6 GB) came from storing money figures, dated register entries and bookkeeping as text statements. Under the rules the whole store comes to ≈ 7 GB (🟡).

## New measurements

- 🟢 **EE annual-report figures, FY2024 file:** 3,890,789 figures in 258,448 reports.

  | Layout | Size | Per figure |
  |---|---|---|
  | Text statements | 478 MB | 123 B |
  | Narrow fact table (report, concept, value; provenance on the report row) | 61 MB | 16 B |
  | One row per report | 44 MB | 11 B |

  Facts are 7.7x smaller than statements.
- 🟢 **EE general-data file** (4.6 GB JSON, 381,685 entities): 65.4M non-null values. 24.1M are annual-report summaries; most of the rest is registry-card bookkeeping repeated on every item (an address alone carries 16.6 values). A profile needs about 10 values per company.
- 🟢 **EE history:** the name and address arrays have start and end fields, but the open file holds only the current entry (0 entries carry an end date; 12,772 companies have more than one status entry). The bulk file has no history.

## 1. Store size and the load rule

**Call: the 10 GB budget stands, with four load rules.**
1. **Statements hold entity attributes and relationships only.** Numbers by period go to a narrow `facts` table (financial lines, taxes paid, employees, social-insurance figures). Dated register entries go to a narrow events table (EE rulings, LT founding documents, the EE report list). Provenance sits on the report, event or sync row. Narrow facts are chosen over one wide row per report: wide rows save 5 B per figure (about 40 MB on all EE key figures) at the price of a per-country schema.
2. **Every stored property maps to an `item_id`** ruled SHOW or CAVEAT, or to a key that resolution or a verdict rule needs. Nothing else is loaded: no registry-card bookkeeping, no contacts beyond the website field. One list drives this rule and qa's rendered-field registry (checklist item 9).
3. **Financial history: the latest 5 fiscal years at load.** Deregistered and struck-off companies keep identity properties only (name, code, form, status, dates).
4. **HIDE and LATER items are never loaded.** Beneficial owners alone are 3.3M statements in EE and 1.8M in LV.

Re-total of data-baltics' per-source counts (`baltics.md`, "Load volume") under these rules (🟡: facts at the measured 16 B, events assumed at 32 B per row):

| Country | data-baltics' rule | Under these rules | Where the cut comes from |
|---|---|---|---|
| LT | 78.5M statements, 9.7 GB | ≈ 1.4-1.7 GB | P&L and balance lines (50.8M statements) become 8.5M facts (≈ 0.14 GB); social-insurance monthly (12.6M) becomes ≈ 0.12 GB of facts |
| LV | 35.8M, 4.4 GB | ≈ 2.0 GB | financial and tax files become ≈ 0.23 GB of facts; beneficial owners not loaded |
| EE | 77.9M, 9.6 GB | ≈ 2.4 GB, plus ≈ 0.13 GB in the share-alike store | key figures become 7.9M facts (≈ 0.13 GB); rulings become events (≈ 0.04 GB); beneficial owners not loaded; tax-board data moves to the share-alike store |
| Cross-border | - | ≤ 1 GB | sanctions ≈ 50 MB; GLEIF filtered by country; TED |
| **Total** | **23.6 GB** | **≈ 7 GB** | leaves ≈ 3 GB for our own history and the US cache |

**Acceptance criteria for the loader slices** (measured on the named machine profile):
- Size on disk: LV ≤ 2.5 GB, EE ≤ 3 GB (+ ≤ 0.25 GB share-alike), LT ≤ 2 GB, cross-border ≤ 1 GB; whole store ≤ 10 GB.
- Searchable in minutes, complete in ≤ 30 min: each country's register file loads first and that country is searchable as soon as it lands (about 2 min for LV and LT, about 6 min for EE, 🟡). Financials, rulings and the rest load after it, in the background. The first core load completes in ≤ 30 min, countries parsed in parallel with a single writer; EE sets the pace (about 23 min of parsing).
- Daily refresh ≤ 5 min, in the background, never blocking reads.

**What would change it:** a loader spec whose counted statements, facts and events exceed its country budget. That spec cuts fields or years; the budget doesn't move.

## 2. Refresh cadence

| Cadence | Sources |
|---|---|
| Daily | LV register, officers, members, insolvency, securing measures, suspensions (~230 MB); EE basic CSV (status) and person files; EE tax debtors (share-alike store); LT daily register files, VMI arrears, Sodra debts if kept; EU, OFAC, UK and LV FIU sanctions; GLEIF daily delta |
| Weekly | LV financial statements (~0.003% of rows change a day); LV VID quarterly taxes, rating and VAT files; EE general data (a 4.6 GB parse every day would eat the 5-minute budget); OR |
| Monthly | EE annual-report files (URL taken from the download page); LT statements; Kohesio; EE taxes paid (quarterly data) |
| On demand | SEC per company (≤ 10 req/s); US state registries (live); agent sources |

- Each source runs after its observed publication time (LV ≈ 21:26 UTC, EE ≈ 09:20 UTC, LT after the tax authority's load ≈ 07:00 UTC) and checks the as-of date inside the file before replacing yesterday's data.
- An unchanged file costs one sync row and no writes.
- 🟡 About 0.5 GB is downloaded per day.

## 3. Share-alike storage (S07.EE.01, S08.EE.01, the notices in S09.EE.01, S12.EE.01)

**Call: build the share-alike storage class, not agent-only.**
- A separate SQLite file, attached read-only at query time. The main store never holds a share-alike row.
- Each row's licence comes from its sync.
- Export, the bulk API and bulk MCP tools exclude it. Single-company responses carry the attribution and licence link (legal round 3).
- Negative tests: export and bulk endpoints contain no row from it. The architecture's CI test stays, scoped to "no share-alike source in the main store".
- Effort S. 🟡 Size well under 100 MB.

**Why not agent-only:** EE tax debt is a verdict risk signal. Agent-only would make it need an LLM key, which breaks the $0 instant profile (council decision 3, two speeds).

**What would change it:** the LAWYER item in `legal.md` on whether a local store falls inside project rule 4. If it does, these four rows go agent-only.

## 4. History (S02; officer changes in S13)

**Call: our own history from install day. No register API contract in v1.**
- Cost is churn only: the lean layout already retires a changed row's old statements; we keep them instead of deleting. Measured LV churn ~600 changed rows a day; 🟡 ~0.2 GB a year, EE of the same order.
- Company attributes (name, address, status, legal form, capital) are retired, never deleted.
- Ended person roles are kept only for the retention period legal sets (rule 11, LAWYER). Until then the default is 0 days (legal round 3). "Officer left" can still show as an event on the day it is seen; the ended role itself is not retained. A config value plus the planned retention job.
- EE companies that vanish from the open files keep a tombstone: name, code, form, last status, and "not in the register's open data since [date]". Struck-off companies stay searchable from install day; those struck off before install are not covered.

**What would change it:** the council wants history from before install. That needs the EE contract (human key round) and a back-fill loader, effort M.

## 5. US states (S01-S03 US)

**Call: adopt data-us's live proposal for NY, CO, OR, CT, PA and WA. FL bulk is LATER.**
- Search fans out to the six portals in parallel, 3 s timeout each. Baltic and cached results render first. A portal that fails shows "Not checked: [state] registry did not answer", never an empty list.
- Each entity the user opens is cached as statements with its sync (live query, state licence).
- `SOCRATA_APP_TOKEN` (free) is recommended on the keys list; without it, queries share the anonymous throttle.
- FL is LATER: its licence is unverified (gate 2), and it is an L loader for one state (SFTP, fixed-width records, daily deltas). Trigger: licence verified and the council wants FL officers.
- S17 US state networks: LATER (they need bulk data).
- Effort M: one Socrata client plus six field maps.

## 6. Agent cost

- 🟡 Modelled at $0.46 typical and $0.92 worst case per investigation on the mid tier, under the $1.50 cap.
- **Call: the runtime slice is not accepted until data-osint's measured run replaces the model** (key pending), with the pre-run estimate calibrated on it. Planning does not wait for it.
- Parallelism is not a constraint: provider limits allow ~50 concurrent investigations; one user needs 1-2.

## 7. Markets (M01-M09)

- The architecture's 60 s quote refresh breaks the free tiers. Call: stocks hourly while open (S7 allows 50 calls/h for 13 symbols), crypto every 5 min, official series daily. Every tile shows its as-of time.
- ETF proxy tickers live in the user's local settings only (a settings table in the local store), never in the repo. Fixtures use fictional tickers. Effort S.
- The Taiwan peak is computed from the first run, labelled "peak since [first-run date]", until a user key with history exists. Effort S. (The designer recommends seeding it once from a cited figure; the council decides.)

## 8. Person join keys (S17 network; the legal R rows on codes and the EE hash)

A technical option for legal and the council: drop the LV masked code and the EE person hash at load, and keep only an install-local HMAC of them as the person join key. It is never shown, exported or served. That keeps the one-hop network (S17.LV.01, S17.EE.01) without storing the codes. If legal rules even that out, S17 for LV and EE falls back to company-to-company links through shared addresses and corporate members.

## 9. Effort by loader group

| Group | Items | Effort | Blocking dependency |
|---|---|---|---|
| LV (~20 CSVs, CC0, stable URLs) | S01-S09, S12, S13, S17, S18 LV | M | none |
| EE (4.6 GB JSON streamed by line block; monthly zip URLs from the page; share-alike store; person files) | S01-S09, S12, S13, S17, S18 EE | L | none |
| LT (daily files, VMI API, classifier and address joins) | S01, S02, S06, S08, S09, S12, S13, S18 LT | M | none |
| Sanctions (EU, OFAC, UK, LV FIU; match on a second identifier) | S11.ALL.01, S11.ALL.02, S11.LV.02 | M | none |
| GLEIF (country filter, daily delta) | S01.ALL, S05.ALL.01 | S | none |
| TED, Kohesio | S12 | S | none |
| SEC (submissions, company facts, Forms 3/4/5 quarterly sets, 8-K items) | S01, S03, S04, S06, S13, S14, S17 US | L | `SEC_USER_AGENT` with a real email. Without it, US public companies have no profile, and the "US companies" done criterion fails |
| US states, live | S01-S03 US | M | `SOCRATA_APP_TOKEN` recommended |
| Markets | M01-M09 | M | user keys for the M01-M04 price tiles |
| Agent runtime + 4 specialists | query-time rows in S10, S11, S15, S16 | L | `ANTHROPIC_API_KEY` for the measured run |

## Not fixable by engineering

LT S03 People (0%), US private S04 and S06 (0%), and EE S07 (26.9%) have no free source with more. No build effort raises them. Show "Not published in [country]" and spend no effort there. The council decides whether the country promise changes.

## Amendment (cto, 2026-11-20): M03 Taiwan peak

The designer is right; "computed from the first run" is withdrawn, because a 0% drawdown on day one reads as "no crash". Revised call: seed the peak once from a cited official figure, if legal clears it (the same open question as "one cited figure per market" in `markets.md`). Until then the tile shows "Peak not known yet: tracking since [date]" with no drawdown percentage, never 0%. Effort S either way.

On store size: the call is narrow facts, not wide rows (16 B per figure vs 11 B for one row per report, against 123 B as statements). The per-country budgets above become the loader acceptance criteria.

## Legal review of these calls (legal seat, 2026-11-20)

Not legal advice; positions cite `legal.md` rules.

**Agreed, no legal objection:** load rule 4 (HIDE and LATER never loaded; rule 1); load rule 2 (every stored property maps to a SHOW or CAVEAT item; rule 4, data minimisation); load rule 3 for company data; the refresh cadence, the US live-query call, FL LATER and the markets cadence, subject to the notes below.

**Not cleared, with conditions:**
1. **Share-alike store (§3):** not cleared; rule 4's reach to a local store is a **LAWYER** item. Acceptable only if the four rows can switch to agent-only without code changes. The EE tax-debtor file may include natural persons (sole traders): "?" until checked; any natural person is excluded or handled under rule 5.
2. **Ended person roles and "officer left" events (§4):** the 0-day default is correct. The event itself is natural-person data: until a lawyer sets the period, do not store "officer left" events that name a natural person. Company-level change events are fine.
3. **Tombstones (§4):** company tombstones are fine. A struck-off sole trader's tombstone keeps a natural person's name: rule 5, identity fields only, company context, purpose note; **LAWYER** if shown.
4. **HMAC person join key (§8): not supported.** A keyed hash stored locally is still personal data: anyone with the original code list can recompute it, and it links persons across companies (rules 1 and 4). Use the company-to-company fallback. If the council wants the person link, a lawyer decides first. Light **R** (rules 1 and 4; round 3 items 2 and 3): the conditions "never leaves the install, deleted with the store" limit exposure but don't change the classification. If the council overrules, a lawyer confirms first, and then: the HMAC key is not stored beside the codes and derived values are never written to the store; no API, MCP tool, export or log emits the key or a link built from it; it is deleted with the store and never copied into backups or shared between installs.
5. **SEC insider data (Forms 3/4/5):** named insiders are natural persons. Company context only (rule 2); no stored person-level history beyond what the matrix needs; **LAWYER** for the retention period.
6. **US state caching (§5):** each cache entry needs a TTL and the state licence's terms checked before the cache goes live; "?" until data-us reads the six licences.

## cto's answer to the legal review (2026-11-20): all six conditions accepted

1. **Share-alike rows (S07.EE.01, S08.EE.01, the S09.EE.01 notices, S12.EE.01): both modes are built; switching is config only.** Each source's registry entry carries `storage: share-alike-store | live-no-store`. `live-no-store` is a deterministic fetch, not an agent: the daily debtor file (1.27 MB) is read into memory at refresh and never written to disk, so EE tax debt stays in the $0 instant profile in both modes. The quarterly taxes-paid file (~3.47M rows) is too large to fetch live, so in `live-no-store` mode S07.EE.01 and the taxes-paid part of S08.EE.01 show "Not checked: licence question pending". CI tests both modes on fixtures. Effort S + S.
   - **Natural persons in the EE debtor list: none** (🟢 2026-11-20). 19,920 rows; 19,622 codes match the register and none is a sole trader (the register lists 24,545); the other 298 are foreign companies. The loader still drops any row whose register entry is a natural person, as the rule 5 guard.
2. **"Officer left" events: company-level only** until a lawyer sets the period: "a board member's role ended on [date]", with no name and no person key.
3. **Sole-trader tombstones:** identity fields only, company context, purpose note, driven by the `naturalPerson` flag (rule 5).
4. **HMAC person join key: withdrawn.** S17 for LV and EE uses company-to-company links only (shared addresses, corporate members). Person-to-person links wait for a lawyer and a council call; that also covers S17.US.01 (shared SEC insiders across issuers). No extra build cost.
5. **SEC insiders:** company context only; only what the matrix rows need is stored; the retention period is a config value for a lawyer to set.
6. **US state cache:** each source's registry entry gets a cache TTL and the state licence. Proposed defaults: re-fetch on view when older than 24 h; purge entries not viewed in 30 days. The US live slice is not accepted until data-us has recorded all six licences.

## Legal's acceptance (2026-11-20)

Legal accepts cto's answer (switchable share-alike storage, company-level "officer left" events, sole-trader tombstones, the HMAC withdrawal and company-to-company links, SEC insiders in company context, and the debtor-list check; the loader's rule 5 guard stays because the register can change). Three test conditions carry into the plan:
1. `live-no-store` mode has a negative test: no write to disk, no cache entry, no log line containing the debtor data.
2. The US cache defaults (24 h re-fetch, 30-day purge) are acceptable; the live US slice stays blocked until all six state licences are recorded; rule 16 applies to each cached statement.
3. The 30-day purge has a test that deletes a cached entry not viewed in that period.
