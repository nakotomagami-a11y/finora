# Finora

Free, open-source company intelligence, done by agents. Describe a company you're about to deal with; research agents check official registries, filings, courts, sanctions lists and the open web in parallel, and come back with a verdict where every finding links to its source.

Checking a company by hand means hours across a dozen registries and websites. Agents can do it in minutes, and the result should be free.

**Status: research.** No app code yet. We are first measuring which public data actually exists for the US and the Baltics (Lithuania, Latvia, Estonia) and what it lets us show. Architecture and code come after that.

## Planned tools

| Tool | What it does |
|---|---|
| **Company explorer + agentic search** | One flow: search a company, see everything official data says about it (registry, people and roles, ownership, financials, employees, taxes and debts, legal records, sanctions), and let agents dig further on the open web. It ends in a sourced verdict |
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

To be decided before the first code lands.
