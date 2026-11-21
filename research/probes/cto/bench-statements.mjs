// Loads the LV company file twice into a one-row-per-value statement store and reports load time,
// size and the cost of reloading an unchanged file. Run download.mjs first.
//   --layout=lean     integer keys, interned properties, sync ids, a row hash per source record
//   --layout=drafted  the early architecture draft: text hash key, ISO timestamps, last_seen set on every statement
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { rmSync, statSync } from "node:fs";
import { cachePath, flags, percentile, readCsv, seconds } from "./lib.mjs";

const { layout, limit } = flags({ layout: "lean", limit: Infinity });
const SOURCE = "lv-ur-register";
const PROPS = {
  name: "name", regcode: "registrationNumber", type_text: "legalForm", registered: "incorporationDate",
  terminated: "dissolutionDate", address: "address", sepa: "sepa", regtype_text: "register",
  city: "city", index: "postalCode", atvk: "region",
};

const dbPath = cachePath(`bench-statements-${layout}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });
const db = new DatabaseSync(dbPath);
db.exec("pragma journal_mode = wal; pragma synchronous = off; pragma cache_size = -262144; pragma temp_store = memory;");

const values = (row) => Object.entries(PROPS)
  .map(([column, prop]) => [prop, (row[column] ?? "").trim()])
  .filter(([, value]) => value);

function draftedLayout() {
  // Leaves out the third index of the draft, (prop, value), so its figures are a lower bound.
  db.exec(`
    create table statement (
      id text primary key, entity_id text not null, schema text not null, prop text not null, value text not null,
      lang text, source_id text not null, source_record text not null, source_url text,
      first_seen text not null, last_seen text not null, retrieved_at text not null
    ) without rowid;
    create index statement_entity on statement (entity_id, prop);
    create index statement_source on statement (source_id, last_seen);
  `);
  const upsert = db.prepare(`
    insert into statement values (?, ?, 'Company', ?, ?, null, ?, ?, null, ?, ?, ?)
    on conflict (id) do update set last_seen = excluded.last_seen
  `);
  return {
    async load() {
      const now = new Date().toISOString();
      let rows = 0, written = 0;
      db.exec("begin");
      for await (const { row } of readCsv(cachePath("lv_register.csv"), ";", { limit })) {
        const entityId = `lv-ur:${row.regcode}`;
        for (const [prop, value] of values(row)) {
          const id = createHash("sha1").update(`${entityId}|Company|${prop}|${value}|${SOURCE}`).digest("base64url");
          upsert.run(id, entityId, prop, value, SOURCE, row.regcode, now, now, now);
          written++;
        }
        if (++rows % 100_000 === 0) { db.exec("commit"); db.exec("begin"); }
      }
      db.exec("commit");
      return { rows, statementsWritten: written };
    },
    afterFirstLoad() {},
    readEntity: db.prepare("select prop, value from statement where entity_id = ?"),
    entityKeys: () => db.prepare("select distinct entity_id as k from statement order by random() limit 2000").all().map((r) => r.k),
  };
}

function leanLayout() {
  db.exec(`
    create table sync (id integer primary key, source_id text not null, retrieved_at text not null);
    create table entity (id integer primary key, key text not null unique);
    create table prop (id integer primary key, schema text not null, name text not null, unique (schema, name));
    create table record (
      source_id text not null, record_key text not null, entity_id integer not null,
      row_hash blob not null, first_sync integer not null, last_sync integer not null,
      primary key (source_id, record_key)
    ) without rowid;
    create table statement (
      id integer primary key, entity_id integer not null, prop_id integer not null, value text not null,
      source_id text not null, record_key text not null, first_sync integer not null, last_sync integer
    );
  `);
  const insertProp = db.prepare("insert into prop (schema, name) values (?, ?) returning id");
  const propId = Object.fromEntries(Object.values(PROPS).map((name) => [name, Number(insertProp.get("Company", name).id)]));
  const getRecord = db.prepare("select row_hash, entity_id from record where source_id = ? and record_key = ?");
  const touchRecord = db.prepare("update record set last_sync = ? where source_id = ? and record_key = ?");
  const upsertEntity = db.prepare("insert into entity (key) values (?) on conflict (key) do update set key = excluded.key returning id");
  const upsertRecord = db.prepare(`
    insert into record values (?, ?, ?, ?, ?, ?)
    on conflict (source_id, record_key) do update set row_hash = excluded.row_hash, last_sync = excluded.last_sync
  `);
  const retireStatements = db.prepare("update statement set last_sync = ? where source_id = ? and record_key = ? and last_sync is null");
  const insertStatement = db.prepare(`
    insert into statement (entity_id, prop_id, value, source_id, record_key, first_sync, last_sync)
    values (?, ?, ?, ?, ?, ?, null)
  `);
  const insertSync = db.prepare("insert into sync (source_id, retrieved_at) values (?, ?) returning id");
  return {
    async load() {
      const sync = Number(insertSync.get(SOURCE, new Date().toISOString()).id);
      let rows = 0, changed = 0, written = 0;
      db.exec("begin");
      for await (const { line, row } of readCsv(cachePath("lv_register.csv"), ";", { limit })) {
        rows++;
        const key = row.regcode;
        const hash = createHash("sha1").update(line).digest().subarray(0, 12);
        const previous = getRecord.get(SOURCE, key);
        if (previous && hash.equals(Buffer.from(previous.row_hash))) { touchRecord.run(sync, SOURCE, key); continue; }
        changed++;
        const entityId = Number(previous ? previous.entity_id : upsertEntity.get(`lv-ur:${key}`).id);
        if (previous) retireStatements.run(sync, SOURCE, key);
        for (const [prop, value] of values(row)) { insertStatement.run(entityId, propId[prop], value, SOURCE, key, sync); written++; }
        upsertRecord.run(SOURCE, key, entityId, hash, sync, sync);
      }
      db.exec("commit");
      return { rows, changedRows: changed, statementsWritten: written };
    },
    afterFirstLoad() {
      db.exec(`
        create index statement_entity on statement (entity_id, prop_id);
        create index statement_live on statement (source_id, record_key) where last_sync is null;
      `);
    },
    readEntity: db.prepare(`
      select p.name, s.value from statement s join prop p on p.id = s.prop_id
      where s.entity_id = ? and s.last_sync is null
    `),
    entityKeys: () => db.prepare("select id as k from entity order by random() limit 2000").all().map((r) => Number(r.k)),
  };
}

const store = layout === "drafted" ? draftedLayout() : layout === "lean" ? leanLayout() : null;
if (!store) throw new Error("--layout must be lean or drafted");

const firstStarted = performance.now();
const first = await store.load();
const indexStarted = performance.now();
store.afterFirstLoad();
const firstDone = performance.now();
db.exec("pragma wal_checkpoint(truncate)");
const sizeAfterFirst = statSync(dbPath).size;

const reloadStarted = performance.now();
const reload = await store.load();
const reloadDone = performance.now();
db.exec("pragma wal_checkpoint(truncate)");

const statements = Number(db.prepare("select count(*) as n from statement").get().n);
const timings = store.entityKeys().map((key) => {
  const started = performance.now();
  store.readEntity.all(key);
  return performance.now() - started;
}).sort((a, b) => a - b);

console.log(JSON.stringify({
  layout,
  first: { ...first, loadSeconds: seconds(firstStarted, indexStarted), indexSeconds: seconds(indexStarted, firstDone) },
  databaseMbAfterFirst: Math.round(sizeAfterFirst / 1e6),
  bytesPerStatement: Math.round(sizeAfterFirst / statements),
  reloadOfUnchangedFile: { ...reload, seconds: seconds(reloadStarted, reloadDone) },
  databaseMbAfterReload: Math.round(statSync(dbPath).size / 1e6),
  entityReadMs: { p50: percentile(timings, 0.5), p99: percentile(timings, 0.99) },
}, null, 2));
