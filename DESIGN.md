# DESIGN

> **Status: draft v0.** Tone, tokens, type, the app shell and the flow concept are set here. Everything that depends on data (which fields appear per country, in which state) waits for council session 1 and is drafted in `docs/design/display-options.md`. Screens follow in `docs/design/screens/` during phase 3.

## Reading this as

A **daily research desk**: a person types a company, sees at once what the official records say, and watches a team of agents dig further, in parallel, until a sourced verdict lands. Tools other than company research (Crash monitor first) live in the same shell and share the same components.

## Tone

Quiet, exact, sourced, alive.

- **Quiet.** A warm near-black (or warm paper, in the light theme), hairline borders, one accent. Nothing decorates. A user opens it ten times a day; it must never tire the eye.
- **Exact.** Numbers line up in tabular figures. Every value has a date. Wording comes from the register, not from us.
- **Sourced.** Every value and every finding has a source chip with its licence and confidence. "We found nothing", "nobody publishes this" and "we may not show this" look different.
- **Alive.** While agents work, the page visibly moves: lanes tick, sources count up, findings land in their section. Motion stops when work stops.

An editorial serif for headings and verdicts gives it the feel of a written report, not a dashboard. The sans carries all UI text; the mono carries agent activity, codes, counts and source chips.

### Principles

1. **Official first, agents second.** The company page shows registry data instantly from our store. Agents add to it; they never replace it.
2. **Say why it's empty.** No blank fields. Every gap has a state (see `docs/design/display-options.md` §1).
3. **Show the work.** Every agent, step, source and question is visible while it happens, and replayable afterwards.
4. **Opinion is labelled.** Official records, corroborated findings, single-source findings and inferences each look different.
5. **Colour carries meaning only, never alone.** Status colours always pair with an icon or a sign.
6. **One page, many tools.** Shell, search, chips, states and tables are shared; a new tool adds routes, not a new visual language.

## Tokens

CSS custom properties, defined once in the design-system package and exposed as Tailwind theme values. Dark is the default; light follows `prefers-color-scheme` and a user toggle.

### Colour

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0f0e0d` | `#f6f4ef` | page |
| `--surface` | `#171614` | `#ffffff` | cards, panels |
| `--surface-2` | `#201e1b` | `#eeebe4` | wells, hovered rows, inputs |
| `--line` | `rgb(255 255 255 / 0.08)` | `rgb(0 0 0 / 0.09)` | hairline borders |
| `--line-strong` | `rgb(255 255 255 / 0.14)` | `rgb(0 0 0 / 0.16)` | focused or active borders |
| `--ink` | `#ece8e1` | `#1b1916` | primary text |
| `--ink-2` | `#c9c4bb` | `#45413b` | secondary text, labels |
| `--muted` | `#a29d94` | `#5f5a52` | captions, chips, "not published" rows |
| `--faint` | `#7d786f` | `#8a857c` | icons and dividers only, never text |
| `--accent` | `#d9b98a` | `#7a5c24` | the one accent: primary action, focus ring, the running pulse |
| `--on-accent` | `#1a1410` | `#ffffff` | text on accent fills |
| `--good` | `#7cc98f` | `#1a6c34` | no concerns, recoveries |
| `--warn` | `#e5b45a` | `#8a5a00` | points to check, stale, waiting on you |
| `--bad` | `#f2806f` | `#b3261e` | serious concerns, losses, errors |
| `--info` | `#8db4e6` | `#2559a8` | agent findings, links |

Each status colour also has a `-tint` (the colour at 10% over `--surface`) for card backgrounds.

Measured contrast (WCAG): every text token is ≥ 4.5:1 on `--bg`, `--surface` and `--surface-2` in both themes. Lowest: light `--accent` 5.21:1 and light `--good` 5.45:1 on `--surface-2`; dark `--muted` 6.17:1 on `--surface-2`. `--faint` (3.1 to 4.4:1) is reserved for non-text use.

### Type

Self-hosted, all under the SIL Open Font License. No third-party font CDN (it would leak every visit).

| Role | Face | Size / line | Weight |
|---|---|---|---|
| Display (verdict) | Instrument Serif | 56 / 60, mobile 40 / 44 | 400 |
| H1 (company name) | Instrument Serif | 40 / 44, mobile 32 / 36 | 400 |
| H2 (section) | Instrument Serif | 26 / 32 | 400 |
| H3 (card title) | Geist | 15 / 22 | 600 |
| Body | Geist | 14 / 22 | 400 |
| Small | Geist | 13 / 20 | 400 |
| Label (overline) | Geist | 11 / 16, tracking 0.08em, uppercase | 500 |
| Mono (activity, codes, chips) | Geist Mono | 12 / 18 | 400 |
| Numbers in tables | Geist, `font-variant-numeric: tabular-nums` | as body | 400 / 600 |

