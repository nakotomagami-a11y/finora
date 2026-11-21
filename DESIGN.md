# DESIGN

> **Status: v1, phase 3.** Grounded in the council's data record (`docs/plan/council/01-data.md`, Part G is authoritative), the legal memo (`docs/research/legal.md`) and the agreed contract (`docs/plan/reviews/00-early-plan-review.md`). Where this file and the council record disagree, the council record wins and this file is the bug.
>
> **Mockups:** `docs/design/mockups/`, static HTML with fictional data and no build step. Start at `index.html`, which links every screen and state. Open it directly in a browser, or run `python -m http.server 8080 -d docs/design/mockups` and go to `http://127.0.0.1:8080/`. Every state is a URL parameter; the floating "Mockup states" panel (collapsed by default, `&panel=open` expands it) switches between them and the theme.
>
> **Related:** `docs/design/IA.md` (routes and navigation for many tools), `docs/design/display-options.md` (the advice trail behind the council's calls).

## 1. Reading this as

A **daily research desk**. A person types a company and sees at once what the official registers say, with every gap named. When a deal is at stake they press **Investigate**, and four agents dig further in parallel, visibly, ending in a rule-based verdict with sources. Tools other than company research (Crash monitor first) live in the same shell and use the same components.

## 2. Tone and principles

**Quiet, exact, sourced, alive.**

- **Quiet.** Warm near-black (or warm paper in the light theme), hairline borders, one sand accent. It is opened ten times a day, so it never tires the eye and never decorates.
- **Exact.** Tabular figures, a date on every value, the register's own words.
- **Sourced.** Every value carries a source chip with licence, date and confidence. "Nothing found", "nobody publishes this" and "we may not show this" look different.
- **Alive.** While agents work, lanes tick, tasks finish, sources count up and findings land in their sections. Motion stops when work stops.

An editorial serif (Instrument Serif) carries headings and the verdict, so the page reads like a written report. Geist carries all UI text; Geist Mono carries agent activity, codes, counts and source chips.

Principles:
1. **Official first, agents second.** The company page shows register data instantly from the local store. Agents add findings; they never overwrite official values.
2. **Never a blank section.** Every gap has a named state (§5). "Missing does not mean clean" is said wherever it matters.
3. **Show the work.** Every agent, task, source, question and its usage is visible while it happens and stays inspectable in the report.
4. **Opinion is labelled.** Rule-based, AI-written, official, corroborated, single-source, inferred and derived each look different.
5. **Colour carries meaning, never alone.** Every status colour pairs with an icon, a sign or a word. "None found" and "No concerns found" are never green.
6. **One shell, many tools.** A new tool adds a manifest and routes, not a new visual language.

## 3. Tokens

Source of truth: `docs/design/mockups/assets/tokens.css`. The build copies these values into `packages/ui/src/tokens.css` and exposes them to Tailwind v4 through `@theme`. Dark is the default; light follows `prefers-color-scheme` or the user's choice in Settings.

### 3.1 Colour

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0f0e0d` | `#f6f4ef` | page |
| `--surface` | `#171614` | `#ffffff` | cards, sections, panels |
| `--surface-2` | `#201e1b` | `#eeebe4` | wells, inputs, chips, coverage line |
| `--line` | `rgb(255 255 255 / .08)` | `rgb(0 0 0 / .09)` | hairlines |
| `--line-strong` | `rgb(255 255 255 / .16)` | `rgb(0 0 0 / .18)` | button borders, hovered rows |
| `--ink` | `#ece8e1` | `#1b1916` | primary text |
| `--ink-2` | `#c9c4bb` | `#45413b` | secondary text, "None found" lines |
| `--muted` | `#a29d94` | `#5f5a52` | captions, labels, gap rows |
| `--faint` | `#7d786f` | `#8a857c` | icons and dividers only, never text |
| `--accent` | `#d9b98a` | `#7a5c24` | primary action, focus ring, running pulse, the subject node |
| `--on-accent` | `#1a1410` | `#ffffff` | text on accent fills |
| `--good` | `#7cc98f` | `#1a6c34` | recoveries and "Current" health only; never "None found" or "No concerns found" |
| `--warn` | `#e5b45a` | `#8a5a00` | Points to check, waiting on you, stale dates |
| `--bad` | `#f2806f` | `#b3261e` | Serious concerns, losses, form validation errors, failure banners. Never the text of a data row: a "Not checked" row uses a `--warn` icon on `--muted` text (§5), so missing data never reads as a finding |
| `--info` | `#8db4e6` | `#2559a8` | agent findings, AI-written tag, derived values |

Each status colour has a `-tint` (10% over `--surface`) for backgrounds, plus `--accent-tint`.

**Measured contrast (WCAG):** every text token is at least 4.5:1 on `--bg`, `--surface` and `--surface-2` in both themes. The lowest values are light `--accent` at 5.21:1 and light `--good` at 5.45:1 on `--surface-2`, and dark `--muted` at 6.17:1 on `--surface-2`. `--faint` (3.1 to 4.4:1) is never used for text. An axe run over the mockups in both themes found no contrast violations.

### 3.2 Type

Fonts are self-hosted under the SIL Open Font License (`mockups/assets/fonts/`, licence files alongside); no third-party font CDN. Geist Sans covers every Baltic letter in one file. Geist Mono and Instrument Serif need both their latin and latin-ext files, split by `unicode-range` (measured in Chromium).

| Role | Face | Size / line, desktop (mobile) | Weight |
|---|---|---|---|
| Display: the verdict level | Instrument Serif | 56/60 (40/44) | 400 |
| H1: company name, page title | Instrument Serif | 40/44 (30/34); clamped to 3 lines, full name in the tooltip and identity row | 400 |
| H2: section | Instrument Serif | 26/32 (23/28) | 400 |
| H3: card and tile title | Geist | 15/22 | 600 |
| Body | Geist | 14/22 | 400 |
| Small | Geist | 13/20 | 400 |
| Label (overline) | Geist | 11/16, tracking .08em, uppercase | 500 |
| Mono: activity, codes, chips, coverage line | Geist Mono | 12/18 | 400 |
| Numbers | any face, `font-variant-numeric: tabular-nums` | | |

### 3.3 Spacing, radius, elevation, motion

- **Spacing:** 4 px scale: 4, 8, 12, 16, 20, 24, 32, 40, 56, 72.
- **Radius:** chips and inputs 6, buttons 10, cards and sections 14, the verdict block 20, pills full.
- **Elevation:** none on the page; layers come from `--surface` against `--bg` plus hairlines. Popovers, sheets and the command bar use `--shadow-pop`.
- **Motion:** 120 ms hover and focus, 200 ms expand and collapse, a 1.6 s pulse on a running agent's dot, and a 600 ms accent ring when a finding lands. `prefers-reduced-motion` turns all animation off; counters still update.
- **Layout:** tool rail 72 px; aside 360 px (320 px under 1280); content max 1240 px.

## 4. Copy rules

- **Voice:** plain, short, literal. Sentences, not labels, for states ("Checked the debtor list as of 19 Nov 2026: none found").
- **Banned in every string Finora writes**, controls included, case-insensitive and whole-word **with inflections**: *clear, cleared, clears, clearing; safe, safely, safety; avoid, avoided, avoids; scam, scams, scammer; fraud, frauds, fraudulent, fraudster*, letter grades and anything that reads like a credit score (council session 2). Approvals by people read "approves", never "clears". Use "Reset", not "Clear". The only exemption is a verbatim excerpt shown in the `Quote` component with its citation.
  - **Other locales (draft for native review in `packages/i18n/REVIEW.md`):** Baltic languages inflect, so the test matches word stems, not whole words. Proposed stems: LT `švar`, `saug`, `venk`, `apgav`, `sukč`; LV `tīr`, `droš`, `izvair`, `krāp`; ET `puhas`, `turval`, `vältig`, `pett`. A native reviewer confirms the list and removes stems that also match innocent words (for example LT `saug` in "saugoti", to keep). Until then the locale test reports matches as warnings, and the English test fails the build.
- **Register words first.** Status pills and legal forms show the register's own word plus an English gloss: `SIA · limited company`, `Likviduojamas · under liquidation`. Never our paraphrase alone. A tax authority's own rating is shown verbatim as "Tax authority's rating: A", never restyled as a Finora score.
- **Dates:** `19 Nov 2026` in prose and chips (`19 Nov` when the year is the current one); `FY 2025` or `FY to Jun 2025` for financial periods (non-calendar years name the period end).
- **Money:** the company's own currency, never converted silently. `€212k`, `EUR k` in table headers, `USD m` for US public companies. Pre-euro Latvian figures say "LVL (before the euro)". Figures filed in thousands carry "Reported in thousands".
- **Check 5 wording** ("Accounts filed"): the line says what the register holds, "Annual report for [year] in the register since [date]" or "Annual report for [year] not in the register, [N] months after the year ended". It never says "late", "overdue" or "deadline" (architecture, `filing-window.test.ts`); the window is Finora's estimate, not a legal deadline.
- **Fixed lines** (copy keys, not free text):
  - Rule 6 disclaimer: "Not a credit report. Not for credit, employment, tenancy or insurance decisions."
  - Facts-only: "Facts only: no verdict is given on a private individual."
  - Caveat suffix for checks: "Missing does not mean clean."
  - Coverage line: "[Country]'s official data: … Not in open data: …" (council Part A, CMO copy).
- **Every empty state comes from the council's keys** (Part D), rendered as in §5.

## 5. Display states

Every value renders through `FieldRow` with an `itemId` from Part G. The section DTO is the architect's union; each state below has exactly one rendering. The mockup `company.html` shows all of them across its country variants.

| DTO state | Council key | Icon | Copy | Notes |
|---|---|---|---|---|
| `data{freshness: current, completeness: full}` | SHOW | none | the value | source chip and confidence at the row end |
| `data{… completeness: partial}` | SHOW | none | value with a dotted underline | the gap is spelled out under it ("2022 not filed · the column is empty, not zero") |
| `data{freshness: stale}` | | amber chip date | value | chip and popover say "older than this source's [cadence] cycle" |
| `data` + caveat key | CAVEAT | `info` | caveat line under the value, muted, never only in a tooltip | checks add "Missing does not mean clean." |
| `checked_none{source, asOf}` | CN | `check` in `--ink-2` | "Checked [source] as of [date]: none found" | never green |
| `not_published{country}` | NP | `dash` | "Not published in [country]", or the council's row-specific line | a section where every row is NP collapses to one line |
| `not_checked{reason: later}` | NC | `dash` | "Not checked in this version" | only where a primary job needs the row |
| `not_checked{reason: error}` | NC | `warn` in `--warn` | "Not checked: [reason] · Retry" | |
| `not_checked{reason: skipped}` | NC | `dash` | "Not checked: [why the run skipped it]" | |
| `not_checked{reason: paid_only}` | PAID | `euro` | "Available as a paid register extract" + "Order from the register" | link only to the official register's own ordering page; no link if none exists |
| `not_checked{reason: needs_key}` | KEY | `key` | the row's setting, "Set the SEC contact in Settings" (the only optional local setting in v1; H5: no API keys) + Settings link | |
| `not_checked{reason: needs_source}` | | `settings` | "Not configured: add provider [code] to your local provider file" + "How to set it up" | a coded source with no entry in the local provider map (C15); the same copy and icon as the Crash monitor row state `not_configured` (§12); never a number, never "none found" |
| `not_checked{reason: needs_purpose}` | | none | the purpose gate itself (§8.3), never the words "Not checked" | |
| `not_checked{reason: agent_only, agentId}` | AGENT | `agent` | "Not checked here: the [agent] agent checks this when you investigate" | becomes a running line, then a finding, during a run |
| `not_checked{reason: manual_lookup, url}` | MANUAL | `hand` | "Check manually at [official site] · Open" | url on the official-host allowlist |
| `not_checked{reason: restricted, basis}` | LOCK | `lock` | "Not shown in [country]: restricted by [legal basis]" | keyed on the rule (country, legal form, section), never on the record |
| `disputed{disputeId}` | | `flag` | "Under review after an objection, since [date]" | value hidden, chip kept |
| `Check.state = not_evaluated{trackedSince}` (P14) | | `clock` | "Not evaluated: tracked since [date]" | **check level, not a section state** (architecture §7.2): shown in the checks list and the check's line; the S02 history row shows the data as `partial` ("4 days of history, tracked since …"). Never reads as clean |
| `loading` (client only) | | skeleton | | width of a typical value; `aria-busy` on the section |
| HIDE | — | | no row, no field, no count | negative-tested |

**Optional fields** (LEI, VAT, website, ticker) are omitted when absent; core fields always render a state.

## 6. Provenance

### 6.1 SourceChip

A mono chip at the row end: `Register LV · 19 Nov`. Click or Enter opens a popover (Esc closes it, returns focus to the chip and resets `aria-expanded`). On desktop the popover is positioned against the viewport (so a scrolling table can never clip it), opens under the chip, flips up or sideways to stay on screen, follows the chip on scroll and closes when the chip leaves the screen; under 768 px it is a bottom sheet across the screen. It with: source name, licence, access tier (open data / share-alike store / your key / display only / query time / shown after a stated purpose), the source's as-of date, retrieved at and by which loader or agent, an excerpt for agent findings, "Open the record" (where a stable per-record link exists) and "How this source is used" (Sources page). Variants: `web` (agent finding, `--info` text), `derived` ("Derived by Finora", dashed border, with "Computed from"), `stale` (amber).

### 6.2 Confidence

A small badge before the chip. Names, not percentages.

| Level | Badge | Meaning |
|---|---|---|
| Official | solid dot | read from an official register or filing, unchanged |
| Corroborated | two dots | two or more independent sources agree |
| Single source | hollow dot | one non-official source |
| Inferred | dashed dot | an agent concluded it from other findings; never a key finding on its own |
| Derived by Finora | square | computed by our own deterministic code (shared-address counts, parent links, future estimates) |

### 6.3 Text labels

- `AI-written` (`--info` tag): the verdict explanation, every agent finding sentence, chat answers, exports of those.
- `Rule-based` (neutral tag): the verdict level, which fixed rules set.
- They never share a sentence.

## 7. Information architecture

Summary; routes and the tool manifest are in `docs/design/IA.md`.

- **Tool rail** (left, 72 px, icon plus label; a bottom bar under 768 px): Explorer, Library, Crash monitor; Sources and Settings at the bottom. Built from tool manifests.
- **Top bar:** the command bar (`/` or Ctrl+K anywhere, or the top-bar field; `?cmd=open`): a modal palette: the input is a `combobox` controlling a `listbox` of grouped `option`s (companies with their distinguishing facts, investigations, tools and pages), filtered as you type, ↑ ↓ move the selection (`aria-activedescendant`, `aria-selected`), Enter opens it, Esc closes and returns focus to whatever opened it. On the search page `/` focuses the search box instead. Then today's spend against the daily cap, the theme control: a three-way System / Dark / Light switch (S03; System follows the OS). The language switch (EN, LT, LV, ET) lives in the footer on every page and in Settings, never in the top bar.
- **The main flow is one page.** Search → company page with official data at once → Investigate → the same page gains the agent panel, findings land in their sections → the verdict appears on top and a chat docks in the aside. The URL becomes stable when the run starts (`.../runs/[id]`), so the run can be shared, reopened and re-run.

## 8. Screens and states

| Screen | Mockup | States |
|---|---|---|
| Search (home) | `search.html` | empty home with country status and recent runs; results grouped by country with distinguishing facts; very long name; a country still loading ("Estonia: loading, 62%"); US live registers streaming; no match (lists the registers checked, offers "Investigate this text"); live registers failed |
| Company profile | `company.html?state=full` | Latvia, Estonia, Lithuania, US private, US public, US public without the SEC contact, sole trader; purpose gate unset; new install (snapshot rules not evaluated); long name; loading; error |
| Investigate | `company.html?state=estimate`, `first-run`, `cli-missing`, `cli-signed-out`, `daily-cap` | pre-run usage estimate; one-time extra-usage notice; Claude Code not installed; not signed in; daily usage cap reached |
| Investigation running | `company.html?state=streaming` | agent panel with lanes and task sub-rows; findings landing; header stats |
| Agent asks you | `company.html?state=question&q=…` | which company (no default), possible sanctions match, is this website theirs (scope), usage cap reached, cap reached with the extension used |
| Report | `company.html?state=report`, `partial` | No concerns found, Points to check, Serious concerns, Not enough data; one agent failed (the web agent, so check 11 is not run). The facts-only variant is a profile state (`?country=sole-trader`) |
| Network explorer | `network.html` | graph, list twin, address hosting 412 companies, no links, loading, error |
| Library | `library.html` | list, filtered, empty, loading, error |
| Crash monitor | `crash.html` | keyless (current), one source stale, one source failed, loading, Taiwan peak seeded |
| Settings | `settings.html` | ready, Claude Code not installed, not signed in, history near its limit |
| Sources | `sources.html` | all current, one source stale, loading; filter by country |

### 8.1 Company page anatomy

1. **Header:** overline (`Company · Latvia`, `Investigation running`, `Investigation report · [date time]`), H1 name, meta row (status pill with gloss, legal form with gloss, code, address), actions.
   - Profile actions: **Investigate** (primary), Network, Report a problem. There is no Export action in v1 (council session 2: define it or remove it; removed). A natural person or sole trader gets no Investigate action: agents never run on one (architecture §7, R5, P6).
   - Run actions: Stop and write the report, Skip to report.
   - Report actions: Network, Re-run, Report a problem.
2. **Facts-only disclaimer** (sole traders and natural persons, P6) directly under the actions.
3. **Coverage line** before any result: "[Country]'s official data: … Not in open data: …".
4. **During a report:** the verdict block and "The 11 checks" sit above the sections.
5. **Section index** (pills linking to sections) on profile and report.
6. **Sections**, in order: S02 Status and history, S03 People, S04 Owners, S06 Financials, S07 Workforce, S08 Taxes and arrears, S09 Insolvency, pledges and notices, S10 Courts, S11 Sanctions and watchlists, S13 Filings and events, S14 Securities (US public), S15·S16 Web presence and news, S17 Network. S01 is the header. S05 and S12 are LATER and not rendered. Each section header carries its id and "Report a problem".
7. **Footer:** the attribution lines of every cited source (deduplicated), the disclaimer when a person is shown, "AI-written text is labelled", and the correction link.
8. **Aside:** profile shows "Checks from official data" (checks 1 to 9; 10 and 11 say "Runs when you investigate") with the Investigate button and the typical usage ("about 150k standard tokens"). It opens with the fixed line (council session 2, item 13; the condition of O1): **"No verdict yet. These checks use official data only; the rest run when you investigate. Missing does not mean clean."** A check whose data is past its source's cycle shows a **clock**, never a check mark. Under 1024 px, where the aside moves down, a **checks tally** under the header repeats "No verdict yet" with counts (on record, to check, not possible, past their cycle) and links to the panel; run shows the agent panel; report shows the chat dock (plus the lanes when an agent failed).

### 8.2 Section rules by country

The calls are Part G; the treatments the mockups show:

- **S02:** status pill in register words; dated events where history exists; "Changes in the last 6 months" from our snapshots, or "Not evaluated: tracked since [date]" on a new install.
- **S03:** purpose gate, then a role table with the purpose line above it. LV, EE, US: "Current roles only; past roles are not published. People appear only in this company's context." LT: role facts ("Has a manager since …", "No board") and names as `paid_only`. US private states that publish no officers: NP. Personal codes, hashes and birth dates never appear (P3). Every table with names ends with the rule 6 disclaimer line. **LV fallback** (`LV_PERSON_ROWS=role_counts`, a lawyer trigger; `?lvpeople=role_counts`): role counts and start dates, a LOCK row "Officer names: pending a legal review", the caveat "Officers are not screened against sanctions lists: names not loaded", check 3 on counts and dates, check 9 "Company screened; officers not screened: names not loaded", and the coverage line adds "officer names (pending a legal review)".
- **S04:** LV and EE show company members only; members who are private individuals and beneficial owners are LOCK rows citing legal rule 1. LT is `paid_only`. US private is NP ("No US source publishes owners of private companies"). US public shows 13D/G and 10% holders behind the purpose gate.
- **S06:** five years, newest first, currency and period in the header; sparkline and last-year change with arrow and sign; "[year] not filed" as partial; "All line items" disclosure. US private collapses to one line. Sole traders: behind the purpose gate, facts only.
- **S07:** headcount plus a 24-month line; EE uses the three council lines ("N employees on [date] …", "No employee count from the tax board for [quarter]", "Paid no state taxes in [year] …").
- **S07 and S08 in LT, social insurance** (`agent-only` while `LAW-SODRA` is open): the profile shows the AGENT state ("the money and tax agent checks this when you investigate"); the report shows the money agent's live reading with a chip whose access reads "read live by the money and tax agent, not stored". LT check 7 runs on the VMI arrears list, and the arrears age counts from the list's entry date ("since 2 Sep 2026 (79 days)").
- **Sole traders, dropped data** (council item 11): every row and check whose data is not loaded for a natural person (bankruptcy and insolvency, securing measures, activity suspensions, tax arrears, social-insurance debt, taxes paid) renders the rule-based lock "Not shown for a sole trader: restricted by legal rule 5", identical for every sole trader, never "none found". Test: a bankrupt and a non-bankrupt fixture sole trader give the same output.
- **S08:** an arrears check line first, then taxes by year. LV debt amount is MANUAL; LV rating verbatim. EE tax data carries a `CC BY-SA` tag and "Left out of exports". The LT arrears age counts from the list's entry date, so it is evaluated from day one. US collapses to one line. Sole traders: no S08 at all (HIDE).
- **S09:** one check line per register; US says "Checked UCC filings in Colorado and Connecticut only; other states not checked".
- **S10 in LT, LV and EE:** MANUAL in v1 (council, Baltic court rows): "Check manually at the official court-decision portal", with a caveat that agents don't search it in this version. Check 10 counts as not possible there, and the coverage line names it ("court cases (check manually at the court portal)"); never "none found". In LV, case numbers on S09 events link to the portal, but that does not count as running check 10. Baltic investigations reach at most 10 of 11 checks.
- **S15, no web search in v1** (council, legal gate 1): the web check runs only on a **known domain**: one the user typed, one the register lists, or one Finora verified from the company's own registered name (the page must state the registry code or VAT number). Its line always says how the site was found: "Web check: run on a domain you gave / the register lists / Finora verified", or **"Web check: not run, no website known (add one to check it)"**, never "none found". The S15 caveat reads "Checked from a known domain only; no web search in this version". The web lane shows its real tasks (domain, DNS, certificate logs, homepage through Finora's page filter, news from dataset P4), never search queries.
- **S15, offer domain** (council item 7, O2; `agents.md` §2.5): with an offer domain, the web section reports it first, in one of four outcomes (the signals). The three that aren't tied all fire the one rule `website_inconsistent` (point to check):
  - `offer_domain_tied`: a fact, none found ("paraugs-timber.example is the company's website …");
  - `offer_domain_not_tied`: "[domain] is not linked to [company] in the register or on its own website";
  - `offer_domain_other_company`: "[domain] belongs to another company: its homepage states registration no. …", **ranked first among points to check** in key findings;
  - `offer_domain_unresolvable`: "[domain] does not resolve".
  `website_inconsistent` is also the rule for the register-listed domain. `domain_newer_than_company` fires only on a **registry creation date** (US RDAP, .lt) under 12 months old or newer than the company; certificate-log dates read "certificates seen since [date]" and never fire it. Mockups: `?state=report&offer=match|mismatch|other|unresolvable`.
