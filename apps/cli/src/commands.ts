// `finora-cli` commands (S04f): data sync, data status, search, show, doctor, backup. Each writes
// plain lines through `out` and returns an exit code, so tests run them without a process. No
// command prints a person row, a personal code or an internal hash (PS5).
import { existsSync, readdirSync, statfsSync, statSync } from "node:fs";
import { join } from "node:path";
import { isInternalEid, naturalPersonCaption } from "@finora/domain";
import { FIXTURE_PROFILE } from "@finora/fixtures";
import { runSyncsInWorker, type SyncReport } from "@finora/ingest";
import { LOADERS } from "@finora/sources";
import { companyValues, openStore, searchCompanies, sourceRefForStatement, writeBackup, type Store } from "@finora/store";
import type { CliEnv } from "./env.ts";

export type Io = { env: CliEnv; out: (line: string) => void; now?: () => Date };

const COMPANY_PARTY_TYPES = ["LEGAL_ENTITY", "FOREIGN_ENTITY", "J"];
const SYNC_WORKER = new URL("./sync-worker.ts", import.meta.url);

function withStore<T>(io: Io, fn: (store: Store) => T): T {
  const store = openStore({ dataDir: io.env.dataDir });
  try {
    return fn(store);
  } finally {
    store.close();
  }
}

const dropsLine = (dropped: Record<string, number>) =>
  Object.keys(dropped).length === 0 ? "none" : Object.entries(dropped).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k} ${v}`).join(", ");

/** `data sync [source] --profile fixtures|core [--allow-mass-purge]`: every sync in its own worker. */
export async function dataSync(io: Io, args: { profile: string; source?: string; allowMassPurge?: boolean }): Promise<number> {
  if (args.profile === "core") {
    if (LOADERS.length === 0) {
      io.out("core profile: no loader ships yet (the loader slices add them)");
      return 0;
    }
    io.out("core profile: loaders run through the app's scheduler from S12 on");
    return 1;
  }
  if (args.profile !== "fixtures") {
    io.out(`unknown profile "${args.profile}" (fixtures or core)`);
    return 2;
  }
  withStore(io, () => undefined);
  const chosen = FIXTURE_PROFILE.filter((p) => !args.source || p.loader.meta.id === args.source);
  if (chosen.length === 0) {
    io.out(`no fixture source "${args.source}"`);
    return 2;
  }
  let failed = 0;
  // One worker runs every chosen source in order, each under its own lease (see ingest/worker.ts).
  const outcomes = await runSyncsInWorker(SYNC_WORKER, {
    dataDir: io.env.dataDir,
    sourceIds: chosen.map((p) => p.loader.meta.id),
    userAgent: io.env.secUserAgent ?? "Finora (fixtures)",
    options: {
      shareAlikeMode: io.env.shareAlikeMode,
      allowMassPurge: args.allowMassPurge === true,
      rawCacheDir: join(io.env.dataDir, "raw"),
      companyPartyTypes: COMPANY_PARTY_TYPES,
    },
  });
  for (const [i, { loader }] of chosen.entries()) {
    const outcome = outcomes[i]!;
    if (outcome.kind === "failed" || outcome.kind === "partial") failed++;
    const r = outcome.report;
    io.out(`${loader.meta.id}: ${outcome.kind}${r ? `, read ${r.read}, written ${r.written}, unchanged ${r.unchanged}, deleted ${r.deleted}, dropped ${dropsLine(r.dropped)}` : ""}`);
  }
  // P10 memory budget: the peak of this process, which ran every sync worker above (cto on S04i).
  io.out(`peak RSS: ${(process.resourceUsage().maxRSS / 1024).toFixed(0)} MB`);
  return failed === 0 ? 0 : 1;
}

/** `data status`: each source's latest sync and its report, drops by reason. */
export function dataStatus(io: Io): number {
  return withStore(io, ({ db }) => {
    const sources = db.prepare("SELECT id, storage FROM main.sources ORDER BY id").all() as { id: string; storage: string }[];
    if (sources.length === 0) {
      io.out("no source has synced yet: run `finora-cli data sync --profile fixtures`");
      return 0;
    }
    for (const source of sources) {
      const last = db
        .prepare("SELECT kind, finished_at, upstream_as_of, report_json FROM main.syncs WHERE source_id = ? ORDER BY id DESC LIMIT 1")
        .get(source.id) as { kind: string; finished_at: string | null; upstream_as_of: string | null; report_json: string | null } | undefined;
      if (!last) continue;
      // An unchanged sync writes nothing, so the counts and drops in force are the last content sync's.
      const content = db
        .prepare("SELECT report_json FROM main.syncs WHERE source_id = ? AND kind = 'content' ORDER BY id DESC LIMIT 1")
        .get(source.id) as { report_json: string | null } | undefined;
      const json = last.kind === "unchanged" ? (content?.report_json ?? null) : last.report_json;
      const report = json ? (JSON.parse(json) as Partial<SyncReport>) : {};
      const records = (db.prepare("SELECT COUNT(*) AS n FROM main.records WHERE source_id = ?").get(source.id) as { n: number }).n;
      io.out(`${source.id} [${source.storage}] ${last.kind} at ${last.finished_at ?? "-"}, as of ${last.upstream_as_of ?? "-"}, ${records} records`);
      io.out(`  read ${report.read ?? 0}, written ${report.written ?? 0}, unchanged ${report.unchanged ?? 0}, deleted ${report.deleted ?? 0}${report.reason ? `, reason ${report.reason}` : ""}`);
      io.out(`  dropped: ${dropsLine(report.dropped ?? {})}`);
      const skipped = report.skipped ?? {};
      if (Object.keys(skipped).length > 0) io.out(`  skipped: ${dropsLine(skipped)}`);
    }
    return 0;
  });
}

/** `search <query>`: companies only, ranked; natural persons appear by legal form and code. */
export function search(io: Io, query: string, country?: string): number {
  return withStore(io, ({ db }) => {
    const hits = searchCompanies(db, query, { limit: 20, ...(country ? { country } : {}) });
    if (hits.length === 0) io.out("no company found");
    for (const h of hits) io.out(`${h.match.padEnd(9)} ${h.country}  ${h.caption}  (${h.eid})`);
    return 0;
  });
}

/** `show <eid>`: a company's values with their source and licence; never a person row. */
export function show(io: Io, eid: string): number {
  if (isInternalEid(eid)) {
    io.out("person and relationship rows are never shown");
    return 2;
  }
  return withStore(io, ({ db }) => {
    const entity = db
      .prepare(
        `SELECT e.id, e.eid, e.caption, e.country, e.legal_form, e.status, e.code, e.natural_person, e.tombstone_since, s.name AS schema
         FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE e.eid = ?`,
      )
      .get(eid) as
      | { id: number; eid: string; caption: string; country: string; legal_form: string | null; status: string | null; code: string | null; natural_person: number; tombstone_since: string | null; schema: string }
      | undefined;
    if (!entity || entity.schema === "Person") {
      io.out(`no company ${eid}`);
      return 1;
    }
    if (entity.natural_person === 1) {
      // L3, P6: a sole trader is titled by legal form and code; its details sit behind the purpose gate.
      io.out(`${naturalPersonCaption({ legalForm: entity.legal_form, code: entity.code ?? "" })} (${entity.eid})`);
      io.out("A natural person: facts only, behind a stated purpose. Open it in the app.");
      return 0;
    }
    io.out(`${entity.caption} (${entity.eid})`);
    io.out(`  ${entity.country}, ${entity.legal_form ?? "form unknown"}, ${entity.status ?? "status unknown"}${entity.tombstone_since ? `, not in the register's open data since ${entity.tombstone_since}` : ""}`);
    // L5: suppressed items stay hidden here too (qa F1 on S04f).
    const { values, hiddenItems } = companyValues(db, entity.eid) ?? { values: [], hiddenItems: [] };
    for (const row of values) {
      const ref = sourceRefForStatement(db, row.statementId);
      io.out(`  ${row.prop}: ${row.value}  [${ref.sourceId}, ${ref.licenceId}, retrieved ${ref.retrievedAt.slice(0, 10)}]`);
    }
    for (const itemId of hiddenItems) io.out(`  ${itemId}: hidden at your request`);
    for (const w of db
      .prepare("SELECT p.name AS prop FROM main.withheld w JOIN main.props p ON p.id = w.prop_id WHERE w.entity_id = ?")
      .all(entity.id) as { prop: string }[]) {
      io.out(`  ${w.prop}: not loaded`);
    }
    const people = (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE p.name = 'organization' AND st.value = ?`,
        )
        .get(entity.eid) as { n: number }
    ).n;
    if (people > 0) io.out(`  people: ${people} role lines, shown in the app after you state a purpose`);
    return 0;
  });
}

