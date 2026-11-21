import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { openStore } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { runSync } from "./pipeline.ts";
import { fakeSource, noNetwork, roleSetRecord, companyRecord } from "./testing/fake-source.ts";
import { tempDir } from "./test-helpers.ts";

const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe("no install key and no person pseudonym in v1 (PERSON_ROWS=names_no_id; LAW-PSEUDONYM, PS3)", () => {
  it("a sync of a people source creates no key file and no person key in the data dir", async () => {
    const dir = tempDir();
    dirs.push(dir);
    const store = openStore({ dataDir: dir.path });
    await runSync(store.db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }), { fetcher: noNetwork, rawCacheDir: join(dir.path, "raw") });
    await runSync(store.db, fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records: [roleSetRecord(1, [{ name: "Officer A", role: "board_member", rowId: "4711" }])] }), {
      fetcher: noNetwork,
      rawCacheDir: join(dir.path, "raw"),
    });
    store.close();
    // Legal condition 1: the exact file set, so no key file can hide under another name.
    const names = walk(dir.path)
      .map((f) => f.slice(dir.path.length + 1).split("\\").join("/"))
      .filter((n) => !/-(wal|shm|journal)$/.test(n))
      .sort();
    expect(names).toEqual([
      "deletions.log",
      "finora-sa.db",
      "finora-user.db",
      "finora.db",
      "raw/lv-officers/000.gz",
      "raw/lv-officers/000.json",
      "raw/lv-register/000.gz",
      "raw/lv-register/000.json",
      "restrictions.log",
    ]);
  });

  it("computes no HMAC anywhere in the ingest code", () => {
    const src = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    for (const file of walk(src).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/createHmac|installKey|install_key|person_key/);
    }
  });
});