- **S10 in the US, S11 live lists, S15, S16:** AGENT on the profile; a running line during a run; findings in the report. Court parties who are not proven companies read "a private individual" (P8).
- **S11:** one line per list with its as-of date; a hit becomes a question card (§9.2).
- **S14:** US public only: ticker, net insider buys and sells per quarter behind the purpose gate.
- **S17:** a one-line summary with a "Derived by Finora" chip and "Open the network explorer".

### 8.3 Purpose gate (P2)

A well inside the People (and US Owners, Securities) section: legend "Why are you looking at the people in this company?", four fixed purposes as radio buttons, a note ("Asked once and kept for 12 hours. Each company you open is logged with this purpose. Not available for credit, employment, tenancy or insurance decisions about a person.") and **Show people**. After it, a purpose line sits above each person section: "Purpose: … · change". The purpose list never contains a blocked use (P7).

## 9. Agents on screen

### 9.1 Agent panel (streaming)

- **Header stats**, mono, in the page header: `Investigating · 4 agents · 23 tasks · 31 sources · 18% of the cap`, with a progress meter. A polite live region announces at most one update per lane step.
- **Lanes,** in order: Lead (resolve and plan), Registry and people, Money and tax, Legal, insolvency and sanctions, Web, domain and news, Verdict. Each lane shows:
  - status (`queued`, `running` with a pulsing dot, `waiting`, `done`, `failed`, `stopped`) as word plus dot;
  - name; `elapsed · usually [typical] · N% of the cap` in mono (typical: 15 to 35 s; web 1 to 2 min);
  - a lane whose Claude Code process is retrying a short burst reads **"waiting: Claude is busy"** (`?state=streaming&lane=busy`). It is not a pause: caps and backstops still apply, and Finora starts nothing to get round it. Only the plan limit pauses the investigation (a limit result, a rate-limit retry at its last attempt, or a retry delay over 60 s; C18);
  - a lane queued by the concurrency limit reads **"waiting to start"** with "starts when a lane finishes", so all four agents stay visible even when fewer run at once (council; `?state=streaming&concurrency=2`);
  - the current step (`› reading the news index (query 2 of 4)`);
  - **task sub-rows** from `run.task`: icon (check, spinner, clock for queued, x for failed, skip), label, sources read or "queued"/"skipped".