/** `doctor`: free disk, an integrity check of each store file, leases, the logs, the raw cache. */
export function doctor(io: Io): number {
  return withStore(io, ({ db }) => {
    let problems = 0;
    const fs = statfsSync(io.env.dataDir);
    const freeGb = (fs.bavail * fs.bsize) / 1024 ** 3;
    io.out(`disk: ${freeGb.toFixed(1)} GB free at ${io.env.dataDir}${freeGb < 15 ? " (under the 15 GB the core load needs)" : ""}`);
    for (const schema of ["main", "user", "sa"]) {
      const result = (db.prepare(`PRAGMA ${schema}.quick_check`).all() as { quick_check: string }[]).map((r) => r.quick_check);
      const ok = result.length === 1 && result[0] === "ok";
      if (!ok) problems++;
      io.out(`quick_check ${schema}: ${ok ? "ok" : result.slice(0, 3).join("; ")}`);
    }
    const now = (io.now ?? (() => new Date()))().getTime();
    const leases = db.prepare("SELECT resource, holder, expires_at FROM main.leases ORDER BY resource").all() as { resource: string; holder: string; expires_at: number }[];
    if (leases.length === 0) io.out("leases: none held");
    for (const l of leases) io.out(`lease ${l.resource}: ${l.holder}, ${l.expires_at > now ? "live" : "expired"}`);
    for (const log of ["deletions.log", "restrictions.log"]) {
      const present = existsSync(join(io.env.dataDir, log));
      if (!present) problems++;
      io.out(`${log}: ${present ? "present" : "MISSING (repairs refuse until it is restored)"}`);
    }
    const raw = join(io.env.dataDir, "raw");
    let size = 0;
    if (existsSync(raw)) {
      for (const f of readdirSync(raw, { recursive: true })) {
        const stat = statSync(join(raw, String(f)));
        if (stat.isFile()) size += stat.size;
      }
    }
    io.out(`raw cache: ${(size / 1024 ** 2).toFixed(1)} MB`);
    return problems === 0 ? 0 : 1;
  });
}

/** `backup`: the user file's backed-up tables with legal's filters; three kept. */
export function backup(io: Io): number {
  return withStore(io, ({ db }) => {
    const { path, rows } = writeBackup(db, join(io.env.dataDir, "backups"), (io.now ?? (() => new Date()))());
    io.out(`backup: ${path}`);
    for (const [table, n] of Object.entries(rows)) io.out(`  ${table}: ${n} rows`);
    return 0;
  });
}
