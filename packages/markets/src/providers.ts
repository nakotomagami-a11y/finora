// The local provider file (human ruling H4; qa 7066883380, legal 7066878390). The public tree names no
// commercial provider: each one's hosts, URL templates, attribution line and terms live in a gitignored
// file the user fills (`<data dir>/providers.json`). The repo holds only this schema, the parsers under
// codes, and placeholder hosts for tests. A file that fails the schema configures nothing.

/** Coded providers Finora has a parser for, and the URL templates each one needs. */
export const PROVIDER_URLS = {
  x4: ["daily", "latest"],
  c1: ["global", "ethereum"],
  c3: ["global"],
  o3: ["rpc", "tip", "block"],
  "fred-cited": ["series"],
  e1: ["month"],
} as const;
export type ProviderCode = keyof typeof PROVIDER_URLS;

export type ProviderEntry = {
  /** Bare hostnames only; every fetch, deep link and terms URL must sit on one of them. */
  hosts: string[];
  /** https URL templates with `{name}` placeholders the connector fills. */
  urls: Record<string, string>;
  /** A licence id the server registers from this entry (it must say what the terms allow). */
  licence: { id: string; name: string; redistribution: boolean; nonCommercial: boolean; attributionRequired: boolean; verifiedOn: string };
  termsUrl: string;
  attribution: string | null;
  homepage: string;
  publisher: string;
  /** fred-cited only: the cited series, with a neutral label key and the owner's citation line. */
  series?: { id: string; rowKey: string; attribution: string }[];
};
export type Providers = Partial<Record<ProviderCode, ProviderEntry>>;

export const PROVIDERS_MAX_BYTES = 64 * 1024;
const HOST = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?:\.(?!-)[a-z0-9-]{1,63})+$/;
const IP_LITERAL = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_KEYS = ["hosts", "urls", "licence", "termsUrl", "attribution", "homepage", "publisher", "series"];
const LICENCE_KEYS = ["id", "name", "redistribution", "nonCommercial", "attributionRequired", "verifiedOn"];
/** The rows a cited series may fill: Japan, and the daily US rows legal lit for personal use (7066891816). */
export const SERIES_ROW_KEYS = new Set(["M03.X.01:japan", "M01.X.03:us_large", "M01.X.03:us_broad", "M01.X.03:us_tech"]);
/** Legal's condition 1: each daily US row's attribution line states personal use. */
const PERSONAL_USE_ROWS = "M01.X.03:";
export const PERSONAL_USE = /\bpersonal use\b/i;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 500): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

function hostOk(h: unknown): h is string {
  return typeof h === "string" && HOST.test(h) && !IP_LITERAL.test(h) && h !== "localhost" && !h.endsWith(".localhost") && !h.includes("*");
}

