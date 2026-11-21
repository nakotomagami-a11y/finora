// Loads the LV, EE and LT company files into one flat SQLite table with an FTS5 name index,
// then times prefix name searches. Run download.mjs first.
import { DatabaseSync } from "node:sqlite";
import { rmSync, statSync } from "node:fs";
import { cachePath, flags, percentile, readCsv, seconds } from "./lib.mjs";

const { limit, db: dbName } = flags({ limit: Infinity, db: "bench-search.sqlite" });
const dbPath = cachePath(dbName);
for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  pragma journal_mode = wal;
  pragma synchronous = off;
  create table entity (
    id text primary key, country text, reg_code text, name text, status text,
    registered text, address text, licence text, source text
  );
  create virtual table entity_fts using fts5(
    name, content = 'entity', content_rowid = 'rowid',
    tokenize = "unicode61 remove_diacritics 2", prefix = '2 3 4'
  );
`);
const insert = db.prepare("insert or ignore into entity values (?, ?, ?, ?, ?, ?, ?, ?, ?)");

const SOURCES = [
  {
    country: "LV", file: "lv_register.csv", delimiter: ";",
    toRow: (r) => [`lv:${r.regcode}`, "LV", r.regcode, r.name, r.terminated ? "terminated" : "active", r.registered, r.address, "CC0-1.0", "lv-ur-register"],
  },
  {
    country: "EE", file: "ee_lihtandmed.csv", delimiter: ";",
    toRow: (r) => [`ee:${r.ariregistri_kood}`, "EE", r.ariregistri_kood, r.nimi, r.ettevotja_staatus, r.ettevotja_esmakande_kpv, r.ads_normaliseeritud_taisaadress, "CC-BY-4.0", "ee-rik-lihtandmed"],
  },
  {
    country: "LT", file: "lt_ja.csv", delimiter: ",",
    toRow: (r) => [`lt:${r.ja_kodas}`, "LT", r.ja_kodas, r.ja_pavadinimas, r.isreg_data ? "deregistered" : "registered", r.reg_data, null, "unverified", "lt-rc-jar"],
  },
];

const loadStarted = performance.now();
const rows = {};
for (const { country, file, delimiter, toRow } of SOURCES) {
  rows[country] = 0;
  db.exec("begin");
  for await (const { row } of readCsv(cachePath(file), delimiter, { limit })) {
    insert.run(...toRow(row));
    rows[country]++;
  }
  db.exec("commit");
}
const ftsStarted = performance.now();
db.exec("insert into entity_fts(entity_fts) values('rebuild'); analyze;");
const ftsDone = performance.now();
db.exec("pragma wal_checkpoint(truncate)");

const search = db.prepare(`
  select e.id from entity_fts f join entity e on e.rowid = f.rowid
  where entity_fts match ? order by rank limit 20
`);
const prefixes = ["bal", "tran", "statyb", "invest", "agro", "medi", "auto", "logist"];
const timings = [];
for (let round = 0; round < 5; round++) {
  for (const prefix of prefixes) {
    const started = performance.now();
    search.all(`name:${prefix}*`);
    timings.push(performance.now() - started);
  }
}
timings.sort((a, b) => a - b);

const fill = db.prepare(`
  select country, count(*) as rows,
    round(100.0 * sum(address is not null and address <> '') / count(*), 1) as addressFillPct
  from entity group by country
`).all();

console.log(JSON.stringify({
  rows,
  loadSeconds: seconds(loadStarted, ftsStarted),
  ftsBuildSeconds: seconds(ftsStarted, ftsDone),
  databaseMb: Math.round(statSync(dbPath).size / 1e6),
  searchMs: { p50: percentile(timings, 0.5), p95: percentile(timings, 0.95), max: percentile(timings, 1) },
  fill,
}, null, 2));
