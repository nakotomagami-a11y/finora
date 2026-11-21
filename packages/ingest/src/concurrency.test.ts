import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openStore } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { tempDir } from "./test-helpers.ts";
import { runSyncInWorker } from "./worker.ts";

const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));

describe("S04i acceptance 5: two concurrent syncs of one source", () => {
  it("one runs in its worker, the other ends already_running, and no rows are lost", async () => {
    const dir = tempDir();
    dirs.push(dir);
    const watcher = openStore({ dataDir: dir.path });
    const entry = new URL("./testing/test-sync-worker.ts", import.meta.url);
    const job = { dataDir: dir.path, sourceId: "fake-slow", userAgent: "Finora test", options: {} };
    const hold = join(dir.path, "hold");
    writeFileSync(hold, "");
    const first = runSyncInWorker(entry, job);
    // Start the second sync only once the first holds the source's lease.
    const leased = () => (watcher.db.prepare("SELECT COUNT(*) AS n FROM main.leases WHERE resource = 'sync:fake-slow'").get() as { n: number }).n === 1;
    for (let i = 0; i < 3000 && !leased(); i++) await new Promise((r) => setTimeout(r, 10));
    expect(leased()).toBe(true);
    const second = await runSyncInWorker(entry, job);
    rmSync(hold);
    const outcomes = [await first, second];
    expect(outcomes.map((o) => o.kind)).toEqual(["content", "already_running"]);

    expect(watcher.db.prepare("SELECT COUNT(*) AS n FROM main.records WHERE source_id = 'fake-slow'").get()).toEqual({ n: 40 });
    expect(watcher.db.prepare("SELECT kind FROM main.syncs").all()).toEqual([{ kind: "content" }]);
    expect(watcher.db.prepare("SELECT COUNT(*) AS n FROM main.leases").get()).toEqual({ n: 0 });
    watcher.close();
  }, 60_000);

  it("a hung worker is terminated, its lease released and its sync closed as failed (cto on S04i)", async () => {
    const dir = tempDir();
    dirs.push(dir);
    openStore({ dataDir: dir.path }).close();
    const entry = new URL("./testing/test-sync-worker.ts", import.meta.url);
    const started = Date.now();
    const outcome = await runSyncInWorker(entry, { dataDir: dir.path, sourceId: "fake-hung", userAgent: "t", options: { leaseTtlMs: 600 } }, { startupMs: 20_000 });
    expect(outcome).toMatchObject({ kind: "failed", report: { reason: "worker_hung" } });
    expect(Date.now() - started).toBeLessThan(15_000);
    const store = openStore({ dataDir: dir.path });
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM main.leases").get()).toEqual({ n: 0 });
    expect(store.db.prepare("SELECT kind, report_json FROM main.syncs").all()).toEqual([{ kind: "failed", report_json: JSON.stringify({ reason: "worker_hung" }) }]);
    store.close();
  }, 60_000);
});
