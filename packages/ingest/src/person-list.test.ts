// The sanctions lists through the pipeline (sanctions.md §6, §7a; S06): individuals reach the
// in-memory person index and nothing else (no store row, no raw cache, no log line); a sync with
// no list held parses again; the LV frozen-assets rows pass the party gate only when proven.
import fs, { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { clearPersonList, personListHeld, screenPersonName } from "@finora/resolve";
import { euFsf, lvFidFrozen, type PoliteFetch } from "@finora/sources";
import { lvFidXlsx } from "@finora/sources/testing";
import { openStore, scanStore } from "@finora/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "./pipeline.ts";
import { fakeSource } from "./testing/fake-source.ts";
import { count, sync, tempDir } from "./test-helpers.ts";

const EU = new Uint8Array(readFileSync(new URL("../../../fixtures/sources/eu-fsf/csvFullSanctionsList_1_1.csv", import.meta.url)));
const answer = (bytes: Uint8Array) => ({ status: 200, headers: {}, bytes });
const euFetch: PoliteFetch = async () => answer(EU);

const dirs: { remove(): void }[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  clearPersonList("eu-fsf");
  dirs.splice(0).forEach((d) => d.remove());
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe("a sanctions list with individuals (eu-fsf fixture)", () => {
  it("stores the enterprises, holds the individuals in memory only, and keeps no raw file", async () => {
    const dir = tempDir();
    dirs.push(dir);
    const store = openStore({ dataDir: join(dir.path, "data") });
    const writes = vi.spyOn(fs, "writeFileSync");
    const lines: string[] = [];
    const logger: Logger = { info: (m, f) => void lines.push(JSON.stringify([m, f])), warn: (m, f) => void lines.push(JSON.stringify([m, f])) };
    const outcome = await sync(store.db, euFsf, { fetcher: euFetch, rawCacheDir: join(dir.path, "raw"), logger });

    expect(outcome.kind).toBe("content");
    expect(outcome.report?.dropped).toMatchObject({ person_entry: 2, unknown_subject_type: 1 });
    expect(count(store.db, "SELECT COUNT(*) AS n FROM main.records WHERE source_id = 'eu-fsf'")).toBe(3);
    expect(count(store.db, "SELECT COUNT(*) AS n FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE s.name = 'Person'")).toBe(0);
    expect(personListHeld("eu-fsf")).toBe(true);
    expect(screenPersonName("Sentinel Personone Alpha")).toEqual([{ list: "eu-fsf", entryId: "900003", listDate: "2026-03-01", status: "possible_match" }]);

    expect(scanStore(store.db, ["Sentinel", "Personone", "1961-05-04", "SENTINELDOC1"])).toEqual([]);
    store.close();
    for (const call of writes.mock.calls) expect(String(call[1])).not.toMatch(/Sentinel/);
    expect(lines.join("\n")).not.toMatch(/Sentinel|1961/);
    for (const file of files(dir.path)) expect(readFileSync(file).includes(Buffer.from("Sentinel")), file).toBe(false);
    expect(files(dir.path).some((f) => f.includes(join(dir.path, "raw")))).toBe(false);
  });

  it("keeps sanctions entries out of company search", async () => {
    const store = openStore({ dataDir: null });
    await sync(store.db, euFsf, { fetcher: euFetch });
    expect(count(store.db, "SELECT COUNT(*) AS n FROM main.entities_fts")).toBe(0);
    store.close();
  });

  it("parses again when the serving process holds no person list, in memory only, else answers unchanged", async () => {
    const dir = tempDir();
    dirs.push(dir);
    const store = openStore({ dataDir: join(dir.path, "data") });
    const options = { fetcher: euFetch, rawCacheDir: join(dir.path, "raw") };
    // legal on S06, condition 3: after every sync, held or re-parsed, no file holds a listed person.
    const noPersonOnDisk = () => {
      for (const file of files(dir.path)) {
        const bytes = readFileSync(file);
        for (const needle of ["Sentinel", "Personone", "1961-05-04", "SENTINELDOC1"]) expect(bytes.includes(Buffer.from(needle)), `${file}: ${needle}`).toBe(false);
      }
    };
    await sync(store.db, euFsf, options);
    noPersonOnDisk();
    expect((await sync(store.db, euFsf, options)).kind).toBe("unchanged");
    clearPersonList("eu-fsf");
    expect((await sync(store.db, euFsf, options)).kind).toBe("content");
    expect(personListHeld("eu-fsf")).toBe(true);
    noPersonOnDisk();
    expect((await sync(store.db, euFsf, { ...options, personListHeld: false })).kind).toBe("content");
    noPersonOnDisk();
    expect(scanStore(store.db, ["Sentinel", "Personone"])).toEqual([]);
    store.close();
    noPersonOnDisk();
  });

  it("posts the person list to the serving process", async () => {
    const store = openStore({ dataDir: null });
    const posted: string[] = [];
    await sync(store.db, euFsf, { fetcher: euFetch, onPersonList: (id, list) => void posted.push(`${id}:${list.entries.length}:${list.asOf}`) });
    expect(posted).toEqual(["eu-fsf:2:2026-11-20"]);
    store.close();
  });
});

describe("the LV frozen-assets list through the party gate", () => {
  it("attaches the event to a proven LV company and drops unresolved codes, persons and unproven rows", async () => {
    const store = openStore({ dataDir: null });
    const register = fakeSource({ id: "lv-register" }, {
      records: [
        {
          recordKey: "lv-40103000014",
          hashInput: ["x"],
          entities: [{ eid: "lv-40103000014", schema: "Company", country: "lv", legalForm: "lv-sia", code: "40103000014", statements: [{ prop: "name", value: "Placeholder Bakery 1 SIA", itemId: "S01.LV.01" }] }],
        },
      ],
    });
    await sync(store.db, register);
    const fetcher: PoliteFetch = async (url) =>
      url.includes("package_show")
        ? answer(new TextEncoder().encode(JSON.stringify({ result: { resources: [{ url: "https://data.gov.lv/dati/dataset/x/sankciju_subjekti.xlsx", last_modified: "2026-11-16T08:00:00" }] } })))
        : answer(lvFidXlsx());
    const outcome = await sync(store.db, lvFidFrozen, { fetcher });

    expect(outcome.kind).toBe("content");
    expect(outcome.report?.dropped).toMatchObject({ person_entry: 1, unproven_party: 1, party_not_proven: 1 });
    const events = store.db
      .prepare("SELECT e.eid, ev.date FROM main.events ev JOIN main.entities e ON e.id = ev.entity_id JOIN main.event_types t ON t.id = ev.type_id WHERE t.name = 'register.frozen_assets' ORDER BY e.eid")
      .all() as { eid: string; date: string }[];
    expect(events.map((e) => e.eid)).toEqual(["lv-40103000014", expect.stringMatching(/^sanc-lvfid-[0-9a-f]{32}$/)]);
    expect(scanStore(store.db, ["Listedperson", "Personfive", "Mock Northern Holder"])).toEqual([]);
    store.close();
  });
});
