// Reality check for the open-web sources: runs every OSINT probe on the sample entities chosen by
// select_samples*.py, exactly as an agent tool would at query time, and measures fill rates and latency.
//
// Inputs (all gitignored):  research/.cache/osint/samples.json
// Outputs (all gitignored): research/.cache/osint/profiles/<n>.json   one profile per entity
//                           research/.cache/osint/fillrates.json      aggregate fill rates per country
//                           research/.cache/osint/timings.json        latency and response size per tool
//                           research/.cache/osint/screening.json      false-positive rates of name-only screening
// Optional env: LV_OFFICERS_CSV (LV Enterprise Register officers.csv), EE_SIMPLE_CSV (EE ettevotja_rekvisiidid__lihtandmed.csv)
//
// Usage: node research/probes/osint/reality_check.mjs

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { CACHE, normaliseDomain, pool } from "./lib.mjs";
import { registration, certificates, dns, archive, homepage } from "./domain.mjs";
import { newsSearch } from "./news.mjs";
import { download, loadEntries, screener, parseCsv } from "./sanctions.mjs";
import { loadLists, check } from "./redflags.mjs";

const samples = JSON.parse(readFileSync(join(CACHE, "samples.json"), "utf8"));
mkdirSync(join(CACHE, "profiles"), { recursive: true });

const timings = {};
const time = (tool, r) => {
  if (!r || r.ms === undefined || r.cached) return r;
  (timings[tool] ??= []).push({ ms: r.ms, bytes: r.bytes ?? 0, ok: Boolean(r.ok) });
  return r;
};

console.log("sanctions:", JSON.stringify(await download()));
const entries = loadEntries();
const screen = screener(entries);
const lists = await loadLists();
for (const [k, l] of Object.entries(lists)) time(`list:${k}`, l);

function officersByCode() {
  const file = process.env.LV_OFFICERS_CSV;
  if (!file || !existsSync(file)) return null;
  const rows = parseCsv(readFileSync(file, "utf8"), ";");
  const h = rows[0];
  const [cCode, cType, cName] = ["at_legal_entity_registration_number", "entity_type", "name"].map((c) => h.indexOf(c));
  const map = new Map();
  for (const r of rows.slice(1)) {
    if (r[cType] !== "NATURAL_PERSON") continue;
    if (!map.has(r[cCode])) map.set(r[cCode], []);
    map.get(r[cCode]).push(r[cName]);
  }
  return map;
}
const lvOfficers = officersByCode();

async function profile(s, i) {
  const domain = normaliseDomain(s.website);
  const file = join(CACHE, "profiles", `${String(i).padStart(2, "0")}.json`);
  const previous = process.env.REUSE === "1" && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).profile : null;
  if (previous) return finish(s, i, file, domain, previous);
  const p = { i, country: s.country, bucket: s.bucket, websiteSource: s.website_source, domain: Boolean(domain) };
  if (domain) {
    const baltic = ["LV", "EE", "LT"].includes(s.country);
    const [reg, ct, d, arc, home] = await Promise.all([
      registration(domain).then((r) => time("registration", r)),
      certificates(domain).then((r) => time(`ct`, r)),
      dns(domain).then((r) => time("dns", r)),
      archive(domain).then((r) => time("archive", r)),
      homepage(domain, { code: baltic ? s.code : null }).then((r) => time("homepage", r)),
    ]);
    p.registration = { ...reg, codeMatchesRegister: Boolean(reg.registrantCode && s.code && reg.registrantCode.replace(/\D/g, "") === String(s.code)) };
    p.ct = ct; p.dns = d; p.archive = arc; p.homepage = home;
  }
  return finish(s, i, file, domain, p);
}

async function finish(s, i, file, domain, p) {
  if (!p.news?.ok) p.news = time("news", await newsSearch(s.name));
  const hits = screen(s.name, "entity");
  p.sanctions = { exact: hits.exact.length, fuzzy: hits.fuzzy.length, lists: [...new Set([...hits.exact, ...hits.fuzzy].map((e) => e.list))] };
  p.redflags = check(lists, { domain, name: s.name });
  const officers = s.country === "LV" ? lvOfficers?.get(String(s.code)) : null;
  if (officers) {
    const person = officers.map((n) => screen(n, "person"));
    p.officers = { n: officers.length, exact: person.filter((h) => h.exact.length).length, fuzzy: person.filter((h) => h.fuzzy.length).length };
  }
  writeFileSync(file, JSON.stringify({ sample: s, profile: p }, null, 2));
  process.stdout.write(".");
  return p;
}

const profiles = await pool(samples, process.env.REUSE === "1" ? 1 : 4, profile);
console.log();

