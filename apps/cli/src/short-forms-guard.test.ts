// V1 and V2 of the coordinator's security re-check on S05: a partial or failed officers sync's counts
// trip the rule too, and `data short-forms on` is guarded. It records an unrecorded trip first,
// refuses while an officers sync runs, takes its cursor from finished syncs only, and switches on only
// after a complete officers sync whose check does not trip.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireLease, beginSync, finishSync, lvOfficersChecks, lvShortFormsOff, openStore, setLvShortFormsOff, upsertSource } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { shortFormsOn, type Io } from "./commands.ts";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const NOW = new Date("2026-11-24T10:00:00.000Z");
const TRIPS = { lv_person_names: 10, lv_person_names_short_form: 1 };
const CLEAN = { lv_person_names: 10 };

function io(): Io & { lines: string[] } {
  const lines: string[] = [];
  return { lines, env: { dataDir: dir, secUserAgent: null, shareAlikeMode: "store", lvPersonRows: "names_no_id" }, out: (l) => void lines.push(l), now: () => NOW };
}

/** Runs `fn` on a store of the test's data dir, closed afterwards (shortFormsOn opens its own). */
function withDb<T>(fn: (db: ReturnType<typeof openStore>["db"]) => T): T {
  const store = openStore({ dataDir: dir });
  try {
    return fn(store.db);
  } finally {
    store.close();
  }
}

/** An officers sync row as a run would leave it; `kind` null leaves it running. */
function officersSync(db: ReturnType<typeof openStore>["db"], kind: "content" | "partial" | "failed" | null, checks: Record<string, number>): number {
  upsertSource(db, { id: "lv-ur-officers", storage: "store" }, "2026-11-24T08:00:00Z");
  const id = beginSync(db, { sourceId: "lv-ur-officers", licenceId: "cc0-1.0", storage: "store", parserVersion: "planted", startedAt: "2026-11-24T09:00:00Z" });
  if (kind) finishSync(db, id, { kind, finishedAt: "2026-11-24T09:01:00Z", report: { checks } });
  return id;
}

const cursor = (db: ReturnType<typeof openStore>["db"]) => Number((db.prepare("SELECT value FROM main.store_meta WHERE key = 'lv_short_forms_on_after'").get() as { value: string } | undefined)?.value ?? 0);

describe("V1: a cut-off officers sync's counts trip the rule too", () => {
  it.each(["partial", "failed"] as const)("reads a %s sync's tripping counts", (kind) => {
    dir = mkdtempSync(join(tmpdir(), "finora-sf-v1-"));
    withDb((db) => {
      officersSync(db, "content", CLEAN);
      officersSync(db, kind, TRIPS);
      // A later sync with no counts (it failed before parsing) does not hide the earlier trip.
      officersSync(db, "failed", {});
      expect(lvOfficersChecks(db, { sinceOn: true }).map((c) => c.kind)).toEqual([kind, "content"]);
    });
    // shortFormsOn records it before anything else, then refuses.
    const out = io();
    expect(shortFormsOn(out)).toBe(2);
    expect(out.lines[0]).toMatch(/^short-form rule: switched off \(1 of 10 person names would pass it/);
    expect(withDb(lvShortFormsOff)).toBe(true);
  });
});

describe("V2: switching the rule on is guarded", () => {
  it("refuses while an officers sync holds its lease, and leaves the switch as it was", () => {
    dir = mkdtempSync(join(tmpdir(), "finora-sf-v2-"));
    withDb((db) => {
      setLvShortFormsOff(db, true);
      officersSync(db, "content", CLEAN);
      expect(acquireLease(db, "sync:lv-ur-officers", "another-run", 60_000, NOW.getTime())).not.toBeNull();
    });
    const out = io();
    expect(shortFormsOn(out)).toBe(2);
    expect(out.lines).toEqual(["short-form rule: not switched on: an lv-ur-officers sync is running; run this again after it ends"]);
    expect(withDb(lvShortFormsOff)).toBe(true);
  });

  it("records an unrecorded trip first, so switching on cannot erase it", () => {
    dir = mkdtempSync(join(tmpdir(), "finora-sf-v2-"));
    withDb((db) => officersSync(db, "content", TRIPS));
    expect(withDb(lvShortFormsOff)).toBe(false);
    const out = io();
    expect(shortFormsOn(out)).toBe(2);
    expect(out.lines[0]).toMatch(/^short-form rule: switched off/);
    expect(out.lines[1]).toMatch(/^short-form rule: still off: .*the newest one trips it/);
    expect(withDb(lvShortFormsOff)).toBe(true);
  });

  it("switches on only after a complete officers sync whose check does not trip", () => {
    dir = mkdtempSync(join(tmpdir(), "finora-sf-v2-"));
    withDb((db) => setLvShortFormsOff(db, true));
    const none = io();
    expect(shortFormsOn(none)).toBe(2);
    expect(none.lines.at(-1)).toMatch(/no lv-ur-officers sync has run the check yet$/);
    withDb((db) => officersSync(db, "partial", CLEAN));
    const partial = io();
    expect(shortFormsOn(partial)).toBe(2);
    expect(partial.lines.at(-1)).toMatch(/the newest one ended partial$/);
    withDb((db) => officersSync(db, "content", CLEAN));
    const clean = io();
    expect(shortFormsOn(clean)).toBe(0);
    expect(clean.lines).toEqual(["short-form rule: on"]);
    expect(withDb(lvShortFormsOff)).toBe(false);
  });

  it("takes its cursor from finished syncs only, so a running officers sync's counts are read once it ends", () => {
    dir = mkdtempSync(join(tmpdir(), "finora-sf-v2-"));
    let running = 0;
    withDb((db) => {
      setLvShortFormsOff(db, true);
      officersSync(db, "content", CLEAN);
      running = officersSync(db, null, {});
    });
    // No lease is held (the planted running row's run is gone), so switching on is allowed.
    expect(shortFormsOn(io())).toBe(0);
    withDb((db) => {
      expect(cursor(db)).toBeLessThan(running);
      // The running sync then finishes with tripping counts: it is newer than the cursor, so it is read.
      finishSync(db, running, { kind: "content", finishedAt: "2026-11-24T10:05:00Z", report: { checks: TRIPS } });
      expect(lvOfficersChecks(db, { sinceOn: true }).map((c) => c.id)).toContain(running);
    });
  });
});