/** An https URL (placeholders allowed in path and query) whose host is one of `hosts`. */
function urlOk(u: unknown, hosts: readonly string[]): boolean {
  if (!str(u, 1000)) return false;
  try {
    const url = new URL(u.replace(/\{[a-z]+\}/g, "x"));
    return url.protocol === "https:" && url.username === "" && url.password === "" && url.port === "" && hosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function strict(value: Record<string, unknown>, keys: readonly string[], where: string, problems: string[]): void {
  for (const k of Object.keys(value)) if (!keys.includes(k)) problems.push(`${where}: unknown key`);
}

/** Problems are codes and paths only, never a value from the file (it may hold hosts; qa condition 5). */
export function parseProviders(text: string): { providers: Providers; problems: string[] } {
  const problems: string[] = [];
  if (new TextEncoder().encode(text).length > PROVIDERS_MAX_BYTES) return { providers: {}, problems: ["file: too large"] };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { providers: {}, problems: ["file: not JSON"] };
  }
  if (!isRecord(body) || body.version !== 1 || !isRecord(body.providers)) return { providers: {}, problems: ["file: needs version 1 and a providers object"] };
  strict(body, ["version", "providers"], "file", problems);
  const providers: Providers = {};
  for (const [code, raw] of Object.entries(body.providers)) {
    const where = `providers.${code in PROVIDER_URLS ? code : "?"}`;
    if (!(code in PROVIDER_URLS)) {
      problems.push(`${where}: unknown provider code`);
      continue;
    }
    const before = problems.length;
    if (!isRecord(raw)) {
      problems.push(`${where}: not an object`);
      continue;
    }
    strict(raw, ENTRY_KEYS, where, problems);
    const hosts = Array.isArray(raw.hosts) ? raw.hosts : [];
    if (hosts.length === 0 || hosts.length > 4 || !hosts.every(hostOk)) problems.push(`${where}.hosts: bare hostnames only (no scheme, IP, localhost or wildcard)`);
    const okHosts = hosts.filter(hostOk);
    const urls = isRecord(raw.urls) ? raw.urls : {};
    strict(urls, PROVIDER_URLS[code as ProviderCode], `${where}.urls`, problems);
    for (const name of PROVIDER_URLS[code as ProviderCode]) if (!urlOk(urls[name], okHosts)) problems.push(`${where}.urls.${name}: an https URL on one of the entry's hosts`);
    if (!urlOk(raw.termsUrl, okHosts)) problems.push(`${where}.termsUrl: an https URL on one of the entry's hosts`);
    if (!urlOk(raw.homepage, okHosts)) problems.push(`${where}.homepage: an https URL on one of the entry's hosts`);
    if (!str(raw.publisher, 120)) problems.push(`${where}.publisher: required`);
    if (raw.attribution !== null && !str(raw.attribution, 200)) problems.push(`${where}.attribution: a line of text or null`);
    const lic = isRecord(raw.licence) ? raw.licence : null;
    if (!lic) problems.push(`${where}.licence: required`);
    else {
      strict(lic, LICENCE_KEYS, `${where}.licence`, problems);
      if (!str(lic.id, 80) || !/^[a-z0-9][a-z0-9.-]*$/.test(lic.id)) problems.push(`${where}.licence.id: lower-case id`);
      if (!str(lic.name, 200)) problems.push(`${where}.licence.name: required`);
      for (const flag of ["redistribution", "nonCommercial", "attributionRequired"]) if (typeof lic[flag] !== "boolean") problems.push(`${where}.licence.${flag}: true or false`);
      if (typeof lic.verifiedOn !== "string" || !ISO_DATE.test(lic.verifiedOn)) problems.push(`${where}.licence.verifiedOn: a date`);
    }
    let series: ProviderEntry["series"];
    if (code === "fred-cited") {
      const list = Array.isArray(raw.series) ? raw.series : [];
      if (list.length === 0 || list.length > 8) problems.push(`${where}.series: 1 to 8 entries`);
      series = [];
      for (const s of list) {
        if (!isRecord(s) || !str(s.id, 40) || !/^[A-Z0-9]+$/.test(s.id) || typeof s.rowKey !== "string" || !SERIES_ROW_KEYS.has(s.rowKey) || !str(s.attribution, 200)) {
          problems.push(`${where}.series: each needs id, a known rowKey and an attribution line`);
          continue;
        }
        strict(s, ["id", "rowKey", "attribution"], `${where}.series`, problems);
        if (s.rowKey.startsWith(PERSONAL_USE_ROWS) && !PERSONAL_USE.test(s.attribution)) problems.push(`${where}.series: a daily US row's attribution must state personal use`);
        if (series.some((x) => x.rowKey === s.rowKey)) problems.push(`${where}.series: one series per row`);
        series.push({ id: s.id, rowKey: s.rowKey, attribution: s.attribution });
      }
    } else if (raw.series !== undefined) problems.push(`${where}.series: only for fred-cited`);
    if (problems.length > before) continue;
    const l = lic as Record<string, unknown>;
    providers[code as ProviderCode] = {
      hosts: okHosts,
      urls: Object.fromEntries(PROVIDER_URLS[code as ProviderCode].map((n) => [n, urls[n] as string])),
      licence: { id: l.id as string, name: l.name as string, redistribution: l.redistribution as boolean, nonCommercial: l.nonCommercial as boolean, attributionRequired: l.attributionRequired as boolean, verifiedOn: l.verifiedOn as string },
      termsUrl: raw.termsUrl as string,
      attribution: raw.attribution as string | null,
      homepage: raw.homepage as string,
      publisher: raw.publisher as string,
      ...(series ? { series } : {}),
    };
  }
  // Any problem leaves the whole file unused: a half-read file is never trusted (qa condition 1).
  return problems.length ? { providers: {}, problems } : { providers, problems };
}

/** Fills `{name}` placeholders; every value is URL-encoded. */
export function fillUrl(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-z]+)\}/g, (_m, k: string) => encodeURIComponent(String(values[k] ?? "")));
}
