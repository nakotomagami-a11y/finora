import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { FetchError, isPrivateAddress, politeFetch, retryAfterMs, type Transport, type TransportResponse } from "./fetcher.ts";

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

  it("sends a POST body only when given, and never follows a POST through a redirect (JSON-RPC reads)", async () => {
    const seen: { method: string | undefined; body: string }[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => {
        seen.push({ method: req.method, body });
        if (req.url === "/moved") {
          res.writeHead(302, { location: "/rpc" });
          res.end();
        } else res.end('{"result":1}');
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const port = (server.address() as AddressInfo).port;
      const fetch = politeFetch({ officialHosts: ["rpc.example.org"], userAgent: "x", resolve: async () => [{ address: "127.0.0.1", family: 4 }], allowAddress: () => true, allowHttp: true, retries: 0 });
      const posted = await fetch(`http://rpc.example.org:${port}/rpc`, { headers: { "content-type": "application/json" }, body: '{"method":"getbestblockhash"}' });
      expect(new TextDecoder().decode(posted.bytes)).toBe('{"result":1}');
      await fetch(`http://rpc.example.org:${port}/plain`);
      expect(seen).toEqual([
        { method: "POST", body: '{"method":"getbestblockhash"}' },
        { method: "GET", body: "" },
      ]);
      await expect(fetch(`http://rpc.example.org:${port}/moved`, { body: "{}" })).rejects.toMatchObject({ code: "too_many_redirects" });
    } finally {
      server.close();
    }
  });

  it("retries a POST only when it is marked idempotent, and keeps the body out of error messages", async () => {
    const plain = fake([{ status: 503, headers: {}, bytes: new Uint8Array() }, ok()]);
    const fetchPlain = politeFetch({ officialHosts: ["rpc.example.org"], userAgent: "x", transport: plain.transport, resolve: publicDns, sleep: plain.sleep });
    await expect(fetchPlain("https://rpc.example.org/", { body: '{"secret-body":1}' })).rejects.toSatisfy((e: unknown) => e instanceof FetchError && !e.message.includes("secret-body"));
    expect(plain.calls).toHaveLength(1);
    const marked = fake([{ status: 503, headers: {}, bytes: new Uint8Array() }, ok("done")]);
    const fetchMarked = politeFetch({ officialHosts: ["rpc.example.org"], userAgent: "x", transport: marked.transport, resolve: publicDns, sleep: marked.sleep });
    const r = await fetchMarked("https://rpc.example.org/", { body: "{}", idempotent: true });
    expect(new TextDecoder().decode(r.bytes)).toBe("done");
    expect(marked.calls).toHaveLength(2);
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
        allowAddress: () => true, allowHttp: true,
        maxBytes: 1000,
        retries: 0,
      });
      await expect(fetch(`http://files.example.lv:${port}/big`)).rejects.toMatchObject({ code: "too_large" });
      const roomy = politeFetch({ officialHosts: ["files.example.lv"], userAgent: "x", resolve: async () => [{ address: "127.0.0.1", family: 4 }], allowAddress: () => true, allowHttp: true });
      expect((await roomy(`http://files.example.lv:${port}/big`)).bytes.length).toBe(5000);
    } finally {
      server.close();
    }
  });
});

