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
    const job = {
      dataDir: dir.path,
      loaderModule: new URL("./testing/slow-source.ts", import.meta.url).href,
      loaderExport: "slowSource",
      userAgent: "Finora test",
      options: {},
    };
    const hold = join(dir.path, "hold");
    writeFileSync(hold, "");
    const first = runSyncInWorker(job);
    // Start the second sync only once the first holds the source's lease.
    const leased = () => (watcher.db.prepare("SELECT COUNT(*) AS n FROM main.leases WHERE resource = 'sync:fake-slow'").get() as { n: number }).n === 1;
    for (let i = 0; i < 3000 && !leased(); i++) await new Promise((r) => setTimeout(r, 10));
    expect(leased()).toBe(true);
    const second = await runSyncInWorker(job);
    rmSync(hold);
    const outcomes = [await first, second];
    expect(outcomes.map((o) => o.kind)).toEqual(["content", "already_running"]);

    expect(watcher.db.prepare("SELECT COUNT(*) AS n FROM main.records WHERE source_id = 'fake-slow'").get()).toEqual({ n: 40 });
    expect(watcher.db.prepare("SELECT kind FROM main.syncs").all()).toEqual([{ kind: "content" }]);
    expect(watcher.db.prepare("SELECT COUNT(*) AS n FROM main.leases").get()).toEqual({ n: 0 });
    watcher.close();
  }, 60_000);
});
