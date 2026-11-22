// What every Latvian open-data loader shares (lv-register.md § Source): the data.gov.lv CKAN lookup
// that finds a dataset's current file, a header-checked CSV reader, register codes, dates and the
// as-of strategies the UR and VID files support.
import { isFixtureRegisterCode, isValidRegisterCode, type DropReason } from "@finora/domain";
import { columns, csvRowsChunked } from "@finora/formats";
import { join } from "node:path";
import { artifactText, streamedArtifact } from "../artifacts.ts";
import type { AsOfStrategy, FetchContext, RawArtifact } from "../types.ts";

export const LV_PORTAL_HOST = "data.gov.lv";
export const LV_REGISTER_HOSTS = [LV_PORTAL_HOST, "info.ur.gov.lv", "www.ur.gov.lv"];
export const LV_DEEP_LINK = "https://info.ur.gov.lv/#/legal-entity/{entityCode}";
export const LV_PORTAL_API = "https://data.gov.lv/dati/api/3/action/package_show?id=";

/** Thrown when the file's header lacks a column the field map reads: the sync fails `schema_changed`. */
export class SchemaChanged extends Error {
  override name = "schema_changed";
}
/** Thrown when `package_show` has no resource with the expected file name. */
export class ResourceMissing extends Error {
  override name = "resource_missing";
}

type CkanResource = { url?: string; format?: string; last_modified?: string | null };

/**
 * Finds a dataset's current file through CKAN `package_show` and downloads it, plus a small
 * `resource.json` holding the portal's `last_modified` (the `portal_metadata` as-of strategy).
 */
export async function fetchCkanFile(ctx: FetchContext, slug: string, fileName: string): Promise<RawArtifact[]> {
  const portal = await ctx.fetcher(`${LV_PORTAL_API}${encodeURIComponent(slug)}`);
  const resources = (JSON.parse(new TextDecoder().decode(portal.bytes)) as { result?: { resources?: CkanResource[] } }).result?.resources ?? [];
  const resource = resources.find((r) => r.url && r.url.split("?")[0]!.split("/").at(-1) === fileName && (r.format ?? "").toUpperCase() === "CSV");
  if (!resource?.url) throw new ResourceMissing();
  // The file streams to the sync's work dir, never held whole in memory (S05 memory, cto).
  const file = await ctx.fetcher(resource.url, ctx.workDir ? { toFile: join(ctx.workDir, fileName) } : {});
  const metadata = new TextEncoder().encode(JSON.stringify({ lastModified: resource.last_modified ?? null }));
  return [
    file.file ? streamedArtifact(fileName, file, ctx.now) : { name: fileName, bytes: file.bytes, headers: file.headers, fetchedAt: ctx.now },
    { name: "resource.json", bytes: metadata, fetchedAt: ctx.now },
  ];
}

/** The artifact with this file name; a missing one is a schema change (the fetch always adds it). */
export function artifact(raw: RawArtifact[], fileName: string): RawArtifact {
  const found = raw.find((a) => a.name === fileName);
  if (!found) throw new SchemaChanged(`no artifact ${fileName}`);
  return found;
}

export type CsvRecord = { line: number; get: (column: string) => string };

/**
 * Rows of a CSV with a checked header: every column the loader reads must be present (an extra
 * column is fine). Values are trimmed; a missing cell reads as "".
 */
export function* readCsv(source: RawArtifact | Uint8Array, separator: string, needed: readonly string[], options: { requireHeader?: boolean } = {}): Generator<CsvRecord> {
  // Decoded in chunks, from memory or the streamed file: the file is never one string.
  const file: RawArtifact = source instanceof Uint8Array ? { name: "", bytes: source, fetchedAt: "" } : source;
  const rows = csvRowsChunked(artifactText(file), separator);
  const header = rows.next();
  if (header.done) {
    if (options.requireHeader) throw new SchemaChanged("empty file");
    return;
  }
  const { at, missing } = columns(header.value.map((h) => h.trim()), needed);
  if (missing.length > 0) throw new SchemaChanged(`missing columns: ${missing.join(", ")}`);
  const index = at as Record<string, number>;
  let line = 1;
  for (const row of rows) {
    line++;
    yield { line, get: (column) => (row[index[column] ?? -1] ?? "").trim() };
  }
}

export type Dropped = { reason: DropReason; prop?: string };

/**
 * A value from a closed set (SEC-2 in the S05 review): an enum column could carry free text, a
 * person's name included, so only a listed value is stored. Empty or unknown is "unspecified";
 * unknown is counted.
 */
export function closedValue(values: ReadonlySet<string>, value: string, prop: string, dropped: Dropped[]): string {
  if (values.has(value)) return value;
  if (value !== "") dropped.push({ reason: "unknown_enum", prop });
  return "unspecified";
}

/** ISO 4217 codes, plus the Latvian lats the register still holds for capital set before 2014. */
export const CURRENCIES: ReadonlySet<string> = new Set([...Intl.supportedValuesOf("currency"), "LVL"]);

/**
 * A court or case number as the files write it: digits with capital letters and separators only, so
 * a name in the column is never stored. Anything else is dropped, counted.
 */
export function caseNumber(value: string, prop: string, dropped: Dropped[]): string | null {
  if (value === "") return null;
  if (value.length <= 40 && /\d/.test(value) && /^[A-Z0-9 ./_-]+$/.test(value)) return value;
  dropped.push({ reason: "free_text", prop });
  return null;
}

/** An LV register code as the files write it: spaces and a stray `'` quoting stripped. */
export const cleanCode = (value: string) => value.replace(/[\s']/g, "");

/**
 * Whether a cleaned value is a usable LV register code. 9-digit legacy journal codes are a counted
 * skip; anything else that fails the check digit (and is not a fixture code, §3.4) is `invalid_code`.
 */
export function lvCodeProblem(code: string): DropReason | null {
  if (code === "") return "no_code";
  if (/^\d{9}$/.test(code)) return "legacy_code";
  if (isValidRegisterCode("lv", code) || isFixtureRegisterCode("lv", code)) return null;
  return "invalid_code";
}

/** `YYYY-MM-DD`, or the date part of an ISO timestamp; anything else is null. */
export function isoDate(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return date.getUTCMonth() === Number(mo) - 1 && date.getUTCDate() === Number(d) ? `${y}-${mo}-${d}` : null;
}

/** The latest valid date among values, ignoring any after `today` (UTC, `YYYY-MM-DD`). */
export function maxDate(values: Iterable<string>, today: string): string | null {
  let best: string | null = null;
  for (const v of values) {
    const d = isoDate(v);
    if (d && d <= today && (best === null || d > best)) best = d;
  }
  return best;
}

/** The three as-of strategies of the UR and VID files: data, portal, HTTP header. */
export function lvAsOf(raw: RawArtifact[], fileName: string, dates: (file: RawArtifact) => Iterable<string>, today: string): Partial<Record<AsOfStrategy, string | null>> {
  const file = raw.find((a) => a.name === fileName);
  const meta = raw.find((a) => a.name === "resource.json");
  let inData: string | null = null;
  try {
    inData = file ? maxDate(dates(file), today) : null;
  } catch {
    inData = null;
  }
  const lastModified = meta ? (JSON.parse(new TextDecoder().decode(meta.bytes)) as { lastModified: string | null }).lastModified : null;
  const header = file?.headers?.["last-modified"];
  return {
    max_date_in_data: inData,
    portal_metadata: lastModified ? isoDate(lastModified) : null,
    http_last_modified: header ? new Date(header).toISOString().slice(0, 10) : null,
  };
}