describe("the polite fetcher, after the S04i security review", () => {
  it("classifies IPv6 transition forms and special-use IPv4 ranges by the address they carry (SEC-5)", () => {
    for (const a of ["::ffff:7f00:1", "::ffff:a00:1", "64:ff9b::a00:1", "2002:a00:1::", "2001:0::1", "fec0::1", "100::1", "2001:db8::1", "::127.0.0.1", "::", "198.51.100.7", "203.0.113.9", "192.0.0.8", "240.0.0.1"]) {
      expect(isPrivateAddress(a), a).toBe(true);
    }
    for (const a of ["::ffff:808:808", "::ffff:8.8.8.8", "2a00:1450:4001::", "8.8.8.8"]) expect(isPrivateAddress(a), a).toBe(false);
  });

  it("refuses a redirect from https to http, and drops credentials when the host changes (SEC-6)", async () => {
    const down = fake([{ status: 302, headers: { location: "http://data.example.lv/plain" }, bytes: new Uint8Array() }]);
    const fetch = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: down.transport, resolve: publicDns, sleep: down.sleep });
    await expect(fetch("https://data.example.lv/")).rejects.toMatchObject({ code: "insecure_redirect" });

    const hop = fake([{ status: 302, headers: { location: "https://files.example.lv/a" }, bytes: new Uint8Array() }, ok("a")]);
    const fetch2 = politeFetch({ officialHosts: ["data.example.lv", "files.example.lv"], userAgent: "Finora", transport: hop.transport, resolve: publicDns, sleep: hop.sleep });
    await fetch2("https://data.example.lv/", { headers: { authorization: "Bearer KEY-SENTINEL", "x-api-key": "KEY-SENTINEL" } });
    expect(hop.calls[0]?.headers.authorization).toBe("Bearer KEY-SENTINEL");
    expect(JSON.stringify(hop.calls[1]?.headers)).not.toContain("KEY-SENTINEL");
    expect(hop.calls[1]?.headers["user-agent"]).toBe("Finora");
  });

  it("caps Retry-After at 5 minutes and reads the HTTP-date form (SEC-7)", () => {
    const now = Date.parse("2026-11-21T10:00:00Z");
    expect(retryAfterMs("7", now)).toBe(7000);
    expect(retryAfterMs("86400", now)).toBe(300_000);
    expect(retryAfterMs("Sat, 21 Nov 2026 10:00:30 GMT", now)).toBe(30_000);
    expect(retryAfterMs("soon", now)).toBeNull();
    expect(retryAfterMs(undefined, now)).toBeNull();
  });

  it("stops a slow drip at the total deadline, however often a byte arrives (SEC-7, the real transport)", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200);
      const timer = setInterval(() => res.write("x"), 50);
      res.on("close", () => clearInterval(timer));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    try {
      const fetch = politeFetch({ officialHosts: ["files.example.lv"], userAgent: "x", resolve: async () => [{ address: "127.0.0.1", family: 4 }], allowAddress: () => true, allowHttp: true, deadlineMs: 400, retries: 0 });
      const started = Date.now();
      await expect(fetch(`http://files.example.lv:${port}/drip`)).rejects.toMatchObject({ code: "deadline" });
      expect(Date.now() - started).toBeLessThan(3000);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  it("keeps the rate under concurrent calls: each reserves its slot before waiting (qa S1)", async () => {
    let clock = 0;
    const starts: number[] = [];
    const transport: Transport = async () => {
      starts.push(clock);
      return ok();
    };
    const sleep = async (ms: number) => {
      await new Promise((r) => setTimeout(r, 0));
      clock = Math.max(clock, ms + clock);
    };
    const fetch = politeFetch({ officialHosts: ["www.sec.example"], userAgent: "x", transport, resolve: publicDns, sleep, now: () => clock, requestsPerSecond: 10 });
    await Promise.all(Array.from({ length: 5 }, () => fetch("https://www.sec.example/")));
    expect(starts).toHaveLength(5);
    expect(new Set(starts).size).toBe(5);
  });
});

describe("https only (SEC-7 on S05)", () => {
  it("refuses a plain http URL unless the source opts in", async () => {
    const ok = () => fake([{ status: 200, headers: {}, bytes: new TextEncoder().encode("x") }]);
    const closed = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: ok().transport, resolve: publicDns });
    await expect(closed("http://data.example.lv/file.csv")).rejects.toMatchObject({ code: "host_not_official" });
    const open = politeFetch({ officialHosts: ["data.example.lv"], userAgent: "x", transport: ok().transport, resolve: publicDns, allowHttp: true });
    expect((await open("http://data.example.lv/file.csv")).status).toBe(200);
  });
});