### Spacing, radius, elevation, motion

- **Spacing:** 4px scale: 4, 8, 12, 16, 20, 24, 32, 40, 56, 72.
- **Radius:** 6 chips and inputs, 10 buttons, 14 cards, 20 the verdict block, full for pills.
- **Elevation:** none on the page; layering comes from `--surface` vs `--bg` and hairlines. Popovers and the command bar get one shadow: `0 12px 40px rgb(0 0 0 / 0.45)` (dark), `0 12px 40px rgb(0 0 0 / 0.12)` (light).
- **Motion:** 120 ms for hover and focus, 200 ms for expand and collapse, a 1.6 s pulse on the dot of a running agent, and a 600 ms accent wash on a finding when it lands. `prefers-reduced-motion` turns all of it off except the counters changing.

## Information architecture

Multi-tool shell. The full IA and every route are in `docs/design/IA.md` (phase 3).

- **Tool rail** (left, 56 px icons with labels on hover; a bottom bar on mobile): Explorer, Crash monitor, then each new tool. A tool registers its id, name, icon and routes; the rail reads the registry.
- **Command bar** (`/` or `Ctrl+K` anywhere): search companies across all four jurisdictions, jump to a tool, open a past investigation.
- **Per-tool sidebar** where a tool needs one (Explorer: the library of investigations).
- **Settings:** data connectors and keys (the user's own market-data keys), theme, language (EN, LT, LV, ET).
- **Sources page:** every source, its licence, its freshness and what it covers per country. Every source chip links here.

### The main flow, as one page

The prototype split search, running and report into three screens. The redesign makes them **one company page that fills itself**:

1. **Search.** One box. Typing shows company matches from the official store, grouped by country, with code, status and city. Free text ("the roofer who quoted me, website …") is accepted too and starts an investigation that first resolves the entity.
2. **Company page, official data.** Opens instantly: header, coverage strip, then sections (basics, people, ownership, financials, staff, tax, events, contracts) in their display states. A primary action: **Investigate**.
3. **Investigation running, same page.** An agent panel opens beside the sections (below them on mobile): one lane per agent with status, current step, sources read. Findings land inside the matching section, marked as agent findings. Overall progress and source count sit in the page header.
4. **Agent asks.** A question card pins to the top of the agent panel and the waiting lanes point to it. The rest keep running.
5. **Report, same page.** The verdict block appears on top with key findings, each linked to its evidence; the network summary opens the network explorer; a follow-up chat docks on the right (a sheet on mobile). The URL is stable from step 3 on, so a run can be shared, reopened and re-run.

## Components (first inventory; frontend owns the full one)

Shell, ToolRail, CommandBar, SearchResult, CompanyHeader, CoverageStrip, Section, FieldRow (renders every display state), SourceChip, ConfidenceBadge, StatusPill, KeyFigureTable with Sparkline, EventList, AgentPanel, AgentLane, ActivityLine, QuestionCard, VerdictBlock, KeyFinding, EvidenceGroup, FindingItem, NetworkSummary, NetworkGraph, ChatDock, LibraryList, CrashTile, ConnectorPrompt, EmptyState, ErrorState, Skeleton.

## Accessibility

- Visible focus on everything: 2 px `--accent` ring, 2 px offset.
- Contrast as measured above; status never by colour alone.
- Live agent updates go to a polite live region, throttled to one announcement per lane step, so a screen reader is not flooded.
- Every icon-only button has an `aria-label`; the network graph has a table view with the same data.
- Keyboard: `/` search, `j` / `k` move between findings, `Enter` expands a source chip, `Esc` closes popovers and the chat sheet.

## Responsive

Checked at 1440, 1024, 768 and 390 px wide. Under 1024 the agent panel and the chat move under the content as sheets; under 768 the tool rail becomes a bottom bar.

## Assumptions (until the council or the research says otherwise)

- Dark is the default theme because the prototype was dark and the app is used for long sessions; light is fully supported.
- The prototype's three fonts and sand accent stay; contrast-failing greys from the prototype are replaced.
- The verdict scale wording is a proposal (`display-options.md` §3.15).
