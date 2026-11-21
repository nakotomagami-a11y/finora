import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openStore } from "./open.ts";
import { RestrictionsLog, type RestrictionEntry } from "./restrictions-log.ts";
import { personalCodeSamples, tempDir } from "./test-helpers.ts";

const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));
const newLog = () => {
  const d = tempDir();
  dirs.push(d);
  return new RestrictionsLog(join(d.path, "restrictions.log"));
};

const LV: RestrictionEntry = { op: "suppress", reason: "suppression", companyEid: "lv-00000000001", itemId: "S03.LV.01", sourceRowId: "4711", at: "2026-11-20T00:00:00.000Z" };
const US: RestrictionEntry = { op: "suppress", reason: "dispute", companyEid: "us-ct-FX0001", itemId: "S03.US.03", role: "principal", at: "2026-11-20T00:00:00.000Z" };

describe("restrictions.log", () => {
  it("keeps a line restriction by source row id and a US one by role", () => {
    const log = newLog();
    log.append(LV);
    log.append(US);
    expect(log.active()).toEqual([LV, US]);
  });

  it("holds no hash, name or code", () => {
    const log = newLog();
    log.append(LV);
    log.append(US);
    const text = readFileSync(log.path, "utf8");
    expect(text).not.toMatch(/[0-9a-f]{32,}/);
    for (const line of text.trim().split("\n")) {
      expect(Object.keys(JSON.parse(line) as object).sort()).toEqual(
        expect.arrayContaining(["at", "companyEid", "itemId", "op"]),
      );
      expect(Object.keys(JSON.parse(line) as object).length).toBe(6);
    }

    const bad: Record<string, unknown>[] = [
      { ...LV, lineHash: "ab".repeat(32) },
      { ...LV, name: "Officer Alpha" },
      { ...LV, role: "board_member" },
      { ...LV, reason: "other" },
      { op: "suppress", companyEid: LV.companyEid, itemId: LV.itemId, at: LV.at },
      { ...LV, sourceRowId: "p-12-0" },
      ...Object.values(personalCodeSamples()).map((code) => ({ ...LV, sourceRowId: code })),
    ];
    for (const entry of bad) expect(() => log.append(entry as RestrictionEntry), JSON.stringify(Object.keys(entry))).toThrow();
    expect(readFileSync(log.path, "utf8")).toBe(text);
  });

  it("keeps a dispute and a suppression on one line apart", () => {
    const log = newLog();
    const dispute: RestrictionEntry = { ...LV, reason: "dispute" };
    log.append(LV);
    log.append(dispute);
    log.append({ ...dispute, op: "lift", at: "2026-11-21T00:00:00.000Z" });
    expect(log.active()).toEqual([LV]);
  });

  it("removes lifted entries on compaction", () => {
    const log = newLog();
    log.append(LV);
    log.append(US);
    log.append({ ...LV, op: "lift", at: "2026-11-21T00:00:00.000Z" });
    expect(log.active()).toEqual([US]);
    log.compact();
    const text = readFileSync(log.path, "utf8");
    expect(text).not.toContain("4711");
    expect(text).not.toContain('"lift"');
    expect(log.active()).toEqual([US]);
  });

  it("is created with a new store, and never re-created beside an existing one", () => {
    const d = tempDir();
    dirs.push(d);
    const first = openStore({ dataDir: d.path });
    expect(first.logs?.restrictions.active()).toEqual([]);
    expect(first.logs?.deletions.entries()).toEqual([]);
    first.close();
    rmSync(join(d.path, "restrictions.log"));
    const again = openStore({ dataDir: d.path });
    expect(() => again.logs?.restrictions.active()).toThrow();
    again.close();
  });

  it("fails closed: a missing or corrupt file throws, and so does a failed append", () => {
    const log = newLog();
    expect(() => log.active()).toThrow();
    writeFileSync(log.path, "{not json\n");
    expect(() => log.active()).toThrow();
    const unwritable = new RestrictionsLog(join(log.path, "..", "missing", "restrictions.log"));
    expect(() => unwritable.append(LV)).toThrow();
  });
});
