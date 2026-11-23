// S05 write-path bench (not run in CI). The real LV loaders through the real `runSync` on a sync
// connection (`openStore({ sync: true })`, as the worker opens it), fed from local copies of the
// data.gov.lv files through each loader's own fetch (`toFile`), so the download is left out. For
// each source: time, records, statement writes, the write transactions (BEGIN..COMMIT: count, sum,
// p50, p95, max) and the heap, external and RSS peaks. Then target 5: the register again with the
// same rows under a new file hash. Counts and timings only; no value is ever printed.
//
// Get the files once (open data, CC0): `python -I research/probes/baltics/lv/01_ckan_download.py <cache>`
// writes `<cache>/raw/<dataset>/<file>.csv`. Then, from the repo root, on a fresh run:
//   node --expose-gc scripts/bench/lv-write-path.mts --raw <cache>/raw [--work <dir>] [--person-rows <mode>] [source ids...]
// `--work` puts the temp store on a given drive: use the drive that holds the data dirs, since
// checkpoint flushes depend on the disk (the OS temp dir may be on another drive).
// `--person-rows` sets LV_PERSON_ROWS for the officers: `role_counts` by default for casual runs; an
// acceptance run passes `names_no_id`, the mode that ships by default, which writes more (qa). The store goes to a
// fresh temp dir and is removed on every exit, Ctrl-C included. Record the printed commit, the
// command and the machine with any figure you keep (docs/plan/benchmarks.md).
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSync } from "../../packages/ingest/src/index.ts";
import { loadersFor, LV_PERSON_ROWS_MODES, type LvPersonRows } from "../../packages/sources/src/index.ts";
import { openStore } from "../../packages/store/src/index.ts";

/** The bench prints its figures to stdout. */
const out = (line: string) => void process.stdout.write(`${line}\n`);
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const value = args[i + 1];
  args.splice(i, 2);
  return value ?? null;
};
const personRows = option("--person-rows") ?? "role_counts";
if (!(LV_PERSON_ROWS_MODES as readonly string[]).includes(personRows)) {
  console.error(`--person-rows must be one of ${LV_PERSON_ROWS_MODES.join(", ")}`);
  process.exit(2);
}
const raw = option("--raw");
const workBase = option("--work") ?? tmpdir();
if (!raw || !existsSync(raw)) {
  console.error("usage: node --expose-gc scripts/bench/lv-write-path.mts --raw <cache>/raw [--work <dir>] [--person-rows <mode>] [source ids...]");
  process.exit(2);
}
const only = new Set(args);
const LV = loadersFor({ lvPersonRows: personRows as LvPersonRows }).filter((l) => l.meta.country === "lv" && l.meta.id.startsWith("lv-") && (only.size === 0 || only.has(l.meta.id)));
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();
out(`commit ${commit}, node ${process.version}, ${LV.length} sources, LV_PERSON_ROWS ${personRows}, gc ${typeof globalThis.gc === "function" ? "on" : "off (pass --expose-gc)"}`);

const mb = (n: number) => Math.round(n / 2 ** 20);
const dataDir = mkdtempSync(join(workBase, "finora-bench-store-"));
// A sync connection opens a migrated store only: the full open migrates every file first.
openStore({ dataDir }).close();
const store = openStore({ dataDir, sync: true });
const db = store.db;
let closed = false;
/** The store holds officer names under `names_no_id`: it never outlives the run. */
const cleanUp = () => {
  if (!closed) {
    closed = true;
    try {
      store.close();
    } catch {
      // already closed
    }
  }
  rmSync(dataDir, { recursive: true, force: true });
};
process.once("SIGINT", () => {
  cleanUp();
  process.exit(130);
});

// Write transactions (BEGIN..COMMIT) and maintenance writes (checkpoints, FTS optimize and merge
// steps, vacuum), each timed from outside the product code. A maintenance write runs with no BEGIN
// of its own, and counts against target 3 on its own line (council 7087246086).
let txStart = 0;
let tx: number[] = [];
let maintenance: number[] = [];
const MAINTENANCE = /wal_checkpoint|\(\s*'(optimize|merge|rebuild|automerge|crisismerge)'|\bvacuum\b|incremental_vacuum/i;
const timed = <T,>(series: number[], run: () => T): T => {
  const started = performance.now();
  try {
    return run();
  } finally {
    series.push(performance.now() - started);
  }
};
const exec = db.exec.bind(db);
(db as unknown as { exec: (sql: string) => void }).exec = (sql: string) => {
  if (MAINTENANCE.test(sql)) return timed(maintenance, () => exec(sql));
  if (/^\s*BEGIN/i.test(sql)) txStart = performance.now();
  exec(sql);
  if (/^\s*(COMMIT|ROLLBACK)/i.test(sql) && txStart) {
    tx.push(performance.now() - txStart);
    txStart = 0;
  }
};
const prepare = db.prepare.bind(db);
(db as unknown as { prepare: (sql: string) => unknown }).prepare = (sql: string) => {
  const statement = prepare(sql) as unknown as Record<string, (...a: unknown[]) => unknown>;
  if (!MAINTENANCE.test(sql)) return statement;
  for (const method of ["run", "get", "all"]) {
    const call = statement[method]!.bind(statement);
    statement[method] = (...a: unknown[]) => timed(maintenance, () => call(...a));
  }
  return statement;
};

// The control: a checkpoint through either path is caught, or the bench refuses to run.
db.exec("PRAGMA main.wal_checkpoint(PASSIVE)");
db.prepare("PRAGMA main.wal_checkpoint(PASSIVE)").get();
if (maintenance.length !== 2) {
  console.error("the maintenance timer missed a checkpoint: the bench would under-count target 3");
  cleanUp();
  process.exit(1);
}
maintenance = [];

/** A CKAN `package_show` and file download served from the local copies; `rehash` changes the file's bytes, not its rows. */
let rehash = false;
const fetcher = (() => {
  let slug = "";
  return async (url: string, init?: { toFile?: string }) => {
    if (url.includes("package_show")) {
      slug = decodeURIComponent(url.split("id=")[1] ?? "");
      const dir = join(raw, slug);
      const resources = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".csv")).map((f) => ({ url: `https://data.gov.lv/bench/${f}`, format: "CSV", last_modified: "2026-11-20T21:00:00" })) : [];
      return { status: 200, headers: {}, bytes: new TextEncoder().encode(JSON.stringify({ result: { resources } })) };
    }
    if (!init?.toFile) throw new Error("the LV loaders stream every file");
    copyFileSync(join(raw, slug, url.split("/").at(-1) ?? ""), init.toFile);
    if (rehash) writeFileSync(init.toFile, "\r\n", { flag: "a" });
    return { status: 200, headers: {}, bytes: new Uint8Array(), file: { path: init.toFile, size: statSync(init.toFile).size, sha256: rehash ? "bench-rehash" : "bench" } };
  };
})();

