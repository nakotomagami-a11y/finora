import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { FIXTURE_PROFILE } from "@finora/fixtures";
import { laneOf, workerStartCount } from "@finora/ingest";
import { openStore, suppressItem } from "@finora/store";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backup, dataStatus, dataSync, doctor, resolveSanctions, search, show, type Io } from "./commands.ts";
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
  it("data sync --profile core picks the real loaders by country, and names an empty choice", async () => {
    const out: string[] = [];
    expect(await dataSync({ ...io(), out: (l: string) => out.push(l) }, { profile: "core", country: "zz" })).toBe(2);
    expect(out).toEqual(["no core source for zz"]);
  });

  it("data sync loads every fixture source, and a second run is unchanged", async () => {
    expect(await dataSync(io(), { profile: "fixtures" })).toBe(0);
    expect(lines).toHaveLength(FIXTURE_PROFILE.length + 1);
    expect(lines.at(-1)).toMatch(/^peak RSS: \d+ MB$/);
    for (const line of lines.filter((l) => !l.startsWith("fx-lt-arrears") && !l.startsWith("peak RSS"))) expect(line).toMatch(/: unchanged/);
    expect(await dataSync(io(), { profile: "fixtures", source: "fx-hide" })).toBe(0);
    expect(lines).toHaveLength(2);
    expect(await dataSync(io(), { profile: "nope" })).toBe(2);
  }, 120_000);

  it("starts exactly one long-lived worker per lane, never one per source (cto on S04i)", async () => {
    const fresh = mkdtempSync(join(tmpdir(), "finora-cli-lanes-"));
    try {
      const before = workerStartCount();
      const lanes = new Set(FIXTURE_PROFILE.map((p) => laneOf(p.loader)));
      expect(lanes.size).toBeGreaterThanOrEqual(4);
      expect(await dataSync({ ...io(), env: { dataDir: fresh, secUserAgent: null, shareAlikeMode: "store" } }, { profile: "fixtures" })).toBe(0);
      expect(workerStartCount() - before).toBe(lanes.size);
      // Each source's line names its worker heap peak, so a loader slice can see which source drives P10.
      expect(lines.filter((l) => /^fx-lv-register: .*, heap peak \d+ MB$/.test(l))).toHaveLength(1);
      // Register first in each lane by `meta.order`, not by list position: it finishes before any
      // other source of its lane starts, so the country is searchable first (cto on S04i).
      const db = new DatabaseSync(join(fresh, "finora.db"), { readOnly: true });
      const syncs = db.prepare("SELECT source_id, started_at, finished_at FROM syncs").all() as { source_id: string; started_at: string; finished_at: string }[];
      db.close();
      for (const country of ["lv", "ee", "lt"]) {
        const reg = syncs.find((s) => s.source_id === `fx-${country}-register`)!;
        const others = syncs.filter((s) => s.source_id !== reg.source_id && FIXTURE_PROFILE.some((p) => p.loader.meta.id === s.source_id && laneOf(p.loader) === country));
        expect(others.length).toBeGreaterThan(0);
        for (const other of others) expect(reg.finished_at <= other.started_at, other.source_id).toBe(true);
      }
      expect(lines.filter((l) => l.startsWith("fx-") || l.startsWith("eu-") || l.startsWith("us-") || l.startsWith("uk-") || l.startsWith("esma-") || l.startsWith("lv-")).length).toBe(FIXTURE_PROFILE.length);
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  }, 120_000);

  it("data status shows each source's report with drops by reason (acceptance 3)", () => {
    expect(dataStatus(io())).toBe(0);
    const text = lines.join("\n");
    for (const id of ["fx-lv-register", "fx-ee-register", "fx-lt-register", "fx-us-register", "fx-lv-officers", "fx-ee-officers", "fx-lv-financials", "fx-ee-financials", "fx-lt-financials", "fx-ee-tax", "fx-lt-arrears", "fx-hide"]) {
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

  it("show leaves out an item suppressed for the company, and says so (L5, qa F1)", () => {
    search(io(), "example company 2");
    const eid = /\((lv-\d{11})\)/.exec(lines.find((l) => l.includes("lv-")) ?? "")?.[1];
    const store = openStore({ dataDir: dir });
    suppressItem(store.db, eid!, "S01.LV.01", "2026-11-21T10:00:00.000Z");
    store.close();
    expect(show(io(), eid!)).toBe(0);
    const text = lines.join("\n");
    expect(text).toContain("S01.LV.01: hidden at your request");
    expect(text).not.toMatch(/ name: | address: | registrationNumber: | capital: /);
  });

  it("resolve --sanctions: a fixture name is a possible match with the entry's identifiers; a company eid is listed by its code (S06)", () => {
    expect(resolveSanctions(io(), "Example Company 1")).toBe(0);
    expect(lines[0]).toBe('possible match, needs review: eu-fsf sanc-eu-900001 "Example Company 1" (name exact)');
    expect(lines[1]).toBe("  entry identifiers: registration 40003000018 (lv)");
    expect(resolveSanctions(io(), "lv-40003000018")).toBe(0);
    expect(lines[0]).toMatch(/^listed: eu-fsf sanc-eu-900001 \(registration\)$/);
    expect(lines.join("\n")).toMatch(/lists checked: eu-fsf as of 2026-11-20/);
    expect(resolveSanctions(io(), "lv-40103000014")).toBe(0);
    expect(lines.join("\n")).toContain("listed: lv-fid-frozen lv-40103000014 (frozen assets)");
    expect(resolveSanctions(io(), "Sentinel Personone Alpha")).toBe(0);
    expect(lines).toEqual(["no match on the stored lists (organisations only)"]);
    search(io(), "example company 1");
    expect(lines.join("\n")).not.toContain("sanc-");
  });

  it("leaves no listed person in any file of the data dir after the worker synced the lists (legal on S06, condition 1)", () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    const all = walk(dir);
    expect(all.length).toBeGreaterThan(0);
    for (const file of all) {
      const bytes = readFileSync(file);
      for (const needle of ["Sentinel", "SENTINEL", "Personone", "PERSONFOUR", "Listedperson", "Golfa", "1961-05-04", "1966-07-08", "12.03.1965"]) expect(bytes.includes(Buffer.from(needle)), `${file}: ${needle}`).toBe(false);
    }
  });

  it("doctor reports disk, quick_check and leases", () => {
    expect(doctor(io())).toBe(0);
    const text = lines.join("\n");
    expect(text).toMatch(/^disk: \d+\.\d GB free/m);
    expect(text).toContain("quick_check main: ok");
    expect(text).toContain("quick_check user: ok");
    expect(text).toContain("quick_check sa: ok");
    expect(text).toContain("quick_check cc: ok");
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

  it("never puts the local provider map in a backup (C17, qa condition 5)", () => {
    const sentinel = ["provider", "map", "sentinel", "c1"].join("-");
    writeFileSync(join(dir, "providers.json"), JSON.stringify({ c1: { hosts: [`${sentinel}.invalid`] } }));
    try {
      expect(backup({ ...io(), now: () => new Date(Date.UTC(2026, 10, 22, 9)) })).toBe(0);
      for (const file of readdirSync(join(dir, "backups"))) {
        expect(file).not.toContain("providers");
        expect(readFileSync(join(dir, "backups", file)).includes(sentinel)).toBe(false);
      }
    } finally {
      rmSync(join(dir, "providers.json"), { force: true });
    }
  });

  it("resolves FINORA_DATA_DIR against the repository root, not the working directory", () => {
    expect(loadCliEnv({ FINORA_DATA_DIR: "./.data" }).dataDir).toBe(join(repoRoot(), ".data"));
    expect(loadCliEnv({}).dataDir).toBe(join(repoRoot(), ".data"));
    expect(() => loadCliEnv({ SHARE_ALIKE_MODE: "maybe" })).toThrow(/SHARE_ALIKE_MODE/);
  });
});
