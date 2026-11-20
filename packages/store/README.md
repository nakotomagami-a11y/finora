# @finora/store

The local store (architecture §3): `node:sqlite`, three files attached as `main` (`finora.db`), `user` (`finora-user.db`) and `sa` (`finora-sa.db`), forward-only migrations, the registry write path with provenance, company search, leases, the purpose gate, disputes, suppressions, retention, the canary scanner, backup classes and the two fail-closed logs.

## Demo

`demo.ts` opens an empty in-memory store, writes one fixture company through a fake sync and finds it by a substring of its name:

```sh
node packages/store/demo.ts
```

It prints one hit, `lv-00000000001`, matched as `substring`.

## Tests

```sh
pnpm vitest run packages/store
```
