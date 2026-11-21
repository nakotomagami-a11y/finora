import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { FetchError, isPrivateAddress, politeFetch, type Transport, type TransportResponse } from "./fetcher.ts";

const ok = (body = "ok", headers: Record<string, string> = {}): TransportResponse => ({ status: 200, headers, bytes: new TextEncoder().encode(body) });
const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];

function fake(responses: (TransportResponse | Error)[]) {
  const calls: { url: string; address: string; headers: Record<string, string> }[] = [];
  const transport: Transport = async (url, opts) => {
    calls.push({ url: url.href, address: opts.address, headers: opts.headers });
    const next = responses.shift() ?? ok();
    if (next instanceof Error) throw next;
    return next;
  };
  const slept: number[] = [];
  return { transport, calls, slept, sleep: async (ms: number) => void slept.push(ms) };
}

describe("the polite fetcher", () => {
  it("fetches an official host with the user agent, pinned to the checked address", async () => {
    const f = fake([ok("data")]);
    const fetch = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "Finora test@example.org", transport: f.transport, resolve: publicDns, sleep: f.sleep });
    const response = await fetch("https://data.example.lv/file.csv");
    expect(new TextDecoder().decode(response.bytes)).toBe("data");
    expect(f.calls[0]).toMatchObject({ address: "93.184.216.34", headers: { "user-agent": "Finora test@example.org" } });
  });

  it("refuses a host that is not official, before any request", async () => {
    const f = fake([]);
    const fetch = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: f.transport, resolve: publicDns });
    await expect(fetch("https://evil.example.com/")).rejects.toMatchObject({ code: "host_not_official" });
    await expect(fetch("file:///etc/passwd")).rejects.toMatchObject({ code: "host_not_official" });
    expect(f.calls).toHaveLength(0);
  });

  it("refuses an official host that resolves to a private address (DNS rebinding)", async () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      const f = fake([]);
      const fetch = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: f.transport, resolve: async () => [{ address, family: address.includes(":") ? 6 : 4 }] });
      await expect(fetch("https://data.example.lv/"), address).rejects.toMatchObject({ code: "private_address" });
      expect(f.calls).toHaveLength(0);
    }
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });

  it("re-checks every redirect target and stops after three", async () => {
    const f = fake([{ status: 302, headers: { location: "https://evil.example.com/x" }, bytes: new Uint8Array() }]);
    const fetch = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: f.transport, resolve: publicDns, sleep: f.sleep });
    await expect(fetch("https://data.example.lv/")).rejects.toMatchObject({ code: "host_not_official" });
    const loop = fake(Array.from({ length: 5 }, () => ({ status: 301, headers: { location: "/again" }, bytes: new Uint8Array() })));
    const fetch2 = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: loop.transport, resolve: publicDns, sleep: loop.sleep });
    await expect(fetch2("https://data.example.lv/")).rejects.toMatchObject({ code: "too_many_redirects" });
  });

  it("retries 5xx, 429 and network errors with backoff, honours Retry-After, and gives up", async () => {
    const f = fake([{ status: 503, headers: {}, bytes: new Uint8Array() }, { status: 429, headers: { "retry-after": "7" }, bytes: new Uint8Array() }, new FetchError("network", "reset"), ok("late")]);
    const fetch = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: f.transport, resolve: publicDns, sleep: f.sleep, backoffMs: 100, requestsPerSecond: 1000 });
    expect(new TextDecoder().decode((await fetch("https://data.example.lv/")).bytes)).toBe("late");
    expect(f.slept.filter((ms) => ms >= 100)).toEqual([100, 7000, 400]);

    const down = fake(Array.from({ length: 10 }, () => ({ status: 500, headers: {}, bytes: new Uint8Array() })));
    const fetch2 = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: down.transport, resolve: publicDns, sleep: down.sleep, retries: 2 });
    await expect(fetch2("https://data.example.lv/")).rejects.toMatchObject({ code: "http_status", status: 500 });
    expect(down.calls).toHaveLength(3);
  });

  it("does not retry a 404", async () => {
    const f = fake([{ status: 404, headers: {}, bytes: new Uint8Array() }]);
    const fetch = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: f.transport, resolve: publicDns, sleep: f.sleep });
    await expect(fetch("https://data.example.lv/")).rejects.toMatchObject({ status: 404 });
    expect(f.calls).toHaveLength(1);
  });

  it("keeps to the source's rate limit (SEC: at most 10 per second)", async () => {
    let clock = 0;
    const f = fake([]);
    const sleep = async (ms: number) => {
      f.slept.push(ms);
      clock += ms;
    };
    const fetch = politeFetch({ officialHosts: ["www.sec.example"], userAgent: "x", transport: f.transport, resolve: publicDns, sleep, now: () => clock, requestsPerSecond: 10 });
    for (let i = 0; i < 11; i++) await fetch("https://www.sec.example/");
    expect(clock).toBeGreaterThanOrEqual(1000);
  });

  it("stops a response over the size cap (the real transport, against a local server)", async () => {
    const server = createServer((_req, res) => res.end("x".repeat(5000)));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    try {
      const fetch = politeFetch({
        officialHosts: ["files.example.lv"],
        userAgent: "x",
        resolve: async () => [{ address: "127.0.0.1", family: 4 }],
        allowAddress: () => true,
        maxBytes: 1000,
        retries: 0,
      });
      await expect(fetch(`http://files.example.lv:${port}/big`)).rejects.toMatchObject({ code: "too_large" });
      const roomy = politeFetch({ officialHosts: ["files.example.lv"], userAgent: "x", resolve: async () => [{ address: "127.0.0.1", family: 4 }], allowAddress: () => true });
      expect((await roomy(`http://files.example.lv:${port}/big`)).bytes.length).toBe(5000);
    } finally {
      server.close();
    }
  });
});
