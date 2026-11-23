import { describe, expect, it, vi } from "vitest";
import { purposeInForce, setPurpose } from "./purpose.ts";

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("setPurpose", () => {
  it("posts the purpose id and nothing else, with the cookie, and returns when it expires", async () => {
    const fetchFn = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => json(200, { purposeId: "counterparty_check", expiresAt: "2026-11-22T20:00:00.000Z" }));
    const result = await setPurpose("counterparty_check", fetchFn as unknown as typeof fetch);
    expect(result).toEqual({ ok: true, purposeId: "counterparty_check", expiresAt: "2026-11-22T20:00:00.000Z" });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/purpose");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(String(init.body))).toEqual({ purposeId: "counterparty_check" });
  });

  it("returns the server's error code, such as purpose_blocked, and nothing more", async () => {
    const result = await setPurpose("counterparty_check", (() => json(400, { error: { code: "purpose_blocked" } })) as typeof fetch);
    expect(result).toEqual({ ok: false, code: "purpose_blocked" });
  });

  it("names a failure with no usable body by its status, a network failure, or a bad answer", async () => {
    expect(await setPurpose("counterparty_check", (() => Promise.resolve(new Response("oops", { status: 502 }))) as typeof fetch)).toEqual({ ok: false, code: "http_502" });
    expect(await setPurpose("counterparty_check", (() => Promise.reject(new TypeError("down"))) as typeof fetch)).toEqual({ ok: false, code: "network" });
    expect(await setPurpose("counterparty_check", (() => json(200, { purposeId: "x" })) as typeof fetch)).toEqual({ ok: false, code: "bad_response" });
  });
});

describe("purposeInForce", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  it("is true before the expiry and false at it, after it, or with none", () => {
    expect(purposeInForce("2026-11-22T12:00:01Z", now)).toBe(true);
    expect(purposeInForce("2026-11-22T12:00:00Z", now)).toBe(false);
    expect(purposeInForce("2026-11-22T11:00:00Z", now)).toBe(false);
    expect(purposeInForce(null, now)).toBe(false);
  });
});
