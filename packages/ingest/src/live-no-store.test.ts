import fs from "node:fs";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { openStore } from "@finora/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runSync, type Logger } from "./pipeline.ts";
import { liveRowsFor } from "./live-views.ts";
import { fakeSource, noNetwork } from "./testing/fake-source.ts";
import { tempDir } from "./test-helpers.ts";

const SENTINEL = "SENTINEL-VALUE-7f3a";
const dirs: { remove(): void }[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  dirs.splice(0).forEach((d) => d.remove());
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe("live-no-store writes nothing (legal condition 1)", () => {
  it("keeps the sentinel values in memory only: no store row, no raw cache, no log line, no file", async () => {
    const dir = tempDir();
    dirs.push(dir);
    const store = openStore({ dataDir: join(dir.path, "data") });
    const writes = vi.spyOn(fs, "writeFileSync");
    const lines: string[] = [];
    const logger: Logger = { info: (m, f) => void lines.push(JSON.stringify([m, f])), warn: (m, f) => void lines.push(JSON.stringify([m, f])) };
    const loader = fakeSource({ id: "lv-small-list", storage: "live-no-store", items: ["S01.LV.01"] }, {
      records: [{ recordKey: "k1", hashInput: [SENTINEL], entities: [{ eid: "lv-00000000001", schema: "Company", country: "lv", statements: [{ prop: "notes", value: SENTINEL, itemId: "S01.LV.01" }] }] }],
    });
    const outcome = await runSync(store.db, loader, { fetcher: noNetwork, rawCacheDir: join(dir.path, "raw"), logger });
    store.close();

    expect(outcome.kind).toBe("content");
    expect(liveRowsFor("lv-small-list", "lv-00000000001").map((r) => r.value)).toEqual([SENTINEL]);
    for (const call of writes.mock.calls) expect(String(call[1])).not.toContain(SENTINEL);
    expect(lines.join("\n")).not.toContain(SENTINEL);
    expect(lines.length).toBeGreaterThan(0);
    for (const file of files(dir.path)) expect(readFileSync(file).includes(Buffer.from(SENTINEL)), file).toBe(false);
    expect(files(dir.path).some((f) => f.includes(`${join("raw")}`))).toBe(false);
  });

  it("still writes its one syncs row, with counts only", async () => {
    const store = openStore({ dataDir: null });
    const loader = fakeSource({ id: "lv-small-list", storage: "live-no-store" }, {
      records: [{ recordKey: "k1", hashInput: [SENTINEL], entities: [{ eid: "lv-00000000001", schema: "Company", country: "lv", statements: [{ prop: "notes", value: SENTINEL, itemId: "S01.LV.01" }] }] }],
    });
    await runSync(store.db, loader, { fetcher: noNetwork });
    const rows = store.db.prepare("SELECT kind, report_json FROM main.syncs").all() as { kind: string; report_json: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("content");
    expect(rows[0]?.report_json).not.toContain(SENTINEL);
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM main.statements").get()).toEqual({ n: 0 });
  });
});
