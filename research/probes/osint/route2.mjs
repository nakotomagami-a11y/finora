// Route 2 measurement only (council 7067073326; legal: no route 2 output ships without its light).
// Looks the company up in the open knowledge base P10 by its registered name, keeps items whose
// country matches, reads only their official-website property, and verifies each website exactly
// as route 1 does (the registry code or LV VAT on the homepage). Requests are serial, with an
// identifying User-Agent, as P10's terms ask. The endpoint comes from the local provider map.
// Output: research/.cache/osint/route2/results.json (entity level, gitignored) and aggregates.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, UA, sleep } from "./lib.mjs";
import { provider } from "./providers.mjs";
import { check, registrable } from "./route1.mjs";

const COUNTRY_ITEM = { LV: "Q211", LT: "Q37", EE: "Q191" };
const WEBSITE = "P856";
const COUNTRY = "P17";
const GAP_MS = 4_000;

/** Serial, slow, with backoff on a rate-limit answer; a lookup that never succeeds is reported as failed. */
async function api(params) {
  const url = `${provider("P10")}?${new URLSearchParams({ ...params, format: "json", maxlag: "5" })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(GAP_MS);
    try {
      const res = await fetch(url, { headers: { "user-agent": `${UA} research probe; contact via the repository` }, signal: AbortSignal.timeout(20_000) });
      const text = await res.text();
      if (res.ok && text.startsWith("{")) {
        const json = JSON.parse(text);
        if (!json.error) return json;
      }
    } catch {
      // retried below
    }
    await sleep(30_000 * (attempt + 1));
  }
  throw new Error("lookup_failed");
}

async function websites(company) {
  const search = await api({ action: "wbsearchentities", search: company.name.replace(/["„“”]/g, ""), language: "en", uselang: "en", type: "item", limit: "5" });
  const ids = (search?.search ?? []).map((h) => h.id).slice(0, 5);
  if (ids.length === 0) return { lookups: 1, sites: [] };
  const entities = await api({ action: "wbgetentities", ids: ids.join("|"), props: "claims" });
  const sites = [];
  for (const e of Object.values(entities?.entities ?? {})) {
    const countries = (e.claims?.[COUNTRY] ?? []).map((c) => c.mainsnak?.datavalue?.value?.id);
    if (!countries.includes(COUNTRY_ITEM[company.country])) continue;
    for (const c of e.claims?.[WEBSITE] ?? []) {
      const v = c.mainsnak?.datavalue?.value;
      if (typeof v === "string") sites.push(v);
    }
  }
  return { lookups: 2, sites: [...new Set(sites)] };
}

const samples = JSON.parse(readFileSync(join(CACHE, "samples.json"), "utf8")).filter((s) => ["LV", "LT", "EE"].includes(s.country));
const results = [];
for (const company of samples) {
  const t0 = Date.now();
  let lookups = 0;
  let sites = [];
  let lookupFailed = false;
  try {
    ({ lookups, sites } = await websites(company));
  } catch {
    lookupFailed = true;
  }
  const budget = { used: 0 };
  let verified = null;
  const checks = [];
  for (const site of sites.slice(0, 2)) {
    let host;
    try {
      host = new URL(site).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    const r = await check(host, company, budget);
    checks.push(r);
    if (r.outcome === "verified") {
      verified = registrable(r.host);
      break;
    }
  }
  results.push({ country: company.country, code: company.code, knownSource: company.website_source, lookupFailed, lookups, sitesFound: sites.length, requests: budget.used, ms: Date.now() - t0, verified, checks });
  process.stderr.write(".");
}
mkdirSync(join(CACHE, "route2"), { recursive: true });
writeFileSync(join(CACHE, "route2", "results.json"), JSON.stringify(results, null, 2));
const by = {};
for (const r of results) {
  const a = (by[r.country] ??= { companies: 0, lookupFailed: 0, withWebsiteProperty: 0, verified: 0, verifiedNotInRegister: 0, requestsMax: 0, lookupsMax: 0, secondsMax: 0 });
  a.companies++;
  if (r.lookupFailed) a.lookupFailed++;
  if (r.sitesFound > 0) a.withWebsiteProperty++;
  if (r.verified) {
    a.verified++;
    if (r.knownSource !== "registry") a.verifiedNotInRegister++;
  }
  a.requestsMax = Math.max(a.requestsMax, r.requests);
  a.lookupsMax = Math.max(a.lookupsMax, r.lookups);
  a.secondsMax = Math.max(a.secondsMax, +(r.ms / 1000).toFixed(1));
}
for (const [country, a] of Object.entries(by)) console.log(JSON.stringify({ country, ...a }));
