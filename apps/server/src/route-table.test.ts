import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { patternFor, renderRouteTable } from "../scripts/gen-route-table.mjs";
import { ROUTE_TABLE } from "./route-table.ts";

const SERVER_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("route table", () => {
  it("agrees with the route files (run `pnpm --filter @finora/server routes` after adding one)", () => {
    const committed = readFileSync(join(SERVER_ROOT, "src", "route-table.ts"), "utf8");
    expect(committed.replace(/\r\n/gu, "\n")).toBe(renderRouteTable(SERVER_ROOT));
  });

  it("lists the S02 routes under /api/v1", () => {
    expect(ROUTE_TABLE.map((entry) => entry.pattern)).toEqual(["/api/v1/about", "/api/v1/health"]);
  });

  it("turns a dynamic folder into a path parameter", () => {
    const routes = join("x", "routes");
    expect(patternFor(routes, join(routes, "v1", "companies", "[eid]", "route.ts"))).toBe("/api/v1/companies/:eid");
  });

  it("has no person path (L2)", () => {
    for (const { pattern } of ROUTE_TABLE) expect(pattern).not.toMatch(/person|people|officer/u);
  });
});
