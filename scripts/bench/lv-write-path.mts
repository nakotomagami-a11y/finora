// S05 write-path bench (not run in CI). The real LV loaders through the real `runSync` on a sync
// connection (`openStore({ sync: true })`, as the worker opens it), fed from local copies of the
// data.gov.lv files through each loader's own fetch (`toFile`), so the download is left out. For
// each source: time, records, statement writes, the write transactions (BEGIN..COMMIT: count, sum,
// p50, p95, max) and the heap, external and RSS peaks. Then target 5: the register again with the
// same rows under a new file hash. Counts and timings only; no value is ever printed.
//
// Get the files once (open data, CC0): `python -I research/probes/baltics/lv/01_ckan_download.py <cache>`
// writes `<cache>/raw/<dataset>/<file>.csv`. Then, from the repo root, on a fresh run:
//   node --expose-gc scripts/bench/lv-write-path.mts --raw <cache>/raw [--work <dir>] [source ids...]
// The store goes to a fresh temp dir and is removed at the end. Record the printed commit, the
// command and the machine with any figure you keep (docs/plan/benchmarks.md).
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSync } from "../../packages/ingest/src/index.ts";
import { loadersFor } from "../../packages/sources/src/index.ts";
import { openStore } from "../../packages/store/src/index.ts";

/** The bench prints its figures to stdout. */
const out = (line: string) => void process.stdout.write(`${line}
`);
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const value = args[i + 1];
  args.splice(i, 2);
  return value ?? null;
};
const raw = option("--raw");
const workBase = option("--work") ?? tmpdir();
if (!raw || !existsSync(raw)) {
  console.error("usage: node --expose-gc scripts/bench/lv-write-path.mts --raw <cache>/raw [--work <dir>] [source ids...]");
  process.exit(2);
}
const only = new Set(args);
const LV = loadersFor({ lvPersonRows: "names_no_id" }).filter((l) => l.meta.country === "lv" && l.meta.id.startsWith("lv-") && (only.size === 0 || only.has(l.meta.id)));
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();
out(`commit ${commit}, node ${process.version}, ${LV.length} sources, gc ${typeof globalThis.gc === "function" ? "on" : "off (pass --expose-gc)"}`);

const mb = (n: number) => Math.round(n / 2 ** 20);
const dataDir = mkdtempSync(join(workBase, "finora-bench-store-"));
const store = openStore({ dataDir, sync: true });
const db = store.db;

// Write transactions, timed from outside the product code.
let txStart = 0;
let tx: number[] = [];
const exec = db.exec.bind(db);
(db as unknown as { exec: (sql: string) => void }).exec = (sql: string) => {
  if (/^\s*BEGIN/i.test(sql)) txStart = performance.now();
  exec(sql);
  if (/^\s*(COMMIT|ROLLBACK)/i.test(sql) && txStart) {
    tx.push(performance.now() - txStart);
    txStart = 0;
  }
};

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

async function one(loader: (typeof LV)[number], label = loader.meta.id): Promise<{ seconds: number; tx: number[] }> {
  tx = [];
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
      `heap ${mb(heap)} MB, external ${mb(ext)} MB, rss ${mb(rss)} MB`,
  );
  return { seconds, tx: [...tx] };
}

const all: number[] = [];
let total = 0;
for (const loader of LV) {
  const { seconds, tx: t } = await one(loader);
  total += seconds;
  all.push(...t);
}
out(`all: ${total.toFixed(0)} s (${(all.reduce((a, b) => a + b, 0) / 1000).toFixed(0)} s in write tx); tx ${all.length}: p95 ${ms(quantile(all, 0.95))}, max ${ms(Math.max(0, ...all))}, at 5 s or more: ${all.filter((x) => x >= 5000).length}`);

const register = LV.find((l) => l.meta.id === "lv-ur-register");
if (register) {
  rehash = true;
  await one(register, "lv-ur-register (same rows, new file hash)");
}
store.close();
const size = readdirSync(dataDir).reduce((n, f) => n + statSync(join(dataDir, f)).size, 0);
out(`store ${mb(size)} MB`);
rmSync(dataDir, { recursive: true, force: true });
