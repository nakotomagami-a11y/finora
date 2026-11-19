// Red-flag lists that publish a machine-readable file: Bank of Lithuania illegal financial websites (CSV),
// ESMA list of non-compliant crypto-asset service providers (CSV), Lithuanian gambling regulator's list of
// illegal operators' domains (TXT). Checks a domain and a name against them; returns list sizes for the catalog.

import { timedFetch } from "./lib.mjs";
import { normalise, parseCsv } from "./sanctions.mjs";

const LISTS = {
  lb_illegal_sites: { url: "https://www.lb.lt/illegalwww?export=csv", sep: ";", domainCol: 0, nameCol: 1, unquoted: true },
  esma_ncasp: { url: "https://www.esma.europa.eu/sites/default/files/2024-12/NCASP.csv", sep: ",", domainCol: 6, nameCol: 2 },
  lpt_illegal_gambling: { url: "https://blokuojama.lpt.lt/wp-content/uploads/bankams.txt", lines: true },
};

const BOM = /^\uFEFF/;
const LINE = /\r?\n/;
const host = (s) => String(s).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0];

function rowsOf(text, cfg) {
  const body = text.replace(BOM, "");
  const rows = cfg.unquoted ? body.split(LINE).map((l) => l.split(cfg.sep)) : parseCsv(body, cfg.sep);
  return rows.slice(1).filter((x) => x.length > 2);
}

export async function loadLists() {
  const out = {};
  for (const [key, cfg] of Object.entries(LISTS)) {
    const r = await timedFetch(cfg.url, { timeoutMs: 60000 });
    if (!r.ok) {
      out[key] = { ok: false, status: r.status, ms: r.ms, error: r.error, domains: new Set(), names: new Set() };
      continue;
    }
    let domains = [];
    let names = [];
    if (cfg.lines) {
      domains = r.text.split(LINE).map(host).filter(Boolean);
    } else {
      const rows = rowsOf(r.text, cfg);
      domains = rows.map((x) => host(x[cfg.domainCol] ?? "")).filter(Boolean);
      names = rows.map((x) => normalise(x[cfg.nameCol] ?? "")).filter(Boolean);
    }
    out[key] = { ok: true, ms: r.ms, bytes: r.bytes, rows: Math.max(domains.length, names.length), domains: new Set(domains), names: new Set(names) };
  }
  return out;
}

export function check(lists, { domain, name }) {
  const norm = name ? normalise(name) : null;
  return Object.fromEntries(
    Object.entries(lists).map(([k, l]) => [k, Boolean((domain && l.domains.has(domain)) || (norm && l.names.has(norm)))]),
  );
}
