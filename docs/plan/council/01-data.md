# Council session 1: data (2026-11-20)

Posted by the `council` seat on the hub; committed by the coordinator. The council's technical member's calls are in `01-data-cto.md` and are adopted unchanged. Part G at the end is the coordinator's expansion of Part D into one row per `item_id`, for the council to confirm.

**How the decision was made:**
- Panel: CEO, CFO, CPO, CMO, COO, each convened in isolation, then critic and synthesis. The CPO seat failed once on a usage limit and was re-run in isolation. All five returned.
- Advice taken from: cto (`01-data-cto.md`), legal (its reviews recorded there), designer (`docs/design/display-options.md` §9-§10).
- Legal lights are derived from `docs/research/legal.md`, per council session 0 amendment 1. Not legal advice.
- cto's feasibility calls are adopted unchanged: narrow facts, 5 fiscal years, tombstones, the share-alike switch, US live queries, FL LATER, markets cadence, company-to-company S17.

## Part A: the v1 promise per country (kill-criterion flags)

The primary-job sections for the kill criterion are S01, S02, S03, S06, S08, S09 and S11.

| Country | v1 promises | Structural gap, and how it shows |
|---|---|---|
| LV | The full counterparty check | Beneficial owners: lock. Tax-debt amounts: "Check manually at [official site]". Rating C is the proxy |
| EE | The full check, including the daily tax-debtor list | Beneficial owners: lock. Workforce: CAVEAT, pending a recount |
| LT | A money and status check: financials, taxes, daily tax arrears and insolvency in the instant profile; social-insurance debts and insured counts when you investigate (Part H, Sodra) | Names of officers and owners: `paid_only`. "Names are not in Lithuania's open data. Available as a paid register extract", with a link to the register's own ordering page only. Never "Not published": the register holds them |
| US public | Identity, filings, officers and insiders, financials, insider trades | Needs `SEC_USER_AGENT`. Without it, the profile is `needs_key` and promises nothing |
| US private | "Is it registered and in good standing in NY, CO, CT or PA?" plus federal exclusions and sanctions | Owners, accounts, tax: "No US source publishes these for private companies". The verdict is normally "Not enough data" unless a hard flag fires |

**Coverage line on every profile, before any result** (CMO copy): "[Country]'s official data: ... Not in open data: ...".

**README and every public surface:** drop the parenthetical list after "everything official data says". The promise is "what each country's official registers publish, with every gap named".

**Reasons:** these are facts of the sources, not loader gaps (cto: no build effort raises them). Saying so up front is what keeps trust (CEO, CMO).

**Dissent:** the CEO doubts US private more than the others. The 100% identity fill is circular, because the samples were drawn from the registries we query; the live states hold about 16% of US small businesses.

