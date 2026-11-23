// U3 on S05 (security re-check): the LV short-form switch fails closed and survives a backup. It
// reads as off unless its value is "0", and it lives in user.settings, a table backups keep.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BACKUP_CLASSES } from "./backup-classes.ts";
import { lvShortFormsOff, setLvShortFormsOff } from "./ingest-support.ts";
import { openStore } from "./open.ts";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("the LV short-form switch (U3)", () => {
  it("is on in a fresh store, and reads as off when its row is lost or garbled", () => {
    dir = mkdtempSync(join(tmpdir(), "finora-sf-"));
    const { db, close } = openStore({ dataDir: dir });
    try {
      expect(lvShortFormsOff(db)).toBe(false);
      db.prepare("DELETE FROM user.settings WHERE key = 'lv_short_forms_off'").run();
      expect(lvShortFormsOff(db)).toBe(true);
      db.prepare("INSERT INTO user.settings (key, value) VALUES ('lv_short_forms_off', 'yes')").run();
      expect(lvShortFormsOff(db)).toBe(true);
      setLvShortFormsOff(db, false);
      expect(lvShortFormsOff(db)).toBe(false);
      setLvShortFormsOff(db, true);
      expect(lvShortFormsOff(db)).toBe(true);
    } finally {
      close();
    }
  });

  it("honours a trip recorded before U3 in main.store_meta, until the switch is turned on", () => {
    dir = mkdtempSync(join(tmpdir(), "finora-sf-"));
    const { db, close } = openStore({ dataDir: dir });
    try {
      db.prepare("INSERT INTO main.store_meta (key, value) VALUES ('lv_short_forms_off', '1')").run();
      expect(lvShortFormsOff(db)).toBe(true);
      setLvShortFormsOff(db, false);
      expect(lvShortFormsOff(db)).toBe(false);
    } finally {
      close();
    }
  });

  it("lives in a table that backups keep", () => {
    expect(BACKUP_CLASSES["user.settings"]).toMatchObject({ class: "backed_up", columns: ["key", "value"] });
  });
});
