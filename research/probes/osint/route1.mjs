// Route 1 measurement (cto 7067061298, council bar 7067073326, qa guards 7067079723): can Finora
// find a company's website without any search engine? Candidate hosts are generated only from the
// company's own registered name and country; each is resolved (public addresses only), robots.txt
// is honoured, and only the homepage is fetched. A site is accepted only when the page shows the
// company's registry code (or its LV VAT number, LV + code). A name match never counts.
// Usage: node research/probes/osint/route1.mjs [--countries LV,LT,EE]
// Output: research/.cache/osint/route1/results.json (entity level, gitignored) and aggregates on stdout.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEGAL_FORM_TOKENS } from "../../../packages/domain/src/config/legal-forms.ts";
import { normalizeText } from "../../../packages/domain/src/text/normalize.ts";
import { CACHE, UA, sleep } from "./lib.mjs";

const TLD = { LV: "lv", LT: "lt", EE: "ee" };
const MAX_CANDIDATES = 6;
const MAX_REQUESTS = 8;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const HOST_GAP_MS = 2_000;
const LINKED = Number(process.argv.find((x) => x.startsWith("--linked="))?.split("=")[1] ?? 0);
const CONTACT = /(kontakt|contact|about|par-mums|apie|meist|rekviz|impressum|imprint|firmast|ettevottest|company)/i;

/** Same-host links whose path looks like a contact, about or imprint page. */
function contactLinks(html, base) {
  const origin = new URL(base);
  const out = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], origin);
      if (u.protocol === "https:" && u.hostname === origin.hostname && CONTACT.test(u.pathname) && !out.includes(u.href)) out.push(u.href);
    } catch {
      // not a URL
    }
  }
  return out;
}

const PRIVATE = [/^0\./, /^10\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^2(2[4-9]|[3-5]\d)\./, /^::1?$/, /^f[cd]/i, /^fe80/i, /^ff/i, /^::ffff:/i];
const isPublic = (address) => !PRIVATE.some((re) => re.test(address));

/** The registrable domain, simplified: the last two labels (enough for .lv, .lt, .ee and .com). */
const registrable = (host) => host.toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");

