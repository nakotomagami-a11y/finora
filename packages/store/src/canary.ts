// P3, PS5: a scan of every stored value that can belong to a person, for personal codes, internal
// person ids and any fixture value a test plants. Company registration numbers and entity codes
// are not scanned (qa #20), and person row ids live only in entities.eid, by design.
import type { DatabaseSync } from "node:sqlite";
import { COMPANY_ID_PROPS, findPersonalCodes, PERSON_EID } from "@finora/domain";
import { STORE_SCHEMAS } from "./open.ts";

export type CanaryHit = { table: string; column: string; kind: string };

const FTS_SHADOW = /_(?:data|idx|docsize|config|content)$/;
const SKIP = new Set(["main.entities.eid", "main.entities.code"]);

function check(hits: CanaryHit[], table: string, column: string, value: string, needles: readonly string[]): void {
  for (const hit of findPersonalCodes(value)) hits.push({ table, column, kind: hit.kind });
  if (PERSON_EID.test(value)) hits.push({ table, column, kind: "person_eid" });
  for (const needle of needles) if (value.includes(needle)) hits.push({ table, column, kind: "needle" });
}

export function scanStore(db: DatabaseSync, needles: readonly string[] = []): CanaryHit[] {
  const hits: CanaryHit[] = [];
  for (const row of db
    .prepare(
      `SELECT st.value, p.name AS prop, s.name AS schema FROM main.statements st
       JOIN main.props p ON p.id = st.prop_id JOIN main.entities e ON e.id = st.entity_id
       JOIN main.schemas s ON s.id = e.schema_id`,
    )
    .all() as { value: string; prop: string; schema: string }[]) {
    if (row.schema !== "Person" && COMPANY_ID_PROPS.has(row.prop)) continue;
    // A relationship row names its person by internal id by design; that id never leaves the store.
    if (["director", "member", "owner"].includes(row.prop)) continue;
    check(hits, "main.statements", "value", row.value, needles);
  }
  for (const schema of STORE_SCHEMAS) {
    const tables = db
      .prepare(`SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .all() as { name: string }[];
    for (const { name } of tables) {
      const table = `${schema}.${name}`;
      if (FTS_SHADOW.test(name) || table === "main.statements") continue;
      for (const row of db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]) {
        for (const [column, value] of Object.entries(row)) {
          if (typeof value === "string" && !SKIP.has(`${table}.${column}`)) check(hits, table, column, value, needles);
        }
      }
    }
  }
  return hits;
}
