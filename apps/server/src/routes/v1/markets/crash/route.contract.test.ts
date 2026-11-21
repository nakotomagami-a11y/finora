import { describe, expect, it } from "vitest";
import { CrashResponse } from "@finora/api-contract";
import { readMarketSettings } from "@finora/markets";
import { fakeMarketFetch, fixtureProviders, FIXTURE_TODAY } from "@finora/markets/fixtures";
import { FetchError } from "@finora/sources";
import { openStore } from "@finora/store";
import { runDueMarketJobs } from "../../../../markets/jobs.ts";
import { handle } from "../../../../router.ts";
import { useMarketsStore } from "../../../../services/markets.ts";

const request = () => handle(new Request("http://127.0.0.1:3000/api/v1/markets/crash", { headers: { host: "127.0.0.1:3000" } }));

describe("GET /api/v1/markets/crash", () => {
  it("answers a fresh store with every row loading or not configured, never an error", async () => {
    useMarketsStore(openStore({ dataDir: null }), fixtureProviders());
    const response = await request();
    expect(response.status).toBe(200);
    const body = CrashResponse.parse(await response.json());
    const rows = body.tiles.flatMap((t) => t.rows);
    expect(rows.every((r) => ["loading", "not_configured"].includes(r.state))).toBe(true);
    expect(body.totalWiped).toBeUndefined();
  });

  it("answers from the store only: every row filled from its source, every value sourced", async () => {
    const store = openStore({ dataDir: null });
    const fetch = fakeMarketFetch();
    await runDueMarketJobs({
      store,
      now: () => `${FIXTURE_TODAY}T22:30:00Z`,
      settings: () => readMarketSettings(new Map()),
      providers: fixtureProviders(),
      userAgent: "Finora test",
      fetch: async (url, init) => {
        const r = await fetch(url, init);
        if (r.status >= 400) throw new FetchError("http_status", "fixture", r.status);
        return r;
      },
    });
    useMarketsStore(store, fixtureProviders());
    const body = CrashResponse.parse(await (await request()).json());
    const rows = body.tiles.flatMap((t) => t.rows);
    expect(body.tiles.map((t) => t.tileId)).toEqual(["M01", "M03", "M05", "M06", "M07", "M08"]);
    expect(rows.find((r) => r.rowKey === "M07.X.01:wti")?.value).toBeTypeOf("number");
    expect(rows.filter((r) => r.state === "not_configured")).toEqual([]);
    expect(rows.filter((r) => r.value !== undefined).every((r) => r.sources.length > 0)).toBe(true);
  });

  it("is refused for a foreign Host", async () => {
    const response = await handle(new Request("http://127.0.0.1:3000/api/v1/markets/crash", { headers: { host: "evil.example" } }));
    expect(response.status).toBe(403);
  });
});
