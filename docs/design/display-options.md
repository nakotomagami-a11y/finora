# Display options for council session 1

> **Session 1 has ruled** (`docs/plan/council/01-data.md`). Where this page and that record differ, the council record wins: for example the fixed 11-check list, `paid_only` for Lithuanian names, S05 and S12 LATER, company-to-company network only, and the 12-hour purpose session. `DESIGN.md` and the screens follow the council record; this page stays as the advice trail.
>
> Designer's advice to the council. Updated for the legal memo (`docs/research/legal.md`) and the council's session 0 framing (rubric, three empty states, v1 agents, banned verdict words). Written before the display matrix is final. It offers **ways to show** each data item; the council decides **whether** to show it. Where the research changes a fact, the research wins and this page is updated.

The council's decision for each item (show / show with caveat / hide / later) maps onto one of the display states below. Picking the state also picks the UI, so a builder never has to invent one.

## 1. The display states

Every field in every section, for every country, ends in exactly one state. Empty space is never a state: if we have nothing, the UI says why.

| State | When | How it looks | Wording pattern |
|---|---|---|---|
| **Full** | Official source, loaded, fresh | Value in primary ink, source chip at the end of the row | the value |
| **None found** | A check ran and found nothing (risk signals: tax arrears, insolvency, pledges, courts, sanctions, struck off) | Check-mark icon in `--ink-2`, never green; the source and date are part of the sentence | "Checked the debtor list as of 18 Nov 2026: none found" |
| **Partial** | Some fields or years missing, or only a subset of the population (e.g. only filers above a threshold) | Value shown, plus a dotted underline; hover or tap explains the gap | "3 of 5 years published" |
| **Stale** | This record is older than its source's cycle (council session 0 clarification: record level; the source-level "current" rule is 2× cadence and decides SHOW vs CAVEAT, not this state) | Value shown, date chip turns amber | "as of 14 Mar 2026, older than this source's monthly cycle" |
| **Caveat** | Council says "show with caveat" | Value shown; a short caveat line in muted text right under it, never in a tooltip only | "Covers filers above the threshold only, as of 2025. Missing does not mean clean." |
| **Not published** | The country has no official source for this item | Muted row, dash icon, one line naming the gap | "Not published in Lithuania" |
| **Not shown** | Data exists but law or policy keeps it out (council "hide") | Muted row, lock icon, one line with the reason and a link to the policy page | "Not shown: restricted by a 2026 court ruling" |
| **Paid only** | Official source exists but is not free (grade D, paid extract) | Muted row, one line naming where an official extract can be ordered; no price, no affiliate link | "Available as a paid register extract" |
| **Disputed** | Someone objected through the correction channel (legal memo rule 10) | Value hidden, muted row, one line with the date; the source chip stays | "Under review after an objection, since 12 Nov" |
| **Later** | Council "later" | Not rendered, unless a primary job needs it: then a muted gap row with the "Not checked" icon. Always listed on the Sources page with its trigger | "Not checked in this version" |
| **Loading** | Source query in flight | Skeleton bar the width of a typical value; the agent card shows the live step | "Querying the register" |
| **Error** | Source failed, timed out or was rate-limited | Muted row, warning icon, retry button | "Not checked: the register did not answer. Retry" |
| **Agent finding** | Came from an agent reading the open web, not an official record | Value with a source chip whose kind is "web", and a confidence badge | the finding, always with its citation |

### Display states in code (architect's section DTO union)

Code, copy and mockups share one union (architect, contract settled for phase 3). How each display state above maps onto it. Every `not_checked` reason has **its own icon and copy**; only `later`, `error` and `skipped` use the generic "Not checked" line.