- **Findings land in their section** with a 600 ms accent ring; the section shows "The [agent] agent is checking this now: [step]" until then.
- **Waiting lanes** get an amber border; failed lanes a red border.
- **Under 1024 px** a compact lane list sits right under the page header (one line per lane: status, name, current step or tasks done, time and share of the cap; "All tasks and sources" jumps to the full panel), and a sticky **run bar** under the top bar carries the state ("4 agents · 2 running · $0.27 of $1.50", or "Needs you", or "Reconnecting") and a "Show agents" link that jumps to the panel. A question card always renders inline at the top of the content.
- At most one question per run and three per investigation (`agents.md` §7).
- **Stopped by you** (`?state=report&stopped=yes`): "Stop and write the report" ends every running lane as `stopped`, the verdict step writes from the findings so far, checks that had not finished count as not run, and an info banner says so with a Re-run link.
- **A failed lane** shows "Retry this agent" on the lane; the report banner offers the same (`?state=partial`).
- **Reconnecting** (`?state=reconnecting`): the header stats read "Reconnecting · last update [time]", running lanes add "last update N s ago", and a warn banner says "Connection lost at [time]. Reconnecting (attempt N)… The run keeps going on this machine; when the page reconnects it catches up from the last event it saw. Nothing is lost." with Retry now. The stream resumes from `Last-Event-ID`; nothing on the page is cleared.

