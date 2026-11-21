// sanctions.md §7a: listed individuals live in memory only. Sentinel names and birth dates never
// reach the store, the filesystem or a logger, and a match yields the citation fields only.
import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scanStore } from "@finora/store";
import { clearPersonList, personIndexState, personListHeld, screenPersonName, setPersonList } from "./person-index.ts";
import { screenCompany } from "./sanctions.ts";
import { addOfficers, purposeContext, testStore } from "./test-store.ts";

const SENTINEL = "Sentinel Personone Alpha";
const list = {
  asOf: "2026-11-20",
  loadedAt: "2026-11-21T06:00:00Z",
  entries: [{ list: "eu-fsf", entryId: "900003", names: [SENTINEL, "S. P. Alpha"], program: "FXP", listDate: "2026-03-01", birthYear: 1961, nationalities: ["zz"] }],
};

afterEach(() => {
  vi.restoreAllMocks();
  clearPersonList("eu-fsf");
});

describe("the in-memory person index (LAW-SANCTIONS-PERSONS)", () => {
  it("is empty until a list is set, and says so in counts only", () => {
    expect(personListHeld("eu-fsf")).toBe(false);
    expect(screenPersonName(SENTINEL)).toEqual([]);
    setPersonList("eu-fsf", list);
    expect(personListHeld("eu-fsf")).toBe(true);
    expect(personIndexState()).toEqual([{ sourceId: "eu-fsf", asOf: "2026-11-20", entries: 1 }]);
  });

  it("matches a name in any token order and yields only the citation fields", () => {
    setPersonList("eu-fsf", list);
    const matches = screenPersonName("ALPHA, Sentinel Personone");
    expect(matches).toEqual([{ list: "eu-fsf", entryId: "900003", listDate: "2026-03-01", status: "possible_match" }]);
    expect(JSON.stringify(matches)).not.toMatch(/Sentinel|1961|zz/);
  });

  it("writes nothing: no store row, no file, no log line holds a listed person", () => {
    const writes = vi.spyOn(fs, "writeFileSync");
    const appends = vi.spyOn(fs, "appendFileSync");
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    const db = testStore([{ eid: "lv-50003000024", country: "lv", code: "50003000024", name: "Test Energy 7 SIA", legalForm: "lv-sia" }], []);
    addOfficers(db, "lv-50003000024", [SENTINEL]);
    setPersonList("eu-fsf", list);
    const result = screenCompany(db, "lv-50003000024", { purposed: purposeContext("compliance_screening") });
    expect(result?.officers).toMatchObject({ status: "screened", matches: [{ entryId: "900003" }] });
    for (const spy of [writes, appends, ...logs]) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(/Sentinel|1961/);
    // The officer's own register row holds the name; no list field (birth year, entry) is stored with it.
    expect(scanStore(db, ["1961", "900003", "S. P. Alpha"])).toEqual([]);
  });

  it("forgets a list when it is cleared", () => {
    setPersonList("eu-fsf", list);
    clearPersonList("eu-fsf");
    expect(screenPersonName(SENTINEL)).toEqual([]);
  });
});