| Display state | DTO |
|---|---|
| Full / Partial / Stale | `data{value, freshness: current\|stale, asOf, completeness: full\|partial}` |
| Caveat | `data{…}` plus the council's caveat key |
| None found | `checked_none{source, asOf}` (the section state; `none_found` is the finding rating) |
| Not published | `not_published{country}` |
| Paid only | `not_checked{reason: paid_only}`, rendered with its own copy ("Available as a paid register extract"), not the generic "Not checked" line. The order link goes **only to the official register's ordering page**, never to a reseller or portal; without one, there is no link (council clarification 4) |
| Later / Error / skipped check | `not_checked{reason: later\|error\|skipped}` |
| Purpose gate | `not_checked{reason: needs_purpose}`, rendered as the purpose prompt, never as "Not checked" |
| No key (agent-only or connector data) | `not_checked{reason: needs_key}`, rendered with an "Add your key" action |
| Disputed | `disputed{disputeId}` |
| Loading | client state only, not a DTO state |
| Agent finding | a finding on the run, not a section state |
| Not shown | **no row** for a HIDE item. A primary-job section whose data is HIDE on legal grounds renders `not_checked{reason: restricted, basis}`: a lock and "Not shown in [country]: restricted by [legal basis]", where the basis is a rule number from `legal.md` (council clarification 4). **The lock depends on the rule (country, legal form, section), never on the record**: it shows for every covered entity, whether or not hidden records exist, so the lock itself can't leak that data exists. |

### How research grades map to states

| Grade (`docs/research/README.md`) | Default state |
|---|---|
| A | Full (Stale when past its refresh interval) |
| B | Full or Partial, plus a Caveat naming the limitation |
| C | Agent finding, or Caveat |
| D | Not published (absent) or Paid only (paid extract) |
| X | Not shown |

Rules that follow from this:
1. The council's three empty states stay distinct everywhere (session 0): **"Not published in [country]"**, **"Checked [source] as of [date]: none found"** and **"Not checked"** (Later, Error, or a check the run skipped). "Paid only", "Not shown" and "Disputed" are labelled variants of "Not published" and "Not checked", each with its own icon and reason. A user must be able to tell "nothing bad found" from "nobody checked" from "we may not show it".
2. "None found" is never green and never says "clear". It reports a check, not a judgement.
3. Banned verdict words are banned in every string Finora writes, controls included ("Reset", not "Clear"). The only exemption is a verbatim excerpt in the quote component, with its citation.
4. A section where every field is "Not published" collapses to one line ("Lithuania publishes no ownership data") instead of a block of dashes.
5. The country coverage strip (section 4) tells the user up front what this country can and cannot give.

## 2. Provenance on every finding

Every value and every agent finding carries a **source chip**. Collapsed, it reads `register · LV · 18 Nov`; expanded (click, or focus and Enter), it shows:

- the source name and the record or document link
- the licence (CC0, CC BY 4.0, public domain, "display only, not stored")
- retrieved at (date and time) and the source's own "as of" date
- the agent or loader that produced it
- for agent findings: the quote or excerpt the claim rests on

Licence wording is short and fixed per licence, so the chip never wraps. CC BY sources also get their required attribution line in the report footer.

### Confidence

Four levels, shown as a small badge next to every finding. Names, not percentages: a percentage invites false precision.

| Level | Meaning | Badge |
|---|---|---|
| **Official** | Read from an official register or filing, unchanged | solid dot |
| **Corroborated** | Two or more independent sources agree | two dots |
| **Single source** | One non-official source | hollow dot |
| **Inferred** | The agent concluded it from other findings | dashed dot, plus "how we got here" link |

An "Inferred" finding can never be a key finding on its own; it must cite the findings it rests on.

## 3. Options per data family

Each family lists display options, with a recommendation. "Rec" is the designer's pick; the council decides.

### 3.1 S01 Identity and S02 Status and history
- A. Header block: name, status pill, country flag-free code (`LV 40003…`), registered date, activity, address.
- B. A plus a timeline of status changes (renamed, re-registered, liquidation started).
- **Rec: B.** Status history is where the risk lives (renames after trouble, recent re-registration).
- Status pill wording is the register's own, translated, never our judgement: "Active", "In liquidation", "Removed from register".

### 3.2 S03 People
- A. A "People" table inside the company page: role, name, since, until. No links to a person page.
- B. A, plus "also officer in N other companies" as a count that opens the network explorer scoped to this company.
- C. Standalone person pages.
- **Rec: B.** C is out: the feasibility research flags standalone person profiles as the main GDPR risk, and the legal memo leaves them to a lawyer, so person data appears only inside company pages. Personal codes, even masked ones, are never shown. People never appear in search results or the library as subjects; search finds companies.
- Per country: LT shows "Not published" for names; US shows people only where a filing names them (filing chip says which form).

### 3.3 S04 Owners
- A. Ownership table: holder, share %, since. Companies and people mixed, with a type icon.
- B. A, rendered as a small ownership tree when there are layers.
- **Rec: A in the report, B in the network explorer.** Expect many "Not shown" rows here (restricted shareholder and owner data in parts of the EU). The "Not shown" line must name the reason so the user knows to request an official extract.