### 9.2 Question cards

A card pinned at the top of the primary column (`id="question"`), amber border on amber tint: "Needs you" status, the asking agent, an H2 question in serif, options, then a footer naming the agents that wait and what happens if nobody answers.

| Kind | Options | Default and timeout |
|---|---|---|
| (all agent questions) | the question text and reasons are written by an agent, so the card header carries the `AI-written` tag; the usage-cap and plan-limit cards are `Rule-based` | |
| `entity_choice` | one card per candidate with code, legal form, status, city, registration year; "None of these" | **no default, no countdown**; on timeout the run ends "Not enough data: company not confirmed"; nothing is shown until the company is pinned |
| `sanctions_match` | side-by-side table of the fields either side has (identifiers first), each marked similar / differs / not on list, all neutral colour; Same company / Different company / Not sure | 30 min: recorded as "possible match, needs review (answered by default)"; "Not sure" is a soft flag; "sanctioned" appears only for an ID-confirmed primary-list entry |
| `scope` (`agents.md` §7) | "Is [domain] this company's website?" with how it was found, what the site says and the domain's age; Yes / No / Not sure | 30 min: "Not sure"; until confirmed, findings from the site are "name only" and can raise at most a point to check |
| `cap_reached` | "Stop here and write the report" (default), "Allow up to a third more of the cap (170k standard tokens)" (**once per investigation**, clipped to what is left today, hidden when nothing is left) | **10 min**: stop and write |
| `cap_reached`, extension used | only "Stop here and write the report", with "Extension already used for this investigation" | the report is written automatically |

