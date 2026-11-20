# Information architecture

How Finora's pages, navigation and URLs fit together, and how a new tool joins without changing the rest. Routes follow the architect's accepted answer (early plan review); the visual rules are in `DESIGN.md`.

## Navigation model

| Level | Element | Contents |
|---|---|---|
| Global | Tool rail (left; bottom bar under 768 px) | One entry per enabled tool manifest, in manifest order, then Sources and Settings pinned at the bottom |
| Global | Top bar | Command bar, today's agent spend against the daily cap, theme toggle |
| Global | Command bar (`/`, Ctrl+K) | Companies in all four jurisdictions, past investigations, tools and settings pages, grouped by type |
| Tool | Tool page header | Overline (tool · context), H1, actions |
| Page | Section index | Pills linking to sections on long pages (company profile, report) |

The rail never nests. A tool with several pages puts them in its own header, not in the rail. The only exception is Library, a top-level entry because it is how people return to their work every day.

## Routes

All routes are locale-prefixed (`/en`, `/lt`, `/lv`, `/et`). `[country]` is `lv | ee | lt | us`; `[code]` is the registry code, or the CIK or state entity ID for the US.

| Route | Page | Mockup |
|---|---|---|
| `/[locale]` | Explorer search (home) | `search.html` |
| `/[locale]/explorer?q=` | Search results | `search.html?state=typing` |
| `/[locale]/explorer/[country]/[code]` | Company profile: official data | `company.html?state=full` |
| `/[locale]/explorer/[country]/[code]/runs/[id]` | The same page with the agent panel, then the report and chat (shared layout, so sections don't remount) | `company.html?state=streaming` / `report` |
| `/[locale]/explorer/investigations/[id]` | A free-text run before a company is pinned; replaced by the company route once the lead pins a registry ID | `company.html?state=question&q=entity` |
| `/[locale]/explorer/[country]/[code]/network` | Network explorer | `network.html` |
| `/[locale]/explorer/[country]/[code]/runs/[id]/network` | Network explorer opened from a report | `network.html` |
| `/[locale]/explorer/investigations` | Library | `library.html` |
| `/[locale]/crash` | Crash monitor | `crash.html` |
| `/[locale]/sources` | Sources, licences, attribution, freshness, "not in this version" | `sources.html` |
| `/[locale]/settings` | Keys and connectors, spending caps, purpose, funds, data health, preferences | `settings.html` |
| `/[locale]/design` | Component and state gallery (dev and visual tests only) | `index.html` is its precursor |

No route exists for a person. Person data appears only inside a company's sections, behind the purpose gate.

## Page states in URLs

The mockups and the app's fixture mode use the same names (agreed with frontend and web-qa):

- `?state=` `empty | loading | streaming | question | partial | error | report`, plus the screen-specific states listed in `DESIGN.md` §8;
- `?country=` `lv | ee | lt | us-private | us-public | sole-trader` (fixture subjects);
- `?q=` the question kind; `?verdict=` the level; `?purpose=`, `?install=`, `?sec=`, `?keys=`, `?view=`;
- `?theme=` `dark | light`.

In the real app these are fixture switches only; real state comes from the data.

## User flows

### 1. Instant lookup (most daily use)
Search → result (code, legal form, city and year distinguish name collisions) → company profile with the coverage line, checks 1 to 9 and every section in its state. Cost: nothing. Agents: none. A sole trader opens the facts-only profile, which has no Investigate action.

### 2. Deep dive before paying or signing
Company profile → **Investigate** → pre-run sheet (estimate, cap, purpose) → Start → the URL becomes `.../runs/[id]` → lanes stream, findings land → possibly a question card → the verdict appears on top, chat docks → Library keeps it.

### 3. "Is this offer real?" from free text
Search with pasted text → no match → **Investigate this text** → `/explorer/investigations/[id]` → the lead asks "Which company is it?" → the user picks one (or none: the run stops) → the page moves to the company's `runs/[id]` route and continues as flow 2.

### 4. Return and re-run
Library → a past run (report as it was, with its date) → **Re-run** creates a new run on the same company; both stay in the Library.

### 5. Market check
Rail → Crash monitor → glance at the drawdown strip and debt → optionally Settings to add a key or choose funds.

## Adding a tool

A tool ships:
1. a manifest `src/tools/<id>/manifest.ts`: `{ id, navKey, href, icon, enabled }`; the rail reads the manifest list;
2. a route group under `(tools)/<id>/`;
3. its API routes and contract schemas;
4. its i18n keys under `<id>.*`;
5. its pages built only from `packages/ui` primitives and the shared states. A tool may add composites in its own folder. It never adds tokens, colours or fonts.

The tool's empty, loading, error and "needs key" states reuse `EmptyState`, `Skeleton`, `Banner` and `FieldRow`'s `needs_key`. Its numbers use the source chip and confidence badge like every other value.
