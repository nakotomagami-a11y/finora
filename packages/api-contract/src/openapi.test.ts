import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openApiText } from "./openapi.ts";
import { API_ROUTES } from "./routes.ts";
import { apiVersion, OPENAPI_FILE } from "./write-openapi.ts";

describe("OpenAPI (S04b acceptance 2)", () => {
  it("docs/api/openapi.json is generated and current: run `pnpm --filter @finora/api-contract openapi`", () => {
    expect(readFileSync(OPENAPI_FILE, "utf8").replace(/\r\n/g, "\n")).toBe(openApiText(apiVersion()));
  });

  it("lists every route once, each with a unique operation id", () => {
    const keys = API_ROUTES.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(API_ROUTES.map((r) => r.operationId)).size).toBe(API_ROUTES.length);
    const doc = JSON.parse(openApiText("0")) as { paths: Record<string, Record<string, unknown>> };
    expect(Object.values(doc.paths).reduce((n, p) => n + Object.keys(p).length, 0)).toBe(API_ROUTES.length);
  });
});
