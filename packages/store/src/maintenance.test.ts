// T1 on S05 (security re-check): two runners on one store. Runner A reads a kind's generation and
// works; runner B finishes the same kind and records it done; a new mark lands. A's late unmark must
// leave the new mark owed. Before the fix, B deleted the row, the new mark restarted at generation 1,
// and A's "delete where gen = 1" cleared it.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { maintenanceDue, markMaintenance, runMaintenance, type MaintenanceKind } from "./maintenance.ts";
import { migrate, MIGRATIONS } from "./migrations.ts";
import { openStore } from "./open.ts";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function twoRunners() {
  dir = mkdtempSync(join(tmpdir(), "finora-maint-"));
  const a = openStore({ dataDir: dir });
  const b = openStore({ dataDir: dir });
  return { a, b, close: () => (a.close(), b.close()) };
}

describe("maintenance marks never repeat a generation (T1)", () => {
  it.each<MaintenanceKind>(["fts_merge", "wal_truncate"])("keeps a %s mark set after another runner finished the old one", (kind) => {
    const { a, b, close } = twoRunners();
    try {
      // Start from nothing owed (a fresh store owes a TRUNCATE from its migrations), so A reads the
      // first generation of a new mark: the case where a restarted generation would collide.
      runMaintenance(a.db);
      expect(maintenanceDue(a.db)).toEqual([]);
      markMaintenance(a.db, kind);
      let interleaved = false;
      runMaintenance(a.db, {
        beforeUnmark: (k) => {
          if (k !== kind || interleaved) return;
          interleaved = true;
          // Runner B finishes the same generation, then a new write marks the kind again.
          runMaintenance(b.db);
          expect(maintenanceDue(b.db)).not.toContain(kind);
          markMaintenance(b.db, kind);
        },
      });
      expect(interleaved).toBe(true);
      // A's unmark of the generation it read leaves the newer mark owed, on either connection.
      expect(maintenanceDue(a.db)).toContain(kind);
      expect(maintenanceDue(b.db)).toContain(kind);
      // The next run does it, and then nothing of that kind is owed.
      runMaintenance(a.db);
      expect(maintenanceDue(a.db)).not.toContain(kind);
    } finally {
      close();
    }
  });

  it("clears a kind when no one marked it again, and a mark after that is owed again", () => {
    const { a, close } = twoRunners();
    try {
      markMaintenance(a.db, "fts_merge");
      runMaintenance(a.db);
      expect(maintenanceDue(a.db)).toEqual([]);
      markMaintenance(a.db, "wal_truncate");
      expect(maintenanceDue(a.db)).toEqual(["wal_truncate"]);
    } finally {
      close();
    }
  });

  it("keeps every mark an older store owed: the migration starts done at 0", () => {
    const db = new DatabaseSync(":memory:");
    try {
      const main = MIGRATIONS.filter((m) => m.target === "main");
      // A store before T1: the generation column, no done column, two kinds owed.
      migrate(db, { main: main.findIndex((m) => m.name === "maintenance done generation") }, ["main"]);
      db.exec("INSERT INTO main.maintenance_due (kind, gen) VALUES ('fts_merge', 3) ON CONFLICT (kind) DO UPDATE SET gen = 3");
      migrate(db, undefined, ["main"]);
      expect(maintenanceDue(db)).toEqual(["fts_merge", "wal_truncate"]);
    } finally {
      db.close();
    }
  });
});
