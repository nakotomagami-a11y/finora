# @finora/ingest

The pipeline that runs a loader against the store (architecture §4.4): fetch, as-of check, the gates (field map, personal code, natural person, proven company), staging, writes in time-bounded transactions, purge under the guard, history events, sync reports, every sync under its `sync:<source>` lease and in its own worker thread. `live-cached` sources go through `fetchOnView`; `live-no-store` sources stay in memory.

## Demo

```sh
node packages/ingest/demo.ts
```

It syncs a fake source of 500 companies twice: the first run is `content`, the second writes one `unchanged` sync row and nothing else.

## Tests

```sh
pnpm vitest run packages/sources packages/ingest
```
