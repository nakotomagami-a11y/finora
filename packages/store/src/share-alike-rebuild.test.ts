import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "./open.ts";
import { writeRecord } from "./registry.ts";
import { company, contentSync, tempDir } from "./test-helpers.ts";

const EID = "ee-00000001";
const dirs: { remove(): void }[] = [];
const stores: Store[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  dirs.splice(0).forEach((d) => d.remove());
});

function open(path: string): Store {
  const store = openStore({ dataDir: path });
  stores.push(store);
  return store;
}

function loadRegister(store: Store): void {
  const sync = contentSync(store.db, "ee-register", "2026-11-01T00:00:00.000Z");
  writeRecord(store.db, {
    syncId: sync,
    sourceId: "ee-register",
    recordKey: EID,
    hashInput: [EID],
    entities: [company("ee-00000009", "Filler OÜ", { legalForm: "ee-ou" }), company(EID, "Example Holding OÜ", { legalForm: "ee-ou" })],
  });
}

const joined = (store: Store) =>
  store.db
    .prepare(
      `SELECT e.eid, e.caption, s.prop, s.value FROM sa.sa_statements s JOIN main.entities e ON e.eid = s.eid ORDER BY s.id`,
    )
    .all();

describe("P1, A6: the share-alike store survives a rebuild of finora.db", () => {
  it("keys every share-alike row on the public eid, never on a main-store id", () => {
    const dir = tempDir();
    dirs.push(dir);
    const store = open(dir.path);
    for (const table of ["sa_syncs", "sa_statements"]) {
      const columns = (store.db.prepare(`PRAGMA sa.table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
      expect(columns.filter((c) => /entity_id|record_id|^rowid$/.test(c))).toEqual([]);
    }
  });

  it("re-attaches the share-alike rows after finora.db is deleted and reloaded", () => {
    const dir = tempDir();
    dirs.push(dir);
    const first = open(dir.path);
    loadRegister(first);
    const saSync = first.db
      .prepare("INSERT INTO sa.sa_syncs (source_id, licence_id, started_at) VALUES (?, ?, ?)")
      .run("ee-tax-board", "cc-by-sa-3.0", "2026-11-01T00:00:00.000Z").lastInsertRowid;
    first.db
      .prepare("INSERT INTO sa.sa_statements (eid, prop, value, item_id, sync_id) VALUES (?, ?, ?, ?, ?)")
      .run(EID, "taxesPaid", "12345", "S08.EE.01b", saSync);
    const before = joined(first);
    expect(before).toHaveLength(1);
    first.close();
    stores.splice(stores.indexOf(first), 1);

    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${first.paths.main}${suffix}`, { force: true });
    const rebuilt = open(dir.path);
    expect(joined(rebuilt)).toEqual([]);
    rebuilt.db.exec("DELETE FROM main.entities");
    const sync = contentSync(rebuilt.db, "ee-register", "2026-11-02T00:00:00.000Z");
    writeRecord(rebuilt.db, {
      syncId: sync,
      sourceId: "ee-register",
      recordKey: EID,
      hashInput: [EID],
      entities: [company(EID, "Example Holding OÜ", { legalForm: "ee-ou" })],
    });
    expect(joined(rebuilt)).toEqual(before);
  });
});
