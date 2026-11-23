import { ITEMS } from "@finora/domain";
import { describe, expect, it } from "vitest";
import { marketConnectors } from "./connectors/index.ts";
import { fixtureProviders } from "./fixtures/fake-fetch.ts";
import { TILE_ROWS } from "./tiles.ts";

const MARKET_CONNECTORS = marketConnectors(fixtureProviders());

const marketItems = ITEMS.filter((i) => i.section.startsWith("M"));

describe("Crash monitor items (Part G, one case per M item)", () => {
  for (const item of marketItems) {
    const loadable = item.call === "show" || item.call === "caveat";
    it(`${item.id} (${item.call}) ${loadable ? "has a tile row and a connector" : "has no tile row and no connector"}`, () => {
      const rows = TILE_ROWS.filter((r) => r.itemId === item.id);
      const connectors = MARKET_CONNECTORS.filter((c) => c.meta.items.includes(item.id));
      if (loadable) {
        expect(rows.length).toBeGreaterThan(0);
        expect(connectors.length).toBeGreaterThan(0);
      } else {
        expect(rows).toEqual([]);
        expect(connectors).toEqual([]);
      }
    });
  }

  it("calls no oracle contract and builds no macro tile (M05.X.02a, M06.X.01a, M09.X.01 are LATER)", () => {
    const hosts = MARKET_CONNECTORS.flatMap((c) => c.meta.officialHosts);
    expect(hosts.some((h) => /ethereum|oracle/i.test(h))).toBe(false);
    expect(TILE_ROWS.some((r) => r.itemId.startsWith("M09"))).toBe(false);
  });

  it("gives every row a delay flag, a value-lost rule and a total rule, and counts only two rows in the total", () => {
    for (const r of TILE_ROWS) {
      expect(typeof r.delayed, r.rowKey).toBe("boolean");
      expect([null, "series", "supply"], r.rowKey).toContain(r.valueLost);
    }
    expect(TILE_ROWS.filter((r) => r.countInTotal).map((r) => r.itemId)).toEqual(["M01.X.01", "M06.X.02"]);
  });

  it("has unique row keys", () => {
    expect(new Set(TILE_ROWS.map((r) => r.rowKey)).size).toBe(TILE_ROWS.length);
  });

  it("fills every tile row from a connector that declares its item", () => {
    for (const r of TILE_ROWS) {
      const c = MARKET_CONNECTORS.find((m) => m.meta.id === r.sourceId);
      expect(c?.meta.items, r.rowKey).toContain(r.itemId);
      expect(c?.meta.storage === "connector-cache" ? "cc" : "main", r.rowKey).toBe(r.where);
    }
  });
});