### 9.3 Verdict (companies only)

1. Overline `Verdict` plus the `Rule-based` tag.
2. **Level** in the display serif with its icon: No concerns found (a neutral filled dot, ink; never a check mark), Points to check (`!`, warn), Serious concerns (`×`, bad), Not enough data (`?`, muted). The block gets a faint tint of its level's colour.
3. **Coverage line,** same block, always, with **one denominator, 11** (council item 8): `10 of 11 checks ran · 1 not possible in Latvia · 38 sources · 20 Nov 2026`. "Applicable" never appears in any user-visible string, screen-reader text, the library or MCP. Under it, a rule-based line: "Added by this investigation: N findings from live sources (…)".
4. **Why this level:** each fired rule links to its check ("Check 8: 1 open securing measure since 2 Oct 2026 (soft flag)"); with none: "No hard or soft flag in the checks that ran"; for Not enough data, each rule that fired, in its own words ("Only N of 11 checks ran; the rule needs at least 6", "Neither money check ran (6, financial position; 7, tax and social-insurance arrears)", "The company is not pinned to a registry record").
5. **Explanation** with the `AI-written` tag: "Written from the findings below; every sentence links to its evidence." It never states or restates the level and never adds an uncited remark. When it can't be shown (a banned term after one regeneration, or no sentence with a citation), the one fallback line is **"No written explanation for this report"**; there is no other fallback wording.
6. **Key findings, chosen by rule** (council item 10; `Rule-based` tag, no AI label): only checks that raised a concern or a point to check, concerns first, then points to check (`offer_domain_other_company` first, then `regulator_warning`, then by check number); never an inferred, name-only or context finding. Each reads "Check N: [the check's line]" with its severity and "See the evidence". **Fewer than three when fewer qualify**; with none: "No check raised a point or a concern, so there are no key findings." A `regulator_warning` is listed first among points to check, naming the list and the matched identifier.
7. **The 11 checks** section below it (council Part B), each check with an icon: on record or none found (check), point to check (`!`), concern (`×`), not run (dashed circle and dash), data past its cycle (clock). Every flag maps to a rule (council item 9): `status_not_active` and `no_officers_on_record` are Points to check, so no "!" ever sits under "No concerns found". A name-only court match is a fact, not a flag.

