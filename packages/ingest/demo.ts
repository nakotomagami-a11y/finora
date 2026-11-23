// The S04i demo: the pipeline on a fake source, twice. The second run writes one `unchanged` sync
// row and nothing else. Run with `node packages/ingest/demo.ts`.
import { runSync } from "@finora/ingest";
import { companies, fakeSource, noNetwork } from "@finora/ingest/testing";
import { openStore } from "@finora/store";

const store = openStore({ dataDir: null });
const loader = fakeSource({}, { records: companies(1, 500) });
const count = () => (store.db.prepare("SELECT COUNT(*) AS n FROM main.statements").get() as { n: number }).n;

for (const run of [1, 2]) {
  const outcome = await runSync(store.db, loader, { fetcher: noNetwork });
  process.stdout.write(`run ${run}: ${outcome.kind}, written ${outcome.report?.written ?? 0}, statements in store ${count()}\n`);
}
const syncs = store.db.prepare("SELECT id, kind FROM main.syncs ORDER BY id").all();
process.stdout.write(`${JSON.stringify(syncs)}\n`);
store.close();
