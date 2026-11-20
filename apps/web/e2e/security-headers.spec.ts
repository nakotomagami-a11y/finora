import { expect, test } from "@playwright/test";

test.describe("security headers", () => {
  test("pages carry the CSP, nosniff and referrer headers, and the nonce reaches the scripts", async ({ request }) => {
    const response = await request.get("/en");
    expect(response.status()).toBe(200);
    const headers = response.headers();
    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/https?:\/\//u);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("no-referrer");

    const nonce = /'nonce-([^']+)'/u.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    const html = await response.text();
    const scriptNonces = [...html.matchAll(/<script[^>]*\snonce="([^"]+)"/gu)].map((m) => m[1]);
    expect(scriptNonces.length).toBeGreaterThan(0);
    expect(new Set(scriptNonces)).toEqual(new Set([nonce]));
  });

  test("each page request gets a fresh nonce", async ({ request }) => {
    const first = (await request.get("/en")).headers()["content-security-policy"];
    const second = (await request.get("/en")).headers()["content-security-policy"];
    expect(first).not.toBe(second);
  });

  test("the API carries the same headers", async ({ request }) => {
    const response = await request.get("/api/v1/health");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  });
});

test.describe("local-only guard", () => {
  test("a foreign Host gets 403 host_not_allowed on the API and on pages", async ({ request }) => {
    const api = await request.get("/api/v1/health", { headers: { Host: "evil.example" } });
    expect(api.status()).toBe(403);
    expect(await api.json()).toEqual({ error: { code: "host_not_allowed" } });

    const page = await request.get("/en", { headers: { Host: "evil.example" }, maxRedirects: 0 });
    expect(page.status()).toBe(403);
  });

  test("a POST with a foreign Origin gets 403 forbidden on the API and on pages", async ({ request }) => {
    const origin = "https://evil.example";
    const api = await request.post("/api/v1/health", { headers: { Origin: origin } });
    expect(api.status()).toBe(403);
    expect(await api.json()).toEqual({ error: { code: "forbidden" } });

    const page = await request.post("/en", { headers: { Origin: origin }, maxRedirects: 0 });
    expect(page.status()).toBe(403);
  });

  test("a same-origin POST is not refused by the guard", async ({ request, baseURL }) => {
    const response = await request.post("/api/v1/health", { headers: { Origin: baseURL ?? "" } });
    expect(response.status()).toBe(405);
  });
});