**Facts-only variant** (`isNaturalPerson`): shown on the profile itself, because no investigation can exist for a natural person or sole trader. The block reads "Facts only · No verdict is given on a private individual." with the disclaimer and "official facts from N sources · [date]". No level, no checks scored, no agents, never "Serious concerns". The aside explains why, with no Investigate button.

### 9.4 Usage (human ruling H5: no money, no API keys)

Agents run on the local Claude Code CLI under the user's own Claude plan. Usage is counted in **standard tokens** (st; cto: 1 st = one Sonnet-class uncached input token, from the CLI's own usage report). Caps: **500k st per investigation, 85k st per follow-up, 3.3M st per day**; one extension of **+170k st** ("a third more of the cap"), once per investigation, clipped to the daily cap.

- **Words:** "usage", "standard tokens", "cap". Never a currency symbol, "cost", "spend", "price" or "pays" on any agent surface, and never a percentage of the user's plan or a claim about its remaining allowance (Finora can't see either). The only exception is the council's own notice text below ("… never costs money").
- **Primary reading: a share of the cap.** Meters fill against the cap; the run header, the agent panel and each lane read "N% of the cap"; the top-bar pill reads "today N% of daily cap" (title: "0.6M of the 3.3M standard-token daily cap"), hidden under 768 px, `--warn` from 80%.
- **Pre-run sheet** (Investigate): what will happen; **the estimate line exactly as cto wrote it**: "About 150k standard tokens of your subscription, up to about 310k. Cap 500k. Today: 2.9M of 3.3M left." Under it, a meter with the typical share filled and the worst-case share as a lighter band, "Typically about 30% of this investigation's cap, at most about 62%", and an info popover **"What is a standard token?"**: "Standard tokens are Finora's measure of how much of your Claude plan a run uses. Your plan's own limits are set by your plan, and Finora can't see them." Then typical time; the purpose; the optional field **"Company website or the domain on the offer"** (council item 7, relabelled when web search left v1) with the helper "The web check needs a domain; without one it can't run" (plus the register-listed domain, when there is one); for a US private company the note "the verdict will normally be 'Not enough data'"; a disclosure **"Usage per agent and per model"** (standard tokens and turns per agent, raw tokens per model); and "This run uses your Claude subscription through Claude Code on this machine. Finora stops at its own caps. The estimate uses default per-agent usage until this install has 10 finished investigations." Buttons: Cancel, **Start investigation**.
- **Investigations off** (`?state=agents-off`, its own state, distinct from the two Claude Code states): the agent backend ships off (`FINORA_AGENT_BACKEND=off`, C18) until the human's terms decision. Investigate opens a sheet with the council's copy, "Investigations are off on this install. The company profile above is complete; agents need one choice in Settings → Connections.", and the steps that choice sets up. Never a dead button. Settings → Connections shows the switch's state.
- **One investigation at a time** (`?state=busy`): a second Investigate while one runs opens "Another investigation is running" with a link to it.
- **Stopped for safety** (`?state=unsafe`): if Claude Code doesn't start in Finora's locked-down mode (`runtime_unsafe`), a `--bad` banner says nothing ran and no finding was written, with "Check the connection" and "Try again".
- **First Investigate ever** (`?state=first-run`), a one-time notice before the estimate (council): "Finora stops at its own daily cap. If paid extra usage is on in your Claude account, a run could draw on it. Keep it off to make sure Finora never costs money." with an "I understand" checkbox and Continue. Settings → Usage repeats it.
- **Claude Code not installed** (`?state=cli-missing`) and **not signed in** (`?state=cli-signed-out`): Investigate opens a sheet with the one or two steps to fix it ("Install Claude Code; run `claude` once and sign in") and **Check again**. Never a disabled button; the instant profile keeps working.
- **Daily usage cap reached:** a sheet "Today's usage cap is reached · 3.3M of 3.3M standard tokens · resets at 00:00"; the profile keeps working, because it doesn't use the plan.
- **Paid extra usage** (council's final rule; C19). Claude Code reports overage in its rate-limit event:
  | Claude reports | Finora shows |
  |---|---|
  | paid extra usage **in use** | every run interrupted at once; a `Rule-based` pause card, **"Paid extra usage is on in your Claude account. Turn it off to continue."** (`?state=overage`) |
  | paid extra usage **permitted and a window used up** (rejected, or 100%) | the same pause, **before** the first paid request (`?state=overage&row=limit`); the header and lanes read "Paused: paid extra usage is on in your Claude account" / "paused: paid extra usage is on", true for both pause rows |
  | paid extra usage **permitted**, every window still inside the plan | a non-blocking warning, "Paid extra usage is on in your Claude account; Finora will stop before using it", on the pre-run sheet, under the run header and next to Claude Code's status in Settings → Connections (`?overage=enabled`, `settings.html?state=overage-enabled`) |
  | no event | nothing: the one-time notice only, never a claim either way |

  The pause card offers **Check and resume** (only once Claude reports overage off or a window reset; a pause never ends by itself) or **Stop here and write the report**. Findings are kept; no verdict on partial evidence.
- **Claude's own plan-window figure:** a secondary line labelled as Claude's figure. Always in the plan-limit pause ("Claude reports your 5-hour window at 100%, resetting at 14:00"). Before a start, only if Claude reports it on runs that aren't limited, and then only at 90% or more, as a warning: "Claude reports your 5-hour window at [N]%; this investigation may pause." (`?window=high`). Finora's cap share stays primary; never an invented or extrapolated plan share.
- **Your Claude plan's usage limit** (`?state=limit`, council H5 item 2): the run **pauses**; the header reads "Paused: your Claude plan's usage limit · resumes after [time]", running lanes read "paused …", and a `Rule-based` card "Usage limit reached: resumes after [time]" offers **Resume at [time]** (default) or **Stop here and write the report** (checks that haven't finished count as not run). Never a verdict on partial evidence.

### 9.5 Follow-up chat

Docked in the aside (a section under the content below 1024 px): suggestions, questions as right-aligned bubbles, answers with the `AI-written` tag and citation chips that jump to sections (`S02`). The per-question cap is stated in its header.

## 10. Network explorer

Company-to-company only, one hop (S17). Graph and an equivalent list ("List" is the default under 768 px). Edges: company member (solid, with share), same registered office (dashed, derived by Finora). Inactive companies have dashed outlines and muted labels. The address node shows its company count. Over 20 companies at one address, a banner explains office buildings and registered-agent addresses, the graph shows 20 and the list shows all. A side card shows the selected company with its chip and "Open company" / "Centre here", plus the legend and the council's caveat. Browsing never starts agents.

## 11. Library

Rows: country code, name, code and time, a status note when relevant (one agent did not finish, needs you, stopped at the cap), the verdict pill, checks that ran, usage in standard tokens ("140k st"). Filters: all, points to check or serious, needs you, per country, a text filter. Empty, loading and error states.

## 12. Crash monitor

No keys in v1 (H5): every tile runs on a keyless source or is not drawn. Commercial sources appear under coded aliases (H4); their real names live in a local provider file.

- **Distance from peak** strip: one row per market sorted by drop, bar plus signed percentage with an arrow; "peak not known yet" instead of a bar where needed.
- **US national debt:** a ticking figure labelled `estimate`, the official figure with its date, the 30-day change.
- **Tiles: M01 US stocks, M03 Asia and Pacific, M05 gold, M06 crypto, M07 oil.** Title, id, the drawdown in large type, a context line (as-of, peak date), extra rows, the council caveat, and source chips in the footer.
  - **M01:** the quarterly official row (US equity value, keeps "value below peak") plus daily rows per series ("US large companies", "US broad market", "US technology"; index names never appear). The daily rows' caveat says: personal use only, the index owner's copyright (the owner is named from the local provider file), via FRED, 1-day lag; drawdown only, and the series never leaves the machine.
  - **M03:** Japan, broad index (citation required, kept on this machine) and Taiwan. Taiwan: "Peak not known yet: tracking since [date]", never 0%.
  - **M05:** the monthly average only. **M06:** keyless, as before. **M07:** unchanged.
  - **Not drawn:** Europe (M02), the Americas outside the US (M04) and South Korea. A footer line under the tiles says "Not covered in v1: Europe, the Americas outside the US and South Korea (no free source)". A tile with no data is never drawn and never reads 0%.
  - **Value below peak** appears only on rows whose tile config allows it (`valueLost`): the quarterly US row, bitcoin and ether (drop × current supply, "computed by Finora"), and the total crypto market.
  - **Peak basis** (`peakBasis`): `since` reads "peak = highest daily close since [date]"; `all_time` (total crypto) reads "all-time high, [date]"; `seeded` (Taiwan, once legal approves it) reads "peak seeded from [source]" (`?taiwan=seeded`).
  - **Value below peaks** summary at the top of the drawdown card (`totalWiped`): "≈ $X trillion" (market value, not usage), then a sentence naming every row it sums with its as-of, "Peaks fall on different dates; the oldest figure is from [as-of]", and the Derived by Finora badge. Bitcoin and ether are inside the crypto total and are never added on top of it.
  - A failed source hides its value ("Last good value 07:40, hidden rather than shown as current"); a stale one shows amber dates and a banner.
  - **`not_configured`** (C15 provider map): a coded source with no entry in the local provider file shows the tile's shape with "Not configured: add providers [codes] to your local provider file", "No number is shown until then, never 0%", and a "How to set it up" link (`crash.html?state=not-configured`). It replaces `choose-fund`, `needs_key` and `needs_symbol`.
- "How it's calculated" and the attribution lines close the page. Each row carries its `attribution` from the local provider file (data-markets), and the running app shows that line in the tile footer and the page's source list; the mockups show only the codes, because real provider names never enter the tree (H4). Personal-use series stay on this machine and are never exported.

## 13. Components

The frontend inventory (`docs/plan/ui-build-plan.md`) is the build list; these are the design names and the mockup classes they come from.

| Component | Package | States and behaviour |
|---|---|---|
| Shell, ToolRail, TopBar, CommandBar | ui / web | rail ↔ bottom bar at 768; command bar opens on `/` or Ctrl+K, modal, focus trapped |
| ReportProblemSheet | web | legal rule 10: what is wrong (value wrong, wrong company, objection about me), details, send; confirms that an objected statement is hidden while reviewed (`?problem=open`) |
| Button | ui | primary, default, quiet, small, danger; focus ring |
| StatusPill | ui | neutral, warn, bad; register word plus gloss |
| SourceChip + popover | ui | official, web, derived, stale; Enter opens, Esc closes |
| ConfidenceBadge | ui | 5 levels (§6.2) |
| AiLabel, RuleLabel | ui | §6.3 |
| FieldRow | ui | every state in §5; `itemId` required |
| CaveatLine, Quote | ui | Quote enforces per-source length limits (company site 300 chars, press 125, domain records derived facts only) |
| Section | web | header with id and "Report a problem"; landing animation |
| CoverageLine, PersonDisclaimer, PurposeGate, PurposeLine | ui / web | §4, §8.3 |
| KeyFigureTable, Sparkline | web | partial columns, deltas with arrow and sign |
| EventList | web | dated events with chips and severity |
| ChecksList | web | instant (1 to 9) and full (11) variants |
| AgentPanel, AgentLane, TaskRow, RunStats | web | §9.1 |
| QuestionCard (+ CompareTable) | web | §9.2 |
| VerdictBlock, FactsOnlyBlock, KeyFindings | web | §9.3; level and explanation are separate children |
| FindingCard | web | agent tag, severity, AI tag, confidence, chip |
| ChatDock | web | §9.5 |
| Sheet (dialog) | ui | centred on desktop, bottom sheet on mobile; focus trapped |
| NetworkGraph + NetworkList | web | §10 |
| LibraryRow, FilterChips | web | §11 |
| CrashTile, DrawdownStrip, DebtTicker | web | §12 |
| Banner, EmptyState, Skeleton, Spinner, Meter | ui | warn, bad, info banners |
| UsagePill, UsageEstimate, UsageMeter | web | §9.4: share of the cap first, standard tokens and per-model tokens in a disclosure, the "What is a standard token?" popover; never a currency |
| CliStatusSheet, ExtraUsageNotice, PlanLimitCard | web | §9.4: Claude Code missing or signed out (Check again), the one-time extra-usage notice, the paused-at-plan-limit card (Resume / Stop and write the report) |

## 14. Accessibility

- Focus is always visible: a 2 px `--accent` outline with 2 px offset. A skip link is the first tab stop. Tab order follows the page (verified in the mockups).
- Contrast as measured in §3.1; status never by colour alone.
- Icon-only buttons have an `aria-label`; decorative icons are `aria-hidden`. The network graph has a list twin with the same data; graph nodes are focusable buttons named by their visible text.
- Scrollable tables are focusable regions named after their section.
- The agent panel uses a polite live region, throttled to one announcement per lane step. Question cards are regions with an H2.
- Sheets are modal dialogs with a label: focus moves to the primary action on open, Tab stays inside, Esc triggers the sheet's Cancel or Close. This is an acceptance test for the sheet component.
- **Touch targets** under 768 px: primary buttons 40 px high, small buttons, segmented controls, tabs, switches and chips at least 28 px, link buttons and every standalone link (lists, footer, breadcrumbs, index pages, "See the evidence") at least 32 px tall (padding, not font size; links inside running text are exempt, per the WCAG 2.5.8 inline exception), filter and index pills 36 px. Nothing interactive is under 24 × 24 (WCAG 2.2 target size minimum).
- **Focus is never hidden by fixed bars** (WCAG 2.2, 2.4.11): `html` sets `scroll-padding-top` to the sticky header's height plus 8 px and, under 768 px, `scroll-padding-bottom` to the bottom bar's height plus 8 px, so a focused control scrolled into view always lands between the bars. Anchored sections use the same offset (`scroll-margin-top`).
- Keyboard: `/` search; ↑ ↓ Enter in results; `j` / `k` between findings in a report; Enter opens a source chip; `?` opens a small dialog that lists these shortcuts.
- The mockups pass axe (no violations) on the main states in both themes at 1280 and 390 px.

## 15. Responsive

Checked at 390×844, 768×1024, 1280×800 and 1920×1080, with no horizontal overflow on any screen or state.

- **Under 1280:** the aside narrows to 320 px.
- **Under 1024:** the aside (agent panel, chat, checks) moves below the content; the network side card moves under the graph.
- **Under 768:**
  - the tool rail becomes a bottom bar and the usage pill hides;
  - field rows stack the label above the value, and the meta row stacks;
  - sheets become bottom sheets, and the network defaults to the list.
- Tables scroll sideways inside their section rather than crushing columns.

## 16. Assumptions and open items

- Dark is the default theme; light is complete.
- Settings has no key rows in v1 (H5): **Connections** shows Claude Code's status (found, signed in, version, Check again) and the optional SEC contact setting; **Usage** shows the three caps, today's share and the extra-usage notice.
- Typical usage and times start from the per-role defaults converted to standard tokens (cto: typical about 153k st, worst about 307k st) and become per-install figures after 10 runs.
- The four purposes in the gate are a draft for legal to confirm against P7.
- Open with legal: WHOIS and web-archive terms (S15 stays DNS, certificate logs and homepage until then).

## 17. Phase 5: design review checklist

For each UI slice, the designer checks the running app against the matching mockup state, at the four viewports, in both themes:

1. Every rendered value goes through `FieldRow` (or a table with `itemId`) and shows the §5 state and copy for its DTO.
2. No banned word in any rendered string; register words with glosses; dates and money as §4.
3. Source chip, confidence and AI or rule labels on every value and finding.
4. The coverage line comes before any result; the disclaimer on every natural-person page.
5. Agent lanes, task rows, landing findings and question cards behave as §9; no countdown on `entity_choice`.
6. Layout, spacing and type match tokens; no horizontal overflow; focus visible; axe clean.