### 3.4 S06 Financials
- A. Key figures table (revenue, profit, equity, assets, employees) by year, newest left.
- B. A plus a sparkline per figure and a year-on-year change with arrow and sign.
- C. Full statements (every line item) behind "All line items".
- **Rec: B, with C behind a disclosure.** Currency and the period end date are always shown. Missing years are "Partial", not zero. Never colour alone: every change has a sign and an arrow.

### 3.5 S07 Workforce
- A. Latest headcount with the quarter or month.
- B. A plus a 24-month line.
- **Rec: B where the source is monthly or quarterly (LT, LV, EE); A for US (annual report text, "Caveat: from the annual report").** Average salary only where officially published and only for companies above a minimum headcount (council to set; small companies leak individual salaries).

### 3.6 S08 Taxes and arrears
- A. Taxes paid per year; tax debt as a flag with amount and "as of" date.
- **Rec: A.** A tax debt is a red-flag finding with the debtor-list source chip. When a debt disappears from the list, show "No longer on the debtor list since …" for a limited window (council to set), then drop it.

### 3.7 S09 Insolvency, pledges and notices; S10 Courts
- A. An "Events" list, newest first: date, type, status, amount if any, source.
- **Rec: A**, with each event's status in the register's words ("Proceedings closed"). Court cases name parties that are companies; natural-person parties are masked as "a private individual".

### 3.8 S12 Public money
- A. Totals per year plus the top five contracts or projects with buyer and value.
- **Rec: A.** Positive signal; usually green-neutral, never a risk colour.

### 3.9 VAT status (part of S01)
- **Rec:** one row in the header block: "VAT registered since …" or "Not VAT registered". US: the row is not rendered (n/a, not "Not published").

### 3.10 S05 Group
- **Rec:** LEI in the codes row; parent and ultimate parent as the first ring of the network.

### 3.11 S11 Sanctions and watchlists
Three outcomes only, and the UI never says "sanctioned" from a fuzzy match (legal memo rule 8: "possible match, needs review"; "sanctioned" only with a primary list entry):
- **No match** across the named lists (each list listed, with its as-of date).
- **Possible match: needs your review**: a question card to the human (section 5), showing both records side by side with the matching fields highlighted.
- **Confirmed match**: only on an exact identifier match (registration code, LEI) or after the human confirms.
- **Rec:** this exact pattern. It doubles as the clearest "agent asks the human" moment in the product.

### 3.12 S13 Filings and events; S14 Securities
- A. A filings timeline with form type chips (3, 4, 5, 13D/G, 8-K 5.02).
- B. A plus a net insider buying/selling bar per quarter.
- **Rec: B for public companies.** "CEO left" style events come from 8-K item detection and are labelled with the item number.

### 3.13 S15 Web presence; S16 News and reputation
- Display-only where terms forbid storing: the report keeps our summary sentence and the link, not the third-party text. The chip says "display only, not stored" and the excerpt is re-fetched on open, or replaced by "Open source to read".
- Review platforms: aggregate rating and count only where the platform's terms allow it; otherwise only the link.
- Domain: registered date versus company registered date is a good one-line finding ("Domain registered 3 years before the company").
- **Rec:** these are agent findings with "Single source" or "Corroborated" confidence, never "Official".
- **Session 0:** v1 has one web, domain and news agent. Social media and reviews agents are LATER, so the review ratings above are not built in v1, and the report shows no reviews or social block at all (not a gap row), because no primary job depends on them.

### 3.14 S18 Score inputs (red-flag checks)
- A list of named checks, each with **None found / Flagged / Not checked**, so the user sees what was checked, not just what was found. The count feeds the verdict's coverage line ("8 of 11 checks ran").
- **Rec:** this list, with the check definitions published (transparent scoring is a stated product goal).

### 3.15 The verdict

S17 Network is covered by the network explorer screen: companies first, people only as nodes inside a company's network, never as a search entry point.

The prototype used "Go / Caution / Avoid"; session 0 bans that wording. Under the council's frame (level set by deterministic rules on hard flags, explanation written by the model, coverage always shown, "not enough data" a valid outcome), the wording below was **accepted by the council** (answer to the designer, session 0), with two guardrails folded in: the "Not enough data" rule and a one-shot cap extension (§5). If the first milestone demo shows "No concerns found" read as a clean bill despite the coverage line, level 1 becomes "Nothing found in N of M checks".

