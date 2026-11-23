# Finora

Free, open-source company intelligence, done by agents. Describe a company you're about to deal with; research agents check official registries, filings, courts, sanctions lists and the open web in parallel, and come back with a verdict where every finding links to its source.

Checking a company by hand means hours across a dozen registries and websites. Agents can do it in minutes, and the result should be free.

**Status: building, slice by slice.** Milestone 1 (the foundation) is built: the workspace, the store, the loaders, the fixture world and the UI plumbing. Real data comes in milestone 2, starting with Latvia. The register of the work is `docs/plan/README.md`.

## Running Finora

v1 runs locally only, on your own machine. It needs Node 24.20 or later and pnpm. The one-command start with the public registers loaded lands with slice S12 (`docs/running.md`). There is no hosted build until the publication-related lawyer questions in `docs/plan/lawyer-register.md` are cleared.

What runs today, on fictional fixture data:

```sh
node scripts/guard/install.mjs                      # the git hooks
pnpm install
pnpm test                                           # Vitest and the node tests
pnpm dev                                            # the localised shell at http://127.0.0.1:3000/en
FINORA_DEMO=1 pnpm dev                              # also the /en/design gallery and fixture views
pnpm finora-cli data sync --profile fixtures        # load the fixture world
pnpm finora-cli search example --country lv         # also ee, lt, us
pnpm finora-cli show <entity id>
```

## Planned tools

| Tool | What it does |
|---|---|
| **Company explorer + agentic search** | One flow: search a company, see what each country's official registers publish about it, with every gap named, and let agents dig further on the open web. It ends in a sourced verdict |
| **Crash monitor** | How far markets (stocks, gold, crypto, oil) are from their peaks, plus the live US national debt |
| **Profile templates** | Reusable checklists for common investigations: a contractor, a supplier, an employer, an investment |

## Principles

- **Official and open data first.** Every source has its licence recorded; nothing is scraped where its terms forbid it.
- **Every claim cites its source.** A finding without a source isn't shown.
- **Transparent scoring.** Any score shows its working.
- **Privacy by design.** EU personal data is handled under the GDPR; people appear only in the context of the companies they run.
- **No bundled licensed data.** Data that may not be redistributed comes through connectors that use your own keys.

## Contributing

Read [the publishing checklist](docs/contributing/publishing-checklist.md) first, then turn on the guard:

```bash
node scripts/guard/install.mjs
```

Then, with Node 24 and pnpm (the version is pinned in `package.json`):

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm check        # dependency table, tokens, lawyer register, generated items
```

Read `docs/architecture.md` before writing code; `docs/plan/slices.md` says what each slice builds and how it is tested.

## License

- **Code:** [GNU AGPL-3.0](LICENSE). If you run a modified version as a service, you must offer its source to its users.
- **Docs and research text** (`docs/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Data** loaded from public sources keeps its source's licence; Finora never relicenses it. Each source's licence is recorded in `docs/research/`.
