# Display matrix

Assembled by the coordinator on 2026-11-20 from the "Display matrix rows" of the four area docs: `baltics.md` (64 rows), `us.md` (49), `osint.md` (20) and `markets.md` (16). The rows are copied unchanged, with two exceptions: where two areas measured the same cross-border source, their rows are merged into one so the council rules once (GLEIF relationships, `S05.ALL.01`; the UN list, `S11.ALL.05`), with both areas' evidence kept. Only the `item_id`, the `From` column and the two empty decision columns are added. 149 area rows, 147 matrix rows. Regenerated after each area fix; ids can shift within a section and country until session 1 starts. The evidence for every row is in its area doc.

This is the input for council session 1 (`docs/plan/council/00-framing.md`: gates, calls, empty states).

## How to read it

- **item_id:** `<section>.<country>.<nn>`. `ALL` = cross-border, `X` = Crash monitor tile (no country), `LTLVEE` = all three Baltic countries. `OUT` = sources outside the report sections (US political donations, non-profits, trademarks), listed so a HIDE call still gets an id and a negative test.
- **Section and tile IDs, grades:** see `docs/research/README.md`. A = official, structured, bulk, fresh, open; B = one limitation; C = partial, derived, unclear licence or query time only; D = not available free; X = legally restricted.
- **Fill rate:** from the area's reality check or population count. "pending" = the source needs a key deferred under register C7 (mostly `SEC_USER_AGENT`).
- **Legal:** the legal light (G / Y / R) with the memo rule number. The council derives it in session 1 from `legal.md` (council session 0, amendment 1), with `legal` advising on contested rows. The positions that already settle rows are `legal.md` rounds 2-3 and the market addendum: beneficial owners, LV masked codes, the EE person hash and EE natural-person bankruptcy notices are R; sole traders, CC BY-SA data, LT social-insurance files and the UN list are Y.
- **Call:** SHOW / CAVEAT / HIDE / LATER, decided by the council in session 1.

## Grade counts

| Grade | Rows |
|---|---|
| A | 53 |
| B | 35 |
| C (incl. one row graded C by one area and A by another) | 37 |
| D | 17 |
| X | 2 |
| X? (provisional) | 2 |
| none (tile not graded) | 1 |
| **Total** | **147** |

## Rows