**What would change it:**
- **US private** (the CEO's test, adopted for the milestone): draw 10 US private companies from a national list. If fewer than 5 match a registry ID, US private leaves v1, and search says "US private companies: not covered in v1".
- **EE workforce:** the recount in Part F.

## Part B: the verdict, one scale for every country

**A fixed 11-check list, the same in every country** (CPO, CMO; overrules designer §9's "fewer applicable checks" for the US):
1. Pinned to a registry record
2. Status current and active
3. Officers on record
4. Owners on record
5. Accounts filed (renamed from "Accounts filed on time" in phase 3: "on time" would claim a deadline we only estimate)
6. Financial position (equity, result)
7. Tax and social-insurance arrears
8. Insolvency, liquidation, pledges and securing measures
9. Sanctions and watchlists
10. Court cases (agent)
11. Web presence consistent with the register (agent)

A check that a country can't run counts as **not run**. The coverage line reads "7 of 11 checks ran · 2 not possible in [country]".

**"Not enough data"** replaces only "No concerns found"; flags always show. It fires if any of these holds: the company is not pinned to a registry ID; its status is not current; fewer than 6 of the 11 checks ran; neither money check (6 or 7) ran.

**Thresholds** (CPO, from the debtor lists of 19 Nov):
- **Tax and social arrears:** under EUR 100: a fact, no flag. EUR 100-4,999, a payment plan or deferral, or LV rating C: **Points to check**. EUR 5,000 or more unscheduled, or EUR 1,000 or more with the oldest claim at least 180 days old: **Serious concerns** (LT applies the age rule once our snapshots cover 180 days). In LV, tax data alone never reaches Serious; a tax-authority activity suspension does.
- **Hard flags (Serious concerns):** insolvency or bankruptcy proceedings, liquidation, struck off, a confirmed sanctions entry, a tax-authority activity suspension, the arrears threshold above.
- **Soft flags (Points to check):** accounts overdue; negative equity; an open pledge or securing measure; a possible sanctions match the human marks "not sure"; renamed or re-registered in the last 6 months (from our snapshots). The final soft list goes into the verdict rule table in phase 3.
- **Cleared tax debt** (designer Q2): "No longer on the debtor list since [date]" for 12 months, only for debts that reached EUR 100. A fact, not a flag.

**Sole traders and natural persons** (designer §10; legal rules 5 and 6): the facts-only variant. No verdict block ("Facts only: no verdict is given on a private individual"); the disclaimer at the top; people data behind the purpose gate; driven by `isNaturalPerson`.

**Reasons:** one scale over uneven evidence is the CEO's top risk. "5 of 5 checks ran" for a US private firm would be an overclaim written as a number (CMO).

**Dissent:** designer §9 counted fewer applicable checks for the US. Overruled, because it lets US private reach "No concerns found".

**What would change it:** at the session 3 demo, LV or EE companies routinely land on "Not enough data". Then the threshold moves to 5.

## Part C: calls per section

Legal lights follow the rule: any natural-person register data is at least Y (rule 2), so at most CAVEAT, behind the purpose gate, in company context, with the rule 6 disclaimer.

| Section | Default call | Exceptions | UI (designer §9 unless noted) |
|---|---|---|---|
| S01 Identity | SHOW | US.01 SHOW once the SEC key is set (`needs_key` before). US.03 split: PA CAVEAT, OR LATER until its licence is recorded. US.04 FL LATER (licence unverified). US.05 CA, DE `paid_only`. US.06 SAM LATER (0/10). US.07 licences CAVEAT, shown only for carriers, brokers and contractors | Header block. LEI and VAT are optional fields, shown only when present |
| S02 Status | SHOW | US.02 CT CAVEAT (dataset licence partial). US.03 FDIC SHOW, banks only | Status pill in the register's words. History: "Tracked by Finora since [date]" (our snapshots, Part E) |
| S03 People | CAVEAT (Y, rule 2) | LT.01 SHOW for the published roles ("has a manager since [date]", board yes/no); names `paid_only`. Gender dropped at load. US.04 DEF 14A LATER | Purpose gate, then a role table. LV, EE: "Current roles only; past roles are not published". Codes and hashes are never shown |
| S04 Owners | CAVEAT (Y) | LV.02, EE.02 beneficial owners HIDE + lock (rule 1). LV.03 joint-stock HIDE + lock keyed on legal form. LV.01: natural-person members locked until legal answers "?"; corporate members shown. LT.01 LATER + `paid_only` gap. US.01, US.02 CAVEAT (13D/G, 10% owners; often natural persons, so behind the purpose gate). US.03 not published | Holder table. A corporate member links to that company (this replaces S05 for v1) |
| S05 Group | LATER, all rows | none | Parents show through S04 corporate members; the LEI shows in S01 |
| S06 Financials | SHOW | US.01 SHOW once the SEC key is set. US.02 FDIC SHOW, banks only. US.03 not published | Key figures for 5 years, newest first, currency and period end shown. "2024 not filed" is `partial` |
| S07 Workforce | CAVEAT | Average salary LATER; when it ships: LT 4 or more insured, LV 10 or more, EE never. US.01 PPP LATER (2020-21). US.02 FMCSA SHOW, carriers only. EE.01 CAVEAT, pending the recount (Part F) | Latest headcount and a 24-month line |
| S08 Taxes and arrears | SHOW | LT.02 social-insurance debts CAVEAT ("no licence stated by the publisher"). LV.01 CAVEAT: taxes paid 56%; rating shown verbatim as "Tax authority's rating: [value]"; debt amount `manual_lookup`. EE.01 SHOW for debtors through the share-alike store; taxes paid CAVEAT (39.1%). US.01 not published | An arrears check line, then taxes by year. US: the section collapses to one line |
| S09 Insolvency, pledges | SHOW | LT.01 CAVEAT (bankruptcy reports lag to 2025-10). EE.01 SHOW for status and pledges; EE bankruptcy notices LATER (status carries the signal; natural-person notices HIDE). US.01 CAVEAT "Checked UCC filings in CO and CT only". US.02 FJC LATER, no row. US.03 PACER LATER, `paid_only` | Check lines, plus an event list |
| S10 Courts | CAVEAT, agent only | US.01 FJC civil: shown only after an agent confirms the match, as "possible match, needs review". US.02 P2 court-data service CAVEAT, on demand (free token, 125 a day); also searches US bankruptcy names, as possible matches only | Instant profile: "Not checked here: the legal agent searches the court portal". Natural-person parties are masked as "a private individual" in all four countries |
| S11 Sanctions | SHOW | ALL.05 UN CAVEAT (live, not stored). LT.01, LV.03, EE.01, EE.02 CAVEAT: agents fetch and cite live, nothing stored; LT.01 is the only list naming Baltic companies by code (legal "?" below). LT.02 CAVEAT (domain check by the web agent). US.03 FINRA CAVEAT, broker-dealers only. US.04 enforcement feeds CAVEAT: a name match needs agent confirmation. ALL.04 PEP LATER | One line per list with its date. A hit needs a second identifier and becomes a question card (§3.11) |
| S12 Public money | LATER, all rows | none | No row. It never changes a go/no-go call (1-4% of companies); it also removes the EE procurement share-alike row |
| S13 Filings | SHOW | US.01 SHOW once the SEC key is set, with 8-K item 5.02 as "Officer change (8-K item 5.02)". US.02 CAVEAT (40% fill). US.03 CT CAVEAT | Check lines for "Accounts filed" and "last filing". A material-events list. The full document timeline is LATER |
| S14 Securities | LATER | US.01 insider trades CAVEAT: company context, net buys and sells per quarter, a link per filing, names behind the purpose gate. US.02 tickers SHOW. LTLVEE.01 SHOW as one "Listed on [venue] since [date]" row. LV.01, EE.01: no row | |
| S15 Web | CAVEAT, agent only | EE.01 register website SHOW as an optional field. LV.01 LATER | "Found by agents". Domain age against company age. Registrant code matched at query time only (WHOIS is never stored) |
| S16 News | LATER | ALL.01 news CAVEAT, as a sub-task of the web agent, labelled "Mentions the name; not confirmed to be this company" unless tied to the code or domain; never a key finding. ALL.04 HIDE (X). US.01 is covered by S11.US.04. LV.01, EE.01: no row | |
| S17 Network | CAVEAT, company-to-company only | Person-to-person links LATER, pending a lawyer (cto withdrew the HMAC key): US.01, US.02, and any "also officer in N other companies" count. LT.01 CAVEAT for shared addresses | "This address hosts [n] companies", list collapsed after 20. Caveat: "A shared address can be an office building or a registered-agent address" |
| S18 Score inputs | SHOW | LT.02, US.01 CAVEAT | The 11-check list from Part B |
| OUT | US.01 HIDE. US.02, US.03, US.04 LATER | | No row. US.01 is never loaded and is negative-tested |

**OUT.US.01:** 52 U.S.C. 30111(a)(4) says the copied information "may not be sold or used by any person for the purpose of soliciting contributions or for commercial purposes". It restricts use, not publication. The donors are natural persons, and no job needs them. HIDE.

**Markets (M01-M09):**
- **Drawdown %:** SHOW for every tile with data. Each tile shows its as-of time. cto's cadence applies: stocks hourly, crypto every 5 min, official daily.
- **"Market cap lost":** shown only where the source's terms allow it and are quoted. Otherwise the tile shows drawdown only (legal: LAWYER).
- M07, M08: SHOW. M08 is labelled "ticker is an estimate".
- M01.X.01, M05.X.01: CAVEAT ("quarterly; includes non-listed equity", "monthly average").
- **M01.X.02, M02, M03.X.02, M04: CAVEAT, `needs_key`.** Fund proxies are accepted, titled "[Region], in USD". Caveat: "Via [your symbol], a US-listed fund. In US dollars: includes currency moves and fund fees. Not the index." With no symbol set: "Choose a fund in settings", and no number. Real tickers live in local settings only; fixtures use fictional ones.
- **M03.X.01: CAVEAT.** Taiwan's peak is seeded once from a cited official figure if legal clears it. Until then: "Peak not known yet: tracking since [date]", with no %, never 0%.
- **M05.X.02** splits: oracle LATER; user key CAVEAT.
- **M06.X.01** splits: O5 oracle LATER; O3 supply plus X4 candles CAVEAT ("self-hosted, personal use").
- **M06.X.02:** CAVEAT ("personal use; attribution").
- **M09:** LATER. Trigger: the human asks for macro tiles at a demo.

**Designer §8 questions:** Q2 salary: see S07. Q3 cleared debt: see Part B. Q4 court parties: natural-person parties are masked in all four countries. Q5 "also officer in N other companies": LATER; every version needs a person-to-person link, which legal ruled out pending a lawyer. If a lawyer clears it, ship the CPO wording first: "Current officers also hold roles in N companies now insolvent or in liquidation". Q6 purpose gate: see Part E.

## Part D: the machine-readable item table (council's rule form)

Empty-state keys:
- **NP** = "Not published in [country]"
- **CN** = "Checked [source] as of [date]: none found"
- **NC** = "Not checked"
- **PAID** = "Available as a paid register extract" (official order link only)
- **LOCK** = "Not shown in [country]: restricted by [rule]"
- **KEY** = "Add your key to check"
- **MANUAL** = "Check manually at [official site]"
- **AGENT** = "Not checked here: [agent] checks this when you investigate"
- **—** = no row (optional field or HIDE)

Every CAVEAT also carries "Missing does not mean clean." where the item is a check.

**Id splits:** S01.US.03 → PA and OR; M05.X.02 → oracle and user key; M06.X.01 → O5, and O3 + X4; S08.EE.01 → debtors and taxes paid. The coordinator assigns the new ids in Part G.

| item_id | call | caveat text | empty-state |
|---|---|---|---|
| S01.LT.01, S01.LV.01, S01.EE.01, S01.US.02, S01.ALL.01, S01.ALL.02 | SHOW | - | NP (LEI, VAT: — when absent) |
| S01.US.01 | SHOW | - | KEY ("needs the SEC contact setting") |
| S01.US.03 (PA) | CAVEAT | Pennsylvania register: licence partly stated | NC |
| S01.US.03 (OR), S01.US.04, S01.US.06 | LATER | - | — |
| S01.US.05 | LATER | - | PAID ("No free register in [state]") |
| S01.US.07 | CAVEAT | Licence data for carriers, brokers and contractors only | — |
| S02.LT.01, S02.LV.01, S02.EE.01, S02.US.01 | SHOW | - | NP; history: "Tracked by Finora since [date]" |
| S02.US.02 | CAVEAT | Connecticut filing history: licence not stated on this dataset | NC |
| S02.US.03, S06.US.02 | SHOW | - | — (banks only) |
| S03.LT.01 | SHOW | - | PAID (names) |
| S03.LV.01, S03.EE.01, S03.US.01, S03.US.02, S03.US.03 | CAVEAT | Current roles only; past roles are not published. People appear only in this company's context | needs_purpose; then NP |
| S03.US.04 | LATER | - | — |
| S04.LV.01 | CAVEAT | Members who leave are not published. Natural-person members: LOCK until legal answers | LOCK / NP |
| S04.EE.01 | CAVEAT | Private limited company members only; public limited company shareholders are held by the securities depository | NP |
| S04.US.01, S04.US.02 | CAVEAT | Large holders as filed with the SEC; people appear only in this company's context | KEY / needs_purpose |
| S04.LV.02, S04.EE.02, S04.LV.03 | HIDE | - | LOCK (rule 1) |
| S04.LT.01 | LATER | - | PAID |
| S04.US.03 | LATER | - | NP ("No US source publishes owners of private companies") |
| S05.* (LT.01, LV.01, EE.01, US.01, ALL.01) | LATER | - | — |
| S06.LT.01, S06.LV.01, S06.EE.01 | SHOW | - | NP; "[year] not filed" |
| S06.US.01 | SHOW | - | KEY |
| S06.US.03 | LATER | - | NP ("No US source publishes accounts of private companies") |
| S07.LT.01 | CAVEAT | Insured count from the social-insurance fund; no licence stated by the publisher | NP |
| S07.LV.01 | CAVEAT | Employees from tax filings, quarterly; covers 54-58% of active companies | NP |
| S07.EE.01 | CAVEAT | Quarterly, from the tax board (CC BY-SA) | NP; "0 employees reported" if the recount confirms |
| S07.US.02 | SHOW | - | — (carriers only) |
| S07.US.03 | CAVEAT | From the annual report (self-reported) | KEY |
| S07.US.01 | LATER | - | — |
| S08.LT.01 | SHOW | - | CN |
| S08.LT.02, S18.LT.02 | CAVEAT | Social-insurance fund; no licence stated by the publisher | CN |
| S08.LV.01 | CAVEAT | Taxes paid for 56% of active companies; debt amounts are not open data | MANUAL (amount); CN (rating) |
| S08.EE.01 (debtors) | SHOW | - | CN |
| S08.EE.01 (taxes paid) | CAVEAT | Taxes paid for 39.1% of active companies; share-alike licence | NP |
| S08.US.01 | LATER | - | NP ("The US publishes no tax payment or tax debt data") |
| S09.LV.01, S09.EE.01 | SHOW | - | CN (EE: status and pledges; bankruptcy notices LATER) |
| S09.LT.01 | CAVEAT | Bankruptcy reports published up to [month] (the month is taken from the data) | CN |
| S09.US.01 | CAVEAT | Checked UCC filings in Colorado and Connecticut only; other states not checked | CN |
| S09.US.02 | LATER | - | — |
| S09.US.03 | LATER | - | PAID ("Federal bankruptcy dockets: paid, not checked") |
| S10.LT.01, S10.LV.01, S10.EE.01 | CAVEAT | Searched by the legal agent at query time; possible matches need review | AGENT |
| S10.US.01, S10.US.02 | CAVEAT | Possible match by name, needs review | AGENT |
| S11.ALL.01, S11.ALL.02, S11.ALL.03, S11.LV.01, S11.LV.02, S11.US.01, S11.US.02 | SHOW | - | CN |
| S11.ALL.05, S11.LT.01, S11.LT.02, S11.LV.03, S11.EE.01, S11.EE.02, S11.US.03, S11.US.04 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S11.ALL.04 | LATER | - | KEY |
| S12.* (all 11 rows) | LATER | - | — |
| S13.LT.01, S13.LV.01, S13.EE.01 | SHOW | - | NP |
| S13.US.02 | CAVEAT | State filing history, where the state publishes it (40% of samples) | NC |
| S13.US.01 | SHOW | - | KEY |
| S13.US.03 | CAVEAT | Connecticut filing history: licence not stated on this dataset | NC |
| S14.US.01 | CAVEAT | Insider transactions as filed; people appear only in this company's context | KEY / needs_purpose |
| S14.US.02, S14.LTLVEE.01 | SHOW | - | — |
| S14.US.03, S14.LTLVEE.02, S14.LV.01, S14.EE.01 | LATER | - | — |
| S15.LT.01, S15.LV.02, S15.EE.02, S15.US.01 | CAVEAT | Found by an agent; WHOIS read at query time, not stored | AGENT |
| S15.EE.01 | SHOW | - | — |
| S15.LV.01 | LATER | - | — |
| S16.ALL.01 | CAVEAT | Mentions the name; not confirmed to be this company | AGENT |
| S16.ALL.04 | HIDE | - | — |
| S16.ALL.02, S16.ALL.03, S16.US.01, S16.LV.01, S16.EE.01 | LATER | - | — |
| S17.LT.01 | CAVEAT | A shared address can be an office building or a registered-agent address | — |
| S17.LV.01, S17.EE.01 | CAVEAT | Company-to-company links only: shared addresses and corporate members | — |
| S17.US.01, S17.US.02 | LATER | - | — |
| S18.LT.01, S18.LV.01, S18.EE.01 | SHOW | - | NC per check |
| S18.US.01 | CAVEAT | The US has no public tax-debt or payment-default data | NC per check |
| M07.X.01, M08.X.01 | SHOW | M08: "ticker is an estimate" | NC |
| M01.X.01, M05.X.01, M03.X.01, M06.X.02, M06.X.01 (O3+X4), M05.X.02 (user key) | CAVEAT | as in Part C | NC / "Peak not known yet: tracking since [date]" |
| M01.X.02, M02.X.01, M03.X.02, M04.X.01 | CAVEAT | Via [your symbol], a US-listed fund. In US dollars: includes currency moves and fund fees. Not the index | KEY / "Choose a fund in settings" |
| M05.X.02 (oracle), M06.X.01 (O5), M09.X.01 | LATER | - | — |
| OUT.US.01 | HIDE | - | — (never loaded) |
| OUT.US.02, OUT.US.03, OUT.US.04 | LATER | - | — |

## Part E: the policy table (COO)

Session 2 rejects a plan that lacks any of these rows. Interim values ship as the v1 values until a lawyer answers; nothing is upgraded without that answer. No hosted build while any publication-related LAWYER item is open.

| policy_id | Rule | Config and interim value | Proof (test) | Owner |
|---|---|---|---|---|
| P1 | Share-alike data lives in its own store: never merged, exported or served in bulk. Now only S07.EE.01 and S08.EE.01 | `SHARE_ALIKE_MODE=store`, switchable to `live-no-store` | cto's negative tests: no share-alike row in the main store or in exports; no write, cache or log line in `live-no-store` | architect, qa |
| P2 | Purpose gate (rule 2): asked once per session from a fixed list (the session ends at app restart or after 12 h). A log row for every company whose person data is opened. API and MCP require a purpose on every call | `PURPOSE_SESSION_HOURS=12` | 3 companies in one session → 3 log rows; after 12 h + 1 min → `needs_purpose` again | architect, qa |
| P3 | No personal codes, ever: masked LV codes, derived birth dates or ages, the EE person hash, gender. Dropped at load | - | A canary code and birth-date pattern scanned across DOM, API, MCP, export and agent output | architect, qa |
| P4 | Ended person roles are not retained. "A board member's role ended on [date]" is a company-level event, with no name | `PERSON_ROLE_RETENTION_DAYS=0` (LAWYER) | TTL test with a fake clock | cto, legal |
| P5 | Natural-person cache TTL (rule 11) and US live cache: re-fetch after 24 h, purge entries not viewed in 30 days | `PERSON_DATA_TTL_DAYS=30` (LAWYER) | purge test: day 29 survives, day 30 is deleted | cto, qa |
| P6 | Facts-only variant for natural persons and sole traders | `isNaturalPerson` | no verdict block; disclaimer present | frontend, qa |
| P7 | Blocked uses for natural persons and sole traders: credit, employment, insurance, tenancy, licensing, credit servicing. Excluded from the purpose list and stated in the terms | - | refusal test on UI, API and MCP; footer links the terms | architect, legal |
| P8 | HIDE holds on the agent path too: agent output is filtered for HIDE item types, personal codes and natural-person court parties before display | - | canary test with an agent fixture that "finds" a beneficial owner and a code | data-osint, qa |
| P9 | Our own snapshots: company-level change events (name, address, status, legal form), debtor-list entries and exits (LT, EE), identity-only EE tombstones. No full daily copies. LT arrears: only on-list and off-list events are stored | `HISTORY_MAX_GB=1` | health check: last run ≤ 48 h; size under the cap | cto |
| P10 | Store budgets from cto (LV ≤ 2.5 GB, EE ≤ 3 + 0.25 GB, LT ≤ 2 GB, cross-border ≤ 1 GB, total ≤ 10 GB); first load ≤ 30 min; each country searchable as soon as its register lands | - | loader acceptance tests on the named machine profile | cto |
| P11 | Each state's live query is blocked until its licence is recorded in the source registry (recorded: NY, CO, CT, PA; OR and WA LATER, register C11) | - | slice gate; the licence invariant fails CI for a source without a licence id | coordinator |
| P12 | Fund tickers live in local settings only | - | the guard; fixtures use fictional symbols | architect |
| P13 | LAWYER register: id, question, affected item_ids, interim value, config key, test. CI fails on a `[pending: lawyer]` with no register row | - | CI | legal |

## Part F: open items

**For `legal` (the only real "?" rows):**
1. S04.LV.01: does rule 1 cover natural-person members of private limited companies? Interim: LOCK.
2. S11.LT.01, S11.LT.02 (gambling list), S11.EE.01, S11.EE.02: no licence is stated. Is a live, cited, not-stored check at query time fine? Interim: CAVEAT live only.
3. S15: the .lv and .ee WHOIS purpose clauses, and the web archive's terms, for a due-diligence lookup at query time. Interim: CAVEAT live only.
4. P7: confirm that the FCRA-based blocked uses apply to natural persons and sole traders only. A COO flag: blocking "investment" everywhere would clash with US public-company research.

**For `data-baltics`:** recount S07.EE.01. Does the quarterly file list every taxpayer, so that 26.9% is the share with staff rather than missing data? If so, "0 employees reported, [quarter]" is a shown fact, and the call stays CAVEAT.

**For the human, at the first session 3 demo (not now):** which country's companies do you actually pay or sign with each week? The CEO's challenge: if it isn't the US, US private is the first thing to cut.

## Where the seats disagreed

- **Coverage denominator:** the designer counted fewer applicable checks for the US; CPO and CMO want one fixed list. **The fixed list wins** (Part B).
- **LT names:** CPO and designer said "Not published"; CMO said `paid_only`, because the register does hold them. **`paid_only` wins**, verified in `baltics.md`.
- **"Also officer in N other companies":** the designer wanted a count; CMO wanted ID-based links only; CPO wanted only links to insolvent companies. **LATER for all:** legal blocks person-to-person links pending a lawyer, and the CMO's ID-based version relied on the EE hash, which is now HIDE.
- **Retention of ended roles:** COO wanted an interim of 35 days; legal and cto said 0. **0 wins** (gate 1). COO dissent recorded.
- **Years of financials:** CFO wanted 3; cto 5. **5 wins**: cto's narrow facts make the difference about 0.35 GB.
- **S14 US insider trades:** CPO wanted LATER (it serves an investor job); the CEO puts them in the US public promise. **In v1, as CAVEAT in company context**: the data costs $0, fill is 100%, and S03 and S04 already load Forms 3/4/5. CPO dissent recorded.
- **S16 news:** CPO wanted LATER. **The council keeps it as a CAVEAT sub-task of the web agent**: session 0's yield rule applies per agent, not per sub-task, and the mission requires open-web digging. CPO dissent recorded. **What would change it:** the measured run shows wrong-company news findings; then it goes LATER.
- **S12 public money:** the designer wanted it as a neutral positive signal; CPO wanted LATER. **LATER wins** (gate 3). Trigger: a supplier-vetting template.
- **Purpose gate:** COO wanted once per session; CPO once per day. **Per session, at most 12 h.**

**Domain strays, named:** COO proposed a retention number, which belongs to legal. CEO and CPO questioned a fill-rate measurement, which belongs to data-baltics; it is sent there as a recount. CMO's ID-based network count was overtaken by legal's ruling.

**Suspicious unanimity:** all five seats, cto and the designer chose the share-alike store and US live queries. The agreement rests on measured numbers: under 100 MB, $0, and the EE debtor list is a primary-job risk signal. Legal accepts it only with the config switch, and that switch is P1.

## Part H: changes after the reconciliation round (2026-11-20)

Applied on top of Parts B-E after legal's review and cto's notes. Gate 1 decided the legal ones: legal's light wins. Part G already includes the item changes. Chair rulings; the panel was not re-convened, so no new dissent beyond the notes at the end.

**Item changes**
1. **S03.LT.01 → CAVEAT**, company context, behind the purpose gate: a start date for an identifiable manager is personal data.
2. **S04.LV.01 and S04.EE.01: natural-person members are HIDE + LOCK in both countries** (rule 1, light R). Corporate members are company data and stay shown. Part F item 1 is withdrawn. *What would change it:* legal clarifying "R, company context only" as Y; both rows then return to CAVEAT behind the purpose gate.
3. **S17 address links: registered offices only.** Any address shared with a sole trader or private individual is suppressed, with any count tied to it (S17.LT.01, S17.LV.01, S17.EE.01).
4. **S07.EE.01:** the source never reports "0 employees", so three states replace it (data-baltics' recount, `baltics.md`, `9f973bd`): "N employees on [date] (employment register, board members not counted)"; "No employee count from the tax board for [quarter]"; "Paid no state taxes in [year]: not in the tax board's file". CAVEAT stays.
5. **S15 split:** WHOIS (`S15.ALL.whois`) and the web archive (`S15.ALL.archive`) are LATER until their terms are read and quoted (`data-osint` reads the .lt, .lv and .ee registry WHOIS terms and the archive's terms, for legal). Registrant name and contact are never shown on any path. DNS, certificate logs, the homepage fetch and the US RDAP creation date stay CAVEAT, and check 11 runs on those.

**Natural persons and sole traders**
6. **Part B applies to companies only.** Sole traders and natural persons get the facts-only variant (P6): no verdict level, never "Serious concerns" (rule 5).
7. **Sole-trader addresses: country only; nothing finer is loaded.** Legal answered no: municipality level is not cleared (LAWYER). LT sole-trader addresses are not loaded.
8. **Sole-trader money:** business financials (S06) CAVEAT, behind the purpose gate, facts only, rule 6 disclaimer, never in a verdict. Tax, arrears and cleared-debt lines tied to a natural person (S08): **HIDE** (credit-type data, rule 5; the purpose gate doesn't change that).
9. **Natural-person insolvency is HIDE in every country** (extends legal round 3 item 5c). Company insolvency is unaffected.

**Policy table changes**
- **P2 (purpose gate):** the 12 h session keeps the purpose text, but every company opened gets its own log row with the purpose in force at that moment. The log is append-only: a change of purpose is its own row, and no earlier row is rewritten. No access to person data without a purpose attached. Test: change the purpose between two companies; assert two different purposes and an unchanged first row.
- **P6:** adds items 6-8 (companies-only verdict, sole-trader address, sole-trader money).
- **P7 (blocked uses):** scoped to natural-person and sole-trader subjects only, so US public-company research is not blocked (legal, Part F item 4).
- **P8 (agent path and court parties):** natural-person insolvency is never loaded (item 9). Court parties are masked unless proven to be a company: a registry ID match in the store, or a legal-form token (SIA, AS, UAB, OÜ, Inc, LLC and the like); everything else shows as "a private individual". Fixtures include a company name without a form token, which must be masked.
- **P9 (history cap):** at `HISTORY_MAX_GB`, warn in the health check and on Settings; never delete silently (deleted history turns "renamed" into a false clean).
- **P13 (LAWYER register) rows adopted now:** natural-person role starts, address-based links, WHOIS, LLC members, retention (P4, P5), sole-trader addresses at municipality level, the anonymous member count.
- **New P14 (snapshot-dependent rules):** "renamed or re-registered in 6 months", the LT 180-day arrears age and "no longer on the debtor list since" read "Not evaluated: tracked since [date]" until our snapshots cover the window, never as clean. Test: a 10-day-old install can't report "no rename in 6 months".

**Accepted from the designer:** `not_checked{reason: "agent_only", agentId}` for the AGENT key (with an Investigate action) and `not_checked{reason: "manual_lookup", url}` for MANUAL, with the official-host allowlist; a "Derived by Finora" provenance chip for values we compute (parent links, shared-address counts, future estimates). Both go to the architect for phase 3.

**Other answers recorded:** Part F item 2 (national lists without a stated licence): a live, cited, not-stored check from the official publication is fine; the rows stay CAVEAT with the licence caveat. `OUT.US.01` stays HIDE (the council read 52 U.S.C. 30111(a)(4); stricter than legal's minimum). `SEC_USER_AGENT` is on the critical path for "done": the coordinator gets it from the human before the US slices start. data-baltics records the Lithuanian register's official extract-ordering page with the LT loader spec; it is the only allowed `paid_only` target.

**Dissent added:** cleared tax debt window: the designer wanted 90 days; the council keeps 12 months (CPO: contracts run longer). LV salary estimate from 5 employees (designer): moot for v1, since salary is LATER.

**Final round (2026-11-20): session 1 closed**
- **The proven-company gate** (cto load rules 1-2, adopted as the enforcement for P8 and the S04 LOCK): a member is loaded only if the register types it as a company (LV `LEGAL_ENTITY` or `FOREIGN_ENTITY`; EE `J`). Everything else, including LV `JOINT_OWNERS`, is never loaded and is counted in the sync report. Every row tied to a party (members, the EE and LT debtor lists, social-insurance debts, insolvency rows, sanctions links) goes through one ingest helper and loads only if the party is proven to be a company, by a code that resolves to a register entity with a non-natural-person form or by the register's own type field. Court-party masking uses the same logic. One fixture test per type value; a fixture sole trader at a company address creates no S17 link.
- **Check 4, "Owners on record":** no anonymous member count (legal: not approved; LAWYER). About 91% of LV and EE companies have no company member to show (LV 13,015 of 140,544 companies with members; EE 7.9% of entities), so S04 is LOCK and check 4 counts as not run. The coverage line names the reason: "Owners: restricted in [country]". Instant profiles still reach 6 or more checks. *What would change it:* a lawyer clears the anonymous count, or the LLC-member LOCK.
- **Part F, closed:** (1) LV and EE LLC members: LOCK, a LAWYER item; (2) national lists: CAVEAT, live, cited, from the official publication only; (3) WHOIS and archive: LATER; (4) P7 applies to natural-person subjects only; (5) sole-trader money: as in P6. **Part F, open:** WHOIS and archive terms (data-osint, then legal).
- **Critical path:** `SEC_USER_AGENT` comes from the human before the US slices start.
- **Dissent:** none new.

**WHOIS and archive ruling (2026-11-20, after phase 3 opened):** data-osint quoted the registry and archive terms (`osint.md` §1.1a); legal reviewed them; the council applied legal's lights (gate 1, no dissent).
- **.lt WHOIS (`S15.LT.whois`): CAVEAT.** Domain age, registrar and creation date, read once per investigation at query time; the holder is never shown; no storage beyond the investigation's cited record; no contact of the holder. **Build condition:** the .lt terms are re-read against the server notice on the build date; if they changed, the row drops back to LATER.
- **.lv WHOIS (`S15.LV.whois`): LATER.** Its purpose clause (Internet operation, or contacting the holder over legal problems) doesn't cover due diligence. *What would change it:* the .lv registry confirms in writing that the lookup is within its purpose.
- **.ee WHOIS (`S15.EE.whois`): LATER, no display.** The terms bar business use and require results to be passed on "in its entirety", which conflicts with showing selected fields, including the register-code match.
- **Web archive (`S15.ALL.archive`): LATER.** Access is "for scholarship and research purposes only", with no collecting or storing of personal data. No archive link in v1, not even a plain link (LAWYER). *What would change it:* a lawyer clears the link.
- **Check 11:** in LV and EE it runs on DNS, certificate logs and the homepage only.

**Officer names, LV and EE (2026-11-20, chair clarification; legal confirmed (b)):** the v1 default is `PERSON_ROWS=names_no_id`: current roles only, behind the purpose gate, with the rule 6 disclaimer; each officer row is keyed by the company and the source record; responses use an opaque per-response index (`p1`, `p2`); no eid, no HMAC; codes dropped at load (P3). Nothing in v1 needs a persistent person identifier (person-to-person links, "also officer in N companies" and the network "same person?" question are all LATER), so `pseudonym` stays an unbuilt LAWYER row (`LAW-PSEUDONYM`). **New P13 LAWYER row:** are LV board and officer data still public after the 9 Nov 2026 ruling? Interim: names shown as above. *Trigger:* if a lawyer decides against names, LV People falls to role counts and dates ("Officer names: pending a legal review", the LOCK variant), check 9 screens the company only ("Officers not screened: names not loaded"), and the LV promise reads "the full counterparty check, except who runs it". Dissent: none.

**Calls from the Baltic loader specs (phase 3, 2026-11-20; chair clarifications within session 1's gates, no dissent recorded):**
1. **Sole traders' LV securing measures and suspensions: HIDE** (credit-type data about a natural person, legal and council agree). **Sole traders' VAT numbers: dropped** (an LV VAT number embeds the personal code, P3); show "VAT registered: yes / no" only (legal: no objection).
2. **Sodra (S07.LT.01, S08.LT.02, S18.LT.02): the agent path only** (gate 1). Legal does not clear `store` or `live-no-store`: "public by law" is not a licence, and a live fetch in the instant profile is still a use of the data. The three rows are CAVEAT on the agent path, read live at query time, never stored, "no licence stated by the publisher"; the instant profile shows "Social-insurance data: checked when you investigate". LT check 7 in the instant profile runs on the tax-authority arrears (S08.LT.01); the money agent adds social-insurance debts. *Trigger to return them to the instant profile:* the publisher's terms are quoted (`LAW-SODRA-LICENCE`); no outreach in v1 (C11). The council's preference for the instant profile is recorded as that trigger. (cto measured that the files would fit a live fetch: 414 KB and 753 KB zipped.)
3. **Share capital: SHOW** as an optional S01 field (LT, LV, and EE if the file has it); company data, never feeds the verdict. *What would change it:* it pushes a loader over its P10 budget.
4. **Check 5, "Accounts filed" (renamed from "accounts filed on time"), states a fact, not a legal conclusion.** The soft flag reads "Annual report for [year] not in the register, [N] months after the year ended"; the words "late", "overdue" and "deadline" are never used in the UI or the spec. The trigger windows (LV 7, EE 6, LT 5 months, each plus 30 days) are labelled in the check definition as "Finora's estimate of the usual filing window". With that wording no lawyer is needed; a statutory date cited from the law can replace the estimate later (legal agrees).
5. **LT 180-day arrears:** evaluated from day one from the list entry's own creation date (`sukurta`), "On the arrears list since [date]", a lower bound, so it can only under-flag; P14 doesn't apply to LT arrears age. **cto verified the field** (🟢 2026-11-20, last 10,000 changes of the portal's change feed: 6,434 patches, none touching `sukurta`; a paid and re-listed debt gets a new date). Fixture test: a patch never moves the date; a delete followed by an insert resets it. The arrears list includes sole traders; the party gate drops them (P6), and the negative test includes one.
6. **S09.LT.01 caveat:** "Bankruptcy reports published up to [month]", taken from the data.
7. **LT `paid_only` target:** the register's own extract-ordering page, `https://www.registrucentras.lt/paslauga/jar-israsas` (data-baltics, HTTP 200).
8. **Retained tax periods (cto):** `purgeScope: "periods-in-file"` keeps periods that roll out of the publisher's file; they count against `HISTORY_MAX_GB`. EE (share-alike store, ≈ 19 MB per quarter) collapses a rolled-out quarter into one annual report per company, and its store size is checked against the 0.25 GB cap in the EE slice. Weekly jobs (LV statements, EE general data, GLEIF) each get their own night, outside the 5-minute daily budget.

**Baltic court rows (phase 3, 2026-11-20; chair clarification, legal agrees, no dissent):** `S10.LT.01`, `S10.LV.01` and `S10.EE.01` are LATER, with the MANUAL empty state "Check manually at the official court-decision portal" (official link only). Check 10 ("Court cases") counts as not possible in LT, LV and EE in v1; the coverage line reads "Court cases: check manually at [portal]", never "none found". In LV, the case-number links on S09 events don't count as running check 10. *Reasons:* agents honour `robots.txt` (EE disallows the decision paths); LT and LV have no readable terms and no legal light; a partial court check that reads as complete is the "clean = no data" failure. *What would change it:* LT, a build-time probe shows company names in published decisions and legal gives a light (`LAW-COURTS-LT`), then CAVEAT agent search by code and by name as "possible match, needs review"; LV, its terms are read and legal gives a light (`LAW-COURTS-LV`); EE, the portal lifts the disallow or publishes an API outside it. Baltic investigations reach at most 10 of 11 checks, still above the "Not enough data" line.

## Part G: the item table, one row per `item_id` (final, confirmed)

Expanded from Part D, then updated with Part H and the council's and cto's final row lists. Every one of the 147 `item_id`s in `docs/research/display-matrix.md` appears exactly once, plus four splits and four new S15 ids, so 155 rows. No id is missing or unknown. Counts: SHOW 41, CAVEAT 56, LATER 53, HIDE 5. **Part G is the authoritative table; Part D is the council's rule form. Confirmed by `council` and `cto` on 2026-11-20.**

**New ids:** `S15.LT.whois`, `S15.LV.whois`, `S15.EE.whois` and `S15.ALL.archive` (Part H, item 5 and the WHOIS ruling). **Split ids:** `S01.US.03a` (PA) and `S01.US.03b` (OR); `S08.EE.01a` (tax debtors) and `S08.EE.01b` (taxes paid); `M05.X.02a` (oracle) and `M05.X.02b` (user key); `M06.X.01a` (O5 oracle) and `M06.X.01b` (O3 supply + X4 candles).

**Reconciliation points, closed:** (1) OR and WA: yes, the US private promise reads "NY, CO, CT or PA" and P11 is per state. (2) `S03.US.03`: yes, CT principals, PA parties and the NY CEO only; FL officers LATER with `S01.US.04`, OR representatives with `S01.US.03b`.

| item_id | call | caveat text | empty-state |
|---|---|---|---|
| S01.LT.01 | SHOW | - | NP (LEI, VAT: — when absent) |
| S01.LV.01 | SHOW | - | NP (LEI, VAT: — when absent) |
| S01.EE.01 | SHOW | - | NP (LEI, VAT: — when absent) |
| S01.US.01 | SHOW | - | KEY ("needs the SEC contact setting") |
| S01.US.02 | SHOW | - | NP (LEI, VAT: — when absent) |
| S01.US.03b (OR) | LATER | - | — |
| S01.US.03a (PA) | CAVEAT | Pennsylvania register: licence partly stated | NC |
| S01.US.04 | LATER | - | — |
| S01.US.05 | LATER | - | PAID ("No free register in [state]") |
| S01.US.06 | LATER | - | — |
| S01.US.07 | CAVEAT | Licence data for carriers and brokers (FMCSA) only; the OR and WA licence sources are LATER (P11) | — |
| S01.ALL.01 | SHOW | - | NP (LEI, VAT: — when absent) |
| S01.ALL.02 | SHOW | - | NP (LEI, VAT: — when absent) |
| S02.LT.01 | SHOW | - | NP; history: "Tracked by Finora since [date]" |
| S02.LV.01 | SHOW | - | NP; history: "Tracked by Finora since [date]" |
| S02.EE.01 | SHOW | - | NP; history: "Tracked by Finora since [date]" |
| S02.US.01 | SHOW | - | NP; history: "Tracked by Finora since [date]" |
| S02.US.02 | CAVEAT | Connecticut filing history: licence not stated on this dataset | NC |
| S02.US.03 | SHOW | - | — (banks only) |
| S03.LT.01 | CAVEAT | Role facts only; names are not in Lithuania's open data | needs_purpose; PAID (names) |
| S03.LV.01 | CAVEAT | Current roles only; past roles are not published. People appear only in this company's context | needs_purpose; then NP |
| S03.EE.01 | CAVEAT | Current roles only; past roles are not published. People appear only in this company's context | needs_purpose; then NP |
| S03.US.01 | CAVEAT | Current roles only; past roles are not published. People appear only in this company's context | needs_purpose; then NP |
| S03.US.02 | CAVEAT | Current roles only; past roles are not published. People appear only in this company's context | needs_purpose; then NP |
| S03.US.03 | CAVEAT | CT principals, PA parties and the NY CEO only; FL officers are LATER with S01.US.04 and OR representatives with S01.US.03b. People appear only in this company's context | needs_purpose; then NP |
| S03.US.04 | LATER | - | — |
| S04.LT.01 | LATER | - | PAID |
| S04.LV.01 | CAVEAT | Company members only; members who are private individuals are not shown (rule 1) | LOCK / NP |
| S04.LV.02 | HIDE | - | LOCK (rule 1) |
| S04.LV.03 | HIDE | - | LOCK (rule 1) |
| S04.EE.01 | CAVEAT | Company members of private limited companies only; members who are private individuals are not shown (rule 1). Public limited company shareholders are held by the securities depository | LOCK / NP |
| S04.EE.02 | HIDE | - | LOCK (rule 1) |
| S04.US.01 | CAVEAT | Large holders as filed with the SEC; people appear only in this company's context | KEY / needs_purpose |
| S04.US.02 | CAVEAT | Large holders as filed with the SEC; people appear only in this company's context | KEY / needs_purpose |
| S04.US.03 | LATER | - | NP ("No US source publishes owners of private companies") |
| S05.LT.01 | LATER | - | — |
| S05.LV.01 | LATER | - | — |
| S05.EE.01 | LATER | - | — |
| S05.US.01 | LATER | - | — |
| S05.ALL.01 | LATER | - | — |
| S06.LT.01 | SHOW | - | NP; "[year] not filed" |
| S06.LV.01 | SHOW | - | NP; "[year] not filed" |
| S06.EE.01 | SHOW | - | NP; "[year] not filed" |
| S06.US.01 | SHOW | - | KEY |
| S06.US.02 | SHOW | - | — (banks only) |
| S06.US.03 | LATER | - | NP ("No US source publishes accounts of private companies") |
| S07.LT.01 | CAVEAT | Social-insurance fund, read at query time; no licence stated by the publisher. Agent path only, not stored | AGENT ("Social-insurance data: checked when you investigate") |
| S07.LV.01 | CAVEAT | Employees from tax filings, quarterly; covers 54-58% of active companies | NP |
| S07.EE.01 | CAVEAT | Quarterly, from the tax board (CC BY-SA); board members are not counted | "N employees on [date]" / "No employee count from the tax board for [quarter]" / "Paid no state taxes in [year]: not in the tax board's file" / "Not checked: licence question pending (live-no-store mode)" |
| S07.US.01 | LATER | - | — |
| S07.US.02 | SHOW | - | — (carriers only) |
| S07.US.03 | CAVEAT | From the annual report (self-reported) | KEY |
| S08.LT.01 | SHOW | - | CN |
| S08.LT.02 | CAVEAT | Social-insurance fund, read at query time; no licence stated by the publisher. Agent path only, not stored | AGENT ("Social-insurance data: checked when you investigate") |
| S08.LV.01 | CAVEAT | Taxes paid for 56% of active companies; debt amounts are not open data | MANUAL (amount); CN (rating) |
| S08.EE.01a (tax debtors) | SHOW | - | CN |
| S08.EE.01b (taxes paid) | CAVEAT | Taxes paid for 39.1% of active companies; share-alike licence | NP / "Not checked: licence question pending (live-no-store mode)" |
| S08.US.01 | LATER | - | NP ("The US publishes no tax payment or tax debt data") |
| S09.LT.01 | CAVEAT | Bankruptcy reports published up to [month] (the month is taken from the data) | CN |
| S09.LV.01 | SHOW | - | CN |
| S09.EE.01 | SHOW | - | CN (status and pledges; bankruptcy notices LATER; natural-person insolvency HIDE) |
| S09.US.01 | CAVEAT | Checked UCC filings in Colorado and Connecticut only; other states not checked | CN |
| S09.US.02 | LATER | - | — |
| S09.US.03 | LATER | - | PAID ("Federal bankruptcy dockets: paid, not checked") |
| S10.LT.01 | LATER | - | MANUAL ("Check manually at the official court-decision portal"), official link only |
| S10.LV.01 | LATER | - | MANUAL ("Check manually at the official court-decision portal"), official link only; the court case numbers loaded with S09.LV.01 events link to the portal from those events |
| S10.EE.01 | LATER | - | MANUAL ("Check manually at the official court-decision portal"), official link only |
| S10.US.01 | CAVEAT | Possible match by name, needs review | AGENT |
| S10.US.02 | CAVEAT | Possible match by name, needs review | AGENT |
| S11.LT.01 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S11.LT.02 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S11.LV.01 | SHOW | - | CN |
| S11.LV.02 | SHOW | - | CN |
| S11.LV.03 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S11.EE.01 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S11.EE.02 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S11.US.01 | SHOW | - | CN |
| S11.US.02 | SHOW | - | CN |
| S11.US.03 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S11.US.04 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S11.ALL.01 | SHOW | - | CN |
| S11.ALL.02 | SHOW | - | CN |
| S11.ALL.03 | SHOW | - | CN |
| S11.ALL.04 | LATER | - | KEY |
| S11.ALL.05 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S12.LT.01 | LATER | - | — |
| S12.LT.02 | LATER | - | — |
| S12.LT.03 | LATER | - | — |
| S12.LV.01 | LATER | - | — |
| S12.LV.02 | LATER | - | — |
| S12.LV.03 | LATER | - | — |
| S12.EE.01 | LATER | - | — |
| S12.EE.02 | LATER | - | — |
| S12.EE.03 | LATER | - | — |
| S12.US.01 | LATER | - | — |
| S12.US.02 | LATER | - | — |
| S13.LT.01 | SHOW | - | NP |
| S13.LV.01 | SHOW | - | NP |
| S13.EE.01 | SHOW | - | NP |
| S13.US.01 | SHOW | - | KEY |
| S13.US.02 | CAVEAT | State filing history, where the state publishes it (40% of samples) | NC |
| S13.US.03 | CAVEAT | Connecticut filing history: licence not stated on this dataset | NC |
| S14.LV.01 | LATER | - | — |
| S14.EE.01 | LATER | - | — |
| S14.US.01 | CAVEAT | Insider transactions as filed; people appear only in this company's context | KEY / needs_purpose |
| S14.US.02 | SHOW | - | — |
| S14.US.03 | LATER | - | — |
| S14.LTLVEE.01 | SHOW | - | — |
| S14.LTLVEE.02 | LATER | - | — |
| S15.LT.01 | CAVEAT | Found by an agent from DNS, certificate logs and the homepage (US: plus the domain creation date); registrant details are never shown | AGENT |
| S15.LV.01 | LATER | - | — |
| S15.LV.02 | CAVEAT | Found by an agent from DNS, certificate logs and the homepage (US: plus the domain creation date); registrant details are never shown | AGENT |
| S15.EE.01 | SHOW | - | — |
| S15.EE.02 | CAVEAT | Found by an agent from DNS, certificate logs and the homepage (US: plus the domain creation date); registrant details are never shown | AGENT |
| S15.US.01 | CAVEAT | Found by an agent from DNS, certificate logs and the homepage (US: plus the domain creation date); registrant details are never shown | AGENT |
| S15.LT.whois | CAVEAT | Domain age, registrar and creation date from the .lt registry, read once per investigation at query time; the holder is never shown | AGENT |
| S15.LV.whois | LATER | - | — |
| S15.EE.whois | LATER | - | — |
| S15.ALL.archive | LATER | - | — (no archive link in v1, not even a plain link: legal marks that LAWYER) |
| S16.LV.01 | LATER | - | — |
| S16.EE.01 | LATER | - | — |
| S16.US.01 | LATER | - | — |
| S16.ALL.01 | CAVEAT | Mentions the name; not confirmed to be this company | AGENT |
| S16.ALL.02 | LATER | - | — |
| S16.ALL.03 | LATER | - | — |
| S16.ALL.04 | HIDE | - | — |
| S17.LT.01 | CAVEAT | A shared address can be an office building or a registered-agent address. Registered offices of companies only; an address shared with a sole trader or private individual is not shown | — |
| S17.LV.01 | CAVEAT | Company-to-company links only: shared addresses and corporate members. Registered offices of companies only; an address shared with a sole trader or private individual is not shown | — |
| S17.EE.01 | CAVEAT | Company-to-company links only: shared addresses and corporate members. Registered offices of companies only; an address shared with a sole trader or private individual is not shown | — |
| S17.US.01 | LATER | - | — |
| S17.US.02 | LATER | - | — |
| S18.LT.01 | SHOW | - | NC per check |
| S18.LT.02 | CAVEAT | Social-insurance fund, read at query time; no licence stated by the publisher. Agent path only, not stored | AGENT ("Social-insurance data: checked when you investigate") |
| S18.LV.01 | SHOW | - | NC per check |
| S18.EE.01 | SHOW | - | NC per check |
| S18.US.01 | CAVEAT | The US has no public tax-debt or payment-default data | NC per check |
| M01.X.01 | CAVEAT | Quarterly; includes non-listed equity | NC |
| M01.X.02 | CAVEAT | Via [your symbol], a US-listed fund. In US dollars: includes currency moves and fund fees. Not the index | KEY / "Choose a fund in settings" |
| M02.X.01 | CAVEAT | Via [your symbol], a US-listed fund. In US dollars: includes currency moves and fund fees. Not the index | KEY / "Choose a fund in settings" |
| M03.X.01 | CAVEAT | Peak seeded once from a cited official figure, if legal clears it | NC / "Peak not known yet: tracking since [date]" (no %, never 0%) |
| M03.X.02 | CAVEAT | Via [your symbol], a US-listed fund. In US dollars: includes currency moves and fund fees. Not the index | KEY / "Choose a fund in settings" |
| M04.X.01 | CAVEAT | Via [your symbol], a US-listed fund. In US dollars: includes currency moves and fund fees. Not the index | KEY / "Choose a fund in settings" |
| M05.X.01 | CAVEAT | Monthly average | NC |
| M05.X.02a (oracle) | LATER | - | — |
| M05.X.02b (user key) | CAVEAT | With your own key; personal use | NC / KEY |
| M06.X.01b (O3 supply + X4 candles) | CAVEAT | Self-hosted, personal use | NC |
| M06.X.01a (O5 oracle) | LATER | - | — |
| M06.X.02 | CAVEAT | Personal use; attribution | NC |
| M07.X.01 | SHOW | - | NC |
| M08.X.01 | SHOW | Ticker is an estimate | NC |
| M09.X.01 | LATER | - | — |
| OUT.US.01 | HIDE | - | — (never loaded) |
| OUT.US.02 | LATER | - | — |
| OUT.US.03 | LATER | - | — |
| OUT.US.04 | LATER | - | — |
