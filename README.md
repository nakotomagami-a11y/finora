# Finora

Free, open-source company intelligence, done by agents. Describe a company you're about to deal with; research agents check official registries, filings, courts, sanctions lists and the open web in parallel, and come back with a verdict where every finding links to its source.

Checking a company by hand means hours across a dozen registries and websites. Agents can do it in minutes, and the result should be free.

**Status: planning done, build next.** No app code yet. The data research (`docs/research/`), the council's data decisions and the build plan (`docs/plan/`) are written and reviewed; the build starts slice by slice once the plan is approved. The register of the work is `docs/plan/README.md`.

## Running Finora

v1 runs locally only, on your own machine: one command starts the app on `127.0.0.1` with the public registers loaded (see `docs/plan/slices.md` S12 once it lands). There is no hosted build until the publication-related lawyer questions in `docs/plan/lawyer-register.md` are cleared.

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

## License

- **Code:** [GNU AGPL-3.0](LICENSE). If you run a modified version as a service, you must offer its source to its users.
- **Docs and research text** (`docs/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Data** loaded from public sources keeps its source's licence; Finora never relicenses it. Each source's licence is recorded in `docs/research/`.
