# Display options for council session 1

> Designer's advice to the council, written before the display matrix and the legal memo are final. It offers **ways to show** each data item; the council decides **whether** to show it. Where the research changes a fact, the research wins and this page is updated.

The council's decision for each item (show / show with caveat / hide / later) maps onto one of the display states below. Picking the state also picks the UI, so a builder never has to invent one.

## 1. The display states

Every field in every section, for every country, ends in exactly one state. Empty space is never a state: if we have nothing, the UI says why.

| State | When | How it looks | Wording pattern |
|---|---|---|---|
| **Full** | Official source, loaded, fresh | Value in primary ink, source chip at the end of the row | the value |
| **Partial** | Some fields or years missing, or only a subset of the population (e.g. only filers above a threshold) | Value shown, plus a dotted underline; hover or tap explains the gap | "3 of 5 years published" |
| **Stale** | Source older than its expected refresh interval | Value shown, date chip turns amber | "as of 14 Mar 2026 (source not updated for 40 days)" |
| **Caveat** | Council says "show with caveat" | Value shown; a short caveat line in muted text right under it, never in a tooltip only | "Self-reported by the company, not audited" |
| **Not published** | The country has no official source for this item | Muted row, dash icon, one line naming the gap | "Lithuania does not publish company officers" |
| **Not shown** | Data exists but law or policy keeps it out (council "hide") | Muted row, lock icon, one line with the reason and a link to the policy page | "Not shown: restricted by a 2026 court ruling" |
| **Later** | Council "later" | Not rendered in the report at all; listed once on the coverage page | none in the report |
| **Loading** | Source query in flight | Skeleton bar the width of a typical value; the agent card shows the live step | "Querying the register" |
| **Error** | Source failed, timed out or was rate-limited | Muted row, warning icon, retry button | "Register did not answer. Retry" |
| **Agent finding** | Came from an agent reading the open web, not an official record | Value with a source chip whose kind is "web", and a confidence badge | the finding, always with its citation |

Rules that follow from this:
1. "Not published", "Not shown" and "Error" look different on purpose. A user must be able to tell "nothing bad found" from "nobody checked" from "we may not show it".
2. A section where every field is "Not published" collapses to one line ("Lithuania publishes no ownership data") instead of a block of dashes.
3. The country coverage strip (section 4) tells the user up front what this country can and cannot give.

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

### 3.1 Company basics (name, codes, status, address, activity, dates)
- A. Header block: name, status pill, country flag-free code (`LV 40003…`), registered date, activity, address.
- B. A plus a timeline of status changes (renamed, re-registered, liquidation started).
- **Rec: B.** Status history is where the risk lives (renames after trouble, recent re-registration).
- Status pill wording is the register's own, translated, never our judgement: "Active", "In liquidation", "Removed from register".

### 3.2 People in the company (officers, board, signatories)
- A. A "People" table inside the company page: role, name, since, until. No links to a person page.
- B. A, plus "also officer in N other companies" as a count that opens the network explorer scoped to this company.
- C. Standalone person pages.
- **Rec: B.** C is out: the feasibility research flags standalone person profiles as the main GDPR risk. Personal codes, even masked ones, are never shown. People never appear in search results or the library as subjects; search finds companies.
- Per country: LT shows "Not published" for names; US shows people only where a filing names them (filing chip says which form).

### 3.3 Shareholders and beneficial owners
- A. Ownership table: holder, share %, since. Companies and people mixed, with a type icon.
- B. A, rendered as a small ownership tree when there are layers.
- **Rec: A in the report, B in the network explorer.** Expect many "Not shown" rows here (restricted shareholder and owner data in parts of the EU). The "Not shown" line must name the reason so the user knows to request an official extract.

### 3.4 Financial statements
- A. Key figures table (revenue, profit, equity, assets, employees) by year, newest left.
- B. A plus a sparkline per figure and a year-on-year change with arrow and sign.
- C. Full statements (every line item) behind "All line items".
- **Rec: B, with C behind a disclosure.** Currency and the period end date are always shown. Missing years are "Partial", not zero. Never colour alone: every change has a sign and an arrow.

### 3.5 Employees and salary
- A. Latest headcount with the quarter or month.
- B. A plus a 24-month line.
- **Rec: B where the source is monthly or quarterly (LT, LV, EE); A for US (annual report text, "Caveat: from the annual report").** Average salary only where officially published and only for companies above a minimum headcount (council to set; small companies leak individual salaries).

