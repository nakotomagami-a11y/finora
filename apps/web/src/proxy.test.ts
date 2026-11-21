import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isLocaleFree } from "./lib/paths.ts";
import { config, proxy } from "./proxy.ts";

function request(path: string, host = "127.0.0.1:3000", method = "GET"): NextRequest {
  return new NextRequest(`http://127.0.0.1:3000${path}`, { method, headers: { host } });
}

/** The matcher as the regular expression Next.js builds from it. */
const MATCHED = new RegExp(`^${config.matcher[0]}$`, "u");

describe("the proxy matcher", () => {
  it.each(["/", "/en", "/en/terms", "/en/x.y", "/en/terms.rsc", "/api/v1/health", "/api/v1/health.json", "/favicon.ico", "/robots.txt", "/_next/image", "/_next/data/x.json"])(
    "runs on %s",
    (path) => {
      expect(MATCHED.test(path)).toBe(true);
    },
  );

  it.each(["/_next/static/chunks/a.js", "/_next/static/css/b.css"])("skips %s", (path) => {
    expect(MATCHED.test(path)).toBe(false);
  });
});

describe("proxy", () => {
  it.each(["/en/x.y", "/en/terms.rsc", "/api/v1/health.json", "/_next/webpack-hmr", "/en/terms", "/"])(
    "refuses a foreign Host on %s",
    (path) => {
      const response = proxy(request(path, "evil.example"));
      expect(response.status).toBe(403);
      expect(response.headers.get("content-security-policy")).toContain("'nonce-");
    },
  );

  it.each(["/en/x.y", "/en/terms.rsc", "/api/v1/health.json", "/en/terms"])("gives %s a nonce CSP with a normal Host", (path) => {
    const response = proxy(request(path));
    expect(response.status).not.toBe(403);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/u);
    expect(csp).toMatch(/style-src 'self' 'nonce-[^']+'/u);
    expect(csp).not.toContain("unsafe-eval");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("refuses a cross-site POST on a dotted path", () => {
    const response = proxy(new NextRequest("http://127.0.0.1:3000/en/x.y", { method: "POST", headers: { host: "127.0.0.1:3000", origin: "https://evil.example" } }));
    expect(response.status).toBe(403);
  });
});

describe("isLocaleFree", () => {
  it("is true for the API, Next.js internals and file-like paths", () => {
    for (const path of ["/api/v1/health", "/_next/data/x.json", "/en/terms.rsc", "/favicon.ico"]) expect(isLocaleFree(path), path).toBe(true);
  });

  it("is false for pages", () => {
    for (const path of ["/", "/en", "/lv/terms", "/explorer/lv/40000FX0001"]) expect(isLocaleFree(path), path).toBe(false);
  });
});