/** Candidate hosts from the company's own registered name only (never a person's). */
export function candidates(name, country) {
  const tokens = normalizeText(name.replace(/["'„“”«»]/g, " "))
    .split(" ")
    .filter((t) => t && !LEGAL_FORM_TOKENS.has(t) && /^[a-z0-9]+$/.test(t));
  if (tokens.length === 0) return [];
  const cc = TLD[country];
  const joined = tokens.join("");
  const hyphen = tokens.join("-");
  const first = tokens[0].length >= 4 ? tokens[0] : null;
  const list = [`${joined}.${cc}`, `${hyphen}.${cc}`, `${joined}.com`, `${hyphen}.com`];
  if (first && tokens.length > 1) list.push(`${first}.${cc}`, `${first}.com`);
  return [...new Set(list)].filter((h) => h.length <= 70).slice(0, MAX_CANDIDATES);
}

function htmlText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
}

/** Whether the page text shows the code (digits may be split by spaces or dashes) or LV + code. */
function showsCode(text, code, country) {
  const digits = code.replace(/\D/g, "");
  const flexible = new RegExp(`(?<!\\d)${digits.split("").join("[\\s-]?")}(?!\\d)`);
  if (flexible.test(text)) return "registry_code";
  if (country === "LV" && new RegExp(`LV\\s?${digits}(?!\\d)`, "i").test(text)) return "vat";
  return null;
}

async function resolvePublic(host) {
  try {
    const all = await lookup(host, { all: true });
    if (all.length === 0) return { ok: false, reason: "no_address" };
    if (all.some((a) => !isPublic(a.address))) return { ok: false, reason: "private_address" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "no_dns" };
  }
}

async function get(url, budget) {
  if (budget.used >= MAX_REQUESTS) return { ok: false, reason: "budget" };
  budget.used++;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html,*/*" } });
    const location = res.headers.get("location");
    const reader = res.body?.getReader();
    let size = 0;
    const chunks = [];
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          ctrl.abort();
          break;
        }
        chunks.push(value);
      }
    }
    return { ok: true, status: res.status, location, body: Buffer.concat(chunks).toString("utf8") };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

function robotsAllowsRoot(text) {
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [k, ...rest] = line.split(":");
    const v = rest.join(":").trim();
    if (/^user-agent$/i.test(k ?? "")) applies = v === "*" || /finora/i.test(v);
    else if (applies && /^disallow$/i.test(k ?? "") && v === "/") return false;
  }
  return true;
}

/** One candidate: DNS, robots, then the homepage, with same-registrable-domain redirects only. */
async function check(candidate, company, budget) {
  // The www. form of the same candidate counts as the same candidate: many sites answer only there.
  let host = candidate;
  let dns = await resolvePublic(host);
  if (!dns.ok && dns.reason === "no_dns") {
    host = `www.${candidate}`;
    dns = await resolvePublic(host);
  }
  if (!dns.ok) return { host: candidate, outcome: dns.reason };
  const robots = await get(`https://${host}/robots.txt`, budget);
  if (robots.ok && robots.status === 200 && !robotsAllowsRoot(robots.body)) return { host, outcome: "robots_disallow" };
  await sleep(HOST_GAP_MS);
  let url = `https://${host}/`;
  for (let hop = 0; hop < 3; hop++) {
    const page = await get(url, budget);
    if (!page.ok) return { host, outcome: page.reason };
    if (page.status >= 300 && page.status < 400 && page.location) {
      const next = new URL(page.location, url);
      if (next.protocol !== "https:") return { host, outcome: "insecure_redirect" };
      if (isIP(next.hostname) || registrable(next.hostname) !== registrable(host)) return { host, outcome: "cross_domain_redirect" };
      url = next.href;
      await sleep(HOST_GAP_MS);
      continue;
    }
    if (page.status !== 200) return { host, outcome: `http_${page.status}` };
    const evidence = showsCode(htmlText(page.body), company.code, company.country);
    if (evidence) return { host, outcome: "verified", evidence, page: "home" };
    // Variant B (needs legal's light): up to LINKED same-host pages the homepage links to, whose
    // path names a contact, about or imprint page (§4.6 allowlist rule 1 allows 3).
    for (const link of contactLinks(page.body, url).slice(0, LINKED)) {
      await sleep(HOST_GAP_MS);
      const sub = await get(link, budget);
      if (!sub.ok || sub.status !== 200) continue;
      const found = showsCode(htmlText(sub.body), company.code, company.country);
      if (found) return { host, outcome: "verified", evidence: found, page: "linked" };
    }
    return { host, outcome: "no_code_on_page" };
  }
  return { host, outcome: "too_many_redirects" };
}

async function main() {
  const countries = (process.argv.find((a) => a.startsWith("--countries="))?.split("=")[1] ?? "LV,LT,EE").split(",");
  const samples = JSON.parse(readFileSync(join(CACHE, "samples.json"), "utf8")).filter((s) => countries.includes(s.country));
  const results = [];
  for (const company of samples) {
    const t0 = Date.now();
    const budget = { used: 0 };
    const hosts = candidates(company.name, company.country);
    const checks = [];
    for (const host of hosts) {
      if (budget.used >= MAX_REQUESTS) break;
      const r = await check(host, company, budget);
      checks.push(r);
      if (r.outcome === "verified") break;
    }
    const verified = checks.find((c) => c.outcome === "verified") ?? null;
    const known = company.website ? registrable(new URL(/^https?:/.test(company.website) ? company.website : `https://${company.website}`).hostname) : null;
    results.push({
      country: company.country,
      code: company.code,
      knownSite: known,
      knownSource: company.website_source,
      candidates: hosts.length,
      requests: budget.used,
      ms: Date.now() - t0,
      verified: verified ? registrable(verified.host) : null,
      evidence: verified?.evidence ?? null,
      sameAsKnown: verified && known ? registrable(verified.host) === known : null,
      checks,
    });
    process.stderr.write(".");
  }
  mkdirSync(join(CACHE, "route1"), { recursive: true });
  writeFileSync(join(CACHE, "route1", "results.json"), JSON.stringify(results, null, 2));
  // Aggregates only on stdout (no names, no hosts).
  const by = {};
  for (const r of results) {
    const a = (by[r.country] ??= { companies: 0, verified: 0, verifiedNew: 0, verifiedSameAsKnown: 0, verifiedDiffersFromKnown: 0, requests: [], seconds: [] });
    a.companies++;
    a.requests.push(r.requests);
    a.seconds.push(r.ms / 1000);
    if (r.verified) {
      a.verified++;
      if (r.knownSource !== "registry") a.verifiedNew++;
      if (r.sameAsKnown === true) a.verifiedSameAsKnown++;
      if (r.sameAsKnown === false) a.verifiedDiffersFromKnown++;
    }
  }
  const p = (xs, q) => [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
  for (const [c, a] of Object.entries(by)) {
    console.log(JSON.stringify({ country: c, companies: a.companies, verified: a.verified, verifiedNotInRegister: a.verifiedNew, verifiedSameAsKnown: a.verifiedSameAsKnown, verifiedDiffersFromKnown: a.verifiedDiffersFromKnown, requestsMax: Math.max(...a.requests), requestsP50: p(a.requests, 0.5), secondsP50: +p(a.seconds, 0.5).toFixed(1), secondsMax: +Math.max(...a.seconds).toFixed(1) }));
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) await main();
