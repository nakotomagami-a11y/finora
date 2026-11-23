// People exist only inside one company (architecture §3.3, PS2). A company's role lines are its
// Directorship and Membership rows; every query here starts from the company's eid, and no
// function takes a person id, so no call can join a person across companies.
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { RestrictionEntry } from "./restrictions-log.ts";

/**
 * What a dispute or restriction points at. A person's line is targeted by the source's own
 * row-local id, or by its role where the source has none (US people sources); only a company's
 * line (a corporate officer or member) has a content hash. No hash of a person's line exists
 * anywhere (council session 2 addendum 5, legal on S04a Q-3).
 */
export type LineTarget = { kind: "row"; rowId: string } | { kind: "role"; role: string } | { kind: "hash"; hash: string };

export type RoleLine = {
  sourceId: string;
  itemId: string;
  name: string | null;
  role: string | null;
  startDate: string | null;
  /** The line names a natural person. */
  personal: boolean;
  /** Internal only (PS5): never output, logged or exported. */
  target: LineTarget;
  hidden: "disputed" | "suppressed" | null;
};

/** Content hash of a company's line, the stable target of a dispute across role-set reloads (R10, qa M1). */
export function lineHash(line: { sourceId: string; itemId: string; name: string | null; role: string | null; startDate: string | null }): string {
  return createHash("sha256")
    .update(JSON.stringify([line.sourceId, line.itemId, line.name, line.role, line.startDate]))
    .digest("hex");
}

type Hide = { itemId: string; rowId?: string; role?: string; reason: "dispute" | "suppression" };

function personHides(db: DatabaseSync, companyEid: string, restrictions: readonly RestrictionEntry[]): Hide[] {
  const hides: Hide[] = restrictions
    .filter((r) => r.companyEid === companyEid)
    .map((r) => ({
      itemId: r.itemId,
      reason: r.reason,
      ...(r.sourceRowId !== undefined ? { rowId: r.sourceRowId } : {}),
      ...(r.role !== undefined ? { role: r.role } : {}),
    }));
  for (const d of db
    .prepare("SELECT item_id, source_row_id, role FROM user.disputes WHERE company_eid = ? AND status = 'open' AND personal = 1")
    .all(companyEid) as { item_id: string; source_row_id: string | null; role: string | null }[]) {
    hides.push({
      itemId: d.item_id,
      reason: "dispute",
      ...(d.source_row_id !== null ? { rowId: d.source_row_id } : {}),
      ...(d.role !== null ? { role: d.role } : {}),
    });
  }
  return hides;
}

/**
 * A company's role lines for the given items, each marked hidden where a suppression, an open
 * dispute or an active restriction covers it. `restrictions` is `RestrictionsLog.active()`.
 */
export function companyRoleLines(
  db: DatabaseSync,
  companyEid: string,
  itemIds: readonly string[],
  restrictions: readonly RestrictionEntry[] = [],
): RoleLine[] {
  if (itemIds.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT rel.entity_id AS rel_id, rel.line, r.source_id, r.line_ids, i.name AS item_id,
         (SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = rel.entity_id AND p.name = 'role') AS role,
         (SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = rel.entity_id AND p.name = 'startDate') AS start_date,
         (SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = rel.entity_id AND p.name IN ('director', 'member')) AS party_eid
       FROM main.statements rel
       JOIN main.props rp ON rp.id = rel.prop_id AND rp.name = 'organization'
       JOIN main.items i ON i.id = rel.item_id
       JOIN main.records r ON r.id = rel.record_id
       WHERE rel.value = ? AND i.name IN (${itemIds.map(() => "?").join(", ")})
       ORDER BY r.id, rel.line, rel.entity_id`,
    )
    .all(companyEid, ...itemIds) as {
    rel_id: number;
    line: number | null;
    source_id: string;
    line_ids: string | null;
    item_id: string;
    role: string | null;
    start_date: string | null;
    party_eid: string | null;
  }[];

  const party = db.prepare(
    `SELECT e.natural_person,
       (SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = e.id AND p.name = 'name' LIMIT 1) AS name
     FROM main.entities e WHERE e.eid = ?`,
  );
  const disputedHashes = new Set(
    (
      db
        .prepare("SELECT line_hash FROM user.disputes WHERE company_eid = ? AND status = 'open' AND line_hash IS NOT NULL")
        .all(companyEid) as { line_hash: string }[]
    ).map((r) => r.line_hash),
  );
  const suppressedItems = new Set(
    (db.prepare("SELECT item_id FROM user.suppressions WHERE company_eid = ?").all(companyEid) as { item_id: string }[]).map((r) => r.item_id),
  );
  const hides = personHides(db, companyEid, restrictions);

  return rows.map((row) => {
    const who = row.party_eid ? (party.get(row.party_eid) as { natural_person: number; name: string | null } | undefined) : undefined;
    // A party we cannot see is treated as a person, so a gap can only over-protect.
    const personal = who === undefined || who.natural_person === 1;
    const base = { sourceId: row.source_id, itemId: row.item_id, name: who?.name ?? null, role: row.role, startDate: row.start_date };
    const lineIds = row.line_ids ? (JSON.parse(row.line_ids) as (string | null)[]) : [];
    const rowId = row.line !== null ? (lineIds[row.line] ?? null) : null;
    const target: LineTarget = !personal
      ? { kind: "hash", hash: lineHash(base) }
      : rowId !== null
        ? { kind: "row", rowId }
        : { kind: "role", role: row.role ?? "" };

    let hidden: RoleLine["hidden"] = suppressedItems.has(row.item_id) ? "suppressed" : null;
    if (hidden === null && target.kind === "hash" && disputedHashes.has(target.hash)) hidden = "disputed";
    if (hidden === null && personal) {
      const hits = hides.filter(
        (h) => h.itemId === row.item_id && ((h.rowId !== undefined && h.rowId === rowId) || (h.role !== undefined && h.role === row.role)),
      );
      if (hits.some((h) => h.reason === "suppression")) hidden = "suppressed";
      else if (hits.length > 0) hidden = "disputed";
    }
    return { ...base, personal, target, hidden };
  });
}