| Level | Wording | Colour and icon | When (rules owned by the runtime spec) |
|---|---|---|---|
| 1 | **No concerns found** | `--ink` text, neutral dot (never green) | the checks that ran raised no hard or soft flag |
| 2 | **Points to check** | `--warn`, `!` | one or more soft flags |
| 3 | **Serious concerns** | `--bad`, `×` | any hard flag (for example insolvency, struck off, a confirmed sanctions entry) |
| 0 | **Not enough data** | `--muted`, `?` | the entity is not pinned to a registry ID, or fewer than half the checks that apply in its country ran (provisional; session 1 sets the threshold) |

- Always one block: the level, then **coverage on the same line** ("8 of 11 checks ran · 46 sources · 19 Nov 2026"), so "No concerns found" is never read without how much was checked.
- **"Why this level":** under the level, the rules that fired (or "No hard or soft flag in the checks that ran"), each linking to its finding. The level is labelled **rule-based**; the explanation paragraph carries the **AI-written** tag (memo rule 9). The two never share a sentence.
- Per-agent outcomes use the same vocabulary as the checks: None found / Point to check / Concern / Not checked. "Clear", "Safe", "Avoid", "Scam", "Fraud", letter grades and score-like numbers never appear.
- Every key finding links to its evidence and is pinned to the company's registry ID.

- **Natural persons and sole traders** (legal memo rules 5 and 6): never a credit, character or eligibility verdict. Any other verdict on them is pending a lawyer, so until then the default is no verdict: the report shows sourced facts only, and the verdict block is replaced by "Facts only: no verdict is given on a private individual".
- **Disclaimer** (memo rule 6): every page that shows a natural person carries the fixed "not a credit report" line at the top of the People section and in the report footer. Its wording is a token in the copy file, not free text.

## 4. Country coverage strip

On top of every company page and report, one line per section showing what this country's official data can provide:

`Basics ● · People ● · Owners ◐ · Financials ● · Staff ● · Tax ● · Courts ◐ · Contracts ●`

Full, partial, not published and not shown each get a distinct icon and text label (not colour alone). This sets expectations before the user scrolls, and makes "Lithuania has no people data" a fact about the country, not a failure of the app.

## 5. Agents asking the human

The decision points the data creates, so the runtime and the UI agree on them:

1. **Which entity?** Several registered companies match the name. Cards with code, status, city, registered date.
2. **Possible sanctions match.** Side-by-side comparison, "Same entity" / "Different" / "Not sure".
3. **Same person?** Two officer records share a name across companies. Shown only inside the network, never as a person profile.
4. **Scope.** "This company has 40 subsidiaries. Check all, or only the 5 largest?" with the cost of each.
5. **Cost cap reached.** The run pauses at the per-investigation cap (session 0 default $1.50): "Stop here and write the report" (default) or "Allow up to $0.50 more". The extension is offered once per run and never past the daily cap; after it, the run stops at the cap with no question. Agent cards show their cost live, and the header shows the total against the cap.

Each question shows which agents are waiting on it, and has a default the run takes after a timeout, so an unattended run still finishes. "Which entity?" never times out into a guess: its default is to stop, because session 0 names the wrong company as the worst failure.

**No LLM key.** The instant official profile works without one. The Investigate button stays visible and opens a short "Add your key to run agents" sheet, never a disabled button with no explanation.

**Cost states** (council answers to the designer; human decision H2: bring your own key, estimate before start, cap in code). Each is a phase 3 screen state:

1. **Pre-run estimate.** Investigate opens a short sheet before anything runs. It shows the estimated range ("typically $0.40, at most $1.50 under the cap") with what drives it (the data-osint method), the per-investigation cap, and today's remaining daily spend. The primary button is "Start investigation".
2. **Cap reached, first time.** Covered by question 5 above. If "Allow up to $0.50 more" would pass the daily cap, the card offers only the amount left, or drops the option when nothing is left.
3. **Cap reached, extension already used.** The card offers only "Stop here and write the report" and says why: "Extension already used for this run".
4. **Daily cap reached.** Investigate opens a sheet with spend against the daily cap and the time it resets. The instant official profile keeps working, because it costs nothing. The daily cap can't be raised from inside a run.

