// People exist only inside one company (architecture §3.3, PS2). A company's role lines are its
// Directorship and Membership rows; every query here starts from the company's eid, and no
// function takes a person id, so no call can join a person across companies.
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type RoleLine = {
  sourceId: string;
  itemId: string;
  name: string | null;
  role: string | null;
  startDate: string | null;
  /** Internal only (PS5): never output, logged or exported. */
  hash: string;
  hidden: "disputed" | "suppressed" | null;
};

/** Content hash of a line, the stable target of a dispute across role-set reloads (R10, qa M1). */
export function lineHash(line: { sourceId: string; itemId: string; name: string | null; role: string | null; startDate: string | null }): string {
  return createHash("sha256")
    .update(JSON.stringify([line.sourceId, line.itemId, line.name, line.role, line.startDate]))
    .digest("hex");
}

export function companyRoleLines(db: DatabaseSync, companyEid: string, itemIds: readonly string[]): RoleLine[] {
  if (itemIds.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT rel.entity_id AS rel_id, r.source_id, i.name AS item_id,
         (SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = rel.entity_id AND p.name = 'role') AS role,
         (SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = rel.entity_id AND p.name = 'startDate') AS start_date,
         (SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = rel.entity_id AND p.name IN ('director', 'member')) AS person_eid
       FROM main.statements rel
       JOIN main.props rp ON rp.id = rel.prop_id AND rp.name = 'organization'
       JOIN main.items i ON i.id = rel.item_id
       JOIN main.records r ON r.id = rel.record_id
       WHERE rel.value = ? AND i.name IN (${itemIds.map(() => "?").join(", ")})
       ORDER BY r.id, rel.line, rel.entity_id`,
    )
    .all(companyEid, ...itemIds) as { rel_id: number; source_id: string; item_id: string; role: string | null; start_date: string | null; person_eid: string | null }[];

  const nameOf = db.prepare(
    `SELECT st.value FROM main.entities e JOIN main.statements st ON st.entity_id = e.id
     JOIN main.props p ON p.id = st.prop_id WHERE e.eid = ? AND p.name = 'name' LIMIT 1`,
  );
  const disputed = new Set(
    (
      db
        .prepare("SELECT line_hash FROM user.disputes WHERE company_eid = ? AND status = 'open'")
        .all(companyEid) as { line_hash: string }[]
    ).map((r) => r.line_hash),
  );
  const suppressed = new Set(
    (db.prepare("SELECT item_id FROM user.suppressions WHERE company_eid = ?").all(companyEid) as { item_id: string }[]).map(
      (r) => r.item_id,
    ),
  );

  return rows.map((row) => {
    const name = row.person_eid ? ((nameOf.get(row.person_eid) as { value: string } | undefined)?.value ?? null) : null;
    const base = { sourceId: row.source_id, itemId: row.item_id, name, role: row.role, startDate: row.start_date };
    const hash = lineHash(base);
    const hidden = suppressed.has(row.item_id) ? "suppressed" : disputed.has(hash) ? "disputed" : null;
    return { ...base, hash, hidden };
  });
}
