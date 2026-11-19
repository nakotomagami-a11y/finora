// Sanctions lists: download the official files, normalise names, and screen names against them.
// Lists: OFAC SDN + non-SDN consolidated (US), EU Financial Sanctions Files, UN Security Council, UK Sanctions List.
// Downloads go to research/.cache/osint/sanctions/ (gitignored). Nothing here is committed except this code.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, timedFetch } from "./lib.mjs";

const DIR = join(CACHE, "sanctions");
mkdirSync(DIR, { recursive: true });

const OFAC = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/";
export const SOURCES = {
  ofac_sdn: OFAC + "SDN.CSV",
  ofac_sdn_alt: OFAC + "ALT.CSV",
  ofac_cons: OFAC + "CONS_PRIM.CSV",
  ofac_cons_alt: OFAC + "CONS_ALT.CSV",
  eu_fsf: "https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw",
  un_sc: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
  uk: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv",
};

/** Download every list unless a copy younger than a day exists. Returns per-list size and latency. */
export async function download() {
  const report = {};
  for (const [key, url] of Object.entries(SOURCES)) {
    const file = join(DIR, key);
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 86400000) {
      report[key] = { cached: true, bytes: statSync(file).size };
      continue;
    }
    const r = await timedFetch(url, { timeoutMs: 180000 });
    if (r.ok) writeFileSync(file, r.text);
    report[key] = { ok: r.ok, status: r.status, ms: r.ms, bytes: r.bytes, error: r.error };
  }
  return report;
}

export function parseCsv(text, sep = ",") {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const LEGAL_FORMS = new Set(
  ("sia as ab uab ou oü mtu tu fie ik inc incorporated corp corporation co company ltd limited llc lp llp plc gmbh sa srl " +
   "jsc ojsc cjsc pjsc ao ooo zao pao tov the of and un sabiedriba ar ierobezotu atbildibu akciju akcine bendrove uzdaroji " +
   "akcine leidybine osauhing aktsiaselts holding group").split(" "),
);

export function normalise(name) {
  return String(name)
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").filter((t) => t && !LEGAL_FORMS.has(t)).sort().join(" ");
}

/** Load all lists into [{ list, id, kind: "person"|"entity"|"other", name, norm, hasDob, hasRegNo }]. */
export function loadEntries() {
  const entries = [];
  const add = (list, id, kind, name, extra = {}) => {
    const norm = normalise(name);
    if (norm.length >= 3) entries.push({ list, id, kind, name, norm, ...extra });
  };
  const read = (key) => (existsSync(join(DIR, key)) ? readFileSync(join(DIR, key), "utf8") : "");

  for (const [prim, alt, list] of [["ofac_sdn", "ofac_sdn_alt", "ofac_sdn"], ["ofac_cons", "ofac_cons_alt", "ofac_cons"]]) {
    const kinds = new Map();
    for (const r of parseCsv(read(prim))) {
      if (r.length < 4) continue;
      const kind = r[2] === "individual" ? "person" : r[2] === "-0- " || r[2] === "" ? "entity" : "other";
      const remarks = r.at(-1) ?? "";
      kinds.set(r[0], kind);
      add(list, r[0], kind, r[1], { hasDob: /DOB/.test(remarks), hasRegNo: /Registration (ID|Number)|Tax ID|Company Number/i.test(remarks) });
    }
    for (const r of parseCsv(read(alt))) if (r.length >= 4) add(list, r[0], kinds.get(r[0]) ?? "other", r[3]);
  }

  const eu = parseCsv(read("eu_fsf").replace(/^\uFEFF/, ""), ";");
  if (eu.length) {
    const h = eu[0];
    const col = (n) => h.indexOf(n);
    const [cId, cType, cName, cBirth, cIdent] = ["Entity_LogicalId", "Entity_SubjectType_ClassificationCode", "NameAlias_WholeName", "BirthDate_BirthDate", "Identification_Number"].map(col);
    const seen = new Set();
    for (const r of eu.slice(1)) {
      const kind = r[cType] === "person" ? "person" : r[cType] === "enterprise" ? "entity" : "other";
      const key = `${r[cId]}|${r[cName]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      add("eu_fsf", r[cId], kind, r[cName], { hasDob: Boolean(r[cBirth]), hasRegNo: Boolean(r[cIdent]) });
    }
  }

  const un = read("un_sc");
  for (const [tag, kind] of [["INDIVIDUAL", "person"], ["ENTITY", "entity"]]) {
    for (const block of un.match(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g")) ?? []) {
      const id = block.match(/<DATAID>(\d+)/)?.[1];
      const parts = ["FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME"].map((t) => block.match(new RegExp(`<${t}>([^<]*)<`))?.[1] ?? "");
      add("un_sc", id, kind, parts.join(" "), { hasDob: /<DATE_OF_BIRTH>|<YEAR>/.test(block), hasRegNo: false });
      for (const a of block.matchAll(/<ALIAS_NAME>([^<]+)</g)) add("un_sc", id, kind, a[1]);
    }
  }

  const uk = parseCsv(read("uk").replace(/^\uFEFF/, ""));
  const headerAt = uk.findIndex((r) => r.some((c) => /Unique ID/i.test(c)));
  if (headerAt >= 0) {
    const h = uk[headerAt].map((c) => c.trim());
    const col = (re) => h.findIndex((c) => re.test(c));
    const cId = col(/^Unique ID$/i), cType = col(/^Designation Type$|Entity type|^Type$/i), cName6 = col(/^Name 6$/i);
    const nameCols = [1, 2, 3, 4, 5].map((n) => col(new RegExp(`^Name ${n}$`, "i")));
    const cDob = col(/^D\.?O\.?B/i), cReg = col(/Business registration/i);
    for (const r of uk.slice(headerAt + 1)) {
      const name = [...nameCols.map((c) => r[c] ?? ""), r[cName6] ?? ""].join(" ").trim();
      const kind = /individual/i.test(r[cType] ?? "") ? "person" : /entity/i.test(r[cType] ?? "") ? "entity" : "other";
      add("uk", r[cId], kind, name, { hasDob: Boolean(r[cDob]?.trim()), hasRegNo: Boolean(r[cReg]?.trim()) });
    }
  }
  return entries;
}

function similarity(a, b) {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

/** Build a token index once; screen(name, kind) returns exact and fuzzy hits. */
export function screener(entries, threshold = 0.9) {
  const byNorm = new Map();
  const byToken = new Map();
  for (const e of entries) {
    if (!byNorm.has(e.norm)) byNorm.set(e.norm, []);
    byNorm.get(e.norm).push(e);
    for (const t of new Set(e.norm.split(" "))) {
      if (!byToken.has(t)) byToken.set(t, []);
      byToken.get(t).push(e);
    }
  }
  return (name, kind) => {
    const norm = normalise(name);
    if (!norm) return { exact: [], fuzzy: [] };
    const sameKind = (e) => !kind || e.kind === kind || e.kind === "other";
    const exact = (byNorm.get(norm) ?? []).filter(sameKind);
    const tokens = norm.split(" ");
    const rarest = tokens.map((t) => byToken.get(t) ?? []).sort((a, b) => a.length - b.length)[0] ?? [];
    const fuzzy = rarest.filter((e) => sameKind(e) && e.norm !== norm && similarity(e.norm, norm) >= threshold);
    return { exact, fuzzy };
  };
}
