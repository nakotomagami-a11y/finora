// Shared helpers for the OSINT probes: timed HTTP, port-43 WHOIS, and the local cache path.
// No dependencies beyond Node 24. Every network call records its latency and response size,
// which feed the latency and token-cost estimates in docs/research/osint.md.

import { createConnection } from "node:net";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const UA = process.env.FINORA_RESEARCH_UA ?? "finora-research/0.1 (+public repo)";
export const CACHE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".cache", "osint");
mkdirSync(CACHE, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with a timeout; never throws. Returns { ok, status, ms, bytes, text, url, error }. */
export async function timedFetch(url, { timeoutMs = 30000, headers = {}, method = "GET" } = {}) {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers: { "user-agent": UA, ...headers },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, ms: Math.round(performance.now() - started), bytes: text.length, text, url: res.url };
  } catch (error) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - started), bytes: 0, text: "", url, error: String(error.cause?.code ?? error.name) };
  }
}

export async function fetchJson(url, opts) {
  const r = await timedFetch(url, opts);
  let json = null;
  if (r.ok) {
    try {
      json = JSON.parse(r.text);
    } catch {
      r.ok = false;
      r.error = "invalid-json";
    }
  }
  return { ...r, json };
}

/** Port-43 WHOIS query. Resolves with the raw text (possibly empty) and its latency. */
export function whois43(server, query, timeoutMs = 15000) {
  const started = performance.now();
  return new Promise((resolve) => {
    let text = "";
    const done = (error) => {
      socket.destroy();
      resolve({ ok: !error && text.length > 0, ms: Math.round(performance.now() - started), bytes: text.length, text, error });
    };
    const socket = createConnection(43, server, () => socket.write(`${query}\r\n`));
    socket.setEncoding("utf8");
    socket.on("data", (d) => (text += d));
    socket.on("end", () => done());
    socket.on("error", (e) => done(e.code));
    socket.setTimeout(timeoutMs, () => done(text ? undefined : "timeout"));
  });
}

/** Run async tasks with at most `limit` in flight. */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export const normaliseDomain = (website) =>
  website
    ? website.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0] || null
    : null;
