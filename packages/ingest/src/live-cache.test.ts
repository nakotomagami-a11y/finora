import type { ParsedRecord, RawArtifact } from "@finora/sources";
import { runRetention } from "@finora/store";
import { describe, expect, it } from "vitest";
import { fetchOnView, isWithheld, type DatasetAnswer, type LiveCachedLoader } from "./live-cache.ts";
import { fakeSource, noNetwork } from "./testing/fake-source.ts";
import { count, memoryDb } from "./test-helpers.ts";

const EID = "us-ct-FX0001";
const DAY0 = Date.parse("2026-11-01T09:00:00.000Z");
const at = (hours: number) => new Date(DAY0 + hours * 3_600_000);

const bytes = (records: ParsedRecord[]): RawArtifact[] => [{ name: "r.json", bytes: new TextEncoder().encode(JSON.stringify({ records })), fetchedAt: "" }];
const master = (status: string): ParsedRecord => ({
  recordKey: "master",
  hashInput: [status],
  entities: [{ eid: EID, schema: "Company", country: "us", legalForm: "us-llc", status, code: "FX0001", statements: [{ prop: "name", value: "Example Holdings LLC", itemId: "S01.US.02" }] }],
});
const principals = (names: string[]): ParsedRecord => ({
  recordKey: "principals",
  hashInput: names,
  entities: names.flatMap((name, i) => [
    { eid: `p-7-${i}`, schema: "Person" as const, country: "us", statements: [{ prop: "name", value: name, itemId: "S03.US.03", line: i }] },
    {
      eid: `rel-7-${i}`,
      schema: "Directorship" as const,
      country: "us",
      statements: [
        { prop: "organization", value: EID, itemId: "S03.US.03", line: i },
        { prop: "director", value: `p-7-${i}`, itemId: "S03.US.03", line: i },
        { prop: "role", value: "principal", itemId: "S03.US.03", line: i },
      ],
    },
  ]),
});

function liveSource() {
  const base = fakeSource({ id: "us-ct-business", country: "us", storage: "live-cached", cacheTtl: { refetchHours: 24, purgeUnviewedDays: 30 }, items: ["S01.US.02", "S03.US.03"] });
  const answers: { master: DatasetAnswer; principals: DatasetAnswer } = {
    master: { dataset: "master", status: "ok", artifacts: bytes([master("active")]) },
    principals: { dataset: "principals", status: "ok", artifacts: bytes([principals(["Principal One", "Principal Two"])]) },
  };
  let calls = 0;
  const loader: LiveCachedLoader & { answers: typeof answers; calls: () => number } = Object.assign(base, {
    answers,
    calls: () => calls,
    async fetchRecord() {
      calls++;
      return [answers.master, answers.principals];
    },
  });
  return loader;
}

const view = (db: ReturnType<typeof memoryDb>, loader: ReturnType<typeof liveSource>, hours: number) =>
  fetchOnView(db, loader, { recordKey: "FX0001", entityEid: EID, datasets: ["master", "principals"] }, { fetcher: noNetwork, keys: {}, now: at(hours) });
const people = (db: ReturnType<typeof memoryDb>) => count(db, "SELECT COUNT(*) AS n FROM main.entities WHERE eid LIKE 'p-7-%'");

describe("live-cached sources (§3.5; LAW-CACHE-TTL interim)", () => {
  it("writes only for an entity the user opens, and re-fetches after 24 h, not before", async () => {
    const db = memoryDb();
    const loader = liveSource();
    expect(await view(db, loader, 0)).toEqual({ master: "fresh", principals: "fresh" });
    expect(people(db)).toBe(2);
    expect(await view(db, loader, 23)).toEqual({ master: "cached", principals: "cached" });
    expect(loader.calls()).toBe(1);
    await view(db, loader, 25);
    expect(loader.calls()).toBe(2);
  });

  it("removes a withdrawn principal when a re-fetch returns the company (CT terms)", async () => {
    const db = memoryDb();
    const loader = liveSource();
    await view(db, loader, 0);
    loader.answers.principals = { dataset: "principals", status: "ok", artifacts: bytes([principals(["Principal One"])]) };
    await view(db, loader, 25);
    expect(people(db)).toBe(1);
  });

  it("an empty answer withholds and keeps the rows; a second miss 24 h later deletes them; per dataset", async () => {
    const db = memoryDb();
    const loader = liveSource();
    await view(db, loader, 0);
    loader.answers.principals = { dataset: "principals", status: "empty" };
    expect(await view(db, loader, 25)).toEqual({ master: "fresh", principals: "withheld" });
    expect(people(db)).toBe(2);
    expect(isWithheld(db, "us-ct-business", "FX0001", "principals")).toBe(true);
    expect(isWithheld(db, "us-ct-business", "FX0001", "master")).toBe(false);

    expect((await view(db, loader, 50))).toEqual({ master: "fresh", principals: "deleted" });
    expect(people(db)).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.entities WHERE eid = ?", EID)).toBe(1);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.events ev JOIN main.event_types t ON t.id = ev.type_id WHERE t.name = 'finora.role_ended'")).toBe(2);
  });

  it("a second empty answer within 24 h still only withholds", async () => {
    const db = memoryDb();
    const loader = liveSource();
    await view(db, loader, 0);
    loader.answers.principals = { dataset: "principals", status: "empty" };
    await view(db, loader, 25);
    loader.meta.cacheTtl = { refetchHours: 1, purgeUnviewedDays: 30 };
    expect((await view(db, loader, 30)).principals).toBe("withheld");
    expect(people(db)).toBe(2);
  });

  it("a 5xx, timeout or 429 is never a miss", async () => {
    const db = memoryDb();
    const loader = liveSource();
    await view(db, loader, 0);
    loader.answers.principals = { dataset: "principals", status: "error" };
    for (const hours of [25, 50, 75]) expect((await view(db, loader, hours)).principals).toBe("error");
    expect(people(db)).toBe(2);
    expect(isWithheld(db, "us-ct-business", "FX0001", "principals")).toBe(false);
  });

  it("an entity not viewed for 30 days is purged: day 29 survives, day 30 goes", async () => {
    const db = memoryDb();
    const loader = liveSource();
    await view(db, loader, 0);
    runRetention(db, { now: at(29 * 24).toISOString(), personTtlDays: 30 });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.entities WHERE eid = ?", EID)).toBe(1);
    runRetention(db, { now: at(30 * 24 + 1).toISOString(), personTtlDays: 30 });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.entities WHERE eid = ?", EID)).toBe(0);
    expect(people(db)).toBe(0);
  });
});