### What the agent research changes (`docs/research/osint.md` §4.8, §1.6)

- **Timing.** Registry, money and legal agents finish in 15 to 35 s; the web agent takes 60 to 120 s. Each lane shows elapsed time plus "usually under a minute" (or "usually 1 to 2 min" for web), so a long web lane doesn't read as stuck. The three fast lanes finishing first while web keeps working is the visible parallel moment; findings from finished lanes land in their sections while web still runs.
- **Pre-run estimate.** Uses the measured spread: "Typically $0.46, up to $0.92 · cap $1.50 · $8.20 left today", with a per-agent breakdown behind a disclosure. The web agent is the largest share ($0.20), so the scope question can offer "skip web and news" as the cheap option.
- **Quote component, per source type.** The `Quote` primitive enforces the stored-versus-shown rule: the company's own pages, up to 300 characters plus a link; press, headline, outlet, date, link and at most 125 characters; domain records, derived facts only (for example "Domain registered 3 years before the company"); web archives, snapshot dates and links; lists and official notices, a stored excerpt. Over-length text is cut at the limit with "Read at source".
- **Sanctions match card.** Lists carry different identifiers, and only about half of listed companies can ever be confirmed by an official ID. So the side-by-side card shows only the rows where at least one side has a value, marks each row as match, differs or not on the list, and puts official-ID rows first. The outcome wording keeps three cases apart: "Confirmed: same registration number" (rule-based), "Confirmed by you" (human answer, with who and when), and "Possible match, needs review". "Sanctioned" appears only on an ID-confirmed primary-list entry (memo rule 8).
- **Attribution footers.** The report footer collects each cited source's required line ("© European Union", the Open Government Licence line, the agency name, and so on), deduplicated.

### Making parallel work visible with four agents

Session 0 cuts the prototype's nine agents to four plus a verdict step. Four cards look less busy than nine, but the parallel work is real at the source level. So each agent lane shows its **source tasks as sub-rows**, all ticking at once: for example the legal agent checks 2 sanctions lists, insolvency, pledges and courts in parallel, each with its own status and timer. The header counts agents, tasks and sources ("4 agents · 17 tasks · 31 sources"). This shows parallelism more honestly than nine cards did, so the designer does not challenge the cut.

## 6. Crash monitor tiles (M01 to M09)

The tile states depend on the markets research. Expected options:

- **Official only:** US national debt (live), rates and macro. Fully shown.
- **User key connected:** price-based tiles (indices, gold, oil, crypto) show live or delayed values with the provider in the chip.
- **No key:** the tile shows its shape with no numbers and a "Connect a data source" action. Never a fake or cached number.
- **Delayed:** value with a "15 min delayed" style chip.

Every tile shows its source and "as of" time, like every report finding.

### What the markets research changes (`docs/research/markets.md`, UI facts)

