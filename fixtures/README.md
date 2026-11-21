# Fixtures

Synthetic data for tests, CI, e2e and `pnpm finora --demo`. **No real entity, ever**: every name is obviously fictional, and every id follows the fixture rule of `docs/architecture.md` §3.4, so it can never collide with a real register entry.

## The fixture world

`src/world.ts` generates the world from a seed (default `20261121`): about 2,000 entities in four countries. It is never committed (qa #22); the loaders regenerate it on every run, and the same seed always gives the same bytes.

| Country | Companies | Sole traders | Ids |
|---|---|---|---|
| LV | 500 | 20 | `lv-<11 digits>`, prefixes `40003`, `40103`, `40203`, `50003`, `90000`; last digit = (true check digit + 1) mod 10 |
| EE | 380 | 15 | `ee-<8 digits>`, prefix `1`; same fixture check digit |
| LT | 320 | 10 | `lt-<9 digits>`, prefix `30`; same fixture check digit |
| US | 200 | - | SEC filers `us-cik-99xxxxxxxx` (reserved range); state records `us-<state>-FX<4 digits>` |

Also in the world:
- officers of about a third of the LV and EE companies, with row-local role ids;
- financial reports, EE taxes paid (share-alike) and an LT arrears list;
- fixture LEIs, which fail mod 97 by design;
- the tickers `ZZFX01` to `ZZFX13`, which no real listing can match;
- one LV sole trader whose id has a personal-code shape, to prove the refusal;
- a file for every HIDE item. These rows arrive already tagged with the HIDE item id, so they prove the item gate again and nothing more (qa F2 on S04f). The real proof is per source: each loader slice from S05 on commits its source's raw layout with every HIDE column and proves its field map never reads them (`slices.md`, S05, S13, S14).

```sh
pnpm fixtures:gen [seed]     # writes fixtures/.generated/world-<seed>.json (gitignored)
```

## The `fixtures` load profile

`src/loaders.ts` has one fake loader per storage class:

| Storage class | Loaders |
|---|---|
| `store` | the four registers, LV and EE officers, financials, and the HIDE files |
| `share-alike-store` | EE taxes paid |
| `live-no-store` | the LT arrears list |
| `live-cached` | a US state register, read through `fetchOnView` |

To load the profile and search it:

```sh
pnpm finora-cli data sync --profile fixtures
pnpm finora-cli search "example compa"
```

## Tests

- `gen.test.ts`: the same seed gives the same bytes; the world's counts.
- `ids.test.ts`: every fixture id fails the real rule and passes its fixture rule.
- `load.test.ts`: the whole profile loads and searches. Every HIDE row is dropped, and the load stays within the relative time budget recorded in `docs/plan/benchmarks.md`.
