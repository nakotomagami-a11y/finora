// Shared set-up for the store tests. Every name and code here is fictional.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { balticCheckDigit } from "@finora/domain";
import { DeletionsLog } from "./deletions-log.ts";
import { openStore, type Store } from "./open.ts";
import { RestrictionsLog } from "./restrictions-log.ts";
import { beginSync, finishSync, upsertSource, writeRecord, type EntityInput } from "./registry.ts";

export function memoryStore(): Store {
  return openStore({ dataDir: null });
}

export function tempDir(): { path: string; remove(): void } {
  const path = mkdtempSync(join(tmpdir(), "finora-store-"));
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

export function contentSync(
  db: DatabaseSync,
  sourceId: string,
  startedAt: string,
  options: { licenceId?: string; kind?: "content" | "unchanged"; upstreamAsOf?: string } = {},
): number {
  upsertSource(db, { id: sourceId, storage: "store" }, startedAt);
  const id = beginSync(db, { sourceId, licenceId: options.licenceId ?? "cc0-1.0", storage: "store", parserVersion: "test", startedAt });
  finishSync(db, id, { kind: options.kind ?? "content", finishedAt: startedAt, ...(options.upstreamAsOf ? { upstreamAsOf: options.upstreamAsOf } : {}) });
  return id;
}

export function company(eid: string, name: string, extra: Partial<EntityInput> = {}): EntityInput {
  const code = eid.split("-").at(-1) ?? eid;
  return {
    eid,
    schema: "Company",
    country: eid.slice(0, 2),
    legalForm: "lv-sia",
    code,
    statements: [{ prop: "name", value: name, itemId: "S01.LV.01" }],
    ...extra,
  };
}

let personSeq = 0;

/** A company's role set: one Person and one Directorship per line, as a loader writes it. */
export function roleSetEntities(companyEid: string, lines: { name: string; role: string; startDate: string }[], itemId = "S03.LV.01"): EntityInput[] {
  const base = ++personSeq;
  return lines.flatMap((line, position) => {
    const person = `p-${base}-${position}`;
    return [
      { eid: person, schema: "Person", country: "lv", statements: [{ prop: "name", value: line.name, itemId, line: position }] },
      {
        eid: `rel-${base}-${position}`,
        schema: "Directorship",
        country: "lv",
        statements: [
          { prop: "organization", value: companyEid, itemId, line: position },
          { prop: "director", value: person, itemId, line: position },
          { prop: "role", value: line.role, itemId, line: position },
          { prop: "startDate", value: line.startDate, itemId, line: position },
        ],
      },
    ] satisfies EntityInput[];
  });
}

export type TestLine = { name: string; role: string; startDate: string; rowId?: string };

/** Writes a role set; lines with a `rowId` carry the source's row-local id, as LV and EE do. */
export function writeRoleSet(
  db: DatabaseSync,
  syncId: number,
  companyEid: string,
  lines: TestLine[],
  { sourceId = "lv-officers", itemId = "S03.LV.01" }: { sourceId?: string; itemId?: string } = {},
): void {
  writeRecord(db, {
    syncId,
    sourceId,
    recordKey: `${companyEid}:officers`,
    hashInput: lines.map((l) => `${l.rowId ?? ""}|${l.name}|${l.role}|${l.startDate}`),
    entities: roleSetEntities(companyEid, lines, itemId),
    lineIds: lines.map((l) => l.rowId ?? null),
  });
}

/** Both fail-closed logs in a fresh temp directory, created empty as a new store creates them. */
export function testLogs(): { deletions: DeletionsLog; restrictions: RestrictionsLog; dir: string; remove(): void } {
  const dir = tempDir();
  const deletions = join(dir.path, "deletions.log");
  const restrictions = join(dir.path, "restrictions.log");
  for (const path of [deletions, restrictions]) writeFileSync(path, "");
  return { deletions: new DeletionsLog(deletions), restrictions: new RestrictionsLog(restrictions), dir: dir.path, remove: dir.remove };
}

/**
 * Personal-code shapes for canary tests, built at run time so no code-shaped literal is ever
 * committed (the publish guard blocks those). The values are fictional.
 */
export function personalCodeSamples(): { eeLt: string; lv: string; ssn: string } {
  const base = ["3000", "1010", "00"].join("");
  return {
    eeLt: `${base}${balticCheckDigit(base)}`,
    lv: ["0101" + "00", "0" + "0000"].join("-"),
    ssn: ["000", "00", "0000"].join("-"),
  };
}

export function statementIdOf(db: DatabaseSync, eid: string, prop = "name"): number {
  const row = db
    .prepare(
      `SELECT st.id FROM main.statements st JOIN main.entities e ON e.id = st.entity_id
       JOIN main.props p ON p.id = st.prop_id WHERE e.eid = ? AND p.name = ?`,
    )
    .get(eid, prop) as { id: number } | undefined;
  if (!row) throw new Error(`no ${prop} on ${eid}`);
  return row.id;
}
