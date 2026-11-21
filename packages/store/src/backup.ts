// Backups of the user file (architecture §16, LAW-BACKUP-RETENTION): only the backed-up tables,
// only their listed columns, with legal's filters applied, three kept. Main-store and share-alike
// tables are derivable and never copied; the two logs are never copied. S12 adds the schedule,
// the size budget, pruning of deletions and the repair path.
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ITEMS } from "@finora/domain";
import { BACKUP_CLASSES } from "./backup-classes.ts";

const PERSONAL_ITEMS = new Set<string>(ITEMS.filter((i) => i.personal).map((i) => i.id));
export const BACKUPS_KEPT = 3;

function companyOnly(db: DatabaseSync, eid: string): boolean {
  const row = db.prepare("SELECT natural_person FROM main.entities WHERE eid = ?").get(eid) as { natural_person: number } | undefined;
  return row !== undefined && row.natural_person === 0;
}

const FILTERS: Record<string, (db: DatabaseSync, row: Record<string, unknown>) => boolean> = {
  company_lines_only: (db, r) => r.personal === 0 && !PERSONAL_ITEMS.has(String(r.item_id)) && companyOnly(db, String(r.company_eid)),
  company_level_only: (db, r) => !PERSONAL_ITEMS.has(String(r.item_id)) && companyOnly(db, String(r.company_eid)),
  company_pairs_only: (db, r) => companyOnly(db, String(r.eid_a)) && companyOnly(db, String(r.eid_b)),
};

/** Writes one backup file and prunes to the newest three; returns its path and rows per table. */
export function writeBackup(db: DatabaseSync, dir: string, now: Date): { path: string; rows: Record<string, number> } {
  mkdirSync(dir, { recursive: true });
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const path = join(dir, `finora-user-${stamp}.db`);
  rmSync(path, { force: true });
  const out = new DatabaseSync(path);
  const rows: Record<string, number> = {};
  try {
    out.exec("BEGIN");
    for (const [table, cls] of Object.entries(BACKUP_CLASSES)) {
      if (cls.class !== "backed_up") continue;
      const name = table.split(".")[1] as string;
      out.exec(`CREATE TABLE ${name} (${cls.columns.map((c) => `"${c}"`).join(", ")})`);
      const insert = out.prepare(`INSERT INTO ${name} VALUES (${cls.columns.map(() => "?").join(", ")})`);
      const filter = cls.filter ? FILTERS[cls.filter] : undefined;
      if (cls.filter && !filter) throw new Error(`backup filter ${cls.filter} is not implemented`);
      let n = 0;
      for (const row of db.prepare(`SELECT ${cls.columns.map((c) => `"${c}"`).join(", ")} FROM ${table}`).all() as Record<string, unknown>[]) {
        if (filter && !filter(db, row)) continue;
        insert.run(...cls.columns.map((c) => row[c] as string | number | null));
        n++;
      }
      rows[table] = n;
    }
    out.exec("COMMIT");
  } finally {
    out.close();
  }
  const kept = readdirSync(dir).filter((f) => /^finora-user-.*\.db$/.test(f)).sort();
  for (const old of kept.slice(0, Math.max(0, kept.length - BACKUPS_KEPT))) rmSync(join(dir, old), { force: true });
  return { path, rows };
}
