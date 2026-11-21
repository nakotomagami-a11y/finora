// TED (Tenders Electronic Daily) probe: EU-wide public procurement award notices through the anonymous
// Search API v3. Measures notice volumes per winner country, how often the winner identifier is a national
// register code (the join key to the Baltic registers), and how many sample companies won a notice.
//
// Reads research/.cache/osint/samples.json (gitignored); writes research/.cache/osint/ted.json (aggregates only).
// Usage: node research/probes/osint/ted.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, UA, sleep } from "./lib.mjs";

const API = "https://api.ted.europa.eu/v3/notices/search";
const CODE = { LVA: /^\d{11}$/, LTU: /^\d{9}$/, EST: /^\d{8}$/ };
const ISO3 = { LV: "LVA", LT: "LTU", EE: "EST", US: "USA" };
const RESULT_TYPES = "(notice-type=can-standard OR notice-type=can-social OR notice-type=can-desg OR notice-type=can-tran OR notice-type=can-modif)";

async function search(query, fields, limit = 250, page = 1) {
  const started = performance.now();
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({ query, fields, limit, page, paginationMode: "PAGE_NUMBER" }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  await sleep(1000);
  const json = res.ok ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, ms: Math.round(performance.now() - started), bytes: text.length, json };
}

const strip = (id) => String(id).replace(/^(LVA|LTU|EST|LV|LT|EE)[-\s]*/i, "").replace(/\s/g, "");

const report = { date: new Date().toISOString().slice(0, 10), countries: {}, samples: {}, timings: [] };

for (const country of Object.keys(CODE)) {
  const base = `winner-country=${country} AND ${RESULT_TYPES}`;
  const year = await search(`${base} AND publication-date>=20250101 AND publication-date<=20251231`, ["publication-number"], 1);
  const page = await search(`${base} AND publication-date>=20260101`, ["publication-number", "winner-identifier", "winner-country", "winner-name"], 250);
  report.timings.push(year.ms, page.ms);
  let winners = 0, codeShaped = 0;
  for (const n of page.json?.notices ?? []) {
    const ids = n["winner-identifier"] ?? [];
    const countries = n["winner-country"] ?? [];
    ids.forEach((id, i) => {
      if (countries[i] !== country) return;
      winners++;
      if (CODE[country].test(strip(id))) codeShaped++;
    });
  }
  report.countries[country] = {
    awardNotices2025: year.json?.totalNoticeCount ?? null,
    sampledNotices: page.json?.notices?.length ?? 0,
    winnersInSample: winners,
    winnerIdIsRegisterCodePct: winners ? Math.round((100 * codeShaped) / winners) : null,
  };
}

const samples = JSON.parse(readFileSync(join(CACHE, "samples.json"), "utf8"));
for (const s of samples.filter((x) => x.country !== "US")) {
  const r = await search(`winner-identifier=${s.code} OR winner-identifier="${ISO3[s.country]}-${s.code}"`, ["publication-number"], 1);
  report.timings.push(r.ms);
  const bucket = (report.samples[s.country] ??= { n: 0, withAward: 0, errors: 0 });
  bucket.n++;
  if (!r.ok) bucket.errors++;
  else if ((r.json?.totalNoticeCount ?? 0) > 0) bucket.withAward++;
}
const t = report.timings.slice().sort((a, b) => a - b);
report.latency = { calls: t.length, p50ms: t[Math.floor(t.length / 2)], p95ms: t[Math.floor(t.length * 0.95)] };
delete report.timings;
writeFileSync(join(CACHE, "ted.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
