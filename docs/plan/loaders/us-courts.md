# us-courts: federal civil cases (FJC IDB) and P2 dockets

Courts are **agent-only** in v1 (Part G S10: "CAVEAT, agent only"; possible matches shown only after an agent confirms them). Research: `docs/research/us.md` §3, probes `research/probes/us/fjc_idb.py`, `p2_dockets.py`.

## Source

| `id` | What | Access | Licence |
|---|---|---|---|
| `us-p2-dockets` | dockets and parties of federal courts | REST API v4 on the P2 host (from the local provider map) with header `Authorization: Token <P2 API token>` | API: no stated licence ; bulk files "free of known copyright restrictions" (read 2026-11-20) |
| `us-fjc-civil` | FJC Integrated Database, civil cases | bulk `https://www.fjc.gov/sites/default/files/idb/textfiles/cv88on.zip` (329,665,474 bytes, 10,960,173 cases, filed through 2026-06-30) | no statement on the page; federal work (17 U.S.C. 105), verified partial |

- `officialHosts`: `www.fjc.gov`; the P2 host comes from the local provider map at runtime (C15), and tests use an `*.example` host.
- **P2:** **off in v1** (human ruling H5: no API keys; the API needs a token). S10.US.02 renders `not_checked{reason: "manual_lookup", url: <P2 search URL from the local provider map>}` with "Search federal dockets on [provider name from the map]"; with no provider map the row shows `needs_source`. The design below (`storage: agent-only`, `requires: ["P2 API token"]`) stays for when a key is allowed again. `limits`: "5 requests per minute, 50 requests per hour, and 125 requests per day" (P2's API overview, read 2026-11-20; URL in the private notes), enforced globally across investigations; results cached per investigation. `deepLink`: `(P2 site; host in the local provider map)` from the result. `asOf`: `[in_file_field]` (result `dateFiled`, `date_modified`).
- **FJC civil:** `storage: store`, as a **court index** (not entity statements): one row per (case, organisation party), read only by the agent tool `search_courts`, never rendered without an agent finding. `cadence`: `quarterly` (*observed: file updated with filings to 2026-06-30*). `asOf`: `[max_date_in_data]` over `FILEDATE`. `deepLink`: null (FJC has no per-case page); the agent cites the docket (court, docket number, filing date) and, when found, the P2 docket via `idb_data_id`. `requires`: none.
- `attribution`: "Federal Judicial Center, Integrated Database" / "provider P2".
- `verifiedOn`: FJC 2026-11-20, `https://www.fjc.gov/research/idb` (no licence statement on the page; federal work); P2 2026-11-20, `(P2's documentation; URL in the private notes)` and `(P2's documentation; URL in the private notes)`.

### Contract fields (milestone A.1 checklist)
- `asOf`: FJC `[max_date_in_data]` over `FILEDATE`; P2 per result.
- `purgeScope`: FJC `window` (the last 10 years); P2 `none` (agent-only). `maxPurgeShare`: FJC **0.02 inside the window** (cto, 7029779579): cases filed before the window start are expected deletions and not counted; cases missing inside the window are counted (court cases are not withdrawn from the file, so the floor applies).
- `parserVersion` (A1): the hash of the loader module, its field map and the generated item list, as in §4.4; here the module includes the legal-form token list and the FJC code-book labels.
- Record unit: one record per case (`record_key` = court + docket + filing date) holding its organisation parties; file order.
- `personRecordKey`: none: person parties are never loaded (party gate). Share-alike events: none.

## Items
| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S10.US.01 (FJC civil) | CAVEAT | Possible match by name, needs review | AGENT |
| S10.US.02 (P2) | CAVEAT | Possible match by name, needs review | AGENT |

LATER, not read: S09.US.02 (FJC bankruptcy: no debtor names), S09.US.03 (PACER, paid: "Federal bankruptcy dockets: paid, not checked").

## Field map
**FJC civil index** (tab-delimited, Latin-1, `unzip -p` because the zip uses Deflate64; 46 columns)

| Source field | Target (court index column) | Personal? | Transform |
|---|---|---|---|
| `CIRCUIT`, `DISTRICT`, `OFFICE`, `DOCKET` | `court`, `docket` (record key part) | no | |
| `FILEDATE`, `TERMDATE` | `filed`, `terminated` | no | MM/DD/YYYY → ISO; last 10 years only (filed ≥ today − 10 y) |
| `PLT`, `DEF` | `party_name` (normalised) + `role` (plaintiff, defendant) | no, after the gate | **party gate**: kept only with a legal-form token |
| `NOS` | `nature_of_suit` (code + label from the FJC code book) | no | |
| `ORIGIN`, `DISP`, `JUDGMENT`, `AMTREC`, `CLASSACT` | `origin`, `disposition`, `judgment_for`, `amount_received`, `class_action` | no | code labels from the code book |
| every other column (judges, county, demand, jury, pro se, …) | dropped | - | |

**P2 search result** (returned to the agent, not stored): `caseName`, `court`, `docketNumber`, `dateFiled`, `dateTerminated`, `natureOfSuit`, `cause`, `party` names, `absolute_url`.

## Party gate
- P8 and the proven-company gate: a party name is kept in the court index only if it carries a legal-form token (Inc, LLC, L.L.C., Corp, Corporation, Co, Company, Ltd, LP, LLP, PLLC, PC, N.A., Bank, Trust Company). All other names (people, "et al" fragments, agencies, "United States") are **not loaded**; drop reasons `no_form_token`, `government_party`. Measured: about 29% of defendants and 8% of plaintiffs look like organisations.
- On the P2 path the same function masks parties in the agent's output (P8): a party without a form token or registry-ID match is shown as "a private individual".

## Identity and joins
- Court index rows are not entities. The agent tool searches by the profile's normalised name (exact, then prefix on the first two words) and returns candidates; a candidate becomes a finding only when the agent confirms it with a second identifier (state of the court matches the company's state, the company's address or full legal name in the docket, or a P2 party record) and the human reviews it ("possible match, needs review").
- FJC ↔ P2: `idb_data_id` on P2 dockets (filled on 11% of a 50,000-docket sample) gives a docket link when present.

## Refresh and change
- FJC: quarterly (check `Last-Modified` weekly; reload on a new content hash). `record_key` = `fjc:<circuit>-<district>-<office>-<docket>:<filedate>`, one record per case holding its organisation parties (A8); `hashInput` = the field-map columns in table order. Cases leaving the 10-year window are deleted.
- P2: per investigation.

## Size and time budget
- **Measured 2026-11-20** (`research/probes/us/fjc_court_index.py <cv88on.zip> 10`, the party gate above, over the file filed through 2026-06-30): of 3,378,741 civil cases filed since 2016, **1,462,660 have an organisation party**, giving **1,562,381 index rows**. Dropped: 4,971,717 party names without a form token, 223,384 government parties.
- Size: 1.56 M rows × ≈ 60 B ≈ 0.09 GB, plus one `records` row per case (1.46 M × 74 B, cto's measured bytes per record) ≈ 0.11 GB, **≈ 0.2 GB in total**: under cto's 0.3 GB line, so the 10-year window stands. If the loader slice measures it above 0.3 GB, the window drops to 5 years (cases since 2021: ≈ 0.73 M) before anything else is cut (cto, 7029711221).
- One parse pass over 2.0 GB unzipped ≈ 5-10 min, in the background after the core load.
- P2: 0 bytes stored; ≤ 125 calls a day across all investigations.

## Fixtures
`fixtures/us/fjc/cv88on.txt` (header with the real 46 column names, generated), 8 cases: a company defendant with a form token, a person defendant (must be dropped), "United States" as plaintiff (dropped), a company without a form token (dropped, P8 fixture), cases inside and outside the 10-year window. Zipped with standard deflate for the fixture (the loader handles both). `fixtures/us/p2/search.json` (on an `*.example` host): 3 results, one with a person party.

## Tests
`sources/src/us/fjc/fjc-civil.test.ts` (window, field map, Deflate64 handled through the unzip path), `ingest/src/purge-guard.test.ts` (US window case: aged-out cases pass; a file missing a third of the in-window cases ends `purge_guard`), `ingest/src/party-gate.test.ts` (court cases: person names and "United States" never loaded; a company name without a form token masked), `agent-tools/src/search-courts.test.ts` (US cases) (a name-only candidate is not a finding until confirmed; the 125-a-day budget is shared and refuses call 126; nothing from P2 is written to the store).

## Failure modes
- v1 (H5): `search_courts` runs the FJC index only; S10.US.02 is the manual link above, and the coverage line says "Federal civil cases checked in the FJC index; dockets: check on P2".
- Daily budget used up: "Court dockets: daily limit reached, try tomorrow" (`not_checked{reason: "limit"}`).
- FJC file unchanged for more than 184 days (2 × quarterly): the index is shown as Stale in the check line.

## Open questions
None. The `court_index` table and its class row are confirmed in `architecture.md` §3.5 and §3.8 (architect, `1f3fc7f`, `91a002e`).
