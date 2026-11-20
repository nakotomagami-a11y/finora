import { describe, expect, it } from "vitest";
import { ErrorResponse } from "@finora/api-contract";
import { handle, matchRoute } from "./router.ts";
import type { RouteEntry } from "./router-types.ts";

const LOCAL = { host: "127.0.0.1:3000" };

function request(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Request {
  return new Request(`http://127.0.0.1:3000${path}`, { ...init, headers: { ...LOCAL, ...init.headers } });
}

const table: readonly RouteEntry[] = [
  { pattern: "/api/v1/things/:id", module: { GET: (_r, ctx) => ctx.params.then((p) => Response.json({ id: p.id })) } },
  { pattern: "/api/v1/things/latest", module: { GET: () => Response.json({ id: "latest" }) } },
  {
    pattern: "/api/v1/boom",
    module: {
      GET: () => {
        throw new Error("secret detail");
      },
    },
  },
];

describe("matchRoute", () => {
  it("prefers a static segment over a parameter", () => {
    expect(matchRoute("/api/v1/things/latest", table)?.entry.pattern).toBe("/api/v1/things/latest");
    expect(matchRoute("/api/v1/things/42", table)?.params).toEqual({ id: "42" });
  });

  it("returns null for an unknown path", () => {
    expect(matchRoute("/api/v1/nothing", table)).toBeNull();
  });
});

describe("handle", () => {
  it("answers a known route with its handler", async () => {
    const response = await handle(request("/api/v1/things/7"), table);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "7" });
  });

  it("answers an unknown path with a machine code, not a sentence", async () => {
    const response = await handle(request("/api/v1/missing"), table);
    expect(response.status).toBe(404);
    expect(ErrorResponse.parse(await response.json())).toEqual({ error: { code: "not_found" } });
  });

  it("answers a method the route lacks with 405 and an Allow header", async () => {
    const response = await handle(request("/api/v1/things/7", { method: "DELETE" }), table);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });

  it("answers HEAD with the GET status and no body", async () => {
    const response = await handle(request("/api/v1/things/7", { method: "HEAD" }), table);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("turns a thrown error into internal_error without leaking its message", async () => {
    const response = await handle(request("/api/v1/boom"), table);
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(text).toContain("internal_error");
    expect(text).not.toContain("secret detail");
  });

  it("applies the guard before routing", async () => {
    const response = await handle(request("/api/v1/things/7", { headers: { host: "evil.example" } }), table);
    expect(response.status).toBe(403);
  });
});
