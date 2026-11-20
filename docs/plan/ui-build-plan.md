# UI build plan

> **Status: phase 3 draft 5 (qa review of 0de4d5f answered; Baltic court, check 5 and Sodra changes, and web-qa's mockup findings folded in).** Owner: `frontend`. Written from `DESIGN.md` v1, `docs/design/IA.md`, the mockups in `docs/design/mockups/` (opened in Chromium at 1280 and 390 px wide for this revision), `docs/design/display-options.md`, council session 1 (`docs/plan/council/01-data.md` Parts B-H), `docs/plan/reviews/00-early-plan-review.md`, `docs/plan/agents.md`, `docs/plan/loaders/markets.md`, `docs/architecture.md` and `docs/plan/slices.md`. The mockups win on looks, this plan wins on behaviour. Open conflicts between sources are listed in §16. Items that wait on someone else are marked **[pending: ...]**.

A builder reading this file, `DESIGN.md` and the mockups should never have to guess. If something is unclear, that is a bug in this file.

## Contents

1. [Decisions](#1-decisions)
2. [Where code goes](#2-where-code-goes)
3. [Tokens and themes](#3-tokens-and-themes)
4. [Component inventory](#4-component-inventory)
5. [Specs of the components that carry the product](#5-specs-of-the-components-that-carry-the-product)
6. [Streaming agent progress](#6-streaming-agent-progress)
7. [Loading, empty, partial and error states](#7-loading-empty-partial-and-error-states)
8. [Keyboard behaviour and focus](#8-keyboard-behaviour-and-focus)
9. [Accessibility](#9-accessibility)
10. [Responsive behaviour](#10-responsive-behaviour)
11. [Language, copy and formatting](#11-language-copy-and-formatting)
12. [Fixtures, the state gallery and `?state=`](#12-fixtures-the-state-gallery-and-state)
13. [Policy and legal rules in the UI](#13-policy-and-legal-rules-in-the-ui)
14. [UI slices](#14-ui-slices)
15. [Test strategy for the UI](#15-test-strategy-for-the-ui)
    - [15a. Mockup defects the build must not copy](#15a-mockup-defects-the-build-must-not-copy)
16. [Asks of other seats and open items](#16-asks-of-other-seats-and-open-items)

---

## 1. Decisions

The architecture fixes the framework (`docs/architecture.md` §1, §5.3). This table records the UI choices inside it.

| Concern | Choice | Why, and what was rejected |
|---|---|---|
| Framework | Next.js App Router, React 19, TypeScript `strict` | As architecture §1. Server components render the report; client components run everything live |
| Styling | Tailwind v4, tokens as CSS variables exposed through `@theme` | As architecture §1. No raw colours in code (§3, enforced by `scripts/check-tokens.mjs`) |
| Accessible behaviour | Radix primitives: Dialog, Popover, Tooltip, Tabs, Collapsible, DropdownMenu, Toast, Switch, ToggleGroup | Focus trapping, `aria-*` and keyboard are already right. Our look stays ours |
| Combobox | Our own `Combobox` in `packages/ui`, following the WAI-ARIA 1.2 combobox pattern (`role="combobox"`, `aria-activedescendant`, listbox popup) | Radix has no combobox. A command-menu library would add a dependency for one component that we need in exactly two places (search box, command bar) |
| Server data | TanStack Query for requests | Architecture §5.3: no global client store |
| Live investigation | One `useReducer` per open investigation, fed by one SSE connection (§6). `zustand` only if the reducer proves too small | Architecture §5.3 and the architect's reply |
| SSE transport | A small fetch-stream SSE client (`apps/web/src/lib/sse.ts`), not `EventSource` | `EventSource` cannot send a `Last-Event-ID` header on the first connection, and gives no control over backoff. (the architect confirmed the `Last-Event-ID` header, with `?lastEventId=` as the fallback) |
| Motion | `motion` (one library), loaded with `LazyMotion` and the `domAnimation` feature set. CSS transitions for hover and focus | One animation library. `prefers-reduced-motion` turns off everything except changing counters (DESIGN.md) |
| Icons | `lucide-react` (ISC licence), imported per icon | Tree-shakes; one visual family. Every icon next to text is `aria-hidden`; icon-only buttons need an `aria-label` (enforced by the `IconButton` type) |
| Fonts | `@fontsource/instrument-serif`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` (SIL OFL), bundled by Next | Self-hosted with no CDN, and no binary font files committed (the guard blocks unreviewed binaries). **[pending: S03 verifies the three package names and licences on npm before use]** |
| Charts | Hand-rolled SVG: `Sparkline`, `DrawdownLine`. No chart library | The designer confirmed that sparklines and one drawdown line with a y-axis are enough |
| Graph | Canvas 2D, `d3-force` for layout, loaded with `next/dynamic` only on the network route | Keeps `d3-force` out of every other route's bundle |
| i18n | `next-intl`, `en`, `lt`, `lv`, `et` (architecture §9). Components in `packages/ui` receive finished strings as props and never call `useTranslations` | `packages/ui` may import only `i18n` types (architecture §2) |
| Component tests | Vitest + Testing Library + jsdom | Architecture §13 |
| Browser tests | Playwright (Chromium) with `@axe-core/playwright` | Architecture §13 |

### Deviations from the architecture (D1 and D4 accepted by the architect on 2026-11-20; D2 and D3 to be confirmed in milestone B)

| # | Deviation | Reason |
|---|---|---|
| D1 | `FieldRow`, `SourceChip`, `Quote`, `AiLabel` and `PersonDisclaimer` live in `apps/web/src/components/`, not in `packages/ui` | They take DTO types (`SectionResult`, `SourceRef`, `Citation`). `packages/ui` may import only `i18n`. Putting DTO types into `ui` would break the dependency table. `packages/ui` keeps the presentation primitives they are built from (`StatusLine`, `Chip`, `Popover`, ...) |
| D2 | Fixture DTO files for UI states live in `fixtures/ui/<screen>/<state>.json`, validated against the `api-contract` schemas | One place for the state gallery, the `?state=` mode and the e2e tests. S04b owns the schemas, frontend owns these files |
| D3 | The item registry (`ItemId`, the call for each id) is generated from the Part G table into `packages/domain/src/items/items.generated.ts` by a script and a test that fails when the two disagree | The "rendered-field registry equals the table" gate needs a typed list. `FieldRow` takes `itemId: ItemId`, so an unknown id fails typecheck |
| D4 | Search needs a progressive result shape (§5.4, §16 ask 2) | The designer's "Estonia: loading, 62%" and the live US state groups need it |

---

## 2. Where code goes

```
packages/ui/                         presentation only; no DTO types; no i18n calls
  src/tokens.css                     all design tokens, dark and light
  src/theme.css                      Tailwind v4 @theme mapping
  src/primitives/<name>/             <name>.tsx, <name>.test.tsx
  src/index.ts                       the public surface
apps/web/
  src/app/[locale]/(tools)/explorer/...        routes (architecture §5.3, plus the routes in §14 U4-U8)
  src/app/[locale]/(tools)/crash/page.tsx
  src/app/[locale]/design/...                  state gallery (demo and test builds only)
  src/components/
    shell/        AppShell, ToolRail, BottomBar, TopBar (command bar trigger, SpendPill, ThemeToggle), CommandBar, Footer
    search/       SearchBox, SearchResults, CountryGroup, NoMatch
    field/        FieldRow, SourceChip, AiLabel, DerivedChip, Quote, PersonDisclaimer, PurposeGate, ReportProblem
    company/      CompanyHeader, CoverageLine, SectionIndex, SectionCard, KeyFigureTable, RoleTable, HolderTable, EventList, CheckLine, ChecksAside, ExportMenu
    investigate/  InvestigateSheet, AgentPanel, AgentLane, TaskRow, RunStats, QuestionCard (+ CompareTable, variants)
    report/       VerdictBlock, FactsOnlyBlock, ChecksList, KeyFinding, EvidenceGroup, FindingItem, CitationViewer, FollowUpDock, AttributionFooter
    network/      NetworkGraph, NetworkList, NodeCard, EdgeCard
    library/      LibraryList, LibraryItem, LibraryFilters
    crash/        CrashGrid, CrashTile, DrawdownStrip, DebtTicker, WipedSummary, ConnectorPrompt, FundSymbolField
    settings/     KeyStatusRow, ConnectorSheet, DataStatus
    sources/      SourcesTable
  src/state/investigation.ts         pure reducer, selectors
  src/lib/       api.ts (typed client), sse.ts, format.ts, fixture-mode.ts (server-only), shortcuts.ts, purpose.ts
  src/fixtures/  loader for fixtures/ui (fixture mode only)
  e2e/           Playwright specs
fixtures/ui/<screen>/<state>.json    synthetic DTOs for every state (§12)
```

Conventions:
- One component per folder or file, named export, kebab-case file names, no default exports except Next's `page`, `layout`, `error` and `not-found`.
- Props are typed with no `any`. Components that show data take the DTO slice, not loose strings.
- Strings: no literal user-facing text in a component. It comes from the catalogue (`apps/web`) or, in `packages/ui`, from a prop.
- **No raw colours, no raw font stacks.** `scripts/check-tokens.mjs` (CI step 2) fails on a hex, `rgb(` or `hsl(` literal outside `tokens.css`, and on arbitrary Tailwind colour values.
- **DTO value types import rule** (`no-restricted-imports` per folder): `SectionResult`, `SourcedValue` and `Statement` types are importable only from `components/field/**`, `components/company/**` and the report assembly code. This is the lint half of the rendered-field registry (§13).
- `dangerouslySetInnerHTML` is banned by lint. Register text is rendered as text.
- No comments unless the why is not obvious.

---

## 3. Tokens and themes

`packages/ui/src/tokens.css` is written by hand from the `DESIGN.md` Colour, Type, Spacing, Radius, Elevation and Motion tables. `packages/ui/src/tokens.sync.test.ts` parses the `DESIGN.md` colour table and fails if a token is missing from `tokens.css` or a value differs. So `DESIGN.md` and the code cannot drift.

| Group | Tokens |
|---|---|
| Colour | `--bg --surface --surface-2 --line --line-strong --ink --ink-2 --muted --faint --accent --on-accent --good --warn --bad --info` and a `-tint` for each of `good warn bad info accent` |
| Type | `--font-serif --font-sans --font-mono`; the size and line pairs of the DESIGN.md type table as `--text-display`, `--text-h1`, `--text-h2`, `--text-h3`, `--text-body`, `--text-small`, `--text-label`, `--text-mono` |
| Space | `--space-1` to `--space-10` for 4, 8, 12, 16, 20, 24, 32, 40, 56, 72 px |
| Radius | `--radius-chip` 6, `--radius-button` 10, `--radius-card` 14, `--radius-verdict` 20 |
| Elevation | `--shadow-popover` only |
| Motion | `--dur-fast` 120 ms, `--dur-base` 200 ms, `--dur-wash` 600 ms, `--dur-pulse` 1600 ms, `--ease-out` |

**Layout constants** (DESIGN.md §3.3): tool rail 72 px; agent aside 360 px (320 px below 1280); content column max 1240 px. The theme toggle sits in the top bar; language (`en`, `lt`, `lv`, `et`) is in Settings.

**Themes.**
- Dark is the default. Light follows `prefers-color-scheme` until the user picks one with the toggle.
- Mechanism: `<html data-theme="dark|light">`. Without the attribute, `@media (prefers-color-scheme: light)` applies `:root:not([data-theme])`. The toggle writes a `finora-theme` cookie (`light`, `dark` or absent for "system"). The root layout (a server component) reads the cookie and sets `data-theme` in the HTML, so the first paint has the right theme and no inline script is needed (the CSP forbids one).
- `color-scheme` is set per theme so native controls and scrollbars match.
- **Status colour meaning** (designer's correction): `--good` is for recoveries and positive signals only. "No concerns found" and "none found" use `--ink` or `--ink-2`, never green.
- `--faint` is for icons and dividers, never text (checked by `tokens.contrast.test.ts`, which lists the allowed text pairs and asserts ≥ 4.5:1, and the non-text pairs at ≥ 3:1).

**Fonts.** Instrument Serif for H1, H2, display. Geist for UI. Geist Mono for codes, counts, source chips and agent activity. `font-display: swap`. Numbers in tables use `font-variant-numeric: tabular-nums`. The designer measured in Chromium: Geist Sans covers every Baltic letter in one file; Geist Mono and Instrument Serif need both their latin and latin-ext files, split by `unicode-range`. The mockups carry the woff2 files and OFL licence texts under `docs/design/mockups/assets/fonts/`. The app takes the same faces from Fontsource (no binaries committed beyond the mockups), with the latin and latin-ext subsets for every face, and a Playwright test renders `ĄČĘĖĮŠŲŪŽ ĀČĒĢĪĶĻŅŠŪŽ ÕÄÖÜŠŽ` in each face and fails on a fallback glyph. **[pending: U1 verifies the three package names and licences on npm]**

---

## 4. Component inventory

Notation: **States** are the states each component renders in the gallery (§12). Every interactive component also has *default, hover, focus-visible, active, disabled* unless stated. "Gallery" means a page under `/design`.

### 4.1 Primitives in `packages/ui`

| Component | Purpose and variants | States beyond the basics | Keyboard |
|---|---|---|---|
| `Button` | `primary` (accent fill, `--on-accent` text), `secondary` (surface-2 with line), `ghost`, `danger`. Sizes `md` (40 px high), `sm` (32 px). Radius `--radius-button` | `loading` (pulse dot, label kept, `aria-busy`, still focusable, click ignored) | `Enter` and `Space` activate |
| `IconButton` | Icon only. The `label` prop is required by type and becomes `aria-label` and the tooltip | as Button | as Button. Minimum hit area 24 px, 44 px on touch |
| `Input`, `SearchInput` | Text input with an attached `<label>` (visible or `sr-only`), a hint and an error line. `SearchInput` adds the leading icon and a Reset button | `error` (icon + text, `aria-invalid`, `aria-describedby`), `readonly` | `Esc` in `SearchInput` resets when it has text |
| `Textarea` | The free-text investigation box and the "Report a problem" body. Auto-grows to 8 lines | `error`, character counter at 90% of the limit | `Ctrl/Cmd+Enter` submits only where the form says so |
| `Combobox` | ARIA 1.2 combobox: input, listbox popup, groups with headings, `aria-activedescendant` | `closed`, `open`, `empty`, `loading`, `error` | `ArrowDown/Up` move, `Home/End` first/last, `Enter` choose, `Esc` close (second `Esc` resets), typing filters |
| `Select`, `SegmentedControl` | Short fixed lists (purpose list, locale, theme, graph/list). Radix `ToggleGroup` or `Select` | - | Arrow keys, `Enter`/`Space` |
| `Checkbox`, `Switch` | Settings toggles | `indeterminate` (checkbox) | `Space` |
| `Dialog` | Modal. Radix. Focus trap, return focus to the trigger on close | - | `Esc` closes unless `dismissible=false` (the cap question is a card, not a dialog) |
| `Sheet` | Dialog that slides from the right (≥ 1024 px) or the bottom (< 1024 px). Used for Investigate, key setup, chat dock, agent panel on small screens | `open`, `closed`; reduced motion: no slide, instant | As Dialog. The bottom sheet also closes on its handle |
| `Popover` | Non-modal floating panel for the source chip and edge cards | - | `Enter`/`Space` toggles from the trigger, `Esc` closes and returns focus |
| `Tooltip` | Short text hints for icon buttons only. **Never the only place a fact appears** | - | Shows on focus as well as hover; `Esc` dismisses |
| `Tabs` | Graph / List, report evidence groups | - | Arrow keys, roving tabindex |
| `Disclosure` | Radix `Collapsible`. "All line items", "Show all 12" | `open`, `closed` | `Enter`/`Space` |
| `DropdownMenu` | Overflow menu on a finding | - | Arrow keys, type-ahead, `Esc` |
| `Toast` | Radix Toast. Used only for results of actions the user took ("Objection sent") | - | `F8` focuses the toast region; `Esc` dismisses |
| `Skeleton` | A bar or block with the size of a typical value; a slow shimmer that stops under reduced motion | - | not focusable; `aria-hidden` |
| `Badge`, `StatusPill` | `tone`: `neutral info warn bad good muted`. Always an icon or sign plus text. Status pills show the register's own word with an optional gloss | - | not interactive |
| `Chip` | The mono chip used by source chips and filters. Interactive chips are buttons | `selected` | `Enter`/`Space` |
| `Meter` | Determinate bar (overall progress, country load %). `role="progressbar"` with `aria-valuenow` | `indeterminate` (animated bar, static under reduced motion) | not focusable |
| `Sparkline` | SVG polyline from numbers; `title` and a visually hidden text of first, last and min/max | `empty` (nothing drawn, parent shows a state) | not focusable; the table beside it carries the numbers |
| `Table` primitives | `Table`, `Th`, `Td` with sticky first column and a scroll container that is `role="region"`, `tabindex="0"`, labelled | - | Arrow-free: normal scroll keys |
| `StatusLine` | One row: leading icon, text, optional trailing action. The base of every "why is this empty" row | one per tone | trailing action is a button or link |
| `Kbd` | Key hint (`/`, `Ctrl K`) | - | - |
| `VisuallyHidden`, `LiveRegion` | `sr-only` helper; polite live region with a throttled `announce(text)` | - | - |
| `Icon` | Maps our icon names to `lucide-react` imports (the closed set the design uses) | - | - |

All primitives share one focus style: `outline: 2px solid var(--accent); outline-offset: 2px`. It is an `outline`, not a box-shadow, so Windows forced-colours mode keeps it.

### 4.2 Shell and shared composites in `apps/web`

| Component | Purpose | States | Keyboard |
|---|---|---|---|
| `AppShell` | Left `ToolRail` (≥ 768 px), `TopBar`, main region, `BottomBar` (< 768 px), skip link first in the tab order | - | `Tab` order: skip link, rail, top bar, main |
| `ToolRail`, `BottomBar` | 72 px rail with icon and label. Built from the tool manifests (`id, navKey, href, icon, enabled`): Explorer, Library, Crash monitor, then **Sources** and **Settings** pinned at the bottom. The bottom bar shows the same five. Active entry `aria-current="page"` | `active`, `disabled` (tool flagged off) | `Tab` moves through the entries in order |
| `TopBar` | The command bar trigger (field-shaped button with the `/` hint), `SpendPill` ("today $1.84 of $10.00", hidden under 768 px; turns `--warn` from 80% of the daily cap), `ThemeToggle` | - | `/` and `Ctrl/Cmd+K` open the command bar |
| `CommandBar` | `/` or `Ctrl/Cmd+K` anywhere. Search companies across four jurisdictions, jump to a tool, open a past investigation. Built on `Combobox` in a `Dialog` | `idle` (recent items), `typing`, `loading`, `country-loading`, `no-match`, `error` | §8 |
| `ThemeToggle` | Three-way theme (system, dark, light) in the top bar. The language choice (four locales) is in Settings | - | Arrow keys on the group |
| `Footer` | Source-code link (legal rule 18), terms, the blocked-uses notice for natural persons (P7), attribution lines collected per page | - | links |
| `SourceChip` | `register · LV · 18 Nov` in mono. Opens a popover: source name and record link, licence (link to the Sources page), retrieved at, source's own as-of date, access-tier word, the loader or agent that produced it, and for agent findings the quote. Chip kinds: `official`, `agent-web`, `derived` ("Derived by Finora", lists input sources and links to the method) | `collapsed`, `open` | `Enter`/`Space` toggles; `Esc` closes |
| `ConfidenceBadge` | Dot plus word: Official (solid), Corroborated (two dots), Single source (hollow), Inferred (dashed, plus "How we got here"). The word is always visible | one per level | not interactive, "How we got here" is a link |
| `AiLabel` | "AI-written" tag. Required wherever `generatedBy: "ai"` is true. Wraps text, never a rule-based value | - | not interactive |
| `PersonDisclaimer` | The fixed line "Not a credit report. Not for credit, employment, tenancy or insurance decisions." Text is a catalogue key | - | - |
| `PurposeGate` | The prompt and the "Purpose: ..." line (§5.3) | `needs_purpose`, `chosen`, `expired` | §8 |
| `ReportProblem` | The "Report a problem" action on every section header, finding menu and the page header (the DESIGN.md label; the dialog title is "Report an error or object"). The form has a `kind` choice (Correction or Objection), the item it targets and a free-text note, and posts `POST /disputes { companyEid, itemId, kind: "correction" \| "objection", note }`. After a send the section refetches and the disputed line shows `disputed` | `closed`, `open`, `submitting`, `sent`, `error` | Dialog rules; `Ctrl/Cmd+Enter` submits |
| `Quote` | The only place verbatim third-party text is rendered. Enforces the length limits per source kind (§5.7) | `short`, `cut` (with "Read at source") | link |
| `EmptyState`, `ErrorState` | Page-level states: icon, one heading, one line of cause, one action | `error` takes a machine code and maps it to catalogue text | action is a button |

### 4.3 Search and company page

| Component | Purpose | States | Keyboard |
|---|---|---|---|
| `SearchBox` | The home search. Wraps `Combobox`. Free text is accepted and offers "Investigate this text" | §5.4 | `/` focuses it from anywhere |
| `SearchResult` | One company: name (2-line clamp, full name in `title` and in the header), code, legal form, status pill, city, registration year. Search by name never returns a sole trader or natural person (S04 acceptance 3). If a registry-code lookup does return one, the row shows the legal form and the code only, never the name (architecture §3.3, L3), and opens the facts-only page | `default`, `highlighted`, `struck-off` ("Removed from the register in 2021") | `Enter` opens |
| `CountryGroup` | A group heading with count. The DTO state is `ready`, `loading{percent}` or `error`, and the kind is `bulk` or `live`; `empty` is `ready` with no results and shows the registers checked; a `live` group shows "Searching {registers}" while its request is pending | `ready`, `ready-empty`, `loading`, `error` for each kind | - |
| `CompanyHeader` | Overline (`Company · Latvia`, `Investigation running`, `Investigation report · {date time}`), H1 (≤ 3 lines then truncated, full name in the tooltip and the identity row; **for a natural person or sole trader the H1 is the legal form and registry code, for example "Individual enterprise · {code}", never the name**, and so is `<title>`; L3, P6), meta row (status pill with gloss, legal form with gloss, registration number, address), optional LEI and VAT, and the actions. Profile: **Investigate** (primary), Network, Export, Report a problem. Run: Stop and write the report, Skip to report. Report: Network, Re-run, Export, Report a problem | `loading`, `profile`, `running`, `report`, `sole-trader` (facts-only variant: no Investigate, no Network, no agent rows) | - |
| `CoverageLine` | "[Country]'s official data: ... Not in open data: ..." in a well before any result. Text is a catalogue key per country, plus `us-private` and `us-public-no-sec`. The designer replaced the icon strip with this line | one per country variant | - |
| `SectionIndex` | Pills that jump to each section on the profile and report | - | links in tab order |
| `ChecksAside` | The aside on a profile: "Checks from official data", checks 1 to 9 with their results and "Runs when you investigate" for 10 and 11, then **Investigate** and the typical cost. The same `ChecksList` renders the full 11 in a report | `profile` (1-9), `report` (1-11), `check not_evaluated` | - |
| `ExportMenu` | Export on the header: JSON and FtM of redistributable values only. Says how many share-alike values were left out ("3 values under a share-alike licence are left out of this export; see the Sources page") | `closed`, `open`, `exporting`, `error` | Menu keys |
| `SectionCard` | A titled section with its rows and the agent findings that landed in it. Collapses to one sentence when every row is "not published" | `loading` (skeleton rows), `loaded`, `all-gaps`, `error` (retry) | The heading is focusable by `j/k` navigation only on the report page (§8) |
| `FieldRow` | One value with its label, state and chips (§5.1) | all `SectionResult` states plus `loading` | - |
| `CheckLine` | One risk check: "Checked the debtor list as of 18 Nov 2026: none found", or a finding | `none-found`, `point-to-check`, `concern`, `not-checked`, `possible-match` (a stored-list name hit: "Possible match, needs review", with the entry's identifiers and the list date), `ruled-out` (the entry's own registration number differs from the company's code: "Name matches an entry with a different registration number; not the same company", shown as detail under the none-found line). "Sanctioned" appears only for `status: listed` (an official-ID match), `not-evaluated` ("Not evaluated: tracked since {date}", `clock` icon, P14) | - |
| `KeyFigureTable` | Five fiscal years newest first, currency and period end in each column header ("FY to Jun 2025"), a sparkline per row, year-on-year change with sign and arrow, "All line items" disclosure | `full`, `partial` ("2024 not filed" cell), `lvl` currency (labelled "LVL (before the euro)", never converted), `thousands` ("Reported in thousands") | scroll region is focusable |
| `RoleTable`, `HolderTable` | People and holders, rendered only from a `data` result. 8 rows then "Show all [n]". Names are text, never links (L2). Every non-`data` state is the section's `FieldRow` state (§5.1), so the tables have no `empty` of their own | `data` only (the gate, `restricted`, `paid_only`, `not_published` come from `FieldRow`) | - |
| `EventList` | Newest first: date, type, status in the register's words, amount, source. Rendered only from a `data` result | `data` only | - |
| `SourcesTable` | The Sources page: every source with licence, attribution, cadence, last sync, covered sections per country, its LATER rows and triggers | `loading`, `full`, `error` | Rows are anchors; every `SourceChip` links to its row |

### 4.4 Investigation

| Component | Purpose | States | Keyboard |
|---|---|---|---|
| `InvestigateSheet` | Opens from Investigate. Shows the estimate range ("typically $0.46, up to $0.92"), the cap, spend left today, the per-agent breakdown behind a disclosure, the purpose line and **Start investigation**. Per-agent defaults behind the disclosure: Identifying the company $0.02, Registry and people $0.06, Money and tax $0.06, Legal, insolvency and sanctions $0.07, Web, domain and news $0.20, Verdict $0.05 (typical, mid tier; replaced by measured values) | `estimating`, `ready`, `no-key` (steps to add `ANTHROPIC_API_KEY`, "Check again"), `daily-cap` (spend, reset time), `estimate-error` | Dialog rules; focus lands on **Start** when ready |
| `AgentPanel` | The aside beside the content (below it under 1024 px). Titled "Agents" with the run spend ("$0.27 of $1.50") and a meter, then the lanes in order: Lead (resolve and plan), Registry and people, Money and tax, Legal, insolvency and sanctions, Web, domain and news, Verdict | §6 | `Tab` through lanes |
| `RunStats` | In the page header: `Investigating · 4 agents · 23 tasks · 31 sources · $0.27 of $1.50` in mono, with a meter, then **Stop and write the report** and **Skip to report**. "4 agents" counts the four specialists; the lead and the verdict are lanes but not counted | `planning`, `running`, `waiting`, `paused-at-cap`, `synthesising`, `done`, `stopped`, `failed`, `reconnecting` | The two actions are buttons |
| `AgentLane` | One lane: status as word and dot (`DONE`, `RUNNING`, `WAITING`, `QUEUED`, `FAILED`, `STOPPED`), name, then `elapsed · usually {typical} · $cost` in mono, the current step (`› reading the news index (query 2 of 4)`), and its `TaskRow`s. A waiting lane has an amber border, a failed lane a red one. The lead lane ends with "Pinned to registration no. {code}". The typical time comes from the estimate DTO (`typicalSeconds` per role) | `queued`, `running`, `waiting`, `done`, `failed`, `stopped`, `budget_exceeded`. The running dot pulses 1.6 s, and not under reduced motion | Lanes are not tab stops; their action buttons (Re-run, link to the question) are |
| `TaskRow` | A source task inside a lane: icon (check, spinner, clock for queued, x for failed, skip), label, then "{n} src", "queued" or "skipped" in mono | `queued`, `running`, `done`, `failed`, `skipped` | - |
| `ActivityLine` | One line in mono: what the agent is doing now, from `stepKey` + `params` | - | - |
| `QuestionCard` | Pinned at the top of the primary column (`id="question"`, after the coverage line), amber border on an amber tint: "Needs you", the asking agent, an H2 question in the serif, the options, a footer naming the waiting agents and what happens if nobody answers. Variants: `EntityChoice`, `SanctionsMatch`, `Scope`, `CapReached`, `FreeText`. Shows which lanes wait on it (§5.6) | `pending`, `submitting`, `answered`, `timed-out` (not for entity choice) | §8 |
| `SanctionsMatchCard` | Side-by-side records, match marks, three outcomes (§5.6) | `pending`, `confirmed-by-id`, `confirmed-by-you`, `needs-review`, `different` | Radio-style buttons: Same entity / Different / Not sure |

### 4.5 Report

| Component | Purpose | States | Keyboard |
|---|---|---|---|
| `VerdictBlock` | Level, coverage line, the rules that fired, then the AI-written explanation as a separate child (§5.5) | `no_concerns_found`, `points_to_check`, `serious_concerns`, `not_enough_data`, `not-confirmed` (entity not confirmed) | - |
| `FactsOnlyBlock` | "Facts only: no verdict is given on a private individual" | one | - |
| `ChecksList` | The fixed list of 11 checks (ids 1-11). Each check is `ran` (with a finding rating: `none_found`, `point_to_check` or `concern`), `not_run` (with its coverage reason: `run_failed`, `stopped`, `budget_exceeded`, `needs_key`), `not_possible` ("not possible in {country}", the not-published case) or `not_evaluated` (P14, `trackedSince`). Same four states as architecture §7.2 | all four, and each `ran` rating | - |
| `KeyFinding`, `FindingItem` | One finding: severity (icon + word), statement, `ConfidenceBadge`, citation chips, `AiLabel`, overflow menu (Report an error or object). Renders nothing without a citation (R7) | per severity | `j/k`, `Enter` |
| `EvidenceGroup` | Findings grouped by agent, with "Dig deeper" and "Re-run" | `empty`, `full` | - |
| `CitationViewer` | Popover or sheet with the `Quote` and the source link | `open`, `closed`, `source-gone` ("The source no longer shows this text") | `Esc` |
| `FollowUpDock` | Chat docked right, a sheet below 1024 px. Cost shown, cap $0.25 per follow-up | `idle`, `asking`, `answered`, `cap`, `error`, `no-key` | Input; `Esc` closes the sheet |
| `AttributionFooter` | Each cited source's attribution line, deduplicated, plus the source-code link and the disclaimer where needed | - | links |

### 4.6 Network, library, Crash monitor, settings

| Component | Purpose | States | Keyboard |
|---|---|---|---|
| `NetworkGraph` | Canvas, one hop, companies only (§5.8) | `loading`, `graph`, `empty`, `too-large`, `error` | The canvas is focusable: arrows move the selection to the nearest neighbour, `Enter` opens the node card, `Esc` clears. The list twin is the full alternative |
| `NetworkList` | The same data grouped by relation (shared address, corporate member). Default view under 768 px | the same five | list keyboard |
| `NodeCard`, `EdgeCard` | A company node with its facts, or an edge with its relation and `SourceChip` | `open` | `Esc` |
| `LibraryList`, `LibraryItem`, `LibraryFilters` | Past investigations: subject, country, verdict level and coverage, date, cost, status. Filter by level, country, text | `empty`, `list`, `filtered`, `no-match`, `error` | `Arrow` keys move between items, `Enter` opens |
| `CrashGrid`, `CrashTile` | One tile per M id (§5.9) | `live`, `delayed`, `coarse` (official, finer with a key), `needs-key`, `choose-fund`, `peak-unknown`, `stale`, `error`, `loading` | Tiles are not focusable unless they hold an action; actions are links or buttons |
| `DrawdownStrip` | "Distance from peak" card: one row per market sorted by drop, a bar plus a signed percentage with an arrow; "Add your key" or "peak not known yet" in place of a bar where needed. Peak definition in the card header ("peak = highest daily close since 1 Jan 2025") | `full`, `with-gaps` | rows with actions are links |
| `DebtTicker` | M08: the ticking estimate with an `estimate` tag, the official figure and its date, the 30-day change. The ticking digits are `aria-hidden`; a static text carries "Estimate {x}; official {y} as of {date}" | `live`, `error` (shows the official figure only) | - |
| `ConnectorPrompt` | "Add your key" inside a tile and the settings sheet that explains where the key goes | `closed`, `open` | Dialog rules |
| `FundSymbolField` | Settings input for a fund symbol (P12: stored locally only) | `empty`, `set`, `invalid` | Input |
| `KeyStatusRow` | Settings: presence of each key (names and "set / not set" only) | `set`, `not-set`, `checking` | "Check again" button |
| `DataStatus` | Per-source last sync, rows, history size against `HISTORY_MAX_GB` (warn, never delete silently) | `ok`, `warn`, `error` | - |

---

## 5. Specs of the components that carry the product

### 5.1 `FieldRow` and the section states

`FieldRow` takes `{ itemId: ItemId; label: string; result: SectionResult<T>; render: (value: T) => ReactNode; caveatKey?: CaveatKey }`. It is the only way a registry value reaches the DOM (together with `KeyFigureTable`, `RoleTable`, `HolderTable`, `EventList` and `CheckLine`, which take the same `itemId` and `result`). It writes `data-item-id` and `data-state` on its root, which the tests read. **"None found" comes only from `checked_none{source, asOf}`.** An empty `value` array is a contract error: the schema rejects it, and a component that receives one throws in development and renders the `not_checked.error` state in production, never "none found" (test: `field-row.empty-array.test.tsx`). The value is an array (`SourcedValue<T>[]`), so `render` takes the array.

**Each state has its own icon and copy. No state falls back to a shared line.** The unit test `field-row.states.test.tsx` renders every state and asserts that all texts differ, none is empty, and none contains a banned word.

| DTO state | Icon (lucide) | English copy (catalogue key `field.<state>`) | Action |
|---|---|---|---|
| `data`, current, full | - | the value, then `SourceChip` | - |
| `data`, stale | `clock` | the value; the date chip turns `--warn`: "as of 14 Mar 2026, older than this source's cycle" | - |
| `data`, partial | - | the value with a dotted underline; the gap is spelled out under it ("2022 not filed · the column is empty, not zero") | tooltip and tap-open popover with the explanation |
| `data` with a caveat | - | the value, then one muted line under it from the Part G caveat text. Checks add "Missing does not mean clean." | - |
| `checked_none` | `check` in `--ink-2`, never green | "Checked {source} as of {date}: none found" | - |
| `not_published` | `minus` | "Not published in {country}" | - |
| `not_checked.later` | `minus` | "Not checked in this version" | - |
| `not_checked.error` | `triangle-alert` | "Not checked: {reason}", where the reason is the catalogue text for the error `code` (for example "the register did not answer") | **Retry** |
| `not_checked.skipped` | `minus` | "Not checked: skipped in this run" | - |
| `not_checked.paid_only` | `euro` | "Available as a paid register extract" | link "Order from {host}" **only** when `orderUrl` is not null (the host of the official register page is the link text; the allowlist check is the server's) |
| `not_checked.needs_key` | `key-round` | "Add your key to check" | opens `ConnectorSheet` |
| `not_checked.needs_purpose` | none | the `PurposeGate` well itself, never "Not checked" | choose a purpose |
| `not_checked.restricted` | `lock` | "Not shown in {country}: restricted by {basis}" | link to the policy section of the Sources page |
| `not_checked.agent_only` | `bot` | "Not checked here: {agent} checks this when you investigate" | **Investigate** (opens the sheet) |
| `not_checked.manual_lookup` | `external-link` | "Check manually at {host of url}" | external link, `rel="noopener noreferrer"`, host from the official allowlist |
| `disputed` | `flag` | "Under review after an objection, since {date}"; the value is not rendered, the chip stays | - |
| check state `not_evaluated{since}` (P14) | `clock` | "Not evaluated: tracked since {date}". A **check-level** state, not a section state: it applies to the snapshot-dependent rules (rename in 6 months, the LT 180-day arrears age, "no longer on the debtor list since"). It never reads as clean | - |
| client `loading` | skeleton | - | - |

Rules:
- Optional fields (LEI, VAT, website) render **no row** when absent. Core fields and every risk check always render a state.
- **Courts (S10).** In LT, LV and EE, S10 is `not_checked{reason: manual_lookup}`: "Check manually at the official court-decision portal", with the official link only and a caveat that agents do not search that portal in this version. Check 10 is **not possible** there (`not_possible`), so the coverage line reads "10 of 11 checks ran · 1 not possible in Latvia" and never "none found"; the instant checks card shows it as not run, not as "Runs when you investigate". An LV case number on a securing-measure event links to the portal and does not count as running check 10. Only the US has an agent court search (S10.US.01 and S10.US.02: AGENT state, "Possible match by name, needs review").
- **Lithuanian social insurance (S07.LT.01, S08.LT.02).** `not_checked{reason: agent_only}` on the profile ("the money and tax agent checks this when you investigate"). In a report the value carries a chip "read live by the money and tax agent, not stored". The LT coverage line names it. LT check 7 runs on the stored debtor list (S08.LT.01), and the money agent may add the live signal `social_insurance_debt`, shown as a finding with the "read live, not stored" chip; its 180-day age rule counts from the list's entry date ("on the list since 2 Sep 2026 (79 days)"), so it is not `not_evaluated`.
- **Check 5 wording.** The label is "Accounts filed" (not "on time"). The line says what the register holds: "Annual report for 2025 in the register since 28 Apr 2026", or "Annual report for 2025 not in the register, 14 months after the year ended". The words "late", "overdue" and "deadline" never appear in a string Finora writes (`i18n/src/copy-rules.test.ts` scans the catalogue and the verdict fixtures), because only an estimate of the filing window exists.
- A section whose rows are all `not_published` collapses into one sentence: "Lithuania publishes no ownership data".
- `restricted` depends on the rule (country, legal form, section), never on the record. The UI renders what the DTO says and never infers the lock from missing data.
- Register words are shown as the register writes them, with an English gloss where one exists ("Likviduojamas · under liquidation"), and carry `lang` for the source's language.
- Derived values (shared-address counts, parent links, estimates) use the `derived` chip kind: "Derived by Finora", with the input sources and a method link.
- Snapshot-dependent checks (renamed in the last 6 months, the 180-day arrears age, "no longer on the debtor list since") render the check-level `not_evaluated{since}` state until the snapshots cover the window (P14). It is `Check.state = "not_evaluated"` with `trackedSince` (architecture §7.2, P14), never a section state.
- **Icons** follow the mockups (`assets/app.js`): `dash`, `check`, `warn`, `euro`, `key`, `agent`, `hand`, `lock`, `flag`, `clock`, `info`, `ext`. Lucide stand-ins are `minus`, `check`, `triangle-alert`, `euro`, `key-round`, `bot`, `hand`, `lock`, `flag`, `clock`, `info`, `external-link`. Where a stand-in differs visibly from the mockup glyph, U1 draws the mockup glyph as an inline SVG in `packages/ui`.

### 5.2 `SourceChip`

- Collapsed: mono 12/18, `register · LV · 18 Nov`, never wraps (licence names are short fixed strings).
- Open (popover, not tooltip: works on touch): source name and a link to the record; licence name linking to its row on the Sources page; retrieved at (date, time); the source's own as-of date; access-tier word ("open data", "API with key", "display only"); who produced it (loader id or agent role); for agent findings, the quote in a `Quote`.
- CC BY and similar licences also appear in the page's `AttributionFooter`.
- A value without a `SourceRef` is not rendered (R3). The DTO schema already requires one, and `SourceChip` throws in development if given none.

### 5.3 `PurposeGate`

Person data (S03, S04, S14 insider names) sits behind a stated purpose (legal rule 2, P2).

1. A person section with `needs_purpose` renders a well inside the section: legend "Why are you looking at the people in this company?", the four fixed purposes as radio buttons (from the API; draft list, legal confirms against P7), the note "Asked once and kept for 12 hours. Each company you open is logged with this purpose. Not available for credit, employment, tenancy or insurance decisions about a person.", and **Show people**. **There are no person values in the DOM at this point**: the API did not send them, and a test asserts it.
2. The purposes list excludes the blocked uses (credit, employment, insurance, tenancy, licensing, credit servicing, P7) and the footer links to the terms that state them.
3. Choosing one calls `POST /api/v1/purpose { purposeId }`. The server sets an **HTTP-only session cookie** valid for `PURPOSE_SESSION_HOURS` (12) or until restart; the browser never stores the purpose and no script can read it. The server-rendered profile reads the cookie through the render seam and returns the person sections as data (with `purpose` echoed so the line "Purpose: {purpose} · Change" can render) or as `needs_purpose`. After choosing, the client refetches the section. Every open of a company's person data is logged by the server, one row per company (P2).
4. After it, each person section shows "Purpose: {purpose} · Change" above its table. Changing it is allowed at any time and affects only later opens.
5. Expiry: when the cookie has expired, the next load or refetch returns `needs_purpose` and the gate shows again, without losing page state. A blocked purpose id is refused with `400 purpose_blocked` and the UI shows the error line.
6. Focus: after **Show people**, focus moves to the first row of the unlocked table. After Change, focus returns to the radio group.
7. People rows show name and role only. No codes, no ages, no hashes (P3). Names are text, never links.
8. Natural-person and sole-trader subjects: the disclaimer sits at the top of the page (rule 6) and the page is the facts-only variant (§5.5).

### 5.4 Search and the command bar

- One `Combobox`. Typing is debounced 120 ms; each new query aborts the previous request; a response for an older query is ignored.
- Results come as **groups**: LT, LV, EE, US (bulk-loaded), then the live US state groups. Each group has a state: `ready`, `loading {percent}`, `live`, `error`, `empty`. A country whose load is still running shows "Estonia: loading, 62%" in its place. **"No match" appears only when every group has settled.** A live-state group reads "Searching NY, CO, CT, PA" and then lists results or "Checked NY, CO, CT, PA: no match", so "No match" never means "no such company in the US".
- A row shows the distinguishing facts: code, legal form, status, city, registration year. Names clamp to two lines. Struck-off companies are listed, with "Removed from the register in 2021".
- No person results, ever (L2): the result type has no person variant.
- No match shows two things: what was checked, and **Investigate this text** (opens the Investigate sheet with the text as subject; without a key it opens the key sheet).
- The command bar adds a second group: tools (Explorer, Crash monitor) and recent investigations. `Enter` on a company opens the company page; `Enter` on a tool navigates.
- Search is keyboard-complete: `/` focuses the box; arrow keys move; `Enter` opens; `Esc` resets, then closes.
- Response shape (accepted, architecture §5.1): `GET /search` returns groups, and each live US state register is its own `GET /search/live/:register` request with a 3 s timeout and an error state.

### 5.5 `VerdictBlock`

Structure (top to bottom), as separate children so no wrapper can cover the level:

1. **Level** in the serif display size, from the typed list `no_concerns_found | points_to_check | serious_concerns | not_enough_data`, each with icon and word. Colour: level 1 is `--ink` with a neutral dot, never green; level 2 `--warn` with `!`; level 3 `--bad` with `×`; level 0 `--muted` with `?`. The label "Rule-based" sits beside it.
2. **Coverage on the same line**: "7 of 11 checks ran · 2 not possible in [country] · 31 sources · 19 Nov 2026". `not_enough_data` also lists the checks that did not run, each with its reason ("Owners: restricted in [country]").
3. **Why this level**: the fired rules, each linking to its finding, or "No hard or soft flag in the checks that ran".
4. **Explanation**: the AI-written sentences, each with its citation chips, under an `AiLabel`. `VerdictText` drops any sentence with no citation (R7). If nothing is left, it shows "Not enough evidence for a verdict".
5. The `ChecksList` (the fixed 11 checks, ids 1-11), then key findings, each linked to its evidence.

Fired rules render through the catalogue (`rules.<ruleId>`, for example `rules.arrears_serious`), never from model text. Coverage skip reasons (`not_possible_in_country`, `run_failed`, `stopped`, `budget_exceeded`, `needs_key`) each have their own catalogue line. If the explanation is `null` (reason `banned_term_fallback`), the block shows the fired rules and findings with the line "No written explanation for this report" and nothing else; the level is unaffected.

Variants: `not_enough_data` (muted `?`, the "why" is the reason list: not pinned, status not current, fewer than 6 of 11 ran, neither money check ran); `not-confirmed` ("Not enough data: company not confirmed"); `facts-only` for natural persons and sole traders: no verdict block at all ("Facts only: no verdict is given on a private individual") plus the disclaimer.

Flags always show, whatever the level: "Not enough data" replaces only "No concerns found" (council Part B).

### 5.6 Questions to the human

All question cards pin to the top of `AgentPanel`, are announced once (§6.5), and show which lanes are waiting ("Registry, Money are waiting for your answer"). Waiting lanes link back to the card.

| Variant | Content | Default and timeout |
|---|---|---|
| `entity_choice` | Asked by the lead; up to 5 cards: registry code, legal form, status, city, registered date, and **None of these**. Lithuanian name collisions are common, so the distinguishing facts are always shown | **No default and no countdown.** After 30 minutes the investigation ends and the report shows "Not enough data: company not confirmed". Blocks every lane |
| `sanctions_match` | Asked by the legal agent. Side-by-side records. Rows appear only where at least one side has a value, marked match, differs or not on the list; official identifier rows come first. Buttons: Same entity, Different, Not sure. Outcome wording: "Confirmed: same registration number" (rule-based), "Confirmed by you" (with who and when), "Possible match, needs review". The word "sanctioned" renders only for `status: listed` | "Not sure" after 30 minutes, shown as "answered by default"; it blocks only the legal lane |
| `scope` | Asked by the web agent when a candidate website has no anchor to the company: the site and why it is uncertain, then "Yes, it's theirs" / "No" / "Not sure" | "Not sure" after the timeout, marked "answered by default"; the site then stays "linked by name only" |
| `cap_reached` | "Stop here and write the report" (default, the primary button) or "Allow up to $0.50 more", clipped to what is left of the daily cap. Offered once per investigation. Second time: only the stop button and "Extension already used for this investigation". Nothing left today: no option and the daily-cap text | stop, after 10 minutes. Every lane shows `waiting` with `waitingOn: "cap"` and the header says "Paused at cap" (architecture §7: no separate run status) |
| `free_text` | Asked by the lead when free text names no country and the name exists in several registers: one text input with the candidate countries as quick replies | no default; times out like `entity_choice` |

Keyboard: the card is a landmark region labelled with the question; options are a radio group (arrow keys), `Enter` submits, `Esc` does nothing (a question is never dismissed). The panel shows the timeout as plain text ("The default applies at 14:32") for kinds that have one.

### 5.7 `Quote`

| Source kind | What may be shown |
|---|---|
| The company's own pages | up to 300 characters plus the link |
| Press | headline, outlet, date, link and at most 125 characters |
| Domain records | derived facts only ("Domain registered 3 years before the company") |
| Web archives | snapshot dates and links |
| Lists and official notices | the stored excerpt |

Text over the limit is cut at the limit with "Read at source". Quotes are the only place banned words may appear, and only with their citation (council clarification 2).

### 5.8 Network explorer

- **Company-to-company only, one hop.** Nodes are companies. Edges are: registered-office address shared by companies, and corporate members (LV, EE). **No person nodes, no "also officer in N other companies" count** (council Part C, S17). An address shared with a sole trader or a private individual is not shown, nor any count tied to it.
- An address node reads "This address hosts {n} companies" and collapses after 20 with the caveat: "A shared address can be an office building or a registered-agent address."
- Corporate-member edges are labelled with the holding ("60%", from `share` on the edge); shared-office edges are dashed and carry the "Derived by Finora" chip. Edge cards show the relation, the date, and a `SourceChip`. Counts and links we compute carry the "Derived by Finora" chip.
- Browsing the network **never starts an agent run**; a test asserts that no `POST /investigations` is sent.
- Layout: `d3-force` runs in the main thread for up to 300 nodes, stops when settled, and redraws on pan and zoom only. Under `prefers-reduced-motion` the layout is computed synchronously and drawn once.
- Views: `Tabs` Graph / List. The list is the default under 768 px and is always one click away. The canvas has a visible "View as list" button next to it and `role="img"` with a label that summarises ("12 companies linked to this company through 3 shared addresses and 2 corporate members").
- States: `loading`, `graph`, `empty` ("No linked companies found. Checked shared registered offices and corporate members as of {date}"), `too-large` (more than 200 nodes: the list opens first, "Showing 20 of 340, grouped by address"), `error`.
- Routes: `.../network` and `.../runs/[id]/network`. The back link returns to the profile or run.

### 5.9 Crash monitor tiles

**Page anatomy** (`crash.html`): overline and serif H1 ("How far markets are from their peaks") with the "Updated 2 min ago" line and the cadence note; a `Banner` when running on official data only ("10 of 20 series work without a key ... Add a key"); the **Distance from peak** strip beside the **US national debt** card; tiles M01 to M07; "How it's calculated" and the attribution lines at the end. Fund symbols and key data stay on this machine, and the page says so.

One tile per id M01-M08 (M09 is LATER). A tile holds one or more **rows** (`MarketRow` in architecture §8, defined in `docs/plan/loaders/markets.md` §1.4): M03 holds up to seven markets, M01 three. Each row shows its name, the value and drawdown, a sparkline, the as-of time, the source and its attribution line, and has its own state. The row's DTO state (`ok | peak_unknown | needs_key | needs_symbol | stale | error | loading`) maps to the display states below; `live`, `delayed` and `coarse` are `ok` rows told apart by the row's cadence and lag. State by row (the council's Part C):

| State | When | What shows |
|---|---|---|
| `live` | data is current | value, drawdown, as-of time |
| `delayed` | the source is delayed | the same, plus "15 min delayed" or the lag, in the chip |
| `coarse` | official-only value, finer with a key (M01 quarterly, M05 monthly) | the coarse value, "Quarterly · as of Q2 2026" and "Add a key for daily" inside the tile; never claims to be live |
| `needs-key` | row with a symbol (or a key-only source) and no key | the row's shape with no number, "Add your key to check" |
| `choose-fund` | fund-proxy row with no symbol set (`needs_symbol`) | "Choose a fund in settings", no number |
| `proxy` | fund proxy with a symbol | title "[Region], in USD" and the caveat "Via {symbol}, a US-listed fund. In US dollars: includes currency moves and fund fees. Not the index." |
| `peak-unknown` | history does not reach the peak start | "Peak not known yet: tracking since {date}". **No drawdown percentage, never 0%** |
| `stale` | as-of older than twice its cadence | the value stays, the as-of chip turns `--warn`: "as of {time}, older than its usual refresh" |
| `error` | the request failed | the last good value with its as-of time and a Retry, or an error row if there is none |
| `loading` | first load | skeleton with the tile's final size |

Rules:
- Drawdown is shown with a real minus sign, an arrow icon and the word (for example "−12.4% from peak"). Never colour alone.
- M08's live ticker is an estimate: shown beside the official figure and its date, labelled "estimate", never alone.
- "Market cap lost" shows only where the source's terms allow it and are quoted; otherwise the tile shows drawdown only.
- Every tile has a text alternative to its chart: a hidden table of peak date and value, latest value, drawdown.
- **Total-crypto peak** is an all-time high, not "since [date]": the row says "All-time high, {date}" (the DTO carries the peak basis). A seeded peak says "Peak seeded from {source}".
- **Value-lost summary** (`WipedSummary`, at the top of the drawdown card): "Value below peaks ≈ $X trillion", then one sentence naming every row in the sum with its as-of and "the oldest figure is from {as-of}", and a "Derived by Finora" badge. Only rows with `countInTotal: true` are summed (US corporate equities and the total crypto market; bitcoin and ether keep their own figures and are never added on top). A counted row with no value is named as left out (`excludedItemIds`), and the total never falls back to adding the parts. Hidden when fewer than two rows are counted.
- **Server refresh vs page poll.** The server refreshes crypto every 5 minutes while a Crash monitor client is connected (hourly otherwise), stocks hourly in US hours, official series every 6 hours. The page polls `GET /markets/crash` (a cache read) every 60 s while the tab is visible and stops when hidden; that poll is also what marks a client as connected. Each row's as-of time tells the truth about its age, so a 60 s poll never implies a 60 s refresh.
- Refresh in the page: Each tile has a reserved height, so a refresh causes no layout shift (CLS measured as 0 in e2e). Values change in place; the counter animation is the one motion kept under reduced motion.
- Tickers a user types are saved in local settings only (P12), in 13 named slots (`M01.us_total`, `M01.us_large`, `M01.us_tech`, `M02.europe`, `M03.japan`, `M03.korea`, `M03.taiwan`, `M03.hong_kong`, `M03.china`, `M03.india`, `M03.australia`, `M04.canada`, `M04.brazil`), each matching `^[A-Z0-9.\-]{1,10}$`. No ticker ships in the repo, defaults, fixtures, docs or tests; fixtures use fictional symbols.

---

## 6. Streaming agent progress

### 6.1 Data flow

```
GET /investigations/:id          -> snapshot { ..., lastEventId }          (TanStack Query)
GET /investigations/:id/events   -> SSE, header Last-Event-ID = lastEventId   (apps/web/src/lib/sse.ts)
                                   |
                       frame buffer (events queued as they arrive)
                                   |  flushed once per animation frame
                       reduce(state, event)  -- pure, idempotent -->  React state (useReducer)
                                   |
        selectors: lanes, tasks, header counts, findings by section, pending question, verdict, spend
```

- **Snapshot then stream.** A reload fetches the snapshot, builds the state from it, and opens the stream after `lastEventId`. The reducer ignores any event whose `id` is not greater than the state's `lastEventId`, so replays and duplicates change nothing.
- **Idempotent and order-safe.** Events are applied in `id` order. If one arrives with a gap (`id > last + 1`), the client does not guess: it re-fetches the snapshot and reconnects.
- **Batching.** Events received between two animation frames are reduced together and rendered once. With 17 tasks ticking this keeps the page at one render per frame. The measured budget is an event on screen within 500 ms of arrival.
- **Connection states** (`RunHeader` shows them): `connecting`, `live`, `reconnecting` (shown after 3 s offline, content stays), `failed` (after 5 minutes: "Lost connection to the app. Reload to continue"). Backoff 1, 2, 4, 8, then 15 s, with jitter. A silence of 45 s (two missed 20 s heartbeats) forces a reconnect.
- **Money** is integer micro-USD end to end; sums are integer; formatting uses `Intl.NumberFormat` with the locale. No float arithmetic on money (a test searches for it in the reducer).
- **Text is never model prose in a lane.** A lane step is `stepKey` + `params` (for example `step.fetching_page`, `step.searching_courts`) and a task is `labelKey` + `params` (`task.screen_sanctions`, `task.live_list`, `task.search_courts`, `task.domain_report`, `task.news_search`), both rendered from the `agents` catalogue namespace. An unknown key renders the generic "Working". The key lists live in `docs/plan/agents.md` §11. Lanes start within 2 s of the pin (staggered 1 s apart), so the first frame after `plan` shows `queued` lanes turning `running` in sequence. Findings, explanations and answers are model text, always with `AiLabel`.

### 6.2 Reducer state

```ts
type InvestigationState = {
  lastEventId: number;
  status: InvestigationStatus;
  runs: Record<RunId, { role: AgentRole; status: RunStatus; stepKey?: string; stepParams?: Params;
                        waitingOn?: QuestionId; sourcesRead: number; startedAt?: string; endedAt?: string;
                        spentMicroUsd: number; tasks: TaskId[] }>;
  tasks: Record<TaskId, TaskState>;
  findings: Record<FindingId, Finding>;           // keyed, so a replay cannot duplicate
  questions: Record<QuestionId, QuestionState>;   // pending | answered(by human|default)
  cost: { spentMicroUsd: number; heldMicroUsd: number; capMicroUsd: number };
  verdict: Verdict | null;
  connection: "connecting" | "live" | "reconnecting" | "failed";
};
```

### 6.3 Where each event lands

| Event | Effect on screen |
|---|---|
| `investigation.status` | Header status text and progress; `done` shows the verdict; `budget_exceeded` shows the "report written from what was found" note |
| `plan` | The four specialist lanes start (all together in v1, so no dependency text). The **lead** lane ("Lead: resolve and plan") exists from the start and ends with "Pinned to registration no. {code}"; the **verdict** lane stays `queued` until the specialists end |
| `run.status` | Lane status icon and text; `waiting` links to the question; `failed` shows the machine code mapped to catalogue text and **Re-run {agent}** (agents.md §2.7 offers it) (route: `POST /investigations/:id/runs/:runId/rerun`) |
| `run.step` | The lane's `ActivityLine` (replaces the previous line) |
| `run.task` | A `TaskRow` appears or changes; header task count. In the Baltics the legal lane lists "court portals: manual in the Baltics" as a `skipped` task |
| `run.source` | The lane's "sources read" counter and the header source count tick up |
| `finding` | A `FindingItem` lands in the matching `SectionCard` (by the item's section) with a 600 ms accent wash (none under reduced motion) and in the report's evidence group. A finding with no section shows only in the evidence group. A `context` finding has no severity and no severity chip, and never counts as a fired rule. A web finding with anchor `name_only` shows "Linked by name only"; a news item that is not confirmed shows "Mentions the name; not confirmed to be this company" and is never a key finding. No citation: never rendered |
| `question` | `QuestionCard` pinned to the top of the panel; lanes it blocks show "Waiting for your answer" |
| `question.answered` | The card collapses to "Answered: {answer}" (by you or by default) and the lane resumes |
| `cost` | The lane's cost and the header's spend against the cap. Between 80% and 100% of the cap the header turns `--warn` |
| `verdict` | `VerdictBlock` appears on top of the page; the panel keeps the lanes for replay |
| `error` | An inline `ErrorState` in the panel with the mapped message |

### 6.4 Controls

- **Stop** posts `POST .../stop` and the header shows "Stopping" until `run.status` events arrive. Lanes end `stopped`. The panel then offers "Write the report from what was found" (synthesis is offered, not automatic).
- **Answer** disables the card while posting, then waits for `question.answered`. A failure re-enables it with the error text.
- **Cap extension** is a `cap_reached` question, not a new control.
- **Re-run the whole investigation** opens the Investigate sheet again with the same subject and creates a new run URL. The old run stays in the library.
- **Re-run one agent** (`POST .../runs/:runId/rerun`, agents.md §2.8). The lane shows **Re-run {agent}** only for a specialist whose run ended `failed`, `stopped` or `budget_exceeded` (or `done` with a turn, tool or time limit), and "Re-check now" on any specialist once the investigation is more than 24 hours old. It is hidden while the investigation runs, when the daily cap leaves less than the role's typical cost, and after two re-runs of that role; the button's tooltip text (a visible line, not tooltip-only) says which. The new run appears as a new lane row; the old run stays, marked "Replaced by a re-run", and its findings leave the verdict. When the new run ends the verdict is recomputed and the page shows "Verdict updated {time}".
- **Reload** restores the same state (acceptance test in U5).

### 6.5 Announcements (live region)

One polite `LiveRegion` per page. Throttle rule: at most **one announcement per lane status change**, and none for steps, sources or costs. Messages:
- a run changes status: "Registry: done" or "Legal: waiting for your answer";
- a question arrives: "Question: which company? Choose one in the agents panel";
- the verdict arrives: "Report ready: {level label}, {ran} of {applicable} checks ran";
- connection lost or restored.

The question announcement does not move focus. A shortcut and a link take the user to the card (§8). The counters in the panel are not live regions (they would flood a screen reader). The header's text status is a normal element, and its changes are announced only through the one `LiveRegion`; there is no second region.

---

## 7. Loading, empty, partial and error states

### 7.1 Patterns

| Pattern | Rule |
|---|---|
| **Loading** | A skeleton of the final size, so nothing moves when data arrives. Server components stream with `Suspense` per section: the header and the first sections paint first. No spinners. Under reduced motion the skeleton does not shimmer |
| **Empty** | Never blank. A section has one of the states in §5.1 and says which. A page-level empty state (no investigations yet) has one sentence and one action |
| **Partial** | Rendered as `data` with `completeness: partial` and a visible gap, or a failed agent lane next to finished ones. A partial report says which lane failed and what it would have checked |
| **Error** | Muted, with an icon, the cause in plain words from the machine code, and a **Retry** where retrying can work. An error in one section never blanks the page: each `SectionCard` has its own error boundary (`ErrorState` with Retry), and `error.tsx` exists per route segment |
| **Stale** | Value stays, the date chip turns `--warn` and says why |

### 7.2 Per screen

| Screen | `loading` | `empty` | `partial` | `error` |
|---|---|---|---|---|
| Search | Result groups with skeleton rows; countries still loading show their percent | "Search a company by name or registry code", recent items | one country failed: its group shows "Not checked: {country} did not answer" with Retry; the rest show results | the whole search failed: `ErrorState` with Retry, input kept |
| Company page | Header and section skeletons | the company has no data in a section: §5.1 states | some sections loaded, one failed: that section shows Retry | company not found (`entity_not_found`): "No company with this code in {country}" and the search box; a suppressed entity shows the same, so it leaks nothing |
| Investigation | Panel skeleton while the snapshot loads; lanes `queued` after `plan` | - | a lane `failed` or `budget_exceeded`: the report is written from the rest and says so | the stream failed: `reconnecting` then `failed`; a start failure shows the mapped code (`price_unknown`, `daily_cap_reached`, `no_key`) |
| Report | Verdict skeleton while synthesis runs ("Writing the report from {n} findings") | - | `not_enough_data` is a valid, designed state; a partial report lists the lane that failed | no verdict because synthesis failed: findings and checks stay, with a retry for the explanation |
| Network | Graph skeleton | "No linked companies found. Checked ... as of {date}" | `too-large`: scoped to the list view | Retry |
| Library | Row skeletons | "No investigations yet. Open a company and press Investigate" | - | Retry |
| Crash monitor | Tiles at their final size | - | tiles in mixed states (§5.9) | per tile (§5.9) |
| Settings, Sources | skeleton | - | - | Retry |

### 7.3 Global cases

- **Purpose required** (`428`): the section shows the purpose gate, not an error.
- **Host or origin refused** (`403`): a plain page "This app only answers on the machine it runs on" (local mode).
- **Offline**: the shell shows a banner "You are offline"; cached pages stay readable.
- **No LLM key**: the explorer works fully. **Investigate** stays visible and opens the "Add your key to run agents" sheet. Never a disabled button with no reason.
- **No SEC contact setting**: US public profiles show `needs_key` rows ("needs the SEC contact setting") and promise nothing.
- **Daily cap reached**: Investigate opens the spend and reset-time sheet. The instant profile keeps working.
- **404 and 500**: `not-found.tsx` and `error.tsx` per tool, with the search box and a link home.

---

## 8. Keyboard behaviour and focus

Every interactive element is reachable and operable by keyboard. Focus is always visible (2 px `--accent` outline, 2 px offset).

### 8.1 Global shortcuts

| Key | Action | Notes |
|---|---|---|
| `/` | Focus search, or open the command bar | Ignored when focus is in an editable field |
| `Ctrl/Cmd+K` | Open the command bar | Works everywhere, including in fields |
| `?` | Show the shortcut list (a dialog) | |
| `i` | Open the Investigate sheet | Company pages only |
| `q` | Move focus to the pending question card | Only while a question is pending |
| `j` / `k` | Next / previous finding or section | Report and company pages |
| `Enter` | Expand the focused source chip, finding or lane | |
| `Esc` | Close the topmost popover, sheet or dialog; return focus to its trigger | |

**Precedence.** `Esc` acts on the topmost open layer only: an open popover first, then a sheet or dialog, then (in a field with text) it resets the field, and an empty field loses focus. `/` is global, and only when focus is not in an editable control and no dialog is open. Component rows in §4 describe what their own `Esc` does inside that order.

**Single-character shortcuts** (`/ i q j k ?`) follow WCAG 2.1.4: they can be turned off in Settings ("Keyboard shortcuts", on by default), and they are ignored while a modifier key is held, while focus is in an editable control, and while a dialog is open. `Ctrl/Cmd+K` is a modifier shortcut and stays.

### 8.2 Focus management

| Moment | Focus goes to |
|---|---|
| Page navigation | The page `<h1>` (`tabIndex={-1}`); the skip link is the first tab stop |
| Dialog or sheet opens | The first control, or the primary action when the dialog is a confirmation |
| Dialog or sheet closes | The element that opened it; if it is gone, the nearest heading |
| Command bar opens and closes | Its input; the previously focused element |
| Search results update | Stays in the input; the result count goes to the live region |
| Purpose chosen | The first row of the unlocked table |
| Investigation starts | The panel heading ("Agents"), not the first lane |
| Question arrives | Does not move. `q` and the "Waiting for your answer" link move it |
| Question answered | The next lane that changed status, else the panel heading |
| Verdict arrives | Does not move. The live region announces it; "Skip to report" is a link in the header |
| Tabs and radio groups | Roving tabindex, arrow keys |
| Toast | Does not take focus; `F8` reaches the region |

### 8.3 Component keys

Listed with each component in §4. Extra rules:
- **Lists with many items** (library, search results, evidence) use a single tab stop with arrow keys only where the pattern is a listbox or grid; otherwise each item is a link or button in the normal tab order. Findings use the normal tab order plus `j/k`.
- **The graph canvas** is one tab stop. Inside it: arrow keys move the selection to the nearest neighbouring node in that direction, `Enter` opens the node card, `Esc` clears the selection, `+` and `-` zoom. Everything it shows is also in the list twin.
- **Tables** have no widget keys. A scroll region is focusable so the keyboard can scroll it.
- **No keyboard traps** except modal dialogs, which release on `Esc`.

---

## 9. Accessibility

Target: WCAG 2.2 AA. The checks below are in the build (tests named in §15), not a final audit.

| Area | Rule | Check |
|---|---|---|
| Structure | One `<h1>` per page, headings in order; landmarks: `header`, `nav` (tool rail), `main`, `aside` (agent panel, chat), `footer`; a skip link | axe, `structure.spec.ts` |
| Focus | Visible on every control; never removed; outline, so forced-colours mode keeps it | `keyboard.spec.ts`, forced-colours run |
| Contrast | Text ≥ 4.5:1, non-text ≥ 3:1 in both themes; `--faint` never carries text | `tokens.contrast.test.ts`, axe |
| Colour | Never the only carrier: every status has an icon or sign and a word | review in the gallery, test on `StatusPill` |
| Targets | At least 24 × 24 px (WCAG 2.2); 44 px on coarse pointers | `target-size.spec.ts` on the gallery |
| Motion | `prefers-reduced-motion`: no transitions, pulses, washes, shimmer or sheet slides, except counters changing; nothing flashes | emulated-media test checks computed durations |
| Zoom and reflow | Works at 200% zoom and at 320 CSS px width without two-dimensional scrolling (tables scroll inside their own region) | `reflow.spec.ts` |
| Text spacing | Layout survives the WCAG text-spacing overrides (line 1.5, paragraph 2, letter 0.12, word 0.16) | `text-spacing.spec.ts` |
| Forced colours | Gallery renders with `forcedColors: "active"`: icons keep meaning, chips keep borders | screenshot-free assertion run |
| Names | Every icon-only button has `aria-label`; every input a label; every image `alt` (decorative: empty) | lint rule + axe |
| Live updates | One polite region, throttled (§6.5). No `aria-live` on counters | `live-region.spec.ts` |
| Tables | Real `<table>` with `<th scope>`; the sparkline and chart text alternatives hold the same numbers | axe, unit tests |
| Graph | `role="img"` label plus the list twin; keyboard traversal on the canvas | `network.keyboard.spec.ts` |
| Language | `<html lang>` follows the locale; register values carry `lang` of their source | `lang.spec.ts` |
| Time limits | Question timeouts are server-side defaults; the card states the time and answering is possible until then; no UI element disappears on a timer | review |
| Errors | Errors are text with `role="alert"` for form submits, linked by `aria-describedby` | unit tests |
| Screen reader pass | One manual pass with a Windows screen reader per milestone on the search → profile → investigation path, noted in the council record | manual; **optional if no reader is available** |

---

## 10. Responsive behaviour

Test widths are web-qa's four: **390×844, 768×1024, 1280×800, 1920×1080**. The panel breakpoint is 1024.

| Width | Layout |
|---|---|
| ≥ 1280 | Tool rail (56 px), content column up to 880 px, **agent panel** at the right (360 to 400 px), chat dock as a second right column when open |
| 1024 to 1279 | Tool rail, content, agent panel at the right (336 px); the chat is a right sheet |
| 768 to 1023 | Tool rail; the agent panel and the chat move **below the content** as sheets. A sticky summary bar ("4 agents · 2 running · $0.31") opens the sheet |
| < 768 | **Bottom bar** replaces the rail. One column. Tables become scrollable regions with a sticky first column (key figures show 3 years, then scroll). The network opens in list view. The sheet is a bottom sheet |
| 1920 | Content stays at its maximum width and is centred. The panel does not grow. Nothing stretches to 1920 |

Other rules:
- No horizontal scroll on the page at any of the four widths (tested). Long names wrap and clamp (a 200-character fictional name is a fixture).
- Touch: 44 px targets on coarse pointers. Hover is never the only way to a fact (tooltips repeat information that is also reachable by tap or focus).
- Safe areas: the bottom bar and bottom sheets use `env(safe-area-inset-bottom)`.
- Print: not in v1.

---

## 11. Language, copy and formatting

- **Four locales:** `en`, `lt`, `lv`, `et` (the URL segment is `et`). All text is in `packages/i18n/messages/<locale>.json`, namespaced: `common`, `shell`, `search`, `field`, `company`, `investigate`, `agents`, `report`, `network`, `library`, `crash`, `settings`, `errors`. ICU plurals. The parity test (S02) fails on a missing key, an empty string or a different ICU argument.
- **Banned wording** (council clarification 2) covers every string Finora writes: verdict and status labels, finding statements, catalogue strings, controls, LLM prose. The list lives in one file, `packages/domain/src/config/banned-terms.ts` (architecture §10), per locale, with patterns for the words, letter grades (an A to F grade shown as a rating) and credit-score wording. `i18n/src/banned-terms.test.ts` checks every catalogue string against it, case-insensitively and whole-word, with no exception list, and has cases for the grade and score patterns. The runtime check on model output uses the same file. Controls use "Reset", not "Clear". The only exemption is a verbatim quote inside `Quote`, with its citation. The LT, LV and ET lists are word **stems** (the languages inflect), drafted in DESIGN.md §4 and pending native review: until that review the locale test warns and the English test fails the build.
- **LLM text** with a banned term is rejected, regenerated once, then replaced by the sourced facts alone (council clarification 2). That is a runtime rule; the UI renders the facts-only fallback as a normal state.
- **Numbers and dates** use `Intl` with the active locale. A company's money keeps its own currency (EUR, USD, "LVL (before the euro)"). Dates show the register's as-of date plus the retrieval date in the chip. Relative times only where an absolute time is also available (title attribute or chip).
- **Register words** keep the register's language, plus an English gloss in the pill where one exists, never our paraphrase alone.
- **Lengths:** Lithuanian, Latvian and Estonian strings run longer than English. Buttons and chips wrap or grow, they never clip. The gallery renders every component in `lv` as well.
- **Voice:** plain and exact. Nothing says "Clear", "Safe", "Avoid", "Scam" or "Fraud". "None found" reports a check, not a judgement. Empty-state sentences name the source and the date.

---

## 12. Fixtures, the state gallery and `?state=`

**Fixtures are synthetic.** Names are obviously fictional: "Example Company A SIA", "Sample Trading UAB", "Placeholder Foods OÜ", "Example Holdings Inc", people "Example Person One". One company has a 200-character fictional name. Registry codes use the fixture ID rules in `docs/plan/reviews/00-early-plan-review.md` (#9). Fund symbols are fictional (`FXAA`). No real entity appears in any fixture, screenshot or doc. URLs and email addresses in fixtures use reserved names only (`.example`, `.test`, `example.com`, `example.org`), and `fixtures/ui.test.ts` fails on any other host or on a string shaped like an email address. Fund symbols use a reserved fictional prefix that `fixtures/ids.test.ts` checks.

**The state gallery.** `/[locale]/design` lists every component and screen state; `/design/<group>/<name>` renders one with `?theme=` and `?locale=`. It exists only when `FINORA_DEMO=1` (set by `pnpm finora --demo`, the dev server for tests and CI); a normal run returns 404 there. It is the target of the visual, axe, keyboard and e2e tests, and web-qa can reach any state by URL.

**`?state=` on real pages.** In fixture mode (`FINORA_DEMO=1`) the real routes read a state switch and serve DTOs from `fixtures/ui/` instead of the API. In any other mode the parameters are ignored. This is the same contract the designer's mockups use.

| Parameter | Values |
|---|---|
| `state` | `empty`, `loading`, `streaming`, `question`, `partial`, `error`, `report` |
| `country` | `lt`, `lv`, `ee`, `us` (the same page, different field states) |
| `theme` | `dark`, `light` |
| `q` (with `state=question`) | `entity`, `sanctions`, `scope`, `cap`, `cap-used` |
| `verdict` (with `state=report`) | `insufficient`, `not-confirmed` |
| `subject` | `sole-trader` (facts-only variant) |
| `purpose` | `none`, `set` (person sections locked or open) |
| `markets` (Crash monitor) | `nokey`, `mixed`, `live`, `delayed`, `stale`, `error`, `peak-unknown` |
| `network` | `graph`, `list`, `empty`, `too-large`, `error` |

**Files.** `fixtures/ui/<screen>/<state>.json`. A test (`fixtures.test.ts`) validates every file against the `api-contract` schema and checks that every state in the table above has a file. Event scripts for streaming states are `fixtures/agents/<scenario>.json` (data-osint and architect own the format; the UI plays them with a scripted clock in tests so timing is deterministic).

---

## 13. Policy and legal rules in the UI

Each rule has one place in the UI and a named test. Rules R1-R18 are the legal memo's numbered product rules; P1-P14 are the council's policy table (`01-data.md` Part E and H).

| Rule | UI enforcement | Test |
|---|---|---|
| Rendered-field registry (council) | Every registry value is rendered by `FieldRow` or the field tables with an `itemId` typed from Part G; DTO value types are importable only from `components/field/**` and `components/company/**` | `web/src/field-registry.test.ts` (every `data-item-id` in every fixture is a SHOW or CAVEAT id for that country; every SHOW and CAVEAT id of the UI sections appears at least once in the gallery; no HIDE or LATER id ever appears) |
| HIDE items (S04.LV.02, S04.LV.03, S04.EE.02, S16.ALL.04, OUT.US.01) | The UI has no component or prop that can render them. `restricted` shows a lock keyed on the rule | `web/e2e/hide.spec.ts`: DOM and text of every profile fixture have no HIDE id, no canary beneficial-owner name, no canary personal code or birth-date pattern (P3, P8) |
| R2, P2 purpose gate | `PurposeGate` (§5.3) | `web/e2e/people-purpose.spec.ts`: no person values before a purpose; three companies send three requests carrying the purpose; after 12 h + 1 min the section is locked again (fake clock) |
| R3, R16 source, licence, date | `SourceChip`, `SourcesTable`, `AttributionFooter` | `web/e2e/report-sources.spec.ts`, `web/e2e/sources-page.spec.ts` |
| R5, P6 facts-only | `isNaturalPerson` from the DTO switches to `FactsOnlyBlock` | `web/e2e/facts-only.spec.ts`: no verdict block, the disclaimer at the top, S08 tax rows absent, S06 behind the purpose gate, no Investigate, no Network and no AGENT rows (no agents run on a natural person: `subject_is_natural_person`), and no library entry |
| R6 disclaimer | `PersonDisclaimer` on every page whose DTO has `containsPersonalData` | `web/e2e/disclaimer.spec.ts` |
| P7 blocked uses | The purpose list excludes them; the footer links to the terms | `web/e2e/people-purpose.spec.ts` asserts the option list; `web/e2e/terms-link.spec.ts` asserts the footer link |
| R7 unsourced claims | `VerdictText` and `FindingItem` render nothing without a citation | `web/src/components/verdict-text.test.tsx` |
| R8 sanctions wording | `SanctionsMatchCard`; "sanctioned" only for `status: listed` | `web/src/components/investigate/sanctions-match.test.tsx` |
| R9 AI label | `AiLabel` required by the type for `generatedBy: "ai"` | `web/e2e/ai-label.spec.ts` |
| R10 correction channel | `ReportProblem` on every section and finding menu | `web/e2e/dispute.spec.ts` |
| R18 source-code link | `Footer` | `web/e2e/source-link.spec.ts` |
| L3 indexing | `noindex` header and meta; `<title>` is the company name, or the registry code and legal form for natural persons and sole traders; never a person's name | `web/e2e/seo-headers.spec.ts` |
| Banned wording | §11 | `i18n/src/banned-terms.test.ts`, plus a pass over rendered fixture pages in `web/e2e/banned-words.spec.ts` |
| P12 fund tickers local | `FundSymbolField` writes to local settings only; fixtures use fictional symbols | the guard, plus `web/e2e/settings.spec.ts` |
| P14 snapshot windows | "Not evaluated: tracked since {date}" | `web/src/components/field/snapshot-window.test.tsx` (a 10-day-old fixture cannot show "no rename in 6 months") |
| Secrets | The UI shows key presence only | `web/e2e/settings.spec.ts` plants a canary key and asserts it is absent from HTML, API JSON and client chunks |

---

## 14. UI slices

The architect owns the numbering in `docs/plan/slices.md`. These are the UI slices, named `U1`-`U10` for now, with the architect slice each maps to. Each lands as one commit with its tests (slices.md "How slices work"), then qa review, then a web-qa pass. Every slice is checked by me in a real browser at the four widths before it goes to web-qa.

**Order** follows the council's walking skeleton: Latvia end to end first (architect's M2), then the other countries. The numbers are the architect's (`docs/plan/slices.md`, accepted 2026-11-20); `U1`-`U10` stay as the names used inside this file.

| Slice here | Slice in `slices.md` | Name | Depends on |
|---|---|---|---|
| U1 | S03 | Design system and state gallery | S02 |
| U2 | S04b | Client plumbing, fixtures and the stream (with the architect's contracts) | S03, S04 |
| U3 | S08 | Shell, search and the command bar | S03, S04b, S07 |
| U4 | S08 | Company profile, field system, sources page | U3 |
| U5 | S11 | Investigate and live agents | S08, S09 (S10 for real agents) |
| U6 | S11 | Verdict and report | U5 |
| U7 | S21 | Library | S11 |
| U8 | S20 | Network explorer | S08, S13, S14 |
| U9 | S23 | Crash monitor | S03, S04b, S22 |
| U10 | S24 | Settings and connectors | S04b, S22 |

U3 and U4 land as one S08 slice commit if they stay small enough to review, else as two commits under the same slice. Same for U5 and U6 under S11.

Slices that depend only on fixtures start before the real API lands (the architect's S04b makes that possible). Each is re-verified against the real API when the API slice lands.

### U1 Design system and state gallery

- **Scope:** `tokens.css`, `theme.css`, fonts, the `packages/ui` primitives of §4.1, theme and locale switching in the shell, `/design` with a page for every primitive, `scripts/check-tokens.mjs`, the axe and keyboard harness, the check that the rendered catalogue passes `banned-terms.ts` (the file itself is the architect's), the first visual baselines.
- **Acceptance:**
  1. `tokens.css` defines every token of the `DESIGN.md` colour table in both themes; the sync test fails on a missing or changed token.
  2. Contrast: every listed text pair is ≥ 4.5:1 and every non-text pair ≥ 3:1, in both themes.
  3. The first paint has the right theme with the cookie set to `light`, `dark` and absent (HTML response test, no inline script).
  4. Fonts load from our own origin; a page load makes no request to any other origin.
  5. Every primitive renders in every state of §4.1 in the gallery, in `en` and `lv`.
  6. Every interactive primitive is reachable and operable by keyboard with the focus outline visible, and keeps it in forced-colours mode.
  7. With `prefers-reduced-motion: reduce`, no element on the gallery has a non-zero transition or animation duration, except counters.
  8. axe finds no serious or critical violation on any gallery page, in both themes, at 390, 768, 1024 and 1280.
  9. `check-tokens` fails on a planted hex colour in a component file.
  10. A button with `variant=primary` and an `IconButton` without a `label` fail typecheck in a type test.
- **Tests:** `ui/src/tokens.sync.test.ts`, `ui/src/tokens.contrast.test.ts`, `ui/src/primitives/**/*.test.tsx` (one per primitive), `ui/src/types.test-d.ts`, `scripts/check-tokens.test.mjs`, `web/e2e/design.a11y.spec.ts`, `web/e2e/design.keyboard.spec.ts`, `web/e2e/design.motion.spec.ts`, `web/e2e/theme.spec.ts`, `web/e2e/fonts.spec.ts`, `web/e2e/design.visual.spec.ts` (baselines per §15).
- **Demo:** `FINORA_DEMO=1 pnpm dev`, open `/en/design`, tab through the Button page, switch the theme, switch to `/lv`.

### U2 Client plumbing, fixtures and the stream

- **Scope:** `lib/api.ts` (typed client from `api-contract`), the TanStack Query provider, `lib/server-data.ts` (the render-seam wrapper; first line `import "server-only"`), `lib/fixture-mode.ts` (server-only), `fixtures/ui/**` for every state in §12 (shared with S04b), `lib/sse.ts`, `state/investigation.ts`, `useInvestigation`, `lib/format.ts` (money, dates, relative time), `lib/purpose.ts` (calls `POST /purpose`, no client storage), `lib/shortcuts.ts`.
- **Acceptance:**
  1. The reducer is pure. Applying an event twice, or any event with `id ≤ lastEventId`, leaves the state unchanged (property test over shuffled duplicates).
  2. Replaying `fixtures/agents/<scenario>.json` reaches the same final state as the snapshot of that run (live equals reload), for every scenario.
  3. A gap in event ids triggers a snapshot refetch and a resubscribe, with no duplicate or lost finding.
  4. The SSE client resumes with `Last-Event-ID` after a drop; backoff is 1, 2, 4, 8, 15 s with jitter; 45 s of silence forces a reconnect; `reconnecting` shows after 3 s (fake-clock tests).
  5. Money arithmetic is integer; formatting follows the locale (`en`, `lt`, `lv`, `et`); a test greps the reducer for float operations on money.
  6. Every `fixtures/ui` file validates against the `api-contract` schema, and every state in §12 has a file.
  7. In a production build `?state=` is ignored and `/design` returns 404.
  8. The purpose session is the server cookie: it survives a reload, expires after 12 h (fake clock on the server), and is never readable from script (`document.cookie` test).
  9. Single-character shortcuts are ignored in editable fields, with modifiers, and when disabled in settings.
- **Tests:** `web/src/lib/investigation-reducer.test.ts`, `web/src/lib/investigation-reducer.replay.test.ts`, `web/src/lib/sse.test.ts`, `web/src/lib/format.test.ts`, `web/src/lib/purpose.test.ts`, `web/src/lib/shortcuts.test.ts`, `fixtures/ui.test.ts`, `web/e2e/fixture-mode.spec.ts`.
- **Demo:** `FINORA_DEMO=1 pnpm dev`, open `/en/explorer/lv/00000000000?state=streaming` (a fixture code), watch the replay.

### U3 Shell, search and the command bar

- **Scope:** `AppShell`, `ToolRail`, `BottomBar` and `TopBar` (with `SpendPill` and `ThemeToggle`) from the manifests, skip link, `Footer` with the source-code link, `CommandBar`, the home page ("Who are we looking into?", the search box, one status card per country with its promise and "loaded {date, time}", and Recent investigations), the search results page (§5.4), `Combobox`, no-match and error states.
- **Acceptance:**
  1. `/` and `Ctrl/Cmd+K` open the command bar from any page; `Esc` closes it and focus returns to the previous element; the listbox follows the ARIA 1.2 pattern; the result count is announced.
  2. Typing is debounced 120 ms; changing the query aborts the earlier request; a late response for an older query is ignored.
  3. A loading country shows "Estonia: loading, 62%"; ready countries show results at once; "No match" appears only after all groups settle.
  4. A live-state group shows "Searching ..." then results or "Checked NY, CO, CT, PA: no match".
  5. A result row shows code, legal form, status, city and registration year; a 200-character name clamps to two lines at 390 px with no overflow.
  6. The result type has no person variant (type test); a person's name returns no result in the e2e fixture.
  7. No match offers "Investigate this text"; without a key it opens the key sheet.
  8. The tool rail is built from the manifests; the active tool has `aria-current`; below 768 px the bottom bar replaces it; no horizontal scroll at the four widths.
  9. The footer source-code link is on every page (rule 18).
  10. Switching locale (in Settings) keeps path and query.
  11. The home page shows one card per country with its promise ("full check", "money and status check; no names", "registration and filings") and its load time; a country still loading shows its percent; Recent lists the last investigations with code and time.
  12. The `SpendPill` shows today's spend against the daily cap, turns `--warn` from 80%, and is hidden under 768 px.
  13. At 390 px the status pill sits under the name and the name takes at least 60% of the row width.
- **Tests:** `ui/src/primitives/combobox/combobox.test.tsx`, `web/src/components/search/*.test.tsx`, `web/e2e/search.spec.ts`, `web/e2e/command-bar.spec.ts`, `web/e2e/shell.spec.ts`, `web/e2e/shell.responsive.spec.ts`, `web/e2e/locale.spec.ts`.
- **Demo:** press `/`, type part of an example name, arrow to a result, open it, switch to `lt`.

### U4 Company profile, field system and sources page

- **Scope:** the `explorer/[country]/[code]` route with the shared layout, `CompanyHeader`, `CoverageLine`, `SectionCard` and the sections of Part G (S01-S04, S06-S09, S13, S14, the agent-only placeholders for S10, S11 live lists, S15, S16, the S17 summary, S18's check lines), `FieldRow` and all its states, `SourceChip`, `PurposeGate`, `ReportProblem`, `PersonDisclaimer`, the facts-only variant, `SectionIndex`, `ChecksAside` (checks 1 to 9 with the Investigate action and typical cost), `ExportMenu`, `SourcesTable` and the Sources page, `AttributionFooter`, noindex and titles, Suspense per section, per-section error boundaries. Section order follows DESIGN.md §8.1: S02, S03, S04, S06, S07, S08, S09, S10, S11, S13, S14 (US public), S15·S16, S17; S01 is the header; S05 and S12 are not rendered.
- **Acceptance:**
  1. For each of the five fixtures (LT, LV, EE, US public, US private) every section state matches the mockup at the four widths (web-qa).
  2. The registry test of §13 passes: only SHOW and CAVEAT ids for the country, every SHOW and CAVEAT id of these sections present in the gallery, none of HIDE or LATER.
  3. Every `SectionResult` state renders distinct, non-empty, banned-word-free text (`field-row.states.test.tsx`).
  4. Every CAVEAT value shows its caveat line under it, in the page and not only in a tooltip; checks add "Missing does not mean clean."
  5. A section whose rows are all `not_published` collapses to one sentence.
  6. A person section before a purpose has no person value in the DOM; after a purpose it shows rows and the "Purpose: ... · Change" line; three companies in one session send the purpose three times.
  7. LT S03 shows the role facts and "Names are not in Lithuania's open data. Available as a paid register extract." with a link only to the register's own order page (host check); it never says "Not published" for LT names.
  8. The sole-trader fixture shows `FactsOnlyBlock`, the disclaimer at the top, no verdict block, no S08 tax rows, no Investigate button (the facts-only block on the profile says no agents run), no Network action, no AGENT rows (courts, live lists, web), and no library entry is ever created for it.
  9. Every section and finding has "Report an error or object"; after submitting, the refetched section shows the `disputed` state.
  10. The Sources page lists each source with licence, attribution, cadence and last sync; every `SourceChip` links to its row; the LATER rows and their triggers are listed.
  11. `X-Robots-Tag: noindex` and the `robots` meta are present; `<title>` follows L3.
  12. A 10-day-old fixture shows "Not evaluated: tracked since {date}" for the 6-month rename check (P14).
  13. The first section paints before the slowest section resolves (Suspense streaming test with a delayed fixture).
  14. First contentful paint on the `core` profile is under 1 s locally (relative budget in CI).
  15. The profile page makes no request to a person endpoint (none exists) and renders no personal-code or birth-date pattern in any fixture (P3 canary).
  16. A check that depends on snapshots shows "Not evaluated: tracked since {date}" with the `clock` icon in `ChecksAside` and in the section.
  17. Export downloads redistributable values only and says how many share-alike values were left out.
- **Tests:** `web/src/components/field/field-row.states.test.tsx`, `web/src/field-registry.test.ts`, `web/src/components/field/snapshot-window.test.tsx`, `web/src/components/company/*.test.tsx`, `web/e2e/profile.spec.ts`, `web/e2e/field-states.spec.ts`, `web/e2e/canary.spec.ts`, `web/e2e/co-disclaimer.spec.ts`, `web/e2e/source-link.spec.ts`, `web/e2e/security-headers.spec.ts`, `web/e2e/people-purpose.spec.ts`, `web/e2e/facts-only.spec.ts`, `web/e2e/hide.spec.ts`, `web/e2e/disclaimer.spec.ts`, `web/e2e/dispute.spec.ts`, `web/e2e/report-sources.spec.ts`, `web/e2e/sources-page.spec.ts`, `web/e2e/seo-headers.spec.ts` (profile and `runs/[id]`: noindex, title, disclaimer), `web/e2e/profile.streaming.spec.ts`, `web/e2e/profile.visual.spec.ts`, `web/e2e/profile.a11y.spec.ts`, `web/e2e/perf.spec.ts`.
- **Demo:** search an example Latvian company, open it, read the coverage line, open a source chip, choose a purpose and see the people, open the same page for an LT fixture and see the paid-extract line.

### U5 Investigate and live agents

- **Scope:** `InvestigateSheet` (estimate, no-key, daily-cap), `AgentPanel`, `RunHeader`, `AgentLane`, `TaskRow`, `ActivityLine`, findings landing in sections, the question cards (§5.6) including `SanctionsMatchCard`, stop, reconnect and failure states, the live region, the small-screen sheet and summary bar.
- **Acceptance:**
  1. The sheet shows the estimate (typical, high, basis), the cap and the spend left today before Start; with no key it shows the steps to add one; at the daily cap it shows spend and reset time. **Investigate** is never a disabled button without a reason.
  2. An event reaches the DOM within 500 ms of arrival (e2e with the fake provider and a scripted clock); renders are batched to one per frame (unit).
  3. Four lanes and their task rows update at once: the replay fixture shows at least three lanes `running` in the same frame; the header counts equal the reducer's totals.
  4. Each lane shows status as icon and word, the current step, sources read, elapsed time, the timing hint and its own cost; the header shows spend against the cap and turns `--warn` from 80%.
  5. A finding lands in its `SectionCard` with `AiLabel`, severity icon and word, and citation chips; a finding with no section appears only in the evidence group; a finding without a citation is never rendered.
  6. A question card pins at the top of the primary column; lanes it blocks show "Waiting for your answer" and link to it; other lanes keep running; answering resumes the lane.
  7. Entity choice: shows code, legal form, status, city, registered date and "None of these"; has no default and no countdown; on timeout the report shows "Not enough data: company not confirmed".
  8. Sanctions card: rows only where a side has a value, match marks, official-ID rows first; three outcome wordings; "sanctioned" appears only for `listed`.
  9. Cap reached: first time offers stop (default) or "Allow up to $0.50 more" clipped to the daily remainder; after use only stop with the reason; with nothing left, only the daily-cap text.
  10. **Stop** shows "Stopping" and ends in `stopped` lanes; the panel offers "Write the report from what was found".
  11. A reload mid-run restores an identical state: the DOM text after reload equals the DOM text before it, apart from elapsed timers.
  12. Losing the connection shows the banner after 3 s, keeps the content and recovers without a duplicate finding.
  13. At most one announcement per lane status change, none per step; the question and the verdict announce once each.
  14. At 1024 and below the panel sits under the content (tested at 1024, 1023, 768 and 390), and a sticky summary bar ("4 agents · 2 running · $0.31", a link to the panel) keeps the run visible while the user scrolls the sections (confirmed by the designer: it reads "4 agents · 2 running · $0.27 of $1.50", "Needs you" or "Reconnecting", with "Show agents" jumping to the panel).
  15. A lane step with an unknown key renders "Working"; no model text reaches a lane (type and unit test).
  16. Reduced motion: no pulse, no wash; counters still change.
  17. The lead lane reads "Lead: resolve and plan" and ends with "Pinned to registration no. {code}"; the verdict lane is queued until the specialists end; "4 agents" in the header counts the four specialists; free text that matches no registry record ends with "Not found in the loaded registers", no lanes start, and the page says no web search ran on an unpinned name.
  18. A failed lane offers "Re-run {agent}" and a `budget_exceeded` lane says which checks did not run (coverage reasons have their own text).
- **Tests:** `web/src/components/investigate/*.test.tsx`, `web/src/components/investigate/sanctions-match.test.tsx`, `web/e2e/investigation.flow.spec.ts`, `web/e2e/investigation.question.spec.ts`, `web/e2e/investigation.cap.spec.ts`, `web/e2e/investigation.stop.spec.ts`, `web/e2e/investigation.reload.spec.ts`, `web/e2e/investigation.reconnect.spec.ts`, `web/e2e/investigation.live-region.spec.ts`, `web/e2e/investigation.latency.spec.ts`, `web/e2e/investigation.visual.spec.ts`, `web/e2e/investigation.a11y.spec.ts`, `web/e2e/no-key.spec.ts`.
- **Demo:** `pnpm finora --demo`, open an example company, press Investigate, watch four lanes tick, answer the which-company question, press Stop on a second run.

### U6 Verdict and report

- **Scope:** `VerdictBlock` and its variants, `ChecksList`, `KeyFinding`, `EvidenceGroup`, `FindingItem`, `CitationViewer`, `Quote`, `FollowUpDock`, `AttributionFooter` completion, re-run and dig deeper, the stable run URL (`.../runs/[id]`) in the shared layout so sections do not remount.
- **Acceptance:**
  1. The level label comes from the typed list; level 1 is neutral, never green; every level has an icon and a word.
  2. Coverage is on the same line as the level: "7 of 11 checks ran · 2 not possible in [country] · 31 sources · {date}".
  3. Level and explanation are separate DOM blocks; `AiLabel` never wraps the level (DOM test).
  4. Every explanation sentence has at least one citation chip; a sentence without one is not rendered; with none left the block reads "Not enough evidence for a verdict" (R7).
  5. A citation chip opens the `CitationViewer` with the quote and the source link; `Quote` enforces each source kind's limit and cuts with "Read at source" (unit per kind).
  6. `not_enough_data` shows the muted `?` and lists the checks that did not run with their reasons; `not-confirmed` shows "Not enough data: company not confirmed".
  7. The facts-only fixture has no verdict block.
  8. `ChecksList` always shows the same 11 checks; its counts equal the coverage line.
  9. `j` and `k` move between findings, `Enter` expands a chip; order in the DOM equals the visual order.
  10. The follow-up dock shows its cost, cap and state; an answer carries `AiLabel` and citations, and says "Not found in the evidence" when it has none; at 1023 px and below it is a sheet (tested at 1024 and 1023).
  11. `AttributionFooter` lists each cited source's line once.
  12. Re-run starts a new run under a new URL; the old one remains in the library.
  13. Opening the run URL later (new session) shows the stored report.
  14. The banned-words pass finds nothing in the rendered report fixtures.
- **Tests:** `web/src/components/report/*.test.tsx`, `web/src/components/verdict-text.test.tsx`, `web/src/components/field/quote.test.tsx`, `web/e2e/report.spec.ts`, `web/e2e/report.not-enough-data.spec.ts`, `web/e2e/report.keyboard.spec.ts`, `web/e2e/follow-up.spec.ts`, `web/e2e/ai-label.spec.ts`, `web/e2e/banned-words.spec.ts`, `web/e2e/report.visual.spec.ts`, `web/e2e/report.a11y.spec.ts`.
- **Demo:** finish the run from U5, read the verdict, open a citation, ask a follow-up, re-run.

### U7 Library

- **Scope:** `LibraryList`, `LibraryItem`, `LibraryFilters`, the sidebar placement (≥ 1024 px, Explorer tool) and the full page below it.
- **Acceptance:**
  1. Each item shows subject, country, verdict level and coverage, date, cost and status; the level is shown as icon and word.
  2. Filters by level, country and text work together and the URL holds them; "no match" says which filters apply and offers Reset.
  3. States: empty, list, filtered, no-match, error with Retry.
  4. Arrow keys move between items and `Enter` opens; the list is one tab stop plus arrows.
  5. A run in progress shows its live status and opens the live view.
  6. Delete: each item has a Delete action with a confirm dialog; it calls `DELETE /investigations/:id`, removes the item and shows "Deleted" in a toast; the investigation's stored documents go with it (R11). A failed delete keeps the item and shows the error.
- **Tests:** `web/src/components/library/*.test.tsx`, `web/e2e/library.spec.ts` (includes delete), `web/e2e/library.keyboard.spec.ts`, `web/e2e/library.visual.spec.ts`, `web/e2e/library.a11y.spec.ts`.
- **Demo:** run two investigations, open the library, filter by level, reopen the first.

### U8 Network explorer

- **Scope:** the network routes, `NetworkGraph` (canvas, `d3-force`, lazy), `NetworkList`, `NodeCard`, `EdgeCard`, the address hub, all states of §5.8.
- **Acceptance:**
  1. Nodes are companies only. No person node, no person count, no link to a person page (type test on the DTO and a DOM test).
  2. An address shared by more than 20 companies collapses with the council's caveat line; an address shared with a sole trader or a private individual is absent.
  3. Every edge shows its relation and a `SourceChip`; computed counts carry the "Derived by Finora" chip.
  4. The list twin shows the same nodes and edges, grouped by relation, and is the default under 768 px; the graph has a "View as list" button.
  5. The canvas is one tab stop; arrow keys move the selection, `Enter` opens the node card, `Esc` clears it; the label summarises the network.
  6. States: loading, graph, empty (with what was checked and the date), too-large (list first, "Showing 20 of {n}"), error.
  7. Browsing sends no `POST /investigations` (network log assertion).
  8. With reduced motion the layout is drawn once without animation; the graph holds 60 frames per second panning with 300 nodes on the CI machine (relative budget).
  9. `d3-force` is not in any other route's bundle (bundle check).
- **Tests:** `web/src/components/network/*.test.tsx`, `web/e2e/network.spec.ts`, `web/e2e/network.keyboard.spec.ts`, `web/e2e/network.no-agents.spec.ts`, `web/e2e/network.visual.spec.ts`, `web/e2e/network.a11y.spec.ts`, `scripts/check-bundle-split.test.mjs`.
- **Demo:** open an example company, open the network, use the keyboard to reach a linked company, switch to the list.

### U9 Crash monitor

- **Scope:** the `crash` route, `CrashGrid`, `CrashTile` in every state of §5.9, `DrawdownStrip`, `DebtTicker`, `WipedSummary`, `Sparkline`, `ConnectorPrompt`, the 60 s poll with visibility pause, attribution footers, the fund-symbol settings link.
- **Acceptance:**
  1. Each M01-M08 tile renders every state of §5.9 in the gallery and with `?markets=` on the real route.
  2. A coarse tile shows its cadence and never claims to be live; a key-only tile shows its shape with no number; a fund proxy with no symbol shows "Choose a fund in settings" and no number.
  3. A peak-unknown tile shows no percentage and never 0%.
  4. Drawdown shows a real minus sign, an arrow and the word; colour is never the only signal.
  5. Every tile shows its as-of time, source and attribution line; M08's estimate is labelled and shown next to the official figure and date.
  6. The page polls every 60 s while visible and stops when the tab is hidden; a refresh causes no layout shift (CLS 0 in the e2e measurement).
  7. A stale tile keeps its value and turns its as-of chip `--warn`; an errored tile keeps its last good value with Retry.
  8. The distance-from-peak strip and each sparkline have a text alternative: peak date and value, latest value, drawdown. The debt ticker's digits are `aria-hidden` and a static line gives the estimate and the official figure with its date.
  9. At 390 px tiles stack in one column with no horizontal scroll; at 1280 px they form a grid.
  10. No price value appears in the page for a row whose source needs a key and has none.
  11. A `peak_unknown` row (it carries `trackingSince`) never shows a percentage; the total-crypto row says "All-time high"; the value-lost summary lists the rows it sums, names the oldest as-of date and names any counted row it had to leave out.
  12. A fund slot with no symbol says "Choose a fund in settings" and links to its settings field; with a symbol and no key it says "Add your key to check".
- **Tests:** `web/src/components/crash/*.test.tsx`, `web/e2e/crash.spec.ts`, `web/e2e/crash.refresh.spec.ts`, `web/e2e/crash.states.spec.ts`, `web/e2e/crash.visual.spec.ts`, `web/e2e/crash.a11y.spec.ts`.
- **Demo:** `pnpm finora --demo`, open `/en/crash`, watch a tile update, switch `?markets=nokey` in fixture mode.

### U10 Settings and connectors

- **Scope:** the Settings page: language, the current purpose with Change, key status (names and presence only; the optional market keys and the SEC contact setting included), the `ConnectorSheet` with how to add a key (edit the local `.env`, restart, "Check again"), default cost cap display, the 13 fund-symbol slots, theme and locale, the shortcuts switch, `DataStatus`.
- **Acceptance:**
  1. A key's value never appears in the HTML, an API response or a client chunk; a planted canary key is absent from all three.
  2. Key rows show "set" or "not set" and a "Check again" button; the app never accepts a key through the browser in v1.
  3. Each of the 13 fund-symbol slots saves to local settings only; a symbol that fails the pattern shows an error line; changing a slot's symbol shows "Refetching" until the first value arrives; a saved symbol turns a `choose-fund` row into a proxy row.
  4. The shortcuts switch disables the single-character shortcuts at once.
  5. The AI key row has a `rejected` state ("The AI key was rejected") driven by the `model_auth` code; the Investigate sheet shows the same message.
  6. `DataStatus` shows each source's last sync and rows, and the history size against its cap with a warning, never a silent deletion.
  7. Every control has a label; the page passes axe at both themes.
- **Tests:** `web/src/components/settings/*.test.tsx`, `web/e2e/settings.spec.ts`, `web/e2e/settings.shortcuts.spec.ts`, `web/e2e/settings.a11y.spec.ts`.
- **Demo:** open Settings, see which keys are set, add a fund symbol, open Crash monitor and see the proxy tile.

---

## 15. Test strategy for the UI

| Layer | Tool | What it covers |
|---|---|---|
| Type tests | `tsd` or Vitest type tests | `IconButton` needs `label`; result types have no person variant; lane text type has no free string; `FieldRow` needs `itemId` |
| Unit and component | Vitest + Testing Library | Primitives, composites, the reducer, formatters, the SSE client (fake timers and a fake server), `VerdictText`, `Quote` limits, field-state uniqueness, banned words |
| Fixture validation | Vitest | Every `fixtures/ui` file against its schema; every state in §12 has a file |
| Gallery e2e | Playwright | Every gallery page: axe in both themes, keyboard operation, reduced motion, forced colours, no third-party request |
| Flow e2e | Playwright on `FINORA_DEMO=1` (fake provider, fixture store) | Search → profile → purpose → investigate → question → report → follow-up → library; Crash monitor; settings. Never calls a live source or a paid API |
| Policy e2e | Playwright | `hide.spec.ts`, `people-purpose.spec.ts`, `facts-only.spec.ts`, `disclaimer.spec.ts`, `dispute.spec.ts`, `seo-headers.spec.ts`, `banned-words.spec.ts`, canary tests (§13) |
| Latency and shift | Playwright with a scripted clock and `PerformanceObserver` | Event to DOM ≤ 500 ms; CLS 0 on the Crash monitor refresh; FCP of the profile |
| Visual | Playwright `toHaveScreenshot`, Linux CI image only | A **small** baseline set (qa SHOULD-FIX 21): per key screen at 390, 768, 1280 and 1920 in dark (profile, streaming, question, report, network, Crash monitor = 24 images), plus light at 1280 for profile and report (2 images). Every image is generated from fixtures, opened and read in full, then recorded with `node scripts/guard/guard.mjs review <file>` before the commit. Other states are covered by DOM and a11y tests, not screenshots |
| Bundle | `scripts/check-bundle-secrets.mjs` (S02), `scripts/check-bundle-split.mjs` | No secret in a client chunk; `d3-force` only in the network chunk; first-load JS of the explorer route within a budget set in U3 |
| Real browser, by me | Playwright run in headed mode and screenshots to `research/.cache/frontend/shots/` (never committed) | Before each slice goes to web-qa: the four widths, keyboard path, both themes, reduced motion, at least one non-English locale |

**Definition of done for a UI slice:** every acceptance criterion holds; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e` are green; the gallery shows every state of the slice's components; I have checked it in a real browser at the four widths; qa has no open MUST-FIX; web-qa has no open MUST-FIX.

---

## 15a. Mockup defects the build must not copy

web-qa swept the mockups (commit `7dc2e76`, 448 renders). These findings are build requirements; each has a test in the slice that builds the component.

| Defect in the mockups | Build requirement | Slice and test |
|---|---|---|
| Source popovers run off-screen at 390 px (16 of 20 chips) | `SourceChip` popovers use collision handling with an 8 px viewport padding and flip or shift, so the licence, as-of date and record link are fully inside the viewport at 390 | U4: `web/e2e/source-chip.spec.ts` opens every chip on the LV profile at 390 and asserts the popover box is inside the viewport |
| About 4,000 px of dead vertical space on phones (`flex: 1 1 240px` becomes a height when rows stack) | Rows stack with no flex-basis height; row height follows content. A row with a 40 px value is about 40 px | U4: `web/e2e/profile.layout.spec.ts` asserts no row has more than 30 px of empty space at 390 |
| Search rows crush the name to 74 px at 390 | At 390 the status pill moves under the name; the name gets the full row width and clamps to two lines | U3: `web/e2e/search.responsive.spec.ts` asserts the name box is at least 60% of the row at 390 |
| `aria-expanded` stays `true` after Esc | Use the Radix Popover (it owns `aria-expanded`); focus stays on the chip | U1: `popover.test.tsx` |
| Sheets are not modal (focus not trapped, Esc does nothing) | Sheet is a Radix Dialog: focus trapped, background inert, Esc closes, focus returns to the opener. The pre-run sheet is the one blocking step before money is spent | U1: `sheet.test.tsx`; U5: `investigation.sheet.spec.ts` (Tab never leaves the sheet; Esc closes) |
| Touch targets below 40 px (chips 22 px, Retry 22 px, pills 30 px) | Every interactive target is at least 24 px (WCAG 2.2) and at least 44 px on coarse pointers, the chip's tap area included, without making the chip look bigger | U1: `design.target-size.spec.ts` on the gallery at 390 with `hasTouch` |
| `--faint` used for text (the "/" separators) | `--faint` is for icons and dividers only; separators are decorative `aria-hidden` glyphs or borders | U1: `check-tokens` forbids `--faint` as a text colour |
| Loading and error states without an `h1`, headings jumping from h1 to h3 | Every page state has exactly one `h1` and an ordered heading tree | U3, U4: `structure.spec.ts` over every state |
| `/` and `Ctrl/Cmd+K` do nothing outside the search page; the top-bar field only navigates | The command bar is a real dialog on every page | U3: `command-bar.spec.ts` on each tool page |
| The page loads dark when the OS says light | With no stored choice, follow `prefers-color-scheme` | U1: `theme.spec.ts` with `colorScheme: "light"` |
| Inert controls ("Stop and write the report", "Report a problem", "All line items", "Open") | A control that does nothing is not rendered. Every control in the build has an action and a result state | every slice: the gallery e2e clicks every control and asserts a visible result or navigation |
| States with no URL: reconnecting, stopped by user and its report, retry of one failed agent, command bar open, `not_evaluated` | Each is a gallery state in `/design` (`?state=reconnecting`, `stopped`, `lane-failed`, `command-bar`, `not-evaluated`) | U1, U5: listed in `fixtures/ui.test.ts` |

## 16. Asks of other seats and open items

**Architect.** Status after milestone B (2026-11-20): items 1, 2, 3, 4, 5, 6, 8 and 10 are accepted and in `architecture.md` §5 and `slices.md` (S04b lands every DTO schema; the gallery route is `/design`; the SSE client sends `Last-Event-ID` with `?lastEventId=` as the fallback; library delete is `DELETE /investigations/:id`; the re-run route and `typicalSeconds` are in). Still to confirm: item 7 (the generated item list path) and item 9 is done by the table above. The original list, kept for the record:
1. Accept deviations D1-D4 (§1), including `FieldRow` and `SourceChip` in `apps/web`.
2. Search response shape: `GET /search?q=` returns groups with state: `{ groups: { id, kind: "bulk" | "live", country, state: "ready" | "loading" | "error", percent?, results[] }[] }`. Live state registers are separate requests the client fires in parallel (`GET /search/live/{register}?q=`), each returning one group, so a slow register never blocks the rest. **[pending: architect]**
3. SSE: `Last-Event-ID` header on the first request, with a `?lastEventId=` fallback.
4. Library DTO: subject, country, entity id, verdict level, coverage, cost, status, started, finished; and whether delete or archive exists (R11).
5. Network DTO: nodes (company id, name, code, status, country), edges (relation `shared_address | corporate_member`, `SourceRef`, `derived` flag, date), an address-hub node with `companyCount`, and `truncated`.
6. Crash DTO: `MarketRow` as in `loaders/markets.md` §1.4, plus `cadence`, `delayed`, `peakBasis` (`since | all_time | seeded`), the source and attribution line per row, and `totalWiped` with its included rows and oldest as-of.
7. The Part G table as `packages/domain/src/items/items.generated.ts` (D3), with the empty-state key per id.
8. Estimate and daily-cap DTOs for the Investigate sheet: `{ low, typical, high, basis, capMicroUsd, dailyLeftMicroUsd, dailyResetsAt }`.
9. Number the UI slices (§14) into `slices.md`; the `U` names are placeholders.
10. `GET /settings/status` returns presence for each key and the SEC contact setting.

**Designer: all answered (2026-11-20, commit `319a123`).**
- The runtime wins every conflict: `scope` is "Is {domain} this company's website?" (Yes / No / Not sure, default "Not sure" after 30 min); the cap extension is once per investigation and its question defaults after 10 min; six lanes, four counted; sole traders have no Investigate, Network or agent rows; the purpose list comes from the API as radio buttons.
- **Mobile run view:** below 1024 px a sticky bar under the top bar reads "4 agents · 2 running · $0.27 of $1.50", "Needs you" or "Reconnecting", with "Show agents" jumping to the panel. Question cards always render inline at the top.
- Language switch is in Settings. The home page's per-country "loaded {date}" and the library DTO come from the API.
- Banned words in LT, LV and ET are word stems (the languages inflect), drafted in DESIGN.md §4 and marked for native review: until then the locale test warns and the English test fails the build.
- A `?` shortcuts dialog is in DESIGN.md §14.

**data-osint:** `agents.md` answered most of this (roles, key lists, fake-provider scenarios). Still open: the per-lane timing hints for the UI ("usually under a minute" for registry, money and legal; "usually 1 to 2 min" for web, from osint.md §4.8) as numbers in the estimate DTO, and the route that re-runs one agent.

**web-qa:** the gallery and `?state=` contract (§12) are the way to reach every state; tell me if a state you need has no URL.

**Open items inside this plan:**
- Mockups are not on the branch yet. Differences are folded into draft 2.
- Fonts: the three Fontsource packages and their licences are verified in U1.
- Screen reader pass is manual and optional per milestone.
- Print layout and a PDF export of a report are LATER.
- Standalone person pages, person search and person nodes are out by decision (L2, council Part C).