const FIELDS = {
  "S15 website known": (p) => p.domain,
  "S15 domain registration date": (p) => Boolean(p.registration?.registered),
  "S15 registrant is an organisation": (p) => Boolean(p.registration?.registrantOrg),
  "S15 registrant code = register code": (p) => Boolean(p.registration?.codeMatchesRegister),
  "S15 certificates in CT logs": (p) => (p.ct?.certs ?? 0) > 0,
  "S15 domain resolves": (p) => Boolean(p.dns?.resolves),
  "S15 MX record": (p) => Boolean(p.dns?.mx),
  "S15 SPF": (p) => Boolean(p.dns?.spf),
  "S15 DMARC": (p) => Boolean(p.dns?.dmarc),
  "S15 archived in P8": (p) => (p.archive?.yearsCaptured ?? 0) > 0,
  "S15 homepage reachable": (p) => Boolean(p.homepage?.ok),
  "S15 homepage states register code": (p) => Boolean(p.homepage?.statesRegistryCode),
  "S16 social profile linked from homepage": (p) => (p.homepage?.socialCount ?? 0) > 0,
  "S16 news articles (P4, 3 months)": (p) => (p.news?.articles ?? 0) > 0,
  "S16 news query answered": (p) => Boolean(p.news?.ok),
  "S11 sanctions exact name hit": (p) => p.sanctions.exact > 0,
  "S11 sanctions fuzzy name hit": (p) => p.sanctions.fuzzy > 0,
  "S11 regulator red-flag list hit": (p) => Object.values(p.redflags).some(Boolean),
};
const fill = {};
for (const country of ["LV", "EE", "LT", "US", "all"]) {
  const set = profiles.filter((p) => country === "all" || p.country === country);
  const withSite = set.filter((p) => p.domain);
  fill[country] = { n: set.length, withWebsite: withSite.length, fields: {} };
  for (const [name, fn] of Object.entries(FIELDS)) {
    const base = name.startsWith("S15") && name !== "S15 website known" ? withSite : set;
    const k = base.filter(fn).length;
    fill[country].fields[name] = { filled: k, of: base.length, ofAll: set.length, pct: base.length ? Math.round((100 * k) / base.length) : null };
  }
}
writeFileSync(join(CACHE, "fillrates.json"), JSON.stringify(fill, null, 2));

const pct = (arr, q) => (arr.length ? arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(q * arr.length))] : null);
const timingSummary = Object.fromEntries(
  Object.entries(timings).map(([tool, rows]) => [tool, {
    calls: rows.length, okRate: Math.round((100 * rows.filter((r) => r.ok).length) / rows.length),
    p50ms: pct(rows.map((r) => r.ms), 0.5), p95ms: pct(rows.map((r) => r.ms), 0.95),
    medianBytes: pct(rows.map((r) => r.bytes), 0.5), maxBytes: Math.max(...rows.map((r) => r.bytes)),
  }]),
);
writeFileSync(join(CACHE, "timings.json"), JSON.stringify(timingSummary, null, 2));

// False-positive rate of name-only screening on random register names (not the sample).
function randomNames(file, sep, col, filterCol, filterVal, n) {
  if (!file || !existsSync(file)) return [];
  const rows = parseCsv(readFileSync(file, "utf8").replace(/^\uFEFF/, ""), sep);
  const h = rows[0];
  const c = h.indexOf(col), f = filterCol ? h.indexOf(filterCol) : -1;
  const names = [...new Set(rows.slice(1).filter((r) => f < 0 || r[f] === filterVal).map((r) => r[c]).filter(Boolean))];
  const key = (s) => createHash("sha256").update(`finora-osint-2026-11:${s}`).digest("hex");
  return names.sort((a, b) => (key(a) < key(b) ? -1 : 1)).slice(0, n);
}
const fp = {};
for (const [label, names, kind] of [
  ["EE company names", randomNames(process.env.EE_SIMPLE_CSV, ";", "nimi", null, null, 5000), "entity"],
  ["LV officer names", randomNames(process.env.LV_OFFICERS_CSV, ";", "name", "entity_type", "NATURAL_PERSON", 5000), "person"],
]) {
  if (!names.length) continue;
  const hits = names.map((n) => screen(n, kind));
  fp[label] = {
    n: names.length,
    exact: hits.filter((h) => h.exact.length).length,
    fuzzy: hits.filter((h) => h.fuzzy.length).length,
  };
}
const kinds = {};
for (const e of entries) {
  const k = (kinds[`${e.list}:${e.kind}`] ??= { names: 0, ids: new Set(), withDob: new Set(), withRegNo: new Set() });
  k.names++; k.ids.add(e.id);
  if (e.hasDob) k.withDob.add(e.id);
  if (e.hasRegNo) k.withRegNo.add(e.id);
}
const listStats = Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, {
  names: v.names, entries: v.ids.size, dobPct: Math.round((100 * v.withDob.size) / v.ids.size), regNoPct: Math.round((100 * v.withRegNo.size) / v.ids.size),
}]));
writeFileSync(join(CACHE, "screening.json"), JSON.stringify({ falsePositives: fp, lists: listStats, redflagLists: Object.fromEntries(Object.entries(lists).map(([k, l]) => [k, { ok: l.ok, rows: l.rows }])) }, null, 2));
console.log("done:", profiles.length, "profiles");