| item_id | Section | Country | Sources | Grade | Fill rate | Notes | From | Legal | Call |
|---|---|---|---|---|---|---|---|---|---|
| S01.LT.01 | S01 | LT | JAR daily files; tax-payer register; Sodra; GLEIF | A | 100% (activity 83.5%, VAT 64.4%, LEI 2.5%) | bulk; licence verified Y; full address text; activity from tax / social-insurance files | baltics |  |  |
| S01.LV.01 | S01 | LV | Enterprise Register register; VID yearly (NACE); VID VAT payers; GLEIF | A | 100% (NACE 87%, VAT 50.5%, LEI ≤3%) | bulk; licence verified Y; daily; VAT = LV+code | baltics |  |  |
| S01.EE.01 | S01 | EE | e-Business Register basic + general data | A | 98.3% | bulk; licence verified Y; name, code, form, address, activity 100% except address 98.3%; VAT 42.7%; no LEI in the register (GLEIF join) | baltics |  |  |
| S01.US.01 | S01 | US | SEC submissions, tickers (public companies, Form D filers) | A | deferred: User-Agent pending (expected ~100% of public) | API + bulk; licence verified Y; blocked on `SEC_USER_AGENT` | us |  |  |
| S01.US.02 | S01 | US | State registries: NY, CO, CT | A | private 100% (5/5); public 40% (2/5) | bulk; licence verified Y; daily (NY: monthly master + daily filings) | us |  |  |
| S01.US.03 | S01 | US | State registries: OR, PA | B | within the private 100% above | bulk; licence verified partial (OR: none on the main dataset) | us |  |  |
| S01.US.04 | S01 | US | State registry: FL (Sunbiz) | B | not sampled | bulk SFTP; licence verified N (pages refuse automated reads); best free officer data | us |  |  |
| S01.US.05 | S01 | US | State registries: CA, DE | D | 0% | paid bulk order (CA) or $10-20 per status query (DE); ~40% of US LEIs are DE entities | us |  |  |
| S01.US.06 | S01 | US | SAM.gov entity extract (UEI) | B | 0% (0/10) | bulk monthly; licence verified partial (US Government work); firms registered for federal work only | us |  |  |
| S01.US.07 | S01 | US | FMCSA census, OR CCB, WA L&I licences | A | segment-specific (broker 1/1) | bulk daily; licence verified partial; carriers, brokers, contractors only | us |  |  |
| S01.ALL.01 | S01 | all | GLEIF golden copy (LEI field) | A | LEI records by legal-address country in the golden copy of 2026-11-19 16:00 UTC, all registration statuses: LT 5,402, LV 4,452, EE 30,632 | bulk; licence verified Y; CC0; register code on 98-99.7% of LEI records, so joins are reliable; most small companies have no LEI | baltics |  |  |
| S01.ALL.02 | S01 | all | GLEIF LEI | A | public 60% (3/5); private 40% (2/5) | bulk, 3 publishes a day; licence verified Y (CC0) | us |  |  |
| S02.LT.01 | S02 | LT | JAR daily files; API change feed | A | 100% | bulk; licence verified Y; current status + since-date; no name or address history (keep our own from daily diffs) | baltics |  |  |
| S02.LV.01 | S02 | LV | Register (status, terminated), liquidations, reorganizations, name history | A | 100% | bulk; licence verified Y; name history stale since 2025-04-02; no address history | baltics |  |  |
| S02.EE.01 | S02 | EE | e-Business Register general data, registry-card entries | B | 100% | bulk; licence verified Y; current status and its start date only; no name/address history and deleted companies vanish (history via contract API or our own daily snapshots) | baltics |  |  |
| S02.US.01 | S02 | US | State status + history (NY status history, CO transactions) | A | status 100% private; dated history 40% (2/5, all samples combined) | bulk; licence verified Y | us |  |  |
| S02.US.02 | S02 | US | CT business filing history | B | included in the 40% above | bulk daily; licence verified partial (no licence stated on this dataset; the CT master file says Public Domain) | us |  |  |
| S02.US.03 | S02 | US | FDIC BankFind (failures, history) | A | banks only | API, no key; licence verified partial | us |  |  |
| S03.LT.01 | S03 | LT | JAR management bodies | C | 0% names (99.9% roles only) | bulk; licence verified Y; no names: manager flag, since-date, gender, board flags only | baltics |  |  |
| S03.LV.01 | S03 | LV | Enterprise Register officers | A | 98% | bulk; licence verified Y; current roles only, no end dates; names + masked code (legacy code reveals birth date) | baltics |  |  |
| S03.EE.01 | S03 | EE | e-Business Register persons on card | A | 97.4% | bulk; licence verified Y; current roles only; names + pseudonymous person hash (UUID v5), birth date only for foreigners; drop person emails and home addresses | baltics |  |  |
| S03.US.01 | S03 | US | SEC Forms 3/4/5 officers and directors | A | 80% public (4/5) | bulk quarterly data sets + live XML; licence verified Y; name + insider CIK | us |  |  |
| S03.US.02 | S03 | US | Form D related persons | B | deferred: User-Agent pending | bulk quarterly; licence verified Y; the only federal list of private-company officers | us |  |  |
| S03.US.03 | S03 | US | State people: FL officers, CT principals, PA parties, NY CEO, OR representatives | B | 80% private (4/5, incl. FMCSA) | bulk; licence verified Y/partial/N by state; name only; drop CT residence addresses and agent contacts | us |  |  |
| S03.US.04 | S03 | US | DEF 14A (ecd:PeoName) | C | deferred: User-Agent pending | per-filing; licence verified Y; agent-read | us |  |  |
| S04.LT.01 | S04 | LT | JADIS member counts | C | 0% names (81.3% counts) | API; licence verified Y; counts by type only, last loaded 2025-09; owners and BO names paid | baltics |  |  |
| S04.LV.01 | S04 | LV | Enterprise Register members (SIA) | A | 91% (100% of SIA) | bulk; licence verified Y; personal data; members who leave vanish | baltics |  |  |
| S04.LV.02 | S04 | LV | Enterprise Register beneficial owners | X? | 90% | bulk; licence verified Y; concealment on request since 2026-07-01; CJEU C-37/20, legal memo decides | baltics |  |  |
| S04.LV.03 | S04 | LV | Joint-stock company shareholders | D | 0% | none; licence verified Y (dataset withdrawn, private in CKAN); Constitutional Court 9 Nov 2026 | baltics |  |  |
| S04.EE.01 | S04 | EE | e-Business Register shareholders (members) | A | 97.3% | bulk; licence verified Y; current members of private limited companies; public limited company shareholders are not in the register (kept by the securities depository) | baltics |  |  |
| S04.EE.02 | S04 | EE | e-Business Register beneficial owners | X? | 95.0% | bulk; licence verified Y; still published daily (412,802 rows, 2026-11-19) with name, country, control method and person hash; legal round 3 proposes HIDE (CJEU C-37/20, C-601/20) | baltics |  |  |
| S04.US.01 | S04 | US | Schedules 13D/13G XML | A | deferred: User-Agent pending | per-filing XML; licence verified Y | us |  |  |
| S04.US.02 | S04 | US | Forms 3/4/5 10% owners | A | 80% public (4/5) | bulk; licence verified Y | us |  |  |
| S04.US.03 | S04 | US | Private-company owners | D | 0% (0/5) | not published by any US source | us |  |  |
| S05.LT.01 | S05 | LT | GLEIF relationships only | D | 0% from LT registers | API; licence verified Y (GLEIF CC0, cross-border entry); no group data in LT open data | baltics |  |  |
| S05.LV.01 | S05 | LV | Members with corporate holders (derived); GLEIF relationships | C | 11% | bulk; licence verified Y; LV-registered parents and subsidiaries only; foreign parents by name | baltics |  |  |
| S05.EE.01 | S05 | EE | e-Business Register shareholders (legal-entity holders) | C | 9.8% | bulk; licence verified Y; derived: parent only via a corporate member; no subsidiary or consolidation links | baltics |  |  |
| S05.US.01 | S05 | US | Exhibit 21 subsidiaries | C | deferred: User-Agent pending | per-filing HTML; licence verified Y; names only, agent-matched | us |  |  |
| S05.ALL.01 | S05 | all | GLEIF relationship records + reporting exceptions | C (baltics) / A (us) | 4.5% LT, 3.3% LV, 0.9% EE of LEI holders have a parent LEI (baltics) · 0% (0/10); ~5% of US LEIs have a parent (us) | baltics: bulk; licence verified Y; only LEI holders, accounting-consolidation parents only; most exceptions say "natural persons" (owner not named) · us: bulk; licence verified Y (CC0) | baltics+us |  |  |
| S06.LT.01 | S06 | LT | JAR financial statements | B | 72.7% (revenue 55.8%) | API; licence verified Y; key lines only, monthly loads; no employee count | baltics |  |  |
| S06.LV.01 | S06 | LV | Annual report financial data | A | 74% (FY ≥ 2024) | bulk; licence verified Y; 2006-2026; check currency and rounding | baltics |  |  |
| S06.EE.01 | S06 | EE | RIK annual-report key figures 2019-2025 | A | 71.6% | bulk; licence verified Y; monthly; non-consolidated XBRL figures only; PDF-filed reports have none (1.3% of all FY2025 reports, 38% of large companies) | baltics |  |  |
| S06.US.01 | S06 | US | SEC XBRL company facts | A | deferred: User-Agent pending (public); 0% private | API + bulk; licence verified Y | us |  |  |
| S06.US.02 | S06 | US | FDIC call-report financials | A | banks only | API; licence verified partial | us |  |  |
| S06.US.03 | S06 | US | Private-company financials | D | 0% (0/5) | not published | us |  |  |
| S07.LT.01 | S07 | LT | Sodra daily insured; monthly averages | C | 48.6% insured; 18.8% avg wage | bulk; licence verified N (none stated, public by law); wage only if > 3 insured | baltics |  |  |
| S07.LV.01 | S07 | LV | VID quarterly employees; FS employees; salary derived from social contributions | B | 54-58% (salary 48%) | bulk; licence verified Y; average salary not published, derived estimate | baltics |  |  |
| S07.EE.01 | S07 | EE | EMTA taxes paid, turnover, employees | B | 26.9% | bulk; licence verified Y (CC BY-SA 3.0, share-alike); quarterly employee count; no average salary (EMTA warns against deriving it) | baltics |  |  |
| S07.US.01 | S07 | US | SBA PPP jobs reported | C | 20% public, 20% private | bulk, static since 2024-10; licence verified Y; 2020-21 headcount only | us |  |  |
| S07.US.02 | S07 | US | FMCSA drivers and power units | A | carriers only | bulk daily; licence verified partial | us |  |  |
| S07.US.03 | S07 | US | SEC dei:EntityNumberOfEmployees | B | deferred: User-Agent pending | API; licence verified Y | us |  |  |
| S08.LT.01 | S08 | LT | VMI taxes paid; VMI arrears | A | 76.5% taxes paid; arrears list-based: 11.8% of active companies have overdue tax arrears | API; licence verified Y (CC BY 4.0); daily arrears | baltics |  |  |
| S08.LT.02 | S08 | LT | Sodra daily debts | C | list-based: 15.4% of active companies have a social-insurance debt | bulk; licence verified N (none stated, public by law, art. 15(3)); daily | baltics |  |  |
| S08.LV.01 | S08 | LV | VID taxes paid (quarterly, yearly); VID taxpayer rating | B | taxes 56%; rating 92% | bulk; licence verified Y; debt amount only per-query behind CAPTCHA; rating C = 5.4% | baltics |  |  |
| S08.EE.01 | S08 | EE | EMTA taxes paid; EMTA tax debtors | B | 39.1% | bulk; licence verified Y (CC BY-SA 3.0); taxes paid quarterly; debtor list daily, known for every company, 6.2% of active companies listed | baltics |  |  |
| S08.US.01 | S08 | US | none | D | 0% | no public tax payments or tax-debt lists | us |  |  |
| S09.LT.01 | S09 | LT | JAR status; AVNT bankruptcy reports | B | 100% status; bankruptcy reports to 2025-10 | API + bulk; licence verified Y; no open pledges, arrests or notices | baltics |  |  |
| S09.LV.01 | S09 | LV | Insolvency register; securing measures; suspensions; VID suspensions | A | 12% have an event; 0.5% open insolvency | bulk; licence verified Y; no pledge amounts; official notices (Latvijas Vēstnesis) need written agreement and fees | baltics |  |  |
| S09.EE.01 | S09 | EE | register status, commercial pledges, share pledges, official notices | A | 100% | bulk; licence verified Y; status + pledges daily (CC BY 4.0), 1.6% have a commercial pledge; bankruptcy notices CC BY-SA 4.0 via URI XML | baltics |  |  |
| S09.US.01 | S09 | US | UCC filings: CO, CT | B | 0% (checked for the CO and CT samples: none found) | bulk daily; licence verified Y; 2 states only | us |  |  |
| S09.US.02 | S09 | US | FJC bankruptcy IDB | D | n/a | bulk, but no debtor names, so a case can't be tied to a company | us |  |  |
| S09.US.03 | S09 | US | PACER bankruptcy dockets | D | n/a | paid: $0.10/page, $3 cap, waived under $30 a quarter | us |  |  |
| S10.LT.01 | S10 | LT | none | D | 0% | per-query; licence verified N; courts' portal searchable by agents only | baltics |  |  |
| S10.LV.01 | S10 | LV | Anonymised court rulings (metadata); case numbers from insolvency and securing measures | C | 0% joinable | bulk; licence verified Y; no party IDs; agent full-text later | baltics |  |  |
| S10.EE.01 | S10 | EE | register rulings | D | 0% | bulk; licence verified Y; the 2.9 M rulings are registration decisions, not court cases; court cases not covered by these sources | baltics |  |  |
| S10.US.01 | S10 | US | FJC civil IDB | B | 20% public (1/5), 0% private | bulk, about quarterly; licence verified partial; party names only, agent must confirm | us |  |  |
| S10.US.02 | S10 | US | CourtListener dockets (bulk) and API | B | not run | bulk quarterly, free; API needs `COURTLISTENER_TOKEN`, 125 calls a day; licence verified Y (bulk) | us |  |  |
| S11.LT.01 | S11 | LT | FNTT list of entities owned or controlled by sanctioned subjects | C | 16 entities, all with a company code | per-query (HTML page); licence verified N (none stated); agents fetch and cite at query time | baltics |  |  |
| S11.LT.02 | S11 | LT | Bank of Lithuania illegal websites; gambling regulator domains | B | 100% checked; 0% hits | bulk; licence verified Y (gambling list: none stated); domain and name match | osint |  |  |
| S11.LV.01 | S11 | LV | Enterprise Register sanctions links | B | <0.1% | bulk; licence verified Y; 63 rows; EU and UN screening via cross-border lists | baltics |  |  |
| S11.LV.02 | S11 | LV | FIU list of sanctioned subjects with assets frozen in Latvia | A | 97% of 185 rows carry a birth date or registration number | bulk; licence verified Y (CC0); EU, UN and national regimes plus entities they own or control; complements the register's sanctions-links file | baltics |  |  |
| S11.LV.03 | S11 | LV | Latvijas Banka warnings page; consumer centre lists | C | 100% checked at query time | per-query; licence verified Y (all rights reserved: link and short quote only) | osint |  |  |
| S11.EE.01 | S11 | EE | Ministry of Foreign Affairs list of national-sanctions subjects | C | 4 persons, names only | per-query (HTML page); licence verified N (none stated); no official ID, so never a confirmed match under R8 | baltics |  |  |
| S11.EE.02 | S11 | EE | Finantsinspektsioon alerts; consumer protection list | C | 100% checked at query time | per-query; licence verified N (no terms found) | osint |  |  |
| S11.US.01 | S11 | US | SAM.gov exclusions | A | checked 100%, hits 0% | bulk daily; licence verified partial; risk signal | us |  |  |
| S11.US.02 | S11 | US | FMCSA revocations | A | carriers and brokers only | bulk daily; licence verified partial | us |  |  |
| S11.US.03 | S11 | US | FINRA BrokerCheck | C | not run | per-query only; licence verified Y (permitted-uses terms: attribution, compile date, error channel) | us |  |  |
| S11.US.04 | S11 | US | SEC, Fed enforcement RSS; FTC actions CSV; DOJ press API | A | 100% checked | bulk; licence verified Y (public); CFPB: HTTP 403, later | osint |  |  |
| S11.ALL.01 | S11 | all | EU consolidated financial sanctions list | A | official-ID match possible for 48.9% of entities, 75.0% of persons | bulk; licence verified Y; CC BY 4.0 / Commission reuse notice; 0 Baltic entities and 11 Baltic-linked persons listed; personal data, legal memo | baltics |  |  |
| S11.ALL.02 | S11 | all | OFAC SDN + non-SDN, EU FSF, UK Sanctions List | A | 100% screened; 0% hits | bulk; licence verified Y; name + second identifier required; "possible match, needs review" | osint |  |  |
| S11.ALL.03 | S11 | all | ESMA non-compliant crypto providers | A | 100% checked; 0% hits | bulk; licence verified Y | osint |  |  |
| S11.ALL.04 | S11 | all | PEP (aggregated dataset) | D | - | user key; licence verified Y (CC BY-NC: connector only) | osint |  |  |
| S11.ALL.05 | S11 | all | UN Security Council consolidated list | C | official ID for 10.6% of entities, 63.8% of persons (baltics) · 100% screened; 0% hits (osint) | licence verified Y: the UN site terms were read by baltics (personal, non-commercial use, no redistribution); osint's terms page returned 403. baltics: bulk; licence verified Y; UN site terms: personal non-commercial use, no redistribution; 95% also in the EU list; fetch at query time only · osint: bulk; licence verified N (terms page returned 403); 🟢 1,002 of 1,007 UN entries have a name that also appears on the EU, UK or OFAC lists, so leaving UN out loses almost nothing | baltics+osint |  |  |
| S12.LT.01 | S12 | LT | VPT reports (to 2023); EU funds 2014-2020 | C | 4.5% tenderers; 3.2% EU funds | API; licence verified Y (catalogue); current procurement not open by supplier | baltics |  |  |
| S12.LT.02 | S12 | LT | Kohesio projects + beneficiaries | B | 98.4% of beneficiaries joinable by register code | bulk; licence verified Y; CC BY 4.0; slow refresh (2021-27 rows unchanged March to October 2026) | baltics |  |  |
| S12.LT.03 | S12 | LT | TED award notices (EU-wide) | A | 92% keyed; 43% of samples | API + bulk; licence verified Y | osint |  |  |
| S12.LV.01 | S12 | LV | IUB procurement notices; CFLA EU-funded projects | A | 2.6% + 2.6% | bulk; licence verified Y; daily JSON and CSV; regcode join 99% | baltics |  |  |
| S12.LV.02 | S12 | LV | Kohesio projects + beneficiaries | C | 32.1% of beneficiaries joinable; 0% of 2014-20 projects | bulk; licence verified Y; CC BY 4.0; most LV rows match by name only | baltics |  |  |
| S12.LV.03 | S12 | LV | TED award notices (EU-wide) | A | 99% of winners keyed by register code; 25% of samples won one | API + bulk; licence verified Y; above-threshold contracts only | osint |  |  |
| S12.EE.01 | S12 | EE | public procurement register (award notices) | B | 1.2% | bulk; licence verified Y (CC BY-SA 3.0); 1.2% of active companies won a contract in 12 months; 3,821 Estonian suppliers; EU funds via Kohesio (cross-border) | baltics |  |  |
| S12.EE.02 | S12 | EE | Kohesio projects + beneficiaries | B | 97.3% of beneficiaries joinable | bulk; licence verified Y; CC BY 4.0; slow refresh | baltics |  |  |
| S12.EE.03 | S12 | EE | TED award notices (EU-wide) | A | 99% keyed; 44% of samples | API + bulk; licence verified Y | osint |  |  |
| S12.US.01 | S12 | US | USAspending | A | 0% public, 20% private (1/5) | API, no key; licence verified partial | us |  |  |
| S12.US.02 | S12 | US | SBA PPP loans | C | 20% public, 20% private | bulk, static; licence verified Y | us |  |  |
| S13.LT.01 | S13 | LT | JAR documents; statement filing dates; non-filer lists | B | 87.9% | API; licence verified Y; document type and date only, since 2024 | baltics |  |  |
| S13.LV.01 | S13 | LV | FS filing years; memorandum dates | B | 74% | bulk; licence verified Y; documents themselves per-query at info.ur.gov.lv | baltics |  |  |
| S13.EE.01 | S13 | EE | annual-report list, registry-card entries, rulings | A | 83.3% | bulk; licence verified Y; filing dates and entry types; full reports via contract API | baltics |  |  |
| S13.US.01 | S13 | US | EDGAR filings, 8-K items (5.02) | A | deferred: User-Agent pending; item numbers on 100% of 1,042 8-Ks | API + daily index; licence verified Y | us |  |  |
| S13.US.02 | S13 | US | State filing history (NY daily filings, CO transactions) | A | 40% private (2/5, all samples combined) | bulk; licence verified Y | us |  |  |
| S13.US.03 | S13 | US | CT business filing history | B | included in the 40% above | bulk daily; licence verified partial (no licence stated on this dataset) | us |  |  |
| S14.LV.01 | S14 | LV | (none in LV open data) | D | 0% | none; licence verified N; exchange data not researched for LV | baltics |  |  |
| S14.EE.01 | S14 | EE | none in this area | D | - | listed securities not researched here | baltics |  |  |
| S14.US.01 | S14 | US | SEC Forms 3/4/5 trades | A | 100% public (5/5) | bulk quarterly + live; licence verified Y | us |  |  |
| S14.US.02 | S14 | US | Tickers and exchanges | A | deferred: User-Agent pending | bulk JSON; licence verified Y | us |  |  |
| S14.US.03 | S14 | US | SEC XBRL `dei` facts; price with user key | B | deferred | API; licence verified Y; key pending (`SEC_USER_AGENT`) | markets |  |  |
| S14.LTLVEE.01 | S14 | LT, LV, EE | ESMA FIRDS | A | 73/73 LEI and ISIN | API; licence verified Y; reference data only, no prices | markets |  |  |
| S14.LTLVEE.02 | S14 | LT, LV, EE | prices | D | 0 | no free reusable source found | markets |  |  |
| S15.LT.01 | S15 | LT | web search → DNS, WHOIS, CT, Wayback, homepage | C | website found 29% | per-query; licence verified Y; .lt WHOIS gives registrant name and dates, no code | osint |  |  |
| S15.LV.01 | S15 | LV | Applicant website in EU funds; winner websiteURI in procurement | C | <3% | bulk; licence verified Y; incidental only, the web agent fills it | baltics |  |  |
| S15.LV.02 | S15 | LV | web search → DNS, WHOIS, CT, Wayback, homepage | C | website found 25% | per-query; licence verified Y; .lv WHOIS gives the register code, no dates | osint |  |  |
| S15.EE.01 | S15 | EE | register contacts (WWW) | C | 6.3% of active business-form companies (5.6% of all active entities, as in osint.md) | bulk; licence verified Y; register website field only; web data is the osint area | baltics |  |  |
| S15.EE.02 | S15 | EE | register website field → DNS, WHOIS, CT, Wayback, homepage | B | website 100% of sample (by selection); resolves 67% | per-query; licence verified Y (WHOIS: query time only); population share: see §2 | osint |  |  |
| S15.US.01 | S15 | US | SAM.gov URL or web search → DNS, RDAP, CT, Wayback, homepage | B | website 100% of sample; RDAP date 100%; registrant 0% | per-query; licence verified Y | osint |  |  |
| S16.LV.01 | S16 | LV | (none) | D | 0% | n/a; osint area | baltics |  |  |
| S16.EE.01 | S16 | EE | none in this area | - | - | osint area | baltics |  |  |
| S16.US.01 | S16 | US | SEC / DOJ / FTC press releases | A | not measured on the sample | bulk; licence verified Y (public) | osint |  |  |
| S16.ALL.01 | S16 | all | GDELT DOC 2.0 (news, last 3 months) | C | 16% raw hits; 41% of queries answered | API; licence verified Y; 1 request per 5 s per IP; titles + links only | osint |  |  |
| S16.ALL.02 | S16 | all | social profiles linked from the company's own website | C | 41% | per-query; licence verified Y (own site); links only, no platform data | osint |  |  |
| S16.ALL.03 | S16 | all | review platforms | D | - | paid or AI-restricted; licence verified Y; LATER | osint |  |  |
| S16.ALL.04 | S16 | all | social platform APIs | X | - | terms ban investigating, background checks and eligibility uses (§1.4) | osint |  |  |
| S17.LT.01 | S17 | LT | shared addresses only | C | 100% address, 0% people | bulk; licence verified Y; no person links possible | baltics |  |  |
| S17.LV.01 | S17 | LV | Officers + members + beneficial owners, linked by name + masked code (derived) | B | 49% | bulk; licence verified Y; collisions possible; person data only in company context | baltics |  |  |
| S17.EE.01 | S17 | EE | person hash across card, member and BO files | A | 97.2% | bulk; licence verified Y; links people across companies without personal codes; legal memo decides how far a person network may be shown | baltics |  |  |
| S17.US.01 | S17 | US | Shared insiders across issuers (SEC insider CIK) | A | deferred: User-Agent pending | derived; exact person id | us |  |  |
| S17.US.02 | S17 | US | Shared officers by name within a state (FL, CT, PA) | C | not measured | derived; name-only match, label "same name" | us |  |  |
| S18.LT.01 | S18 | LT | status, VMI arrears, non-filer flags, statements, taxes paid | A | 100% | bulk + API; licence verified Y; transparent inputs available | baltics |  |  |
| S18.LT.02 | S18 | LT | Sodra debts and insured counts | C | 15.4% debt; 46.4% insured | bulk; licence verified N (none stated, public by law) | baltics |  |  |
| S18.LV.01 | S18 | LV | VID rating; FS; insolvency; suspensions; minimum-wage employer list | A | 92% | bulk; licence verified Y; all inputs open | baltics |  |  |
| S18.EE.01 | S18 | EE | derived from S02, S06-S09 | B | - | bulk; licence verified Y; status, key figures, tax debt, taxes paid, pledges, insolvency notices are all machine-readable | baltics |  |  |
| S18.US.01 | S18 | US | Status, UCC, exclusions, revocations, court cases, PPP charge-off | C | see sections | derived; the US has no tax-debt or payment-default data | us |  |  |
| M01.X.01 | M01 | - | Fed Z.1 via FRED (quarterly) | B | 1/3 series | API/CSV; licence verified Y; quarterly only, includes non-listed equity | markets |  |  |
| M01.X.02 | M01 | - | S7 or S6 with user key | C | 3/3 series (estimated) | user key; licence verified Y; personal use; ETF proxies on S7, S&P 500 paid on S6 | markets |  |  |
| M02.X.01 | M02 | - | S7 with user key | C | 1/1 (estimated) | user key; licence verified Y; ETF proxy | markets |  |  |
| M03.X.01 | M03 | - | TWSE OpenAPI, FRED `NIKKEI225`, ECB FX | B | 2/7 series | API; licence verified Y; Taiwan history from first run; Japan self-hosted only | markets |  |  |
| M03.X.02 | M03 | - | S7 with user key; KRX with key | C | 7/7 (estimated) | user key; licence verified Y; country ETFs in USD | markets |  |  |
| M04.X.01 | M04 | - | S7 with user key | C | 2/2 (estimated) | user key; licence verified Y; ETF proxies | markets |  |  |
| M05.X.01 | M05 | - | World Bank Pink Sheet | B | 1/1 | bulk XLSX; licence verified Y; monthly only | markets |  |  |
| M05.X.02 | M05 | - | O5 oracle via O3; S3 or S6 with user key | C | 1/1 | API (on-chain) / user key; licence verified N for the oracle | markets |  |  |
| M06.X.01 | M06 | - | O3 height (computed supply), O5 oracle, X4 candles | C | 2/2 (bitcoin, ether price) | keyless API; licence verified Y (O3, X4), N (O5); ether cap needs C1 supply | markets |  |  |
| M06.X.02 | M06 | - | C1 global, C3 peak | C | 1/1 (total market) | keyless API; licence verified Y; attribution; C3 personal use only | markets |  |  |
| M07.X.01 | M07 | - | EIA spot via FRED | B | 2/2 | CSV/API; licence verified Y; 2-day lag; licence caveat: vendor-permission note (open question 3), A once legal clears it | markets |  |  |
| M08.X.01 | M08 | - | Treasury Fiscal Data, Debt to the Penny | A | 1/1 | API; licence verified Y; daily, ticker is an estimate | markets |  |  |
| M09.X.01 | M09 | - | FRED `DGS10`, `UNRATE` (proposal) | A | 2/2 | CSV/API; licence verified Y; both public domain | markets |  |  |
| OUT.US.01 | - | US | FEC individual contributions | X | n/a | 52 U.S.C. 30111(a)(4): no commercial use; never list donors | us |  |  |
| OUT.US.02 | - | US | FEC company PAC | B | not run | bulk; licence verified Y; later (not in the counterparty job) | us |  |  |
| OUT.US.03 | - | US | IRS 990 / EO BMF (non-profits) | A | not run | bulk monthly; licence verified partial; later | us |  |  |
| OUT.US.04 | - | US | USPTO trademarks and patents | D | not run | key required for every endpoint; terms not read; later | us |  |  |
