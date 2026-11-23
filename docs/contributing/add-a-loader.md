# Adding a loader

A loader brings one official source into the store: it fetches the source's files, parses them into records, and the pipeline gates and writes them. The contract is `packages/sources/src/types.ts` (architecture §4.3); every record is checked against it by `packages/ingest/src/validate.ts`. This page walks through the steps. Its example field map and record are checked by `packages/ingest/src/add-a-loader.docs.test.ts`, so they stay valid.

## 1. Write the loader spec first

Add `docs/plan/loaders/<source-id>.md`: what the source is, its licence and attribution, how often it changes, its record units and keys, and its field map (step 3). The source id is a safe name, `^[a-z0-9][a-z0-9-]{1,63}$`, because it names folders. Every field you store maps to a decided Part G item (`docs/plan/council/01-data.md`); a field with no SHOW or CAVEAT item is not read.

## 2. Create the module

Put the loader in `packages/sources/src/<cc>/<source-id>/<source-id>.ts`, where `<cc>` is the country (`lv`, `ee`, `lt`, `us`) or `intl`. It exports a `SourceLoader`:

- `meta`: the id, country, publisher, `officialHosts` (the only hosts the fetcher will call), licence, storage class, cadence, `asOf` strategies, purge scope and share, the items it fills, and `limits` (requests per second, `maxBytes`).
- `parserVersion`: built with `parserVersion(id, n, FIELD_MAP, items)`, so it moves whenever the parser, the field map or the item list changes, and every install re-parses.
- `fieldMap`: step 3.
- `fetch(ctx)`: download through `ctx.fetcher` only. A file that may not fit in memory streams to disk: `ctx.fetcher(url, { toFile: join(ctx.workDir, name) })`, then `streamedArtifact`, and parse it with `artifactStream`. Return `{ unchanged: true }` when the source says nothing changed.
- `asOf(raw)`: the date each `meta.asOf` strategy reads from the files.
- `parse(raw, ctx)`: pure given the artifacts, yielding one record at a time (step 4).

## 3. Declare the field map

Every value the loader stores has an entry: the source column (`field`), what it becomes (`target`), the Part G item it is shown under (`itemId`), and whether it is personal.

- A value stored as a statement targets `{ "prop": ... }`. The pipeline refuses any statement whose (item, prop) pair the field map does not declare, counted `prop_not_in_item` (M1-F2).
- A value the loader derives (a link to another row, a constant country) is declared with a `derived:<prop>` field.
- One column may feed a resolution key and a statement, or two props. The same target twice, or a dropped field that also feeds something, is refused by `checkFieldMap`.
- A HIDE or LATER item, or a person's code, only appears as `{ "dropped": <reason> }`.

The example below is for a fictional register that stores a company's name and registration number:

```json example-field-map
[
  { "field": "code", "target": { "resolutionKey": "registrationNumber" }, "personal": false },
  { "field": "code", "target": { "prop": "registrationNumber" }, "itemId": "S01.LV.01", "personal": false },
  { "field": "name", "target": { "prop": "name" }, "itemId": "S01.LV.01", "personal": false },
  { "field": "birth_date", "target": { "dropped": "personal_code" }, "personal": true }
]
```

## 4. Yield records

Each record is strict: a key the contract does not name makes it invalid and it is skipped, counted.

- `recordKey` is stable per row (or per report or company-period for long-format sources). It never holds a code or a name.
- `entities` holds the rows the record writes. An entity another source owns is marked `ref: true`: its statements attach to it, but it is never created or changed.
- `parties` holds members, debtors and other counterparties: each goes through the proven-company gate, and only a party proven to be a company is loaded.
- `dropped` lists what the parser dropped by rule, so the sync report can count it.
- Natural persons follow the person rules (P3-P6): no personal code is ever stored, and a sole trader's address keeps the country only.

The record the example field map produces for one row:

```json example-record
{
  "recordKey": "lv-40003000018",
  "hashInput": ["40003000018", "Example Company SIA"],
  "entities": [
    {
      "eid": "lv-40003000018",
      "schema": "Company",
      "country": "lv",
      "legalForm": "lv-sia",
      "status": "active",
      "code": "40003000018",
      "statements": [
        { "prop": "name", "value": "Example Company SIA", "itemId": "S01.LV.01" },
        { "prop": "registrationNumber", "value": "40003000018", "itemId": "S01.LV.01" }
      ]
    }
  ]
}
```

## 5. Register it

Add the loader to `loadersFor(config)` in `packages/sources/src/registry.ts`, and its licence to `packages/sources/src/licences.ts` if it is new. A source that holds person rows takes the run's `LoaderConfig` (for example `LV_PERSON_ROWS`); it never builds itself on a default.

## 6. Test it

- `packages/sources/src/<cc>/<source-id>/<source-id>.test.ts` runs `parse` on a committed synthetic fixture, with no network. Fixture values are fictional: `Example` names and fixture register codes (`fixtureRegisterCode`).
- `packages/sources/src/field-maps.test.ts` checks every shipped loader's field map, and `licences.test.ts` its licence.
- A source with person data adds its fictional names and codes to the byte scans, so a test proves none of them reaches the store files.
- Add the loader's fixture to `fixtures/src/loaders.ts` so the fixture profile loads it end to end.

## 7. Run it

```sh
finora-cli data sync <source-id>
finora-cli data status
```

`data sync` prints, per source, what was read, written, unchanged, deleted and dropped (with each drop's reason), the write timings and any maintenance. `finora-cli --help` lists the commands.
