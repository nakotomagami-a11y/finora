# Loader specs

One spec per source (or per tightly coupled source group), written by the data seat that researched it. A builder implements the loader from the spec alone, without guessing. The contract they implement is `docs/architecture.md` §3-§4; the calls they implement are `docs/plan/council/01-data.md` Part G and the policy table (Parts E and H).

| File | Owner | Covers |
|---|---|---|
| `lv-*.md` | data-baltics | the Latvian sources with a SHOW or CAVEAT row |
| `ee-*.md` | data-baltics | the Estonian sources, including the share-alike store |
| `lt-*.md` | data-baltics | the Lithuanian sources |
| `gleif.md` | data-us | GLEIF LEI records (S01.ALL) |
| `us-*.md` | data-us | SEC, the four live states, FDIC, FMCSA, the federal exclusion and enforcement lists |
| `sanctions.md` | data-osint | EU, OFAC, UK and LV FIU lists, and the live-only national lists |
| `markets.md` | data-markets | the Crash monitor data layer |
| `esma-firds.md` | data-markets | ESMA FIRDS listed-share records for Baltic companies (S14.LTLVEE.01) |

LATER and HIDE sources get no spec. A HIDE item is named in the spec of the source that carries it, with the field that is dropped and its negative test.

## Template

Every spec has these sections, in this order. Write "none" rather than leave a section out.

```markdown
# <source id>: <source name>

## Source
- Publisher, official URL, file or endpoint URLs (stable alias or how to find the current URL)
- Licence id and attribution text, as recorded in docs/research; `storage` class (store / share-alike-store / live-no-store / live-cached)
- Cadence, publication time (UTC) and the as-of field inside the file that proves freshness
- Keys or accounts (env var name), rate limits, politeness rules

## Items
Every Part G item_id this source fills, with its call, caveat text and empty state, copied from 01-data.md.

## Field map
| Source field | Type | Target (entity property, fact concept or event type) | item_id | Personal? | Transform and validation |
Every field the loader reads. Fields not in this table are not read. HIDE fields are listed with target "dropped" and their negative test.

## Party gate
How each party row is proven to be a company (register code with a non-natural-person form, or the register's own type field). What is dropped and how it is counted in the sync report. Not applicable: say why.

## Identity and joins
Entity id rule, join keys to other sources, and what happens when a join fails.

## Refresh and change
Full load, refresh (content hash, row hash, deltas), what counts as removed, tombstones, and what an unchanged file writes (one sync row).

## Size and time budget
Rows read, statements, facts and events written; bytes on disk; first-load and refresh time on the named machine profile. Must fit the country budget in policy P10.

## Fixtures
The synthetic fixture layout (same columns and formats, obviously fictional names, fixture-only IDs per the fixture ID rule), and how it is generated. No real rows.

## Tests
Named test files and what each proves: parsing, field map, licence and provenance on every record, party gate, HIDE negative tests, refresh and purge behaviour, budgets.

## Failure modes
Source down, schema change, partial file, stale as-of date: what the loader does and what the UI shows (the empty state from Part G).

## Open questions
Anything the builder would otherwise have to guess. Empty before approval.
```