Measured: with zero keys, 7 of 20 series are official; keyless on-chain and exchange reads bring it to 10 of 20; one free stock key (the user's own) is estimated to reach 20 of 20. So the zero-key screen is **half full, not empty**, and every tile needs a mixed state:

- **Coarse official value, finer with a key.** M01 shows the quarterly total US equity value with "Quarterly · as of Q2 2026" and an "Add a key for daily" link inside the tile. M05 shows the last month-end gold drawdown the same way. The tile is never blank and never claims to be live.
- **Key-only tiles** (M02, M04): the "Add your key" state from above, with the tile's shape and no number.
- **Full with no key:** M07 oil (with its 2-day lag in the as-of chip), M08 debt, M09, and M06 bitcoin and ether.
- **Peak not known yet.** Where history does not reach the peak start date (Taiwan has the current month only) and no cited seed figure is cleared yet, the tile shows "Peak not known yet: tracking since [date]" with **no drawdown percentage, never 0%** (cto amendment, session 1). Once legal clears a cited seed figure, the tile shows the drawdown with "Peak seeded from [source]" in its chip.
- **Proxy caveat.** If the council accepts ETF proxies for M02 to M04, the tile carries "via a US-listed fund, in USD, includes currency moves".
- **Attribution.** Each tile's footer carries its required line (for example "U.S. Treasury, Fiscal Data"). On-chain values have no per-value link, so their chip links to the Sources page instead.
- **Key data stays local.** The connectors page says that data from a user's key is stored only on this machine and deleted when the key is removed.
- **Ticking debt.** M08's live ticker is an estimate between official daily figures. It is labelled "estimate" next to the official figure and its date, never shown alone.
- **S14 for Baltic listed companies:** "Listed on [venue] since [date]" from the official instrument register. Price only appears with a user key that covers the venue.

## 7. Legal memo rules that shape the UI

From `docs/research/legal.md`, product rules. Each one gets a fixed component, so no screen can forget it.

| Rule | UI |
|---|---|
| 2. Natural-person data behind a stated purpose, logged | **Purpose gate**: the People and Owners sections stay collapsed until the user picks a purpose from a short list (for example "checking a business partner"). It's asked once per session and shown in a small "Purpose: …" line above those sections, with a change link. |
| 3, 16. Source, licence, retrieval date and access tier on every record | The **source chip** (§2) gains an access-tier word ("open data", "API with key", "display only"). The licence links to the Sources page. |
| 6. Disclaimer on every verdict about a person | A fixed **disclaimer line** in the People section and the report footer (§3.15). |
| 7. Unsourced claims are not rendered | KeyFinding and FindingItem render nothing without at least one source. A verdict with zero sourced claims falls back to "Not enough evidence for a verdict". |
| 8. Sanctions wording | §3.11. |
| 9. AI-written text labelled on every surface | An **"AI-written" tag** on the verdict, every agent finding summary, chat answers and exports. Official values never carry it. This also separates register facts from agent prose at a glance. |
| 10. Correction and objection channel on every entity page | A **"Report an error or object"** link in every company header and on every finding's overflow menu. It opens a short form. An objected statement switches to the **Disputed** state (§1). |
| 1, 4, 11 | Data rules with no UI beyond the **Not shown** state (§1). |

## 8. Questions for the council

Designer's recommended answers are in **bold**.

1. ~~Verdict wording and scale~~: **decided** (council answer, session 0): §3.15.
2. Minimum headcount before showing average salary (3.5)? **Follow the source's own threshold where it has one (LT: more than 3 insured). LV's salary is our own estimate from social contributions: show it only at 5 or more employees, labelled "Estimated by Finora" with its method. EE: no salary at all (the tax authority warns against deriving it), so no row.**
3. How long a cleared tax debt stays visible (3.6)? **90 days, as "No longer on the debtor list since [date]", then the row returns to "Checked: none found".**
4. Are natural-person court parties masked in all four jurisdictions (3.7)? **Yes, everywhere, as "a private individual".**
5. Is "also officer in N other companies" (3.2 B) acceptable, or only inside the network explorer? **Only inside the network explorer, behind the purpose gate.** A count on the company page is a step towards a person profile.
6. Purpose gate (§7, rule 2): once per session or per company? **Once per session, picked from a fixed list, shown above each person section with a change link; every access is still logged per company (architecture R2).**
7. ~~Restricted data in a primary-job section~~: **decided** (council clarification 4): the lock state, keyed on the rule, never the record. See §1.

## 9. Session 1: how each section appears, from the display matrix

Advice on the UI treatment per section, keyed to `docs/research/display-matrix.md` and `reality-check.md`. The council makes the call; this says how each likely call renders. Defaults first, then the exceptions per country.

### Two additions to the state model

- **`not_checked{reason: manual_lookup}`**: the official source exists but only a person can read it (for example a per-query page behind a CAPTCHA). Copy: "Check manually at [official site]", with the official link. Agents never get around a CAPTCHA. Needed for LV tax debt amounts (S08.LV.01).
- **"Derived by Finora" provenance.** Some values are computed by our own deterministic code, not read from a source and not written by a model: LV salary estimates, parent links derived from corporate members (S05.LV.01, S05.EE.01), and person links across companies (S17). Their source chip says "Derived by Finora", lists the input sources and links to the method. This is a separate confidence from "Inferred" (agent) and from "Official".

### Field rows: core versus optional

Each section marks fields as **core** (always rendered, in one of the §1 states) or **optional** (row omitted when absent). Optional examples: LEI, website, VAT number when the country has no VAT list. Core examples: status, and every risk-signal check. This keeps sections short without ever hiding a check.

### Per section

| Section | Default treatment | Exceptions |
|---|---|---|
| S01 Identity | Header block, all `data` | US: the chip names the state register. CA and DE (S01.US.05): `paid_only` with the official order page. Federal-only firms (SAM, S01.US.06) and licences (S01.US.07) appear as extra identity rows, never as the main record |
| S02 Status and history | Status pill in the register's own words, translated; a timeline where dated history exists (LV, US NY, CO and CT) | LT, EE: if the council adopts our own snapshots, the timeline starts "Tracked by Finora since [date]"; before that, the current status and its since-date only. **Designer recommends snapshots**: "renamed two months ago" is one of the strongest scam signals |
| S03 People | Purpose gate, then a role table with "since" dates | LT: no names exist, so the section shows the published facts ("Has a manager · board: yes") plus "Names not published in Lithuania". LV, EE: CAVEAT "Current roles only; past roles are not published". US: each row carries its form or state chip; name-only state matches are labelled "same name" |
| S04 Owners | Purpose gate, then a holder table | LT: member counts plus "Names not published in Lithuania (available as a paid register extract)". LV joint-stock (S04.LV.03), and beneficial owners in LV and EE if HIDE: the `restricted` lock, keyed on country and legal form. US private: `not_published` "The US has no public owner register". US public: insiders over 10% and 13D/G holders |
| S05 Group | One line per parent or subsidiary, with its chip | All countries (about 10% fill): CAVEAT "Parents appear only when a company member or an LEI record names them. Missing does not mean independent". With nothing found, the section collapses to that sentence |
| S06 Financials | Key-figure table with sparklines, newest year first, currency and period end shown | Years not filed: `partial` "2024 not filed". EE reports filed as PDF: "Filed as a PDF, figures not machine-readable · open the filing". US private: `not_published`. US public, before the SEC user agent is set: `not_checked{needs_key}` |
| S07 Workforce | Latest headcount plus a 24-month line where monthly or quarterly data exists | All Baltic rows: CAVEAT with the source's cadence. EE at 26.9%: if LATER, the section shows "Not checked in this version", never blank. US: CAVEAT "Headcount from 2020-21 loan data only" (S07.US.01) |
| S08 Taxes and arrears | Risk signal: arrears as a check line ("Not on the tax arrears list as of [date]", or the debt with amount and date), then taxes paid by year | LV debt amount: `manual_lookup`. LV taxpayer rating: shown verbatim as "Tax authority's rating: [value]" with the authority's own explanation, never restyled as our score. EE: depends on the share-alike ruling (below). US: the whole section collapses to "The US publishes no tax payment or tax debt data" |
| S09 Insolvency, pledges, notices | Risk signal: each check is a line, with an event list (newest first) when something exists | US: "Checked UCC filings in Colorado and Connecticut: none found. Other states not checked." The checks must never read as national. PACER: `paid_only`. FJC bankruptcy data has no debtor names, so it gets no row |
| S10 Courts | Mostly agent-only | Instant profile: "Not checked here: the legal agent searches the court portal", with an Investigate action (LT, EE, LV). US federal name matches: "Possible match by name, needs review", never asserted |
| S11 Sanctions and watchlists | Risk signal: a compact checklist, one line per list with its date (`checked_none`), and the §3.11 outcomes on a hit | EE national list (names only, no ID): a hit can only ever be "Possible match, needs review". PEP: `needs_key`, plus "A licensed dataset, connected with your own key" |
| S12 Public money | Totals per year plus the top contracts and projects; neutral styling, never a risk colour | Nothing found: `checked_none`, still neutral. TED: CAVEAT "Contracts above EU thresholds only" |
| S13 Filings and events | A filings timeline | LT non-filer lists and missed deadlines become a check line ("2025 annual report not filed; deadline passed") that feeds S18. US: 8-K item 5.02 as "Officer change (8-K item 5.02)" |
| S14 Securities | US public: insider trades with a net buy and sell bar per quarter | Baltic: "Listed on [venue] since [date]" from the instrument register; prices `needs_key`. Companies with no listing get no row (optional field) |
| S15, S16 Web, news | Agent-only; the instant profile shows "Found by agents" with an Investigate action | Social links from the company's own site: links only. News: name collisions appeared in 3 of 5 hit sets, so a news item is labelled "Mentions the name; not confirmed to be this company" unless the agent ties it to the code or domain, and an unconfirmed item can never be a key finding. Reviews and platform data (S16.ALL.03, S16.ALL.04): no row at all |
| S17 Network | One hop in the network explorer, people behind the purpose gate | The edge style shows how sure a link is. Solid: "Same person (register identifier)" (EE hash, US insider CIK). Dashed: "Probably the same person (name and partial code)" (LV). Dotted: "Same name only" (US states). LT: shared addresses only, with "This address hosts [n] companies" and the list collapsed after 20 |
| S18 Score inputs | The check list (None found / Flagged / Not checked) that feeds the verdict's coverage line | US: CAVEAT "The US has no public tax-debt or payment-default data", so US coverage counts fewer applicable checks |
| OUT.US.01 | HIDE: no row, no API field, no export | Negative-tested |

### Agenda items with a UI side

- **Share-alike storage (EE S07, S08, S09, S12).** **Designer recommends the separate share-alike storage class over agent-only.** Agent-only would take the EE tax-debtor check, a primary-job risk signal, out of the free instant profile. In the UI the values look the same, with a "CC BY-SA" licence chip. Exports leave them out and say so: "3 values under a share-alike licence are left out of this export; see the Sources page".
- **Struck-off EE companies searchable.** **Designer recommends yes, at least identity and status.** For the "is this company real?" job, "Removed from the register in 2021" is the answer the user needs. Without it, search shows "No match", which reads as "maybe it's new".
- **US live state queries.** The section chip says "Fetched live from the [state] register · 2 min ago". The first open shows the loading state, and a failure shows the error state with Retry. In search, live states stream in as their own result group ("Searching NY, CO, OR, CT, PA, WA"), while bulk-loaded states answer instantly. A US search with no match lists the registers that were checked, so "No match" never means "no such company in the US".
- **Kill-criterion flags.** The coverage strip carries each country's promise honestly: LT "People: roles only", US private "Owners, financials: not published in the US", EE "Workforce: partial". If the council re-scopes a country, the strip and the Sources page are where that shows.
- **Markets.** Fund proxies: CAVEAT "via a US-listed fund, in USD, includes currency moves", with the fund symbols kept in local settings only. Taiwan peak: **designer prefers seeding once from a cited figure.** A peak "since first run" shows a 0% drawdown on day one, which reads as "no crash" and is wrong.

## 10. Layout facts from the Baltic research (`baltics.md`, UI facts)

Measured facts that set layout rules for the screens:

- **Long names.** The longest legal names run to 205 (LT), 192 (LV) and 320 (EE) characters; LV's p95 is 66. The company H1 wraps to at most 3 lines and then truncates with the full name in a tooltip and in the identity block. Search results clamp to 2 lines. Mockups include a 200-character fictional name.
- **People tables are short.** Officers per company: p50 1, p95 2 to 3, max 27 (LV); LT boards reach 33. Tables show 8 rows, then "Show all [n]".
- **"Which company?" is mostly a Lithuanian question.** Normalised names collide for 6.6% of active LT companies, 0.82% in LV and 0.1% in EE. Search results and the entity-choice card therefore always show the distinguishing facts: registry code, legal form, status, city and registration year.
- **Register words plus a gloss.** LT statuses and legal forms have official English labels; LV legal forms are Latvian only. The pill shows the register's own word with an English gloss, for example "SIA · limited company" or "Likviduojamas · under liquidation". It never shows our paraphrase alone.
- **Money edge cases.** 410 active LV companies last filed in lats (pre-2014): the figure keeps its currency, labelled "LVL (before the euro)", and is never silently converted. Statements filed in thousands are scaled, with a "Reported in thousands" note. 7.3% of LV and 1.7% of LT companies have a non-calendar fiscal year, so column headers name the period end ("FY to Jun 2025"), not just a year.
- **Deep links.** LV has a free per-company register page; LT has no per-company register page, so the chip links to the open-data record instead. Attribution lines are proposed by data-baltics (no publisher states a wording); the footer uses them.
- **Sole traders are a page variant.** LT has 166,087 individual enterprises and LV 12,146 sole traders. Under legal rules 5 and 6 a sole trader is a natural person. Their company page uses the "Facts only" variant: no verdict block, the disclaimer at the top, people data behind the purpose gate, and the Investigate sheet says that the run will report facts, not a verdict. This is a screen state (`?subject=sole-trader`).
- **History depth.** LV financials go back to FY 2006 (median 10 years per company); LT statements from 2015; LT tax arrears and social-insurance debts exist for today only, so history comes only from our own snapshots ("Tracked by Finora since [date]").
