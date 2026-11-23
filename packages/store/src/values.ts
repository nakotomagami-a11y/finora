// A company's stored values as every surface reads them (L5): an item suppressed for the company is
// left out, on the CLI, the API and MCP alike. Takes a company eid only; never a person row (PS2).
import type { DatabaseSync } from "node:sqlite";

export type CompanyValue = { statementId: number; prop: string; value: string; itemId: string };

export function companyValues(db: DatabaseSync, companyEid: string): { values: CompanyValue[]; hiddenItems: string[] } | null {
  const entity = db
    .prepare("SELECT e.id FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE e.eid = ? AND s.name <> 'Person'")
    .get(companyEid) as { id: number } | undefined;
  if (!entity) return null;
  const suppressed = new Set(
    (db.prepare("SELECT item_id FROM user.suppressions WHERE company_eid = ?").all(companyEid) as { item_id: string }[]).map((r) => r.item_id),
  );
  const rows = db
    .prepare(
      `SELECT st.id, p.name AS prop, st.value, i.name AS item_id FROM main.statements st
       JOIN main.props p ON p.id = st.prop_id JOIN main.items i ON i.id = st.item_id
       WHERE st.entity_id = ? ORDER BY p.name, st.id`,
    )
    .all(entity.id) as { id: number; prop: string; value: string; item_id: string }[];
  const hidden = new Set<string>();
  const values: CompanyValue[] = [];
  for (const r of rows) {
    if (suppressed.has(r.item_id)) hidden.add(r.item_id);
    else values.push({ statementId: r.id, prop: r.prop, value: r.value, itemId: r.item_id });
  }
  return { values, hiddenItems: [...hidden].sort() };
}
