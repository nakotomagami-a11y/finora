# intl-esma-firds: ESMA FIRDS listed shares on Baltic venues

> Loader spec by `data-markets` for item `S14.LTLVEE.01`. Contract: `docs/architecture.md` §3-§4. Research: `docs/research/markets.md` (ESMA FIRDS entry). Probe: `python research/probes/markets/official.py` (probes `firds_shares_<MIC>`), measured 2026-11-20.

## Source

- **Publisher:** European Securities and Markets Authority (ESMA), Financial Instruments Reference Data System (FIRDS). Register UI: `https://registers.esma.europa.eu/publication/searchRegister?core=esma_registers_firds`.
- **Endpoint:** the register's own search endpoint, `GET https://registers.esma.europa.eu/solr/esma_registers_firds/select`, JSON (`wt=json`). One request per venue (6 per sync), each with:
  - `q=*:*`
  - `fq=mic:<MIC>` for the six MICs below
  - `fq=gnr_cfi_code:ES*` (shares; CFI category E, group S)
  - `fq=type_s:parent`
  - `rows=500`, `wt=json`
  - `fl=isin,lei,mic,gnr_cfi_code,mrkt_trdng_start_date,mrkt_trdng_trmination_date,latest_received_flag,status,valid_to_date,publication_date`
  - No `latest_received_flag` filter on the request: the loader needs every version to compute "listed since" (see Field map).
- **Venues (MIC, ISO 10383):** `XRIS` Riga main, `XTAL` Tallinn main, `XLIT` Vilnius main, `FNLV`, `FNEE`, `FNLT` (the three growth markets). Venue labels come from the ISO 10383 institution name of each MIC, kept in `packages/sources/src/intl/esma-firds/venues.ts`.
- **Licence:** `esma-reuse`: "Reproduction of all information on this site (ESMA Library) is authorised except as otherwise stated", provided the source is acknowledged (https://www.esma.europa.eu/legal-notice, verified 2026-11-19, re-checked by qa 2026-11-20). `attributionRequired: true`, `shareAlike: false`, `nonCommercial: false`, `redistribution: true`.
- **Attribution:** "Source: ESMA, Financial Instruments Reference Data System (FIRDS)".
- **Storage:** `store`.
- **Cadence:** `daily`. FIRDS publishes reference data each business day. `publishedAtUtc: "08:00"` (FIRDS publication runs early morning CET; not measured, so the job runs at 08:00 UTC and a later run is cheap: unchanged is one sync row).
- **As-of rule:** the maximum `publication_date` over all returned documents. A response with no `publication_date` fails the sync with `as_of_missing`.
- **Keys:** none. **Limits:** none published. Politeness: 1 request/s, 6 requests per sync. `limits: { requestsPerSecond: 1, dailyRequests: 12 }`.

```ts
export const meta: SourceMeta = {
  id: "intl-esma-firds",
  country: "intl",
  publisher: "European Securities and Markets Authority",
  homepage: "https://registers.esma.europa.eu/publication/searchRegister?core=esma_registers_firds",
  officialHosts: ["registers.esma.europa.eu"],
  licence: "esma-reuse",
  attribution: "Source: ESMA, Financial Instruments Reference Data System (FIRDS)",
  storage: "store",
  cadence: "daily",
  publishedAtUtc: "08:00",
  asOf: { kind: "json-max", path: "response.docs[].publication_date" },
  deepLink: "https://registers.esma.europa.eu/publication/searchRegister?core=esma_registers_firds&isin={isin}",
  orderUrl: null,
  requires: [],
  limits: { requestsPerSecond: 1, dailyRequests: 12 },
  items: ["S14.LTLVEE.01"],
};
```

The deep-link parameter is the register UI's search; if the UI ignores it, `deepLink` falls back to the homepage (decided by the builder's test `esma-firds.deeplink.test.ts`, which only checks the host is official).

## Items

| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| `S14.LTLVEE.01` | SHOW | - | none in Part G. The report renders the row only when a listing exists; a company with no listing gets no S14 row (Part C: "one 'Listed on [venue] since [date]' row") |

`S14.LTLVEE.02` (prices) is LATER and gets no field. `S14.LV.01`, `S14.EE.01` are LATER: no field.

## Field map

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `isin` | string, 12 chars | `Security.isin` (statement) | S14.LTLVEE.01 | no | upper-case; ISO 6166 check digit must pass, else the record is skipped (`invalid_isin`) |
| `lei` | string, 20 chars | `Security.issuer` → company entity via `links` (LEI ↔ registry code) | resolution key | no | ISO 17442 mod-97 must pass, else `invalid_lei` |
| `mic` | string, 4 chars | `Security.listingVenue` (listed extension) | S14.LTLVEE.01 | no | must be one of the six MICs |
| `gnr_cfi_code` | string, 6 chars | filter only (`ES*`) | - | no | not stored |
| `mrkt_trdng_start_date` | ISO datetime | `Security.listedSince` (listed extension), date part | S14.LTLVEE.01 | no | **earliest value across all versions of the same (`isin`, `mic`)**; measured: one live listing's latest version carries a later date than its first |
| `mrkt_trdng_trmination_date` | ISO datetime or absent | filter: present → listing ended, not loaded | - | no | not stored |
| `latest_received_flag` | "0" or "1" | filter: only `1` is current | - | no | not stored |
| `status` | `UNCH`, `MODF`, `TERM`, ... | filter: `TERM` → not loaded | - | no | not stored |
| `valid_to_date` | ISO datetime or absent | filter: present → superseded version | - | no | not stored |
| `publication_date` | ISO datetime | as-of (sync) | - | no | max over the response |
| `gnr_full_name`, `gnr_short_name` | string | **dropped**: the company's name comes from its register | - | no | never read (load rule 2) |
| every other field | - | never read | - | - | - |

