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
    openStore({ dataDir: dir.path }).close();
    const job = {
      dataDir: dir.path,
      loaderModule: new URL("./testing/slow-source.ts", import.meta.url).href,
      loaderExport: "slowSource",
      userAgent: "Finora test",
      options: {},
    };
    const outcomes = await Promise.all([runSyncInWorker(job), runSyncInWorker(job)]);
    expect(outcomes.map((o) => o.kind).sort()).toEqual(["already_running", "content"]);

    const store = openStore({ dataDir: dir.path });
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM main.records WHERE source_id = 'fake-slow'").get()).toEqual({ n: 40 });
    expect(store.db.prepare("SELECT kind FROM main.syncs").all()).toEqual([{ kind: "content" }]);
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM main.leases").get()).toEqual({ n: 0 });
    store.close();
  }, 60_000);
});
