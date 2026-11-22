// The architect's share of the S05 re-check: N6 (a streamed file keeps to the source's byte cap) and
// qa's SHOULD-FIX on 69a9568 (a worker batch without its config loads nothing). Each with its control.
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_LOADER_CONFIG, politeFetch, type SourceMeta } from "@finora/sources";
import { openStore } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { runSync } from "./pipeline.ts";
import { companies, fakeSource, noNetwork } from "./testing/fake-source.ts";
import { memoryDb, records, tempDir } from "./test-helpers.ts";
import { runSyncInWorker, sourceFetchOptions, type WorkerJob } from "./worker.ts";

const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));
const scratch = () => {
  const path = mkdtempSync(join(tmpdir(), "finora-recheck-"));
  dirs.push({ remove: () => rmSync(path, { recursive: true, force: true }) });
  return path;
};

/** A fictional person's name, padded to exactly `size` bytes: what a streamed officers file holds. */
const NAME = ["Recheck", "Person", "Fictional"].join(" ");
const body = (size: number) => Buffer.concat([Buffer.from(NAME), Buffer.alloc(size - NAME.length, " ")]);

async function serving(size: number, run: (url: string) => Promise<void>) {
  const server = createServer((_req, res) => res.end(body(size)));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    await run(`http://files.example.lv:${(server.address() as AddressInfo).port}/officers.csv`);
  } finally {
    server.close();
  }
}

const CAP = 64 * 1024;
const meta: SourceMeta = { ...fakeSource({ officialHosts: ["files.example.lv"] }).meta, limits: { maxBytes: CAP, allowHttp: true } };
const fetcher = () => politeFetch({ ...sourceFetchOptions(meta, "t"), resolve: async () => [{ address: "127.0.0.1", family: 4 }], allowAddress: () => true, retries: 0 });

describe("N6: a streamed file keeps to the source's byte cap", () => {
  it("the source's cap bounds a streamed file as it bounds a buffered body", () => {
    expect(sourceFetchOptions(meta, "t")).toMatchObject({ maxBytes: CAP, maxFileBytes: CAP });
  });

  it("one byte over the cap: refused, and no byte of the file stays in the work dir", async () => {
    const work = scratch();
    await serving(CAP + 1, async (url) => {
      await expect(fetcher()(url, { toFile: join(work, "officers.csv") })).rejects.toMatchObject({ code: "too_large" });
    });
    expect(readdirSync(work)).toEqual([]);
  });

  it("the control: exactly the cap is written", async () => {
    const work = scratch();
    await serving(CAP, async (url) => {
      const res = await fetcher()(url, { toFile: join(work, "officers.csv") });
      expect(res.file?.size).toBe(CAP);
    });
    expect(existsSync(join(work, "officers.csv"))).toBe(true);
  });
});

describe("a worker batch without its config loads nothing (qa on 69a9568)", () => {
  const entry = new URL("./testing/test-sync-worker.ts", import.meta.url);

  it("fails config_missing and writes no record; the same job with its config loads", async () => {
    const dir = tempDir();
    dirs.push(dir);
    const job: WorkerJob = { dataDir: dir.path, sourceId: "fake-slow", userAgent: "t", config: DEFAULT_LOADER_CONFIG, options: {} };
    const { config: _dropped, ...withoutConfig } = job;
    const refused = await runSyncInWorker(entry, withoutConfig as WorkerJob);
    expect([refused.kind, refused.report?.reason]).toEqual(["failed", "config_missing"]);
    const store = openStore({ dataDir: dir.path });
    expect(records(store.db)).toBe(0);
    store.close();
    expect((await runSyncInWorker(entry, job)).kind).toBe("content");
  });
});

describe("G3: an error right after the lease is taken still releases it", () => {
  it("an onStart that throws ends failed, leaves no lease and no running row; the next sync runs", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 3) });
    const failedStart = await runSync(db, loader, {
      fetcher: noNetwork,
      onStart: () => {
        throw new Error("start");
      },
    });
    expect(failedStart.kind).toBe("failed");
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.leases").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.syncs WHERE kind = 'running'").get()).toEqual({ n: 0 });
    expect((await runSync(db, loader, { fetcher: noNetwork })).kind).toBe("content");
  });
});

describe("J4: a clock that throws around the lease leaves none held", () => {
  it("the sync rejects and holds no lease; the next sync runs", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 3) });
    // It fails on its second reading: before J4 that was the first one after the lease was taken.
    let readings = 0;
    const clock = () => {
      if (++readings === 2) throw new Error("clock");
      return new Date("2026-11-23T08:00:00.000Z");
    };
    await expect(runSync(db, loader, { fetcher: noNetwork, now: clock })).rejects.toThrow("clock");
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.leases").get()).toEqual({ n: 0 });
    expect((await runSync(db, loader, { fetcher: noNetwork })).kind).toBe("content");
  });
});
