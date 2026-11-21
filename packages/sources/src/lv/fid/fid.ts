// `lv-fid-frozen`: the Latvian FIU's list of sanctions subjects whose assets are frozen in Latvia
// (sanctions.md §4). An XLSX read under the archive limits; columns found by their leading number.
// A row loads only through the party gate: an LV register code that resolves to a company (the
// event attaches to it), or a foreign name with a company-form word (stored for screening).
// Natural persons and unproven rows are dropped; column 6, the listed person's name, is never kept,
// nor any token of it in another column, and the file itself is never cached (it holds persons).
import { createHash } from "node:crypto";
import { namesCompany, normalizeText } from "@finora/domain";
import { readXlsx } from "../../formats/xlsx.ts";
import { countryCode } from "../../intl/sanctions/countries.ts";
import { isoDate, normalizeId, subjectRecord } from "../../intl/sanctions/shared.ts";
import { parserVersion } from "../../parser-version.ts";
import type { EventInput, FieldMap, ParseContext, ParsedRecord, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";

const ITEM = "S11.LV.02";
const PORTAL = "https://data.gov.lv/dati/api/3/action/package_show?id=sankciju-subjektu-lidzekli-un-saimnieciskie-resursi-kas-iesaldeti-latvija";
const PAGE = "https://sankcijas.fid.gov.lv/lv/iesaldetie-aktivi/sankciju-subjekti";

export const LV_FID_META: SourceMeta = {
  id: "lv-fid-frozen",
  country: "lv",
  publisher: "Finanšu izlūkošanas dienests (Financial Intelligence Unit of Latvia)",
  homepage: PAGE,
  officialHosts: ["data.gov.lv", "sankcijas.fid.gov.lv"],
  licence: "cc0-1.0",
  attribution: "Source: Financial Intelligence Unit of Latvia, sanctions subjects with frozen assets, data.gov.lv, CC0 1.0",
  storage: "store",
  cadence: "weekly",
  publishedAtUtc: null,
  asOf: ["in_file_field", "portal_metadata"],
  maxPurgeShare: 0.05,
  purgeScope: "full",
  deepLink: PAGE,
  rawCache: false,
  orderUrl: null,
  requires: [],
  limits: { maxBytes: 10 * 1024 ** 2 },
  items: [ITEM],
};

export const LV_FID_FIELD_MAP: FieldMap = [
  { field: "sheet2!A1", target: { resolutionKey: "upstream_as_of" }, personal: false },
  { field: "1", target: { prop: "name" }, itemId: ITEM, personal: false },
  { field: "2", target: { resolutionKey: "party_code" }, personal: false },
  { field: "3", target: { prop: "country" }, itemId: ITEM, personal: false },
  { field: "4", target: { event: "register.frozen_assets" }, itemId: ITEM, personal: false },
  { field: "5", target: { event: "register.frozen_assets" }, itemId: ITEM, personal: false },
  { field: "6", target: { dropped: "listed_person_name" }, personal: true },
  { field: "7", target: { event: "register.frozen_assets" }, itemId: ITEM, personal: false },
  { field: "8", target: { event: "register.frozen_assets" }, itemId: ITEM, personal: false },
  { field: "9", target: { event: "register.frozen_assets" }, itemId: ITEM, personal: false },
  { field: "10", target: { event: "register.frozen_assets" }, itemId: ITEM, personal: false },
];

/** The ground is stored as a fixed category, never its text, which names the listed person (legal on S06). */
export const FID_GROUNDS = { ownedOrControlled: "owned_or_controlled_by_listed_person", listedSubject: "listed_subject" } as const;

/** A name token's stem: Latvian declines names, so "Bērziņš" and "Bērziņa" share "berzin". */
const stem = (token: string) => token.slice(0, Math.max(3, token.length - 2));

/** Whether free text holds any 3+ letter token of the listed name, in any order or case ending. */
function holdsListedName(text: string, listedTokens: readonly string[]): boolean {
  return normalizeText(text)
    .split(" ")
    .filter((t) => t.length >= 3)
    .some((t) => listedTokens.some((n) => t.startsWith(stem(n)) || n.startsWith(stem(t))));
}

/** Letters only (a-p), so a key never holds a digit run that reads as a personal code. */
const letterKey = (hex: string) => hex.replace(/[0-9]/g, (d) => "ghijklmnop"[Number(d)]!);

/** Excel's day 0 is 1899-12-30. */
const serialDate = (n: number) => new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10);

function cellDate(value: string): string | null {
  const v = value.trim();
  if (/^\d{4,5}(?:\.\d+)?$/.test(v) && Number(v) < 100_000) return serialDate(Math.floor(Number(v)));
  return isoDate(v);
}

/** The sheet's columns by their leading number ("1.", "2.", ... "10."), from the header row. */
function headerColumns(rows: string[][]): { header: number; at: Map<number, number> } | null {
  const header = rows.findIndex((r) => r.filter((c) => c.trim() !== "").length >= 3);
  if (header < 0) return null;
  const at = new Map<number, number>();
  rows[header]!.forEach((cell, i) => {
    const n = /^\s*(\d{1,2})\./.exec(cell)?.[1];
    if (n && !at.has(Number(n))) at.set(Number(n), i);
  });
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((n) => at.has(n)) ? { header, at } : null;
}

class SchemaChanged extends Error {
  override name = "schema_changed";
}

