// Website and domain probes: registration data (RDAP, or port-43 WHOIS for ccTLDs without RDAP),
// certificate transparency, DNS over HTTPS, the web archive P8, and the homepage itself. The
// endpoints of coded sources (P1, P5, P6, P8) come from the local provider map (providers.mjs, C15).
// Each function returns { ok, ms, bytes, ...fields } so the reality check can compute fill rates.

import { fetchJson, timedFetch, whois43, sleep } from "./lib.mjs";
import { provider } from "./providers.mjs";

const WHOIS_SERVERS = { lt: "whois.domreg.lt", lv: "whois.nic.lv", ee: "whois.tld.ee", eu: "whois.eu" };
let bootstrap = null;

async function rdapBase(tld) {
  if (!bootstrap) {
    const r = await fetchJson("https://data.iana.org/rdap/dns.json");
    bootstrap = new Map();
    for (const [tlds, urls] of r.json?.services ?? []) for (const t of tlds) bootstrap.set(t, urls[0]);
  }
  return bootstrap.get(tld) ?? null;
}

const field = (text, ...labels) => {
  for (const label of labels) {
    const m = text.match(new RegExp(`^\\s*${label}:\\s*(.+)$`, "im"));
    if (m && !/not disclosed/i.test(m[1])) return m[1].trim();
  }
  return null;
};

/** Registration date, registrar, and whether the registrant is an organisation with a registry code. */
export async function registration(domain) {
  const tld = domain.split(".").pop();
  const base = await rdapBase(tld);
  if (base) {
    const r = await fetchJson(`${base}domain/${domain}`);
    const events = Object.fromEntries((r.json?.events ?? []).map((e) => [e.eventAction, e.eventDate]));
    const registrar = r.json?.entities?.find((e) => e.roles?.includes("registrar"));
    const registrant = r.json?.entities?.find((e) => e.roles?.includes("registrant"));
    return {
      ok: r.ok, ms: r.ms, bytes: r.bytes, method: "rdap",
      registered: events.registration?.slice(0, 10) ?? null,
      expires: events.expiration?.slice(0, 10) ?? null,
      registrar: Boolean(registrar),
      registrantOrg: Boolean(registrant),
      registrantCode: null,
    };
  }
  const server = WHOIS_SERVERS[tld];
  if (!server) return { ok: false, ms: 0, bytes: 0, method: "none", error: `no RDAP or known WHOIS for .${tld}` };
  const r = await whois43(server, domain);
  const t = r.text;
  const registered = field(t, "Registered", "registered");
  const holderType = field(t, "Type");
  return {
    ok: r.ok && !/no entries found|not found|available/i.test(t.slice(0, 2000)) , ms: r.ms, bytes: r.bytes, method: "whois43",
    registered: registered ? registered.slice(0, 10) : null,
    expires: field(t, "Expires", "expire"),
    registrar: Boolean(field(t, "Registrar", "registrar")),
    registrantOrg: Boolean(field(t, "Contact organization", "org id", "Name")) && !/natural person/i.test(holderType ?? ""),
    registrantCode: field(t, "RegNr", "org id"),
  };
}

/** Certificate transparency via P1 (free, unauthenticated, rate limited); P5 as fallback. */
export async function certificates(domain) {
  const url = provider("P1").replaceAll("{domain}", domain);
  let r = await fetchJson(url);
  let source = "P1";
  let certs = Array.isArray(r.json) ? r.json.map((c) => ({ notBefore: c.not_before, names: c.dns_names ?? [] })) : null;
  if (!certs) {
    await sleep(1000);
    r = await fetchJson(provider("P5").replaceAll("{domain}", domain), { timeoutMs: 60000 });
    source = "P5";
    certs = Array.isArray(r.json) ? r.json.map((c) => ({ notBefore: c.not_before, names: String(c.name_value).split("\n") })) : null;
  }
  if (!certs) return { ok: false, ms: r.ms, bytes: r.bytes, source, error: r.error ?? `http ${r.status}` };
  const names = new Set(certs.flatMap((c) => c.names).filter((n) => n.endsWith(domain)));
  const dates = certs.map((c) => c.notBefore).filter(Boolean).sort();
  return { ok: true, ms: r.ms, bytes: r.bytes, source, certs: certs.length, hostnames: names.size, firstSeen: dates[0]?.slice(0, 10) ?? null };
}

