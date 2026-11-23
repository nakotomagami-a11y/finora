// S04b: every contract route exists, validates its input, and in FINORA_DEMO serves a body that
// validates against its own response schema.
import { API_ROUTES, ErrorResponse, InvestigationEvent } from "@finora/api-contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BODY_BYTES } from "./contract-route.ts";
import { clearEnvCache } from "./env.ts";
import { ROUTE_TABLE } from "./route-table.ts";
import { handle } from "./router.ts";

const PARAMS: Record<string, string> = { eid: "lv-40003000018", section: "S03", register: "ny", id: "inv-1", qid: "q1", runId: "run-registry" };
const QUERY: Record<string, string> = { search: "?q=example", searchLive: "?q=example", companyExport: "?format=json" };
const BODIES: Record<string, unknown> = {
  purpose: { purposeId: "counterparty_check" },
  dispute: { companyEid: "lv-40003000018", itemId: "S01.LV.01", kind: "correction", note: "Wrong status" },
  investigationEstimate: { subject: { eid: "lv-40003000018" }, roles: ["registry", "money", "legal", "web"] },
  investigationStart: { subject: { eid: "lv-40003000018", offerDomain: "example-shop.invalid" }, purposeId: "supplier_check", locale: "en" },
  investigationAnswer: { optionId: "a" },
  investigationFollowUp: { question: "Why is it in liquidation?" },
  settingsStartupUpdate: { enabled: false },
};

function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return handle(
    new Request(`http://127.0.0.1:3000${path}`, {
      method,
      headers: { host: "127.0.0.1:3000", ...(body === undefined ? {} : { "content-type": "application/json", origin: "http://127.0.0.1:3000" }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
const pathFor = (path: string) => path.replace(/\{(\w+)\}/g, (_, name: string) => PARAMS[name] ?? name);

describe("contract routes (S04b)", () => {
  it("every API_ROUTES entry has a route module with its method, and every route module is in API_ROUTES", () => {
    const table = new Map(ROUTE_TABLE.map((e) => [e.pattern, e.module]));
    for (const route of API_ROUTES) {
      const pattern = route.path.replace(/\{(\w+)\}/g, ":$1");
      expect(table.get(pattern)?.[route.method], `${route.method} ${route.path}`).toBeTypeOf("function");
    }
    const contract = new Set(API_ROUTES.map((r) => `${r.method} ${r.path.replace(/\{(\w+)\}/g, ":$1")}`));
    for (const entry of ROUTE_TABLE) for (const method of Object.keys(entry.module)) expect(contract.has(`${method} ${entry.pattern}`), `${method} ${entry.pattern}`).toBe(true);
  });

  describe("with FINORA_DEMO=1", () => {
    beforeEach(() => {
      vi.stubEnv("FINORA_DEMO", "1");
      clearEnvCache();
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      clearEnvCache();
    });

    for (const route of API_ROUTES) {
      it(`${route.method} ${route.path} answers ${route.status} with a schema-valid body`, async () => {
        const response = await call(route.method, `${pathFor(route.path)}${QUERY[route.operationId] ?? ""}`, BODIES[route.operationId]);
        expect(response.status).toBe(route.status);
        if (route.response === null) return;
        if (route.stream === "sse") {
          const events = (await response.text()).split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)) as unknown);
          expect(events.length).toBeGreaterThan(0);
          for (const event of events) InvestigationEvent.parse(event);
          return;
        }
        route.response.parse(await response.json());
      });
    }

    it("resumes the event stream after Last-Event-ID with no gap or repeat", async () => {
      const response = await call("GET", "/api/v1/investigations/inv-1/events", undefined, { "last-event-id": "4" });
      const ids = (await response.text()).split("\n").filter((l) => l.startsWith("id: ")).map((l) => Number(l.slice(4)));
      expect(ids).toEqual([5, 6, 7]);
    });
  });

  it("validates input before anything else: a person row id, a bad body, a blocked purpose", async () => {
    const badEid = await call("GET", "/api/v1/companies/p-1-2");
    expect(badEid.status).toBe(400);
    expect(ErrorResponse.parse(await badEid.json()).error).toEqual({ code: "bad_request", detail: "params.eid" });
    const badBody = await call("POST", "/api/v1/disputes", { companyEid: "lv-40003000018", itemId: "S01.LV.01", kind: "rant" });
    expect(ErrorResponse.parse(await badBody.json()).error).toEqual({ code: "bad_request", detail: "body.kind" });
    const blocked = await call("POST", "/api/v1/purpose", { purposeId: "employment_decision" });
    expect(blocked.status).toBe(400);
    expect(ErrorResponse.parse(await blocked.json()).error.code).toBe("purpose_blocked");
  });

  it("refuses a relationship row id in a path (PS5, legal MUST on S04b)", async () => {
    const response = await call("GET", "/api/v1/companies/rel-1-0");
    expect(response.status).toBe(400);
    expect(ErrorResponse.parse(await response.json()).error).toEqual({ code: "bad_request", detail: "params.eid" });
  });

  it("refuses a body over 64 KB with 413, declared or streamed, without echoing it", async () => {
    const big = { companyEid: "lv-40003000018", itemId: "S01.LV.01", kind: "correction", note: "x".repeat(MAX_BODY_BYTES) };
    const response = await call("POST", "/api/v1/disputes", big);
    expect(response.status).toBe(413);
    const text = await response.text();
    expect(ErrorResponse.parse(JSON.parse(text)).error.code).toBe("payload_too_large");
    expect(text).not.toContain("xxxx");
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 10; i++) controller.enqueue(new TextEncoder().encode("x".repeat(16 * 1024)));
        controller.close();
      },
    });
    const undeclared = await handle(
      new Request("http://127.0.0.1:3000/api/v1/disputes", { method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit),
    );
    expect(undeclared.status).toBe(413);
  });

  it("without the demo flag, a route with no service yet answers 501 not_implemented", async () => {
    const response = await call("GET", "/api/v1/companies/lv-40003000018");
    expect(response.status).toBe(501);
    expect(ErrorResponse.parse(await response.json()).error.code).toBe("not_implemented");
  });
});