function* rowsOf(raw: RawArtifact[], ctx: ParseContext): Generator<ParsedRecord> {
  const xlsx = raw.find((a) => a.name.endsWith(".xlsx"));
  if (!xlsx) return;
  const [sheet1 = []] = readXlsx(xlsx.bytes);
  const found = headerColumns(sheet1);
  if (!found) throw new SchemaChanged();
  const col = (row: string[], n: number) => (row[found.at.get(n)!] ?? "").trim();
  for (const [i, row] of sheet1.slice(found.header + 1).entries()) {
    const name = col(row, 1).replace(/[„“”"]/g, '"');
    if (!name) continue;
    const second = col(row, 2);
    // Keyed on the subject, column 2 and the row's place: never on column 6, whose hash anyone
    // holding the public list could recompute (legal on S06, S1).
    const recordKey = letterKey(createHash("sha256").update(`${normalizeText(name)}|${normalizeText(second)}|${i}`).digest("hex").slice(0, 32));
    const rowRef = `row ${found.header + i + 2}`;
    if (cellDate(second) !== null && !/^\d{11}$/.test(second.replace(/[\s-]/g, ""))) {
      ctx.onDrop?.("person_entry");
      continue;
    }
    const listedTokens = normalizeText(col(row, 6))
      .split(" ")
      .filter((t) => t.length >= 3);
    const listedIsSubject = listedTokens.length === 0 || normalizeText(col(row, 6)) === normalizeText(name);
    const dropped: { reason: "listed_person_name" }[] = [];
    // Columns 4, 8 and 9 are free text: a field holding any token of the listed name is not kept.
    const free = (n: number): string | null => {
      const value = col(row, n);
      if (!value) return null;
      if (listedTokens.length > 0 && holdsListedName(value, listedTokens)) {
        dropped.push({ reason: "listed_person_name" });
        return null;
      }
      return value;
    };
    const assetTypes = free(4);
    const legalAct = free(8);
    const checkedNote = free(9);
    const ground = listedIsSubject ? FID_GROUNDS.listedSubject : FID_GROUNDS.ownedOrControlled;
    const event = (entityEid: string): EventInput => ({
      entityEid,
      type: "register.frozen_assets",
      date: cellDate(col(row, 10)) ?? cellDate(col(row, 7)) ?? ctx.now.slice(0, 10),
      itemId: ITEM,
      data: {
        assetTypes: (assetTypes ?? "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .join("; ") || null,
        ground,
        sanctionsFrom: cellDate(col(row, 7)),
        legalAct,
        checkedNote,
      },
    });
    const hashInput = [col(row, 2), col(row, 3), assetTypes ?? "", ground, col(row, 7), legalAct ?? "", checkedNote ?? "", col(row, 10)];
    const code = second.replace(/[\s-]/g, "");
    const country = countryCode(col(row, 3));
    if (/^\d{11}$/.test(code) && (country === null || country === "lv")) {
      yield { recordKey, hashInput, rowRef, entities: [], parties: [{ code: { country: "lv", value: code }, entities: [], events: [event(`lv-${code}`)] }], ...(dropped.length > 0 ? { dropped } : {}) };
      continue;
    }
    if (!namesCompany(name)) {
      ctx.onDrop?.("unproven_party");
      continue;
    }
    const subject = subjectRecord({
      list: "lvfid",
      id: recordKey,
      itemId: ITEM,
      names: [{ value: name, kind: "name" }],
      countries: country ? [country] : [],
      websites: [],
      identifiers: second ? [{ type: "registration", number: normalizeId(second), country }] : [],
      sanction: { authority: "Finanšu izlūkošanas dienests", programs: [], listingDate: cellDate(col(row, 7)), sourceUrl: PAGE },
    });
    yield { ...subject, hashInput, rowRef, events: [event(`sanc-lvfid-${recordKey}`)], ...(dropped.length > 0 ? { dropped } : {}) };
  }
}

export const lvFidFrozen: SourceLoader = {
  meta: LV_FID_META,
  parserVersion: parserVersion(LV_FID_META.id, 2, LV_FID_FIELD_MAP, LV_FID_META.items),
  fieldMap: LV_FID_FIELD_MAP,
  async fetch(ctx) {
    const portal = await ctx.fetcher(PORTAL);
    const resources = (JSON.parse(new TextDecoder().decode(portal.bytes)) as { result?: { resources?: { url?: string; last_modified?: string }[] } }).result?.resources ?? [];
    const resource = resources.find((r) => r.url?.includes("sankciju_subjekti"));
    if (!resource?.url) throw new SchemaChanged();
    const file = await ctx.fetcher(resource.url);
    const metadata = new TextEncoder().encode(JSON.stringify({ lastModified: resource.last_modified ?? null }));
    return {
      artifacts: [
        { name: "sankciju_subjekti.xlsx", bytes: file.bytes, headers: file.headers, fetchedAt: ctx.now },
        { name: "resource.json", bytes: metadata, fetchedAt: ctx.now },
      ],
    };
  },
  asOf(raw) {
    const xlsx = raw.find((a) => a.name.endsWith(".xlsx"));
    const meta = raw.find((a) => a.name === "resource.json");
    let inFile: string | null = null;
    try {
      const a1 = xlsx ? (readXlsx(xlsx.bytes)[1]?.[0]?.[0] ?? "") : "";
      inFile = isoDate(/(\d{2}\.\d{2}\.\d{4})/.exec(a1)?.[1] ?? "");
    } catch {
      inFile = null;
    }
    const lastModified = meta ? (JSON.parse(new TextDecoder().decode(meta.bytes)) as { lastModified: string | null }).lastModified : null;
    return { in_file_field: inFile, portal_metadata: lastModified ? isoDate(lastModified) : null };
  },
  parse(raw, ctx) {
    return rowsOf(raw, ctx);
  },
};