### 3.6 Taxes paid and tax debts
- A. Taxes paid per year; tax debt as a flag with amount and "as of" date.
- **Rec: A.** A tax debt is a red-flag finding with the debtor-list source chip. When a debt disappears from the list, show "No longer on the debtor list since …" for a limited window (council to set), then drop it.

### 3.7 Insolvency, pledges, securing measures, court cases
- A. An "Events" list, newest first: date, type, status, amount if any, source.
- **Rec: A**, with each event's status in the register's words ("Proceedings closed"). Court cases name parties that are companies; natural-person parties are masked as "a private individual".

### 3.8 Public contracts and EU funds
- A. Totals per year plus the top five contracts or projects with buyer and value.
- **Rec: A.** Positive signal; usually green-neutral, never a risk colour.

### 3.9 VAT status
- **Rec:** one row in the header block: "VAT registered since …" or "Not VAT registered". US: the row is not rendered (n/a, not "Not published").

### 3.10 Legal entity identifier and parent companies
- **Rec:** LEI in the codes row; parent and ultimate parent as the first ring of the network.

### 3.11 Sanctions and watch lists
Three outcomes only, and the UI never says "sanctioned" from a fuzzy match:
- **No match** across the named lists (each list listed, with its as-of date).
- **Possible match: needs your review**: a question card to the human (section 5), showing both records side by side with the matching fields highlighted.
- **Confirmed match**: only on an exact identifier match (registration code, LEI) or after the human confirms.
- **Rec:** this exact pattern. It doubles as the clearest "agent asks the human" moment in the product.

### 3.12 US securities filings (insider trades, 5% holders, officer changes)
- A. A filings timeline with form type chips (3, 4, 5, 13D/G, 8-K 5.02).
- B. A plus a net insider buying/selling bar per quarter.
- **Rec: B for public companies.** "CEO left" style events come from 8-K item detection and are labelled with the item number.

### 3.13 Open web: news, reviews, social, website and domain
- Display-only where terms forbid storing: the report keeps our summary sentence and the link, not the third-party text. The chip says "display only, not stored" and the excerpt is re-fetched on open, or replaced by "Open source to read".
- Review platforms: aggregate rating and count only where the platform's terms allow it; otherwise only the link.
- Domain: registered date versus company registered date is a good one-line finding ("Domain registered 3 years before the company").
- **Rec:** these are agent findings with "Single source" or "Corroborated" confidence, never "Official".

### 3.14 Red flags
- A list of named checks, each with Pass / Flag / Could not check, so the user sees what was checked, not just what was found.
- **Rec:** this list, with the check definitions published (transparent scoring is a stated product goal).

### 3.15 The verdict
The prototype used "Go / Caution / Avoid". Options:
- A. Keep a three-step verdict on the company, worded as a research outcome: **"No concerns found" / "Points to check" / "Serious concerns"**, always followed by "based on N sources, checked on DATE".
- B. No verdict, only key findings.
- C. A numeric score with published weights.
- **Rec: A now, C later** once the weights are agreed. Never a verdict on a natural person or sole trader (FCRA and defamation risk pending the legal memo); for those the report shows findings only. Every key finding links to its evidence.

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

Each question shows which agents are waiting on it, and has a default the run takes after a timeout, so an unattended run still finishes.

## 6. Crash monitor tiles

The tile states depend on the markets research. Expected options:

- **Official only:** US national debt (live), rates and macro. Fully shown.
- **User key connected:** price-based tiles (indices, gold, oil, crypto) show live or delayed values with the provider in the chip.
- **No key:** the tile shows its shape with no numbers and a "Connect a data source" action. Never a fake or cached number.
- **Delayed:** value with a "15 min delayed" style chip.

Every tile shows its source and "as of" time, like every report finding.

## 7. Questions for the council

1. Verdict wording and scale (3.15): accept "No concerns found / Points to check / Serious concerns"?
2. Minimum headcount before showing average salary (3.5)?
3. How long a cleared tax debt stays visible (3.6)?
4. Are natural-person court parties masked in all four jurisdictions (3.7)?
5. Is "also officer in N other companies" (3.2 B) acceptable, or only inside the network explorer?
