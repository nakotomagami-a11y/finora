import { describe, expect, it } from "vitest";
import { ErrorResponse } from "@finora/api-contract";
import { guardRequest, securityHeaders } from "./guard.ts";

function req(host: string | null, init: { method?: string; origin?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (host !== null) headers.host = host;
  if (init.origin !== undefined) headers.origin = init.origin;
  return new Request("http://127.0.0.1:3000/x", { method: init.method ?? "GET", headers });
}

async function codeOf(response: Response | null): Promise<string | null> {
  if (!response) return null;
  expect(response.status).toBe(403);
  return ErrorResponse.parse(await response.json()).error.code;
}

describe("guardRequest: Host", () => {
  it.each(["localhost", "localhost:3000", "127.0.0.1", "127.0.0.1:3000", "[::1]", "[::1]:3000", "LOCALHOST:3000"])(
    "lets %s through",
    (host) => {
      expect(guardRequest(req(host))).toBeNull();
    },
  );

  it.each(["evil.example", "evil.example:3000", "127.0.0.1.evil.example", "localhost.evil.example:80", "10.0.0.5"])(
    "refuses %s with host_not_allowed",
    async (host) => {
      expect(await codeOf(guardRequest(req(host)))).toBe("host_not_allowed");
    },
  );

  it("refuses a request with no Host header", async () => {
    expect(await codeOf(guardRequest(req(null)))).toBe("host_not_allowed");
  });
});

describe("guardRequest: Origin on unsafe methods", () => {
  it("lets a same-origin POST through", () => {
    expect(guardRequest(req("127.0.0.1:3000", { method: "POST", origin: "http://127.0.0.1:3000" }))).toBeNull();
  });

  it("lets a POST with no Origin through (a local command-line client)", () => {
    expect(guardRequest(req("127.0.0.1:3000", { method: "POST" }))).toBeNull();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("refuses a foreign Origin on %s with forbidden", async (method) => {
    expect(await codeOf(guardRequest(req("127.0.0.1:3000", { method, origin: "https://evil.example" })))).toBe("forbidden");
  });

  it("refuses an Origin that is not a URL", async () => {
    expect(await codeOf(guardRequest(req("127.0.0.1:3000", { method: "POST", origin: "null" })))).toBe("forbidden");
  });

  it("does not check Origin on a GET", () => {
    expect(guardRequest(req("127.0.0.1:3000", { origin: "https://other.example" }))).toBeNull();
  });
});

describe("securityHeaders", () => {
  const headers = securityHeaders({ nonce: "abc", development: false });

  it("carries the CSP, nosniff and referrer headers", () => {
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("'nonce-abc'");
  });

  it("lets only nonce-marked styles through in production", () => {
    const directives = (headers["Content-Security-Policy"] ?? "").split("; ");
    expect(directives.find((d) => d.startsWith("style-src "))).toBe("style-src 'self' 'nonce-abc'");
  });

  it("allows no eval in production, and only in development", () => {
    expect(headers["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(securityHeaders({ nonce: "abc", development: true })["Content-Security-Policy"]).toContain("'unsafe-eval'");
  });

  it("allows no third-party origin", () => {
    expect(headers["Content-Security-Policy"]).not.toMatch(/https?:\/\//u);
  });
});
