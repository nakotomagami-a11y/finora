// The short-form switch travels like LV_PERSON_ROWS (qa 7096154351, legal 7096149394): the parent
// reads it from the store before a run and passes it in every job's config; a tripped check changes
// only the next run's config; data status names the cause, or "not checked" in role_counts.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SyncReport } from "@finora/ingest";
import { beginSync, finishSync, openStore } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { dataStatus, dataSync, shortFormsOn, tripShortForms, type Io } from "./commands.ts";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function io(lvPersonRows: "names_no_id" | "role_counts" = "names_no_id"): Io & { lines: string[] } {
  const lines: string[] = [];
  return { lines, env: { dataDir: dir, secUserAgent: null, shareAlikeMode: "store", lvPersonRows }, out: (l) => void lines.push(l), now: () => new Date("2026-11-21T10:00:00.000Z") };
}

/** The members syncs' parser versions in run order: their `-sf1`/`-sf0` suffix is the run's short-form setting. */
function membersVersions(): string[] {
  const db = new DatabaseSync(join(dir, "finora.db"), { readOnly: true });
  try {
    return (db.prepare("SELECT parser_version FROM syncs WHERE source_id = 'lv-ur-members' ORDER BY id").all() as { parser_version: string }[]).map((r) => r.parser_version.slice(-4));
  } finally {
    db.close();
  }
}

const tripping = { checks: { lv_person_names: 10, lv_person_names_short_form: 1 } } as unknown as SyncReport;

describe("the LV short-form switch", () => {
  it("is read before a run, changes only the next run's config when tripped, and is named in data status", async () => {
    dir = mkdtempSync(join(tmpdir(), "finora-cli-sf-"));
    const first = io();
    expect(await dataSync(first, { profile: "fixtures", country: "lv" })).toBe(0);
    expect(first.lines.some((l) => l.startsWith("short-form rule:"))).toBe(false);
    const status = io();
    dataStatus(status);
    expect(status.lines).toContain("short-form rule: on");

    // A trip after a run's syncs: the run's own jobs were built before it, so they keep their config.
    const trip = io();
    expect(tripShortForms(trip, { lvPersonRows: "names_no_id", lvShortCompanyForms: true }, tripping)).toBe(true);
    expect(trip.lines[0]).toMatch(/^short-form rule: switched off from the next sync \(1 of 10 person names would pass it; 0\.00% are in capitals\)/);
    // Once off, a later trip changes nothing.
    expect(tripShortForms(io(), { lvPersonRows: "names_no_id", lvShortCompanyForms: false }, tripping)).toBe(false);

    const off = io();
    dataStatus(off);
    expect(off.lines.find((l) => l.startsWith("short-form rule:"))).toMatch(/^short-form rule: off \(\d+ of \d+ person names would pass it; [\d.]+% are in capitals\)/);

    // The next run builds its jobs with the rule off: the members loader re-parses under -sf0.
    expect(await dataSync(io(), { profile: "fixtures", country: "lv" })).toBe(0);
    expect(membersVersions()).toEqual(["-sf1", "-sf0"]);

    // The manual step switches it back on for the run after.
    shortFormsOn(io());
    expect(await dataSync(io(), { profile: "fixtures", country: "lv" })).toBe(0);
    expect(membersVersions()).toEqual(["-sf1", "-sf0", "-sf1"]);
  }, 120_000);

  it("shows 'not checked' in role_counts, where no person name is read", async () => {
    dir = mkdtempSync(join(tmpdir(), "finora-cli-sf-"));
    expect(await dataSync(io("role_counts"), { profile: "fixtures", country: "lv" })).toBe(0);
    const status = io("role_counts");
    dataStatus(status);
    expect(status.lines).toContain("short-form rule: not checked in role_counts");
  }, 120_000);

  it("re-derives a trip a killed run measured but never recorded (U1), and not one from before the switch-on", async () => {
    dir = mkdtempSync(join(tmpdir(), "finora-cli-sf-"));
    expect(await dataSync(io(), { profile: "fixtures", country: "lv" })).toBe(0);
    // A run that died after its officers sync committed: the tripping counts are stored, the flag is not.
    const killed = () => {
      const store = openStore({ dataDir: dir });
      try {
        const id = beginSync(store.db, { sourceId: "lv-ur-officers", licenceId: "cc0-1.0", storage: "store", parserVersion: "killed", startedAt: "2026-11-21T11:00:00Z" });
        finishSync(store.db, id, { kind: "content", finishedAt: "2026-11-21T11:01:00Z", report: { checks: { lv_person_names: 10, lv_person_names_short_form: 1 } } });
      } finally {
        store.close();
      }
    };
    killed();
    const next = io();
    expect(await dataSync(next, { profile: "fixtures", country: "lv" })).toBe(0);
    expect(next.lines[0]).toMatch(/^short-form rule: switched off \(1 of 10 person names would pass it/);
    expect(membersVersions()).toEqual(["-sf1", "-sf0"]);
    // The manual switch-on marks the newest sync: that old tripping report never trips it again.
    shortFormsOn(io());
    expect(await dataSync(io(), { profile: "fixtures", country: "lv" })).toBe(0);
    expect(membersVersions()).toEqual(["-sf1", "-sf0", "-sf1"]);
  }, 180_000);

  it("still catches a killed run's trip after a backup holding a high cursor is restored onto a rebuilt store (qa on f1cea9f)", async () => {
    dir = mkdtempSync(join(tmpdir(), "finora-cli-sf-"));
    expect(await dataSync(io(), { profile: "fixtures", country: "lv" })).toBe(0);
    const store = openStore({ dataDir: dir });
    try {
      // What a restored backup of an older store may bring back: a switch-on cursor far above this
      // rebuilt store's sync ids. The cursor is read from main.store_meta only, so it is ignored.
      store.db.prepare("INSERT INTO user.settings (key, value) VALUES ('lv_short_forms_on_after', '999999') ON CONFLICT (key) DO UPDATE SET value = excluded.value").run();
      const id = beginSync(store.db, { sourceId: "lv-ur-officers", licenceId: "cc0-1.0", storage: "store", parserVersion: "killed", startedAt: "2026-11-21T11:00:00Z" });
      finishSync(store.db, id, { kind: "content", finishedAt: "2026-11-21T11:01:00Z", report: { checks: { lv_person_names: 10, lv_person_names_short_form: 1 } } });
    } finally {
      store.close();
    }
    const next = io();
    expect(await dataSync(next, { profile: "fixtures", country: "lv" })).toBe(0);
    expect(next.lines[0]).toMatch(/^short-form rule: switched off/);
    expect(membersVersions()).toEqual(["-sf1", "-sf0"]);
  }, 180_000);
});

