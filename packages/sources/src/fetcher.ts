// The polite fetcher (architecture §4.4 step 1, §12): official hosts only, no private address
// after DNS (the connection is pinned to the address that was checked, so a second lookup cannot
// swap it), a per-source rate limit, retries with backoff, and a size cap.
import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type { PoliteFetch } from "./types.ts";

export class FetchError extends Error {
  readonly code: "host_not_official" | "private_address" | "too_large" | "http_status" | "too_many_redirects" | "network";
  readonly status: number | null;
  constructor(code: FetchError["code"], message: string, status: number | null = null) {
    super(message);
    this.name = "FetchError";
    this.code = code;
    this.status = status;
  }
}

/** True for loopback, private, link-local, CGNAT, multicast, reserved and unspecified addresses. */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19))
    );
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || /^ff/.test(lower);
  }
  return true;
}

export type TransportResponse = { status: number; headers: Record<string, string>; bytes: Uint8Array };
export type Transport = (url: URL, options: { headers: Record<string, string>; address: string; family: number; maxBytes: number }) => Promise<TransportResponse>;
export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

/** node:http(s) with the connection pinned to the checked address. */
export const nodeTransport: Transport = (url, { headers, address, family, maxBytes }) =>
  new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        headers,
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
            request.destroy();
            reject(new FetchError("too_large", `${url.hostname}: response larger than ${maxBytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(response.headers)) if (v !== undefined) out[k] = Array.isArray(v) ? v.join(", ") : v;
          resolve({ status: response.statusCode ?? 0, headers: out, bytes: new Uint8Array(Buffer.concat(chunks)) });
        });
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new FetchError("network", `${url.hostname}: timed out`)));
    request.on("error", (error) => reject(error instanceof FetchError ? error : new FetchError("network", `${url.hostname}: ${error.message}`)));
    request.end();
  });

export type PoliteFetchOptions = {
  officialHosts: readonly string[];
  userAgent: string;
  requestsPerSecond?: number;
  maxBytes?: number;
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

export function politeFetch(options: PoliteFetchOptions): PoliteFetch {
  const transport = options.transport ?? nodeTransport;
  const resolve: Resolver = options.resolve ?? ((h) => dnsLookup(h, { all: true }));
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const interval = 1000 / (options.requestsPerSecond ?? 2);
  const maxBytes = options.maxBytes ?? 2 * 1024 ** 3;
  const retries = options.retries ?? 3;
  const backoff = options.backoffMs ?? 500;
  const allowed = options.allowAddress ?? ((a: string) => !isPrivateAddress(a));
  let next = 0;

  async function pace(): Promise<void> {
    const t = now();
    if (t < next) await sleep(next - t);
    next = Math.max(t, next) + interval;
  }

  async function once(url: URL, headers: Record<string, string>): Promise<TransportResponse> {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchError("host_not_official", `${url.protocol} is not fetched`);
    if (!options.officialHosts.includes(url.hostname)) throw new FetchError("host_not_official", `${url.hostname} is not an official host of this source`);
    const addresses = isIP(url.hostname) ? [{ address: url.hostname, family: isIP(url.hostname) }] : await resolve(url.hostname);
    const target = addresses[0];
    if (!target || addresses.some((a) => !allowed(a.address))) {
      throw new FetchError("private_address", `${url.hostname} resolves to an address that is not public`);
    }
    await pace();
    return transport(url, { headers, address: target.address, family: target.family, maxBytes });
  }

  return async (input, init) => {
    const headers = { "user-agent": options.userAgent, "accept-encoding": "identity", ...init?.headers };
    let url = new URL(input);
    for (let redirects = 0; ; ) {
      let response: TransportResponse | undefined;
      for (let attempt = 0; ; attempt++) {
        try {
          response = await once(url, headers);
        } catch (error) {
          if (!(error instanceof FetchError) || error.code !== "network" || attempt >= retries) throw error;
          await sleep(backoff * 2 ** attempt);
          continue;
        }
        if (!RETRYABLE(response.status) || attempt >= retries) break;
        const retryAfter = Number(response.headers["retry-after"]);
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff * 2 ** attempt);
      }
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        if (++redirects > 3) throw new FetchError("too_many_redirects", `${url.hostname}: more than 3 redirects`);
        url = new URL(response.headers.location, url);
        continue;
      }
      if (response.status >= 400) throw new FetchError("http_status", `${url.hostname}: HTTP ${response.status}`, response.status);
      return response;
    }
  };
}