A record is **current** when `latest_received_flag = "1"`, there is no `mrkt_trdng_trmination_date`, no `valid_to_date`, and `status` is not `TERM`. Measured 2026-11-20: XRIS 8, XTAL 19, XLIT 22, FNLV 5, FNEE 10, FNLT 3, **67 current listings**, LEI on 67/67.

FtM: `Security` is in the subset (§3.3). `isin` and `issuer` are upstream properties; `listingVenue` and `listedSince` are listed extensions in `packages/domain/src/schema/`, checked by `schema/ftm-subset.test.ts`.

## Party gate

Not applicable in the party sense: FIRDS rows are instruments, not parties. The issuer is attached only through an official LEI link. If `links` has no LEI ↔ registry-code link for the issuer's LEI (GLEIF loader, `docs/plan/loaders/gleif.md`), the Security entity is still written (with `issuer` unset) and counted as `unresolved_lei`; it is not shown on any report until the link exists. Issuers are always legal entities (an LEI is never issued to a natural person), so no natural-person rule applies.

## Identity and joins

- **Entity:** one `Security` entity per (`isin`, `mic`): `eid = "isin-" + isin + "-" + mic.toLowerCase()`, `country = "intl"`, `caption = isin`.
- **Record key:** `isin + ":" + mic`. **Hash input:** `[isin, mic, listedSince, lei]`.
- **Join:** `lei` → `links` (asserted by the GLEIF loader) → the LT, LV or EE company entity. The report's S14 row reads the company's Security entities through `issuer`.
- A company with listings on two venues gets two rows.

## Refresh and change

- **Full load and refresh** are the same: 6 requests, every version of every Baltic share record (about 120 documents measured), grouped in memory by (`isin`, `mic`).
- **Change detection:** content hash over the six raw responses; equal → one `unchanged` sync row. Otherwise the row hash per record key.
- **Removal:** a listing that ends (termination date set, `TERM`, or absent from every response) is **deleted** with its Security entity. History event on the company: `finora.listing_ended` with `data: { mic, isin }` and the sync date, item `S14.LTLVEE.01`. A new listing emits `finora.listing_added`.
- **Unchanged file:** one sync row, no writes.

## Size and time budget

- Rows read ≈ 120 versions; written ≈ 67 entities, ≈ 270 statements, a handful of events a year.
- Bytes on disk < 100 KB. Fetch ≈ 1 s per request (measured 118-357 ms), sync < 10 s.
- Budget share: cross-border (≤ 1 GB), negligible.

## Fixtures

- **Layout writer:** `packages/sources/src/intl/esma-firds/fixtures.ts` writes six Solr-shaped JSON responses (`{"responseHeader":{...},"response":{"numFound":n,"start":0,"docs":[...]}}`) with the fields above, from the synthetic world's companies that have a fixture LEI.
- Each fixture writes at least: one current listing per venue; one superseded version (`latest_received_flag: "0"`, `valid_to_date` set) of a current listing with an earlier `mrkt_trdng_start_date`; one terminated listing; one record whose LEI has no link; one record with a bad ISIN check digit.
- **Fixture id rule:** ISINs use the unassigned prefix `ZZ` and a check digit that fails ISO 6166 by design, except where a test needs a valid one (then the generator computes it and the prefix `ZZ` alone keeps it out of the real namespace). LEIs follow the GLEIF fixture rule (§3.4). No real ISIN, LEI or name.

## Tests

| File | Proves |
|---|---|
| `packages/sources/src/intl/esma-firds/esma-firds.test.ts` | parse on fixtures: only current records produce entities; "listed since" is the earliest start date across versions; terminated and superseded are skipped and counted; bad ISIN or LEI counted |
| `packages/sources/src/intl/esma-firds/field-map.test.ts` | every target is `S14.LTLVEE.01` or a resolution key; `gnr_full_name` is never read |
| `packages/ingest/src/intl/esma-firds.sync.test.ts` | unchanged responses write one sync row; a removed listing deletes the entity and emits `finora.listing_ended`; `unresolved_lei` is counted, nothing shown |
| `packages/sources/src/intl/esma-firds/deeplink.test.ts` | the deep link host is in `officialHosts` |
| `apps/web/e2e/report-securities.spec.ts` | a fixture company with a listing shows "Listed on [venue] since [date]" with the FIRDS source chip; one without shows no S14 row |

## Failure modes

| Case | Loader | UI |
|---|---|---|
| Endpoint down or HTTP error | sync `failed`, previous rows kept | the row keeps showing with its as-of date; Stale after 2 days (daily cadence) |
| One of six venues fails | sync `partial`, nothing purged | as above |
| Schema change (a mapped field missing in every doc) | sync `failed` with `schema_changed` | as above; the Sources page shows the failure |
| Stale `publication_date` | `stale_skipped` | as above |
| Search endpoint withdrawn | `failed`; fallback documented below | as above |

**Fallback if the search endpoint goes away:** ESMA's FIRDS full files (`FULINS_E_*` for equities, listed in the `esma_registers_firds_files` core). They are large and split by CFI letter, so they need their own spec; this loader only switches to them if the search endpoint fails 7 days in a row (`finora-cli data status` flags it).

## Open questions

None.