const quantile = (xs: readonly number[], q: number) => (xs.length === 0 ? 0 : [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]!);
const ms = (n: number) => `${n.toFixed(0)} ms`;

async function one(loader: (typeof LV)[number], label = loader.meta.id): Promise<{ seconds: number; tx: number[]; maintenance: number[] }> {
  tx = [];
  maintenance = [];
  globalThis.gc?.();
  let heap = 0;
  let ext = 0;
  let rss = 0;
  const sample = () => {
    const m = process.memoryUsage();
    heap = Math.max(heap, m.heapUsed);
    ext = Math.max(ext, m.external + m.arrayBuffers);
    rss = Math.max(rss, m.rss);
  };
  const timer = setInterval(sample, 100);
  const work = mkdtempSync(join(workBase, "finora-bench-work-"));
  const before = (db.prepare("SELECT COALESCE(MAX(id), 0) AS n FROM main.statements").get() as { n: number }).n;
  const started = performance.now();
  const outcome = await runSync(db, loader, { fetcher: fetcher as never, workDir: work, companyPartyTypes: ["LEGAL_ENTITY", "FOREIGN_ENTITY", "J"] });
  const seconds = (performance.now() - started) / 1000;
  clearInterval(timer);
  sample();
  rmSync(work, { recursive: true, force: true });
  const writes = (db.prepare("SELECT COUNT(*) AS n FROM main.statements WHERE id > ?").get(before) as { n: number }).n;
  const r = outcome.report;
  const inTx = tx.reduce((a, b) => a + b, 0) / 1000;
  out(
    `${label}: ${outcome.kind}${r?.reason ? ` (${r.reason})` : ""}, ${seconds.toFixed(1)} s (${inTx.toFixed(1)} s in write tx), read ${r?.read ?? 0}, written ${r?.written ?? 0}, unchanged ${r?.unchanged ?? 0}, statement writes ${writes}; ` +
      `tx ${tx.length}: p50 ${ms(quantile(tx, 0.5))}, p95 ${ms(quantile(tx, 0.95))}, max ${ms(Math.max(0, ...tx))}, worst #${tx.indexOf(Math.max(...tx)) + 1}; ` +
      `maintenance ${maintenance.length}: max ${ms(Math.max(0, ...maintenance))}, at 5 s or more ${maintenance.filter((x) => x >= 5000).length}; ` +
      `heap ${mb(heap)} MB, external ${mb(ext)} MB, rss ${mb(rss)} MB`,
  );
  return { seconds, tx: [...tx], maintenance: [...maintenance] };
}

try {
  const all: number[] = [];
  const allMaintenance: number[] = [];
  let total = 0;
  for (const loader of LV) {
    const result = await one(loader);
    total += result.seconds;
    all.push(...result.tx);
    allMaintenance.push(...result.maintenance);
  }
  out(`all: ${total.toFixed(0)} s (${(all.reduce((a, b) => a + b, 0) / 1000).toFixed(0)} s in write tx); tx ${all.length}: p95 ${ms(quantile(all, 0.95))}, max ${ms(Math.max(0, ...all))}, at 5 s or more: ${all.filter((x) => x >= 5000).length}`);
  out(`maintenance writes ${allMaintenance.length}: p95 ${ms(quantile(allMaintenance, 0.95))}, max ${ms(Math.max(0, ...allMaintenance))}, at 5 s or more: ${allMaintenance.filter((x) => x >= 5000).length}`);

  const register = LV.find((l) => l.meta.id === "lv-ur-register");
  if (register) {
    rehash = true;
    await one(register, "lv-ur-register (same rows, new file hash)");
  }
  store.close();
  closed = true;
  const size = readdirSync(dataDir).reduce((n, f) => n + statSync(join(dataDir, f)).size, 0);
  out(`store ${mb(size)} MB`);
} finally {
  cleanUp();
}
