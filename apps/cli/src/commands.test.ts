import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "@finora/store";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backup, dataStatus, dataSync, doctor, search, show, type Io } from "./commands.ts";
import { loadCliEnv, repoRoot } from "./env.ts";

let dir: string;
let lines: string[];
const io = (): Io => {
  lines = [];
  return { env: { dataDir: dir, secUserAgent: null, shareAlikeMode: "store" }, out: (l) => void lines.push(l), now: () => new Date("2026-11-21T10:00:00.000Z") };
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "finora-cli-"));
  expect(await dataSync(io(), { profile: "fixtures" })).toBe(0);
}, 120_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("finora-cli (S04f)", () => {
  it("data sync loads every fixture source, and a second run is unchanged", async () => {
    expect(await dataSync(io(), { profile: "fixtures" })).toBe(0);
    expect(lines).toHaveLength(11);
    expect(lines.at(-1)).toMatch(/^peak RSS: \d+ MB$/);
    for (const line of lines.filter((l) => l.startsWith("fx-") && !l.startsWith("fx-lt-arrears"))) expect(line).toMatch(/: unchanged/);
    expect(await dataSync(io(), { profile: "fixtures", source: "fx-hide" })).toBe(0);
    expect(lines).toHaveLength(2);
    expect(await dataSync(io(), { profile: "nope" })).toBe(2);
  }, 120_000);

  it("data status shows each source's report with drops by reason (acceptance 3)", () => {
    expect(dataStatus(io())).toBe(0);
    const text = lines.join("\n");
    for (const id of ["fx-lv-register", "fx-ee-register", "fx-lt-register", "fx-us-register", "fx-lv-officers", "fx-ee-officers", "fx-financials", "fx-ee-tax", "fx-lt-arrears", "fx-hide"]) {
      expect(text).toContain(`${id} [`);
    }
    expect(text).toMatch(/fx-hide \[store\][^\n]*\n[^\n]*\n {2}dropped: hide_item 15/);
    expect(text).toMatch(/dropped: personal_code 1, sole_trader_address 20/);
  });

  it("search ranks companies from all four countries and never a person", () => {
    search(io(), "example compa");
    expect(new Set(lines.map((l) => l.split(/\s+/)[1]))).toEqual(new Set(["lv", "ee", "lt", "us"]));
    search(io(), "officer");
    expect(lines).toEqual(["no company found"]);
  });

  it("show prints a company's values with source and licence, refuses a person row, and titles a sole trader by form and code", () => {
    search(io(), "example company 1");
    const eid = /\((lv-\d{11})\)/.exec(lines.find((l) => l.includes("lv-")) ?? "")?.[1];
    expect(eid).toBeDefined();
    expect(show(io(), eid!)).toBe(0);
    expect(lines.join("\n")).toMatch(/name: Example Company \d+ .*\[fx-lv-register, cc0-1\.0, retrieved \d{4}-\d{2}-\d{2}\]/);
    expect(show(io(), "p-1-0")).toBe(2);
    expect(lines).toEqual(["person and relationship rows are never shown"]);

    const db = openStore({ dataDir: dir }).db;
    const sole = (db.prepare("SELECT eid FROM main.entities WHERE natural_person = 1 AND eid LIKE 'lv-%' LIMIT 1").get() as { eid: string }).eid;
    db.close();
    expect(show(io(), sole)).toBe(0);
    expect(lines[0]).toMatch(/^IK \d{11} \(lv-\d{11}\)$/);
    expect(lines.join("\n")).not.toMatch(/Sample Trader/);
  });

  it("doctor reports disk, quick_check and leases", () => {
    expect(doctor(io())).toBe(0);
    const text = lines.join("\n");
    expect(text).toMatch(/^disk: \d+\.\d GB free/m);
    expect(text).toContain("quick_check main: ok");
    expect(text).toContain("quick_check user: ok");
    expect(text).toContain("quick_check sa: ok");
    expect(text).toContain("leases: none held");
    expect(text).toContain("restrictions.log: present");
  });

  it("backup copies only allowlisted rows, applies the filters and keeps three files", () => {
    const db = openStore({ dataDir: dir }).db;
    const company = (db.prepare("SELECT eid FROM main.entities WHERE natural_person = 0 AND eid LIKE 'lv-%' LIMIT 1").get() as { eid: string }).eid;
    const sole = (db.prepare("SELECT eid FROM main.entities WHERE natural_person = 1 LIMIT 1").get() as { eid: string }).eid;
    db.prepare(
      "INSERT INTO user.disputes (company_eid, source_id, item_id, line_hash, personal, kind, status, opened_at) VALUES (?, 'fx-lv-register', 'S01.LV.01', 'h', 0, 'correction', 'open', 'x')",
    ).run(company);
    db.prepare(
      "INSERT INTO user.disputes (company_eid, source_id, item_id, source_row_id, personal, kind, status, opened_at) VALUES (?, 'fx-lv-officers', 'S03.LV.01', '1001', 1, 'objection', 'open', 'x')",
    ).run(company);
    db.prepare("INSERT INTO user.judgements (eid_a, eid_b, decision, by, at) VALUES (?, ?, 'different', 'human', 'x')").run(company, sole);
    db.close();

    for (let i = 0; i < 4; i++) {
      const at = new Date(Date.UTC(2026, 10, 21, 10, i));
      expect(backup({ ...io(), now: () => at })).toBe(0);
    }
    const files = readdirSync(join(dir, "backups")).sort();
    expect(files).toHaveLength(3);
    const copy = new DatabaseSync(join(dir, "backups", files.at(-1)!));
    expect(copy.prepare("SELECT COUNT(*) AS n FROM disputes").get()).toEqual({ n: 1 });
    expect(copy.prepare("SELECT personal FROM disputes").get()).toEqual({ personal: 0 });
    expect(copy.prepare("SELECT COUNT(*) AS n FROM judgements").get()).toEqual({ n: 0 });
    expect((copy.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((r) => r.name)).toEqual([
      "disputes",
      "judgements",
      "purpose_log",
      "settings",
      "suppressions",
    ]);
    copy.close();
  });

  it("resolves FINORA_DATA_DIR against the repository root, not the working directory", () => {
    expect(loadCliEnv({ FINORA_DATA_DIR: "./.data" }).dataDir).toBe(join(repoRoot(), ".data"));
    expect(loadCliEnv({}).dataDir).toBe(join(repoRoot(), ".data"));
    expect(() => loadCliEnv({ SHARE_ALIKE_MODE: "maybe" })).toThrow(/SHARE_ALIKE_MODE/);
  });
});
