// Work dirs never outlive their sync (qa, legal condition 1 on 9ec97db). Its own file, so its worker
// starts run in a process of their own: many short-lived workers in one process can crash V8 (§4.5).
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquireLease, openStore } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { tempDir } from "./test-helpers.ts";
import { runSyncInWorker } from "./worker.ts";
import { sweepWorkDirs } from "./work-dirs.ts";

const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));

describe("work dirs never outlive their sync (qa, legal condition 1 on 9ec97db)", () => {
  const cases = [
    { id: "fake-stream-hang", limits: { startupMs: 20_000 }, options: { leaseTtlMs: 600 }, reason: "worker_hung" },
    { id: "fake-stream-crash", limits: {}, options: {}, reason: "worker_exit_3" },
    { id: "fake-stream-oom", limits: { maxHeapMb: 128 }, options: {}, reason: "worker_out_of_memory" },
    { id: "fake-stream-stall", limits: { timeoutMs: 3000, startupMs: 20_000 }, options: {}, reason: "worker_timeout" },
  ];
  for (const c of cases) {
    it(`a terminated worker (${c.reason}) leaves no download behind`, async () => {
      const dir = tempDir();
      dirs.push(dir);
      openStore({ dataDir: dir.path }).close();
      const work = join(dir.path, "work");
      const entry = new URL("./testing/test-sync-worker.ts", import.meta.url);
      const outcome = await runSyncInWorker(entry, { dataDir: dir.path, sourceId: c.id, userAgent: "t", options: { ...c.options, workDir: work } }, c.limits);
      expect(outcome.report?.reason).toBe(c.reason);
      expect(readdirSync(work).filter((n) => n.startsWith("finora-"))).toEqual([]);
    }, 60_000);
  }

  it("the next sync of a source removes its orphan, and the boot sweep removes those no live lease holds", async () => {
    const dir = tempDir();
    dirs.push(dir);
    const store = openStore({ dataDir: dir.path });
    const work = join(dir.path, "work");
    for (const name of ["finora-fake-slow-aaaaaa", "finora-other-source-bbbbbb", "finora-held-source-cccccc"]) {
      mkdirSync(join(work, name), { recursive: true });
      writeFileSync(join(work, name, "people.csv"), "x");
    }
    acquireLease(store.db, "sync:held-source", "someone", 60_000);
    expect(sweepWorkDirs(store.db, work)).toBe(2);
    expect(readdirSync(work)).toEqual(["finora-held-source-cccccc"]);
    mkdirSync(join(work, "finora-fake-slow-dddddd"));
    store.close();
    const entry = new URL("./testing/test-sync-worker.ts", import.meta.url);
    expect((await runSyncInWorker(entry, { dataDir: dir.path, sourceId: "fake-slow", userAgent: "t", options: { workDir: work } })).kind).toBe("content");
    expect(readdirSync(work)).toEqual(["finora-held-source-cccccc"]);
  }, 60_000);
});