async function doh(name, type) {
  const r = await fetchJson(provider("P6").replaceAll("{name}", name).replaceAll("{type}", type), {
    headers: { accept: "application/dns-json" },
  });
  return { r, answers: (r.json?.Answer ?? []).map((a) => String(a.data)) };
}

/** Mail and anti-spoofing records: MX, SPF, DMARC, plus whether the domain resolves at all. */
export async function dns(domain) {
  const [a, mx, txt, dmarc] = await Promise.all([doh(domain, "A"), doh(domain, "MX"), doh(domain, "TXT"), doh(`_dmarc.${domain}`, "TXT")]);
  const ms = Math.max(a.r.ms, mx.r.ms, txt.r.ms, dmarc.r.ms);
  const bytes = a.r.bytes + mx.r.bytes + txt.r.bytes + dmarc.r.bytes;
  return {
    ok: a.r.ok, ms, bytes,
    resolves: a.answers.length > 0,
    mx: mx.answers.length > 0,
    spf: txt.answers.some((t) => t.includes("v=spf1")),
    dmarc: dmarc.answers.some((t) => t.includes("v=DMARC1")),
  };
}

/** The web archive P8: first capture, last capture, and the number of distinct years captured. */
export async function archive(domain) {
  const base = provider("P8").replaceAll("{domain}", domain);
  const years = await fetchJson(`${base}&collapse=timestamp:4`, { timeoutMs: 60000 });
  if (!years.ok) return { ok: false, ms: years.ms, bytes: years.bytes, error: years.error ?? `http ${years.status}` };
  const stamps = (years.json ?? []).slice(1).map((row) => row[0]);
  return {
    ok: true, ms: years.ms, bytes: years.bytes,
    firstCapture: stamps[0] ? `${stamps[0].slice(0, 4)}-${stamps[0].slice(4, 6)}-${stamps[0].slice(6, 8)}` : null,
    lastCaptureYear: stamps.at(-1)?.slice(0, 4) ?? null,
    yearsCaptured: stamps.length,
  };
}

const SOCIAL = {
  facebook: /facebook\.com\/(?!sharer|share|dialog|plugins|tr\b)[\w.\-]+/i,
  linkedin: /linkedin\.com\/(company|in|school)\/[\w\-%.]+/i,
  instagram: /instagram\.com\/[\w.\-]+/i,
  x: /(twitter|x)\.com\/(?!intent|share|home)[\w]+/i,
  youtube: /youtube\.com\/(channel|c|user|@)[\w\-@]*/i,
  tiktok: /tiktok\.com\/@[\w.\-]+/i,
};

/** Fetch the homepage once (as a browser would) and look for the identifiers that tie it to the register. */
export async function homepage(domain, { code, vat } = {}) {
  const r = await timedFetch(`https://${domain}/`, { timeoutMs: 20000, headers: { accept: "text/html" } });
  if (!r.ok) return { ok: false, ms: r.ms, bytes: r.bytes, status: r.status, error: r.error };
  const html = r.text;
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const digits = text.replace(/[\s.\-]/g, "");
  const social = Object.fromEntries(Object.entries(SOCIAL).map(([k, re]) => [k, re.test(html)]));
  return {
    ok: true, ms: r.ms, bytes: r.bytes, textChars: text.length,
    finalHost: new URL(r.url).hostname.replace(/^www\./, ""),
    title: Boolean(html.match(/<title[^>]*>([^<]{2,})/i)),
    statesRegistryCode: Boolean(code && digits.includes(String(code).replace(/^0+/, ""))),
    statesVat: Boolean(vat && digits.toUpperCase().includes(vat.toUpperCase())),
    social,
    socialCount: Object.values(social).filter(Boolean).length,
  };
}
