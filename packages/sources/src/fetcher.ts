// The polite fetcher (architecture §4.4 step 1, §12): official hosts only, no private address
// after DNS (the connection is pinned to the address that was checked, so a second lookup cannot
// swap it), a per-source rate limit, retries with backoff, a size cap and a total deadline.
import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import type { PoliteFetch } from "./types.ts";

export class FetchError extends Error {
  readonly code: "host_not_official" | "private_address" | "too_large" | "http_status" | "too_many_redirects" | "insecure_redirect" | "deadline" | "network";
  readonly status: number | null;
  constructor(code: FetchError["code"], message: string, status: number | null = null) {
    super(message);
    this.name = "FetchError";
    this.code = code;
    this.status = status;
  }
}

// Every range that is not the public internet (RFC 6890 and its successors): private, loopback,
// link-local, CGNAT, documentation, benchmarking, multicast, reserved, and the IPv6 transition
// prefixes (NAT64, 6to4, Teredo, ORCHID), which can carry a private IPv4 address inside them.
// Two lists: Node matches an IPv4 address against IPv6 rules through ::ffff:, so one shared list
// would block every IPv4 address. Embedded IPv4 inside IPv6 is unpacked and judged as IPv4 below.
const BLOCKED_V4 = new BlockList();
const BLOCKED_V6 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED_V4.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23],
  ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20], ["5f00::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) BLOCKED_V6.addSubnet(net, prefix, "ipv6");

/** The eight 16-bit groups of an IPv6 address, dotted-quad tail included. */
function groups(address: string): number[] | null {
  let text = address.toLowerCase().split("%")[0] ?? "";
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted?.[1]) {
    const [a = 0, b = 0, c = 0, d = 0] = dotted[1].split(".").map(Number);
    text = `${text.slice(0, -dotted[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = "", tail] = text.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const fill = tail === undefined ? 0 : 8 - h.length - t.length;
  const all = [...h, ...Array.from({ length: fill }, () => "0"), ...t].map((g) => Number.parseInt(g, 16));
  return all.length === 8 && all.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? all : null;
}

/** True unless the address is on the public internet. An unparsable address counts as private. */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return BLOCKED_V4.check(address, "ipv4");
  if (family !== 6) return true;
  const g = groups(address);
  if (!g) return true;
  // An IPv4 address carried inside IPv6 (mapped, compatible, or the hex form of either) is judged as IPv4.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    // ::/96 (compatible, deprecated) and ::ffff:0:0/96 (mapped): the unspecified and loopback
    // addresses are private, every other is judged by the IPv4 it carries.
    if (g[5] === 0 && (g[6] ?? 0) === 0 && (g[7] ?? 0) <= 1) return true;
    const v4 = `${(g[6] ?? 0) >> 8}.${(g[6] ?? 0) & 255}.${(g[7] ?? 0) >> 8}.${(g[7] ?? 0) & 255}`;
    return BLOCKED_V4.check(v4, "ipv4");
  }
  return BLOCKED_V6.check(g.map((x) => x.toString(16)).join(":"), "ipv6");
}

export type TransportResponse = { status: number; headers: Record<string, string>; bytes: Uint8Array };
export type Transport = (
  url: URL,
  options: { headers: Record<string, string>; address: string; family: number; maxBytes: number; deadline: number; body?: string },
) => Promise<TransportResponse>;
export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

/** node:http(s) with the connection pinned to the checked address, an idle timeout and a total deadline. */
export const nodeTransport: Transport = (url, { headers, address, family, maxBytes, deadline, body }) =>
  new Promise((resolve, reject) => {
    let failed = false;
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? headers : { ...headers, "content-length": String(Buffer.byteLength(body)) },
        timeout: 60_000,
        // Node asks for every address when `all` is set (happy eyeballs); answer with the checked one only.
        lookup: ((_host: string, opts: { all?: boolean }, cb: (...args: unknown[]) => void) =>
          opts.all ? cb(null, [{ address, family }]) : cb(null, address, family)) as unknown as http.RequestOptions["lookup"],
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            failed = true;
            clearTimeout(timer);
            reject(new FetchError("too_large", `${url.hostname}: response larger than ${maxBytes} bytes`));
            request.destroy();
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          clearTimeout(timer);
          if (failed) return;
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(response.headers)) if (v !== undefined) out[k] = Array.isArray(v) ? v.join(", ") : v;
          resolve({ status: response.statusCode ?? 0, headers: out, bytes: new Uint8Array(Buffer.concat(chunks)) });
        });
        response.on("error", (error) => reject(error instanceof FetchError ? error : new FetchError("network", `${url.hostname}: ${error.message}`)));
      },
    );
    // A slow drip never outlives the deadline, however often a byte arrives.
    const timer = setTimeout(() => request.destroy(new FetchError("deadline", `${url.hostname}: no complete answer before the deadline`)), Math.max(0, deadline - Date.now()));
    request.on("timeout", () => request.destroy(new FetchError("network", `${url.hostname}: timed out`)));
    request.on("error", (error) => {
      clearTimeout(timer);
      if (failed) return;
      failed = true;
      reject(error instanceof FetchError ? error : new FetchError("network", `${url.hostname}: ${error.message}`));
    });
    request.end(body);
  });

export type PoliteFetchOptions = {
  officialHosts: readonly string[];
  userAgent: string;
  requestsPerSecond?: number;
  /** Per source; the default keeps a buffered body well inside memory. */
  maxBytes?: number;
  /** Time one request may take in total, redirects and retries included. */
  deadlineMs?: number;
  retries?: number;
  backoffMs?: number;
  transport?: Transport;
  resolve?: Resolver;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Tests only: let a local server through the address check. */
  allowAddress?: (address: string) => boolean;
};

const RETRYABLE = (status: number) => status === 429 || status >= 500;
const RETRY_AFTER_CAP_MS = 300_000;
/** Headers that survive a redirect to another host; anything else (keys, cookies) is dropped. */
const SAFE_ON_HOST_CHANGE = new Set(["user-agent", "accept-encoding", "accept"]);

/** Retry-After as seconds or an HTTP date, capped at 5 minutes; null if absent or unreadable. */
export function retryAfterMs(value: string | undefined, now: number): number | null {
  if (!value) return null;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, RETRY_AFTER_CAP_MS) : null;
}

export function politeFetch(options: PoliteFetchOptions): PoliteFetch {
  const transport = options.transport ?? nodeTransport;
  const resolve: Resolver = options.resolve ?? ((h) => dnsLookup(h, { all: true }));
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const interval = 1000 / (options.requestsPerSecond ?? 2);
  const maxBytes = options.maxBytes ?? 512 * 1024 ** 2;
  const deadlineMs = options.deadlineMs ?? 15 * 60_000;
  const retries = options.retries ?? 3;
  const backoff = options.backoffMs ?? 500;
  const allowed = options.allowAddress ?? ((a: string) => !isPrivateAddress(a));
  let next = 0;

  /** Reserves the next slot before waiting, so concurrent calls still keep to the rate. */
  async function pace(): Promise<void> {
    const t = now();
    const slot = Math.max(t, next);
    next = slot + interval;
    if (slot > t) await sleep(slot - t);
  }

  async function once(url: URL, headers: Record<string, string>, deadline: number, body: string | undefined): Promise<TransportResponse> {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchError("host_not_official", `${url.protocol} is not fetched`);
    if (!options.officialHosts.includes(url.hostname)) throw new FetchError("host_not_official", `${url.hostname} is not an official host of this source`);
    const addresses = isIP(url.hostname) ? [{ address: url.hostname, family: isIP(url.hostname) }] : await resolve(url.hostname);
    const target = addresses[0];
    if (!target || addresses.some((a) => !allowed(a.address))) {
      throw new FetchError("private_address", `${url.hostname} resolves to an address that is not public`);
    }
    await pace();
    if (now() > deadline) throw new FetchError("deadline", `${url.hostname}: no complete answer before the deadline`);
    return transport(url, { headers, address: target.address, family: target.family, maxBytes, deadline, ...(body === undefined ? {} : { body }) });
  }

  return async (input, init) => {
    const deadline = now() + deadlineMs;
    let headers: Record<string, string> = { "user-agent": options.userAgent, "accept-encoding": "identity", ...init?.headers };
    let url = new URL(input);
    // A POST body is never re-sent to another host; a redirect turns it into a refused request.
    const body = init?.body;
    const retriesFor = body === undefined || init?.idempotent === true ? retries : 0;
    for (let redirects = 0; ; ) {
      let response: TransportResponse | undefined;
      for (let attempt = 0; ; attempt++) {
        try {
          response = await once(url, headers, deadline, body);
        } catch (error) {
          if (!(error instanceof FetchError) || error.code !== "network" || attempt >= retriesFor) throw error;
          await sleep(backoff * 2 ** attempt);
          continue;
        }
        if (!RETRYABLE(response.status) || attempt >= retriesFor) break;
        await sleep(retryAfterMs(response.headers["retry-after"], now()) ?? backoff * 2 ** attempt);
      }
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        if (++redirects > 3) throw new FetchError("too_many_redirects", `${url.hostname}: more than 3 redirects`);
        const target = new URL(response.headers.location, url);
        if (body !== undefined) throw new FetchError("too_many_redirects", `${url.hostname}: a POST is not followed through a redirect`);
        if (url.protocol === "https:" && target.protocol !== "https:") throw new FetchError("insecure_redirect", `${url.hostname}: a redirect away from https is refused`);
        if (target.host !== url.host) headers = Object.fromEntries(Object.entries(headers).filter(([k]) => SAFE_ON_HOST_CHANGE.has(k.toLowerCase())));
        url = target;
        continue;
      }
      if (response.status >= 400) throw new FetchError("http_status", `${url.hostname}: HTTP ${response.status}`, response.status);
      return response;
    }
  };
}
