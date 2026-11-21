// The S04a demo: an empty in-memory store, one fixture company written through a fake sync, and a
// search by a substring. Run with `node packages/store/demo.ts`.
import { beginSync, finishSync, openStore, searchCompanies, upsertSource, writeRecord } from "@finora/store";

const store = openStore({ dataDir: null });
const now = new Date().toISOString();
upsertSource(store.db, { id: "demo-register", storage: "store" }, now);
const syncId = beginSync(store.db, { sourceId: "demo-register", licenceId: "cc0-1.0", storage: "store", parserVersion: "demo", startedAt: now });
writeRecord(store.db, {
  syncId,
  sourceId: "demo-register",
  recordKey: "lv-00000000001",
  hashInput: ["lv-00000000001", "Ābeļu Dārzs Paraugs SIA"],
  entities: [
    {
      eid: "lv-00000000001",
      schema: "Company",
      country: "lv",
      legalForm: "lv-sia",
      code: "00000000001",
      statements: [{ prop: "name", value: "Ābeļu Dārzs Paraugs SIA", itemId: "S01.LV.01" }],
    },
  ],
});
finishSync(store.db, syncId, { kind: "content", finishedAt: now });
process.stdout.write(`${JSON.stringify(searchCompanies(store.db, "beļu dār"), null, 2)}\n`);
store.close();
