import { describe, expect, it, vi } from "vitest";
import { API_ROUTES } from "@finora/api-contract";
import { AT, agentsStatus, snapshot } from "@finora/api-contract/samples";
import { buildUrl, callApi } from "./api.ts";

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const route = (id: string) => API_ROUTES.find((r) => r.operationId === id) as (typeof API_ROUTES)[number];

describe("buildUrl", () => {
  it("fills each path parameter, encoded, and adds only the query values that are set", () => {
    expect(buildUrl(route("investigation"), { params: { id: "inv 1/x" } })).toBe("/api/v1/investigations/inv%201%2Fx");
    expect(buildUrl(route("search"), { query: { q: "Example & Sons", country: undefined } })).toBe("/api/v1/search?q=Example%20%26%20Sons");
    expect(buildUrl(route("health"))).toBe("/api/v1/health");
  });

  it("refuses a missing path parameter", () => {
    expect(() => buildUrl(route("investigation"), {})).toThrowError("missing path parameter: id");
  });
});

describe("callApi", () => {
  it("returns the data of a valid answer", async () => {
    const result = await callApi("agentsStatus", {}, (() => json(200, agentsStatus())) as typeof fetch);
    expect(result).toEqual({ ok: true, data: agentsStatus() });
  });

  it("uses the route's method and sends a JSON body only when there is one", async () => {
    const fetchFn = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => json(200, { id: "inv-1" }));
    await callApi("investigationStart", { body: { subject: { text: "Example" }, purposeId: "counterparty_check", locale: "en" } }, fetchFn as unknown as typeof fetch);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/investigations");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    await callApi("health", {}, fetchFn as unknown as typeof fetch);
    expect((fetchFn.mock.calls[1] as [string, RequestInit])[1].headers).toEqual({ Accept: "application/json" });
  });

  it("returns the server's error code and status", async () => {
    expect(await callApi("investigationStart", { body: {} }, (() => json(409, { error: { code: "investigation_running" } })) as typeof fetch)).toEqual({ ok: false, status: 409, code: "investigation_running" });
    expect(await callApi("agentsStatus", {}, (() => Promise.resolve(new Response("oops", { status: 502 }))) as typeof fetch)).toEqual({ ok: false, status: 502, code: "http_502" });
  });

  it("treats a body that breaks the contract as a failed request, and a dropped connection as network", async () => {
    expect(await callApi("agentsStatus", {}, (() => json(200, { backend: "wrong" })) as typeof fetch)).toEqual({ ok: false, status: 200, code: "bad_response" });
    expect(await callApi("agentsStatus", {}, (() => Promise.reject(new TypeError("down"))) as typeof fetch)).toEqual({ ok: false, status: 0, code: "network" });
  });

  it("answers null for a route with no body", async () => {
    expect(await callApi("investigationStop", { params: { id: "inv-1" } }, (() => Promise.resolve(new Response(null, { status: 202 }))) as typeof fetch)).toEqual({ ok: true, data: null });
  });

  it("validates a full investigation snapshot", async () => {
    const result = await callApi("investigation", { params: { id: "inv-1" } }, (() => json(200, snapshot())) as typeof fetch);
    expect(result.ok).toBe(true);
    expect(AT).toBeTruthy();
  });

  it("refuses an unknown operation", async () => {
    await expect(callApi("nothing", {})).rejects.toThrowError("no such operation");
  });
});
