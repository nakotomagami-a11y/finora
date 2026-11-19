# Data research: conventions

Every area doc in this folder uses the IDs, template and grades below, so the display matrix and the reality check can be assembled without guessing.

| Doc | Owner |
|---|---|
| `00-feasibility.md` | desk research (hypotheses, not facts) |
| `baltics.md`, `baltics-dictionary.md` | data-baltics |
| `us.md` | data-us |
| `markets.md` | data-markets |
| `osint.md` | data-osint |
| `legal.md` | legal |
| `display-matrix.md` | assembled from the area docs |
| `reality-check.md` | assembled from the area docs |

## Where things go

| What | Where | Committed? |
|---|---|---|
| Probe scripts (download, count, measure) | `research/probes/<area>/` | yes, guarded; no keys, no data |
| Downloads, API responses, entity-level profiles | `research/.cache/<area>/` | never |
| Keys | environment, or the main checkout's `.env` | never |

## Report sections

The company report is built from these sections. Use the IDs everywhere.

| ID | Section | Examples of fields |
|---|---|---|
| S01 | Identity | name, registry code, legal form, registered address, activity code, registration date, VAT number, LEI |
| S02 | Status and history | active / liquidating / deregistered, name and address changes, register events |
| S03 | People | board, managers, officers, signing rights, roles, start and end dates |
| S04 | Owners | shareholders and members, shares, beneficial owners |
| S05 | Group | parent, subsidiaries, LEI relationships |
| S06 | Financials | revenue, profit, assets, equity, liabilities, by year |
| S07 | Workforce | employees, average salary, by month or quarter |
| S08 | Taxes and arrears | taxes paid, tax and social-insurance debts |
| S09 | Insolvency, pledges and notices | insolvency, liquidation, commercial pledges, securing measures, official notices |
| S10 | Courts | court cases and rulings |
| S11 | Sanctions and watchlists | sanctions hits, PEP, exclusion and debarment lists, regulator warnings |
| S12 | Public money | public contracts, grants, EU funds |
| S13 | Filings and events | filings, annual reports, material events (for example officer changes) |
| S14 | Securities | listed securities, insider transactions, large holders |
| S15 | Web presence | website, domain age, certificates, archives |
| S16 | News and reputation | news, reviews, complaints |
| S17 | Network | companies and people linked by shared officers, owners or addresses |
| S18 | Score inputs | the signals a transparent risk score could use |

## Crash monitor tiles

| ID | Tile |
|---|---|
| M01 | US stocks: total market, S&P 500, Nasdaq-100 (level, drawdown from peak, market cap lost) |
| M02 | Europe: broad index |
| M03 | Asia and Pacific indices |
| M04 | Americas excluding the US |
| M05 | Gold |
| M06 | Crypto: bitcoin, ether |
| M07 | Oil: Brent, WTI |
| M08 | US national debt, live |
| M09 | Candidates you propose (rates, volatility, macro); mark them as proposals |

"Peak" means the highest daily close since a configurable start date.

## Source entry template

One entry per source, in this order:

```markdown
### <Source name>
- Publisher and official URL:
- Access: bulk file / API / per-query page; format; paging
- Fields: the fields we would use, with types (full list in the data dictionary)
- Rows and coverage: counted, not quoted; what share of the population it covers
- Freshness: update cadence, and the latest date seen in the data on <date>
- Join keys: registry code, LEI, CIK, VAT, and so on, with format and null rate
- Person identity: how a person is identified (name only, masked code, birth date), if at all
- Licence: exact licence name, quoted from the official page; URL; date verified
- Keys, limits, cost:
- Legal constraints: personal data, restrictions, attribution wording
- Tested with: `research/probes/<area>/<script>` and what it measured
- Verdict: use / use with caveat / skip, and why
```

Unknowns stay visible: write "unknown" and what would settle it. Never fill a field from memory.

## Quality grades

| Grade | Meaning |
|---|---|
| A | Official, structured, bulk or full API, refreshed at least weekly, open licence |
| B | Official and structured, with one limitation: per-query only, slower refresh, partial fields, or a licence caveat |
| C | Partial, derived, unclear licence, or only available to agents at query time |
| D | Not available free (paid, restricted or absent) |
| X | Available, but legally restricted from display (cite the legal memo) |

## Display matrix rows

Format set by council session 0 (`docs/plan/council/00-framing.md`, decision 2). Each area doc ends with its rows: **one row per item × country × source**. A row with an empty cell is decided LATER in session 1, so fill every cell; write "estimated" where a value can't be measured for real.

```markdown
| item_id | Section | Country | Source | Access | Refresh and lag | Licence as stated | Attribution text | Verified (URL) | Fill rate (n/N) | Sample date | Feeds verdict | Effort | Load size, refresh time | Blocking dependency | Empty-state text | Proposed call | Draft caveat |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S03.officers | S03 | LV | Enterprise Register officers | bulk | daily, 1 day | "..." | "..." | Y (url) | 49/50 | 2026-11-20 | Y | S | 40 MB, 2 min | none | Not published in LV | SHOW | - |
```

- `item_id`: `<section>.<short-name>`, lower case (for example `S06.revenue`, `S08.tax-arrears`, `M05.gold`). The coordinator normalises ids across areas.
- Access: bulk / API / per-query / paid / user key.
- Effort: S, M or L, in slices.
- Blocking dependency: none, or the key, contract or human-task it needs.
- Proposed call: SHOW / CAVEAT / HIDE / LATER, against the gates in `docs/plan/council/00-framing.md`.
- Country: `LT`, `LV`, `EE`, `US`, or `all` for cross-border sources. Tiles use `-`.
- Legal light and personal-data class are added by `legal` after assembly; leave them out.

## Reality check

Build real profiles for sample entities from the sources, exactly as the app would, and measure what each section gets.

- Pick samples at random within each segment and record the method and seed, not the entities. Segments per country: at least 5 companies of varied size, including one bankrupt or liquidated and one with tax debt (US: see the data-us brief).
- Keep the profiles in `research/.cache/<area>/profiles/`.
- Commit only the aggregate table:

```markdown
| Section | Country | Segment | Sample size | Filled | Fill rate | Notes |
|---|---|---|---|---|---|---|
```

No entity names, codes or identifiers in committed files or posts.
