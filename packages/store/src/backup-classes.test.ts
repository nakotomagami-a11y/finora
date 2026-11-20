import { describe, expect, it } from "vitest";
import { BACKUP_CLASSES, BACKUP_FILTERS } from "./backup-classes.ts";
import { memoryStore } from "./test-helpers.ts";

const FTS_SHADOW = /_(?:data|idx|docsize|config|content)$/;

function liveTables(): Map<string, string[]> {
  const { db } = memoryStore();
  const tables = new Map<string, string[]>();
  for (const schema of ["main", "user", "sa"]) {
    for (const { name } of db
      .prepare(`SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all() as { name: string }[]) {
      if (FTS_SHADOW.test(name)) continue;
      const columns = (db.prepare(`PRAGMA ${schema}.table_info(${name})`).all() as { name: string }[]).map((c) => c.name);
      tables.set(`${schema}.${name}`, columns);
    }
  }
  return tables;
}

describe("backup classes (LAW-BACKUP-RETENTION)", () => {
  it("classify every table, and name no table that does not exist", () => {
    expect(Object.keys(BACKUP_CLASSES).sort()).toEqual([...liveTables().keys()].sort());
  });

  it("list every column of a backed-up table, so a new column cannot join a backup unnoticed", () => {
    const tables = liveTables();
    for (const [table, cls] of Object.entries(BACKUP_CLASSES)) {
      if (cls.class !== "backed_up") continue;
      expect([...cls.columns].sort(), table).toEqual([...(tables.get(table) ?? [])].sort());
    }
  });

  it("back up no main-store or share-alike table: they are re-derived from the sources", () => {
    for (const [table, cls] of Object.entries(BACKUP_CLASSES)) {
      if (!table.startsWith("user.")) expect(cls.class, table).not.toBe("backed_up");
    }
  });

  it("apply each filter legal set, by name", () => {
    expect(Object.keys(BACKUP_FILTERS).sort()).toEqual(["company_level_only", "company_lines_only", "company_pairs_only"]);
    const filterOf = (table: string) => {
      const cls = BACKUP_CLASSES[table];
      return cls?.class === "backed_up" ? cls.filter : undefined;
    };
    expect(filterOf("user.disputes")).toBe("company_lines_only");
    expect(filterOf("user.suppressions")).toBe("company_level_only");
    expect(filterOf("user.judgements")).toBe("company_pairs_only");
    expect(filterOf("user.purpose_log")).toBeNull();
    expect(filterOf("user.settings")).toBeNull();
  });
});
