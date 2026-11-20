# The v1 prototype: what "fully working" means

Owner: coordinator, with the architect. Read with `docs/plan/slices.md` (the build order and the per-slice demos), `docs/architecture.md` (the contract) and `docs/plan/council/01-data.md` (what each country shows). The council signs off against this file in session 3 at M5 (slice S26).

## 1. Definition of done

v1 is fully working when every line below holds on a clean machine, checked by someone who only reads this repo. Each line names how it is checked.

| # | Criterion | Checked by |
|---|---|---|
| D1 | **One command.** A fresh clone, `pnpm install`, then `pnpm finora` starts the app on `http://127.0.0.1:3000` with no Docker, database server or Python. The first run loads the `core` profile; each country is searchable as soon as its own register lands (P10); the whole first load completes in ≤ 30 min on `dev-desktop-1` | S12 and S25 demos; `benchmarks.md` |
| D2 | **Real data, four countries.** Search finds real companies in LV, EE and LT from the official bulk files, and in the US from SEC (with `SEC_USER_AGENT`) and the live NY, CO, CT and PA registries. Each profile shows what Part G rules for its country, with source, licence, as-of and checked dates on every value, and a named state for every gap (never a blank section) | S05, S13, S14, S16, S17; `field-registry` CI job |
| D3 | **The instant profile is free.** Everything in D2 works with no LLM key and no spend: the 11 checks and the coverage line render from stored data | S07, S08; e2e with no keys |
| D4 | **Agentic search, end to end.** From a profile, Investigate shows the pre-run cost range, runs the four specialists in parallel with live task rows, asks the human when the company match is uncertain, a possible sanctions match needs review, or the cap is reached, and ends in a rule-based verdict level with an AI-written explanation where every claim cites a stored statement or a quoted source span | S09-S11; `agents.md` §14 acceptance; the milestone gate |
| D5 | **The legal product rules hold on every surface.** R1-R18, P1-P14 and PS2-PS7 each have their enforcement point and test green; HIDE items appear on no surface (UI, API, MCP, export, agent output, logs); the purpose gate and the facts-only variant work | architecture §10; the HIDE negative suites |
| D6 | **Crash monitor works.** With no keys, the official rows show drawdown with as-of times; with the user's own stock key and fund slots, the fund-proxy rows fill; crypto refreshes every 5 minutes while open | S22-S24 demos |
| D7 | **The rest of the daily app.** Library (reopen and delete investigations), network explorer (company-to-company, one hop), sources page, settings (keys status, fund slots, purpose, data status), MCP server for a desktop client | S19-S21, S24 |
| D8 | **Green.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e` locally and every CI job on the hub PR (including `guard`); qa has no open MUST-FIX on any slice; web-qa has no open MUST-FIX on any UI slice; the security reviews on the marked slices have no open finding | CI; `docs/plan/reviews/` |
| D9 | **Quality gate on real data.** `node scripts/milestone-gate.mjs` on the regression set in `research/.cache/`: 0 wrong-company findings, 100% cited verdict claims, and a fresh random sample of 10 companies per country within 10 points of the reality-check fill rates. Output (aggregates only) pasted into the session 3 record | S12, S25, S26 |
| D10 | **Council sign-off.** Session 3 at M5 runs the demo script in §3 and records "fully working" in `docs/plan/council/03-*.md`. Then the human merges the hub PR | S26 |

**Not part of v1** (LATER in Part G, so their absence is not a defect): company groups (S05), public money (S12), reviews and social media, person-to-person network links, "also officer in N companies", the web archive and .lv/.ee WHOIS, average salary, macro tiles (M09), FL and OR/WA state registries, PEP lists, hosted or multi-user deployment, profile templates beyond the counterparty check.

## 2. Daily-use scenarios

Each scenario is a real task the maintainer does. The session 3 demos run them on real companies; e2e tests run them on the fixture world.

| # | Scenario | What must happen | Countries |
|---|---|---|---|
| U1 | **Morning check.** Open the app; look at Crash monitor | Tiles show drawdown from peak with as-of times; rows without a key say what to add; nothing reads "0%" without data | - |
| U2 | **"Will this supplier still exist and deliver?"** Search a Latvian company by part of its name, open it | The profile shows status, officers (after a purpose), members that are companies, financials for 5 years, tax rating, insolvency and securing measures, sanctions lines, the 11 checks and the coverage line; every value has its source chip | LV |
| U3 | **"An unknown company sent an invoice: is it real?"** Paste a name and a registry code from the invoice | Search pins the exact entity by code; if two match by name, the app asks which; a deregistered company reads "Removed from the register" with its date, never "no match" | EE, LT |
| U4 | **Deep dive before signing.** Press Investigate on the profile | The pre-run range shows (typical to worst case under the $1.50 cap) next to today's remaining spend; four lanes run at once with task rows ticking; a question card appears when needed; the report ends in a level with "N of 11 checks ran", findings each with a citation, and an AI-written label on prose | LV, EE, LT, US public |
| U5 | **US counterparty.** Search a US private company | Live groups for NY, CO, CT and PA arrive one by one, each with a "did not answer" state when it times out; the profile names the registries checked and says owners and accounts are not published in the US | US private |
| U6 | **US public company.** Open a listed US company | Filings, financials, officers, insider trades behind the purpose gate (with `SEC_USER_AGENT`); without it, a clear `needs_key` state | US public |
| U7 | **Sole trader.** Open a Latvian or Estonian sole trader | The facts-only variant: no verdict level, the "not a credit report" disclaimer, the address at country level only, no tax lines | LV, EE |
| U8 | **Revisit.** Open the library, reopen last week's investigation | The report reopens as it was, with its citations' snapshots; a value that changed since shows its newer as-of | all |
| U9 | **Ask from another tool.** Ask an MCP-capable desktop client about a Baltic company | The MCP tools return cited facts, require a purpose for person data, and never return HIDE items | LV, EE, LT |
| U10 | **Correct an error.** Report an error on a finding | The value is suppressed within the dispute window and stays suppressed across reloads (R10) | all |

## 3. Demo script (council session 3 at M5)

Run from a clean clone, on real data, by a council seat or the maintainer, in this order. Each step names the scenario and the done criterion it proves. Use real companies the maintainer actually deals with; record only aggregates in the committed record.

1. **Install.** `git clone`, `pnpm install`, `pnpm finora`. Watch the progress view; search Latvia as soon as it lands (D1).
2. **Morning check** (U1, D6). Open Crash monitor: official rows filled; one fund slot set from Settings fills its row on refresh.
3. **Latvian supplier** (U2, D2, D3, D5). Search part of a name; open the company; state a purpose; read People; hover three values to see source, licence and dates; follow one link to the register.
4. **Investigate** (U4, D4). Press Investigate; read the pre-run range; watch the four lanes; answer the question card; read the verdict, the coverage line and three citations; ask one follow-up.
5. **Estonian invoice check** (U3). Search by registry code; open; see the tax-debtor line with its CC BY-SA attribution.
6. **Lithuanian company** (U3). Open; see arrears, insured counts and the paid-extract line for names.
7. **Sole trader** (U7, D5). Open one; see the facts-only variant.
8. **US private and public** (U5, U6). Search a common US name; watch the state groups arrive; open a listed company with `SEC_USER_AGENT` set.
9. **Library and network** (U8, D7). Reopen the investigation from step 4; open the network view of the step 3 company and follow one shared-address link.
10. **MCP** (U9). Ask a desktop client about the step 3 company.
11. **Dispute** (U10). Report an error on one value; reload the source; the value stays suppressed.
12. **Gate** (D8, D9). Show the hub PR's CI green; run `node scripts/milestone-gate.mjs` and read its aggregates aloud.

The council answers: would we use this every day? What is missing? Then signs off or lists what blocks.

## 4. Risk register

| # | Risk | Likelihood | Impact | Mitigation | Owner | Trigger to act |
|---|---|---|---|---|---|---|
| K1 | **Wrong company in a finding** (the council's worst failure) | M | H | Entity pinned to a registry id before any agent runs; `entity_choice` with no default; citations rejected if their entity isn't the subject or linked; milestone gate fails on any wrong-company finding | data-osint, architect | any wrong-company finding in a gate run: stop feature work |
| K2 | **Keys not ready** (`SEC_USER_AGENT`, `ANTHROPIC_API_KEY`, `SAM_GOV_API_KEY`, `SOCRATA_APP_TOKEN`) blocks D2 for the US and D4's measured cost | M | H | Asked early; every key-gated path has a fixture mode and a `needs_key` state; the human's key round is scheduled before M3 (US) and before S10's measured run | coordinator | M2 demo reached without the key round |
| K3 | **Measured agent cost exceeds the cap** | M | M | Runtime slice not accepted until the measured run replaces the model; council kill criterion: cut agents before raising the cap | data-osint, cto | measured p95 > $1.50 |
| K4 | **Store budget overrun** (≤ 10 GB store, ≤ 12 GB data dir) | M | M | Narrow facts, record unit per report, load rules 1-4; each loader slice reports its share in `benchmarks.md`; a spec over budget cuts fields or years | cto, data seats | any loader over its country cap |
| K5 | **Upstream schema or URL change** (EE annual-report zips have no stable URL; LT API pages unknown) | H | M | Parsers validate headers; failure modes in every spec; the nightly `live` job; sync failures shown on Settings, never silent | data seats | a `live` job failure |
| K6 | **Legal position changes** (LV officers after the 9 Nov ruling; share-alike local store; pseudonym) | M | H | Every LAWYER item is a config value with a safe interim, tested in both modes (P13, `docs/plan/lawyer-register.md`); no hosted build while a publication item is open | legal, architect | a lawyer's answer or a new ruling |
| K7 | **Name leak in the public repo** (fixtures, screenshots, commits) | M | H | Guard in hooks and CI, private denylist, fixture-only ids, visual baselines from fixtures with `guard review`; qa checks every slice | everyone, qa | any guard hit or leak |
| K8 | **Rate limits on live sources** (state portals, GDELT, SEC 10/s) | M | M | Polite fetcher with per-source limits, 3 s timeouts, cached views, "did not answer" states | architect | repeated 429s in the live job |
| K9 | **Investigation UX feels slow or opaque** | M | M | Tools-first parallel tasks with live rows; pre-run estimate with typical seconds per role; web-qa and designer review every UI slice | frontend, designer | session 3 feedback |
| K10 | **Shared usage quota** stalls seats (13 seats hit the 5-hour limit in 40 min on day 1) | H | M | Seats not needed in a phase are paused; short posts; one slice at a time per builder | coordinator | a stall on the hub |
| K11 | **US private coverage is thin** (four live states ≈ a minority of US small businesses) | H | M | The CEO's milestone test: if fewer than 5 of 10 nationally sampled companies match, US private leaves v1 and search says so | council | the M3 gate |
| K12 | **Security of the agent's web fetch** (SSRF, prompt injection from pages) | M | H | Fetch allowlist and private-address refusal; tool outputs treated as data; security review on S02, S07, S09, S10, S17, S19 | architect, security review | any finding |

## 5. Test and CI strategy

**Layers** (architecture §13-§14 has the full list):
- **Unit** (Vitest): domain rules (verdict table, checks, banned words), parsers on per-source layout fixtures, store and ingest behaviour (purge guard, `parserVersion`, share-alike modes, person rows, disputes, retention with a fake clock).
- **Contract:** every API and MCP response validated against its schema in `packages/api-contract`; generated files (`items.generated.ts`, route table, `openapi.json`) must be current.
- **Rule suites:** one test per R, P and PS rule; HIDE negative suites on six surfaces; the `field-registry` job compares rendered fields with Part G; canary scans for codes, hashes and fixture person names.
- **Agent scenarios:** the `fake` provider replays the 12 scenarios in `agents.md` §13 (questions, cap reached, retries, rejected citations, banned words); no test ever calls a paid API.
- **E2E** (Playwright): the scenarios in §2 on the fixture world at 390, 768, 1280 and 1920 px, with axe; visual baselines from fixtures only.
- **Benchmarks:** recorded on `dev-desktop-1` in `benchmarks.md`; CI uses relative regression budgets.

**Where they run:**
| Where | What | Data |
|---|---|---|
| Pre-commit and pre-push hooks | the guard | staged changes, messages, pushed commits |
| CI on every push to the hub PR | `check`, `test`, `e2e`, `audit`, `demo-boot`, `field-registry`, `guard` | the seeded fixture world; recorded fixtures only; no keys |
| Nightly `live` job (local or a scheduled runner the human approves) | one sync per source against the real endpoint; asserts schemas, as-of freshness and reserved fixture ids staying unassigned | real sources, keys from the environment; output aggregates only |
| Milestone gate (local, by a seat) | `scripts/milestone-gate.mjs` on the regression set | `research/.cache/` (never committed); prints aggregates only |

**Reviews per slice:** qa on every slice's commit range (a MUST-FIX blocks); web-qa on every UI slice; the designer against `DESIGN.md` on UI slices; a security review on the slices marked **security** in `slices.md` (the coordinator runs it with a security-engineer agent and commits its findings to `docs/plan/reviews/`).

## 6. What the human must provide, and when

| Before | What | Why |
|---|---|---|
| M2 (S10's measured run) | `ANTHROPIC_API_KEY` | replaces the modelled agent cost; calibrates the pre-run estimate (about $5) |
| M3 (S16, S17, S18) | `SEC_USER_AGENT` (a real email), `SOCRATA_APP_TOKEN` (free, recommended), `SAM_GOV_API_KEY` (free) | US public companies, unthrottled state queries, federal exclusions |
| M4 (S22-S24) | one free stock key, optionally a crypto aggregator demo key | the fund-proxy tiles |
| Done | the final merge of the hub PR | the only merge |

The full list with variable names is the register's "Keys: what each unlocks" table.
