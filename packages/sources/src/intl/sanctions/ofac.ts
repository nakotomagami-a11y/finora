// `us-ofac-sdn` and `us-ofac-cons`: the OFAC lists as enhanced XML (sanctions.md §2). The file is
// scanned entity by entity over its bytes: each `<entity>` block is decoded alone, so the
// 111 MB file is never held as one string. Organisations are stored for screening; individuals go
// to the in-memory person index only (§7a); vessels and aircraft are not loaded (no company
// screening needs them, and the store has no schema for them).
import { attr, decodeXml, elements, text, withoutComments } from "@finora/formats";
import { parserVersion } from "../../parser-version.ts";
import type { FieldMap, ParseContext, ParsedRecord, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";
import { countryCode } from "./countries.ts";
import { hostOf, isoDate, normalizeId, subjectRecord, type Identifier, type IdentifierType, type ListName } from "./shared.ts";

const ITEM = "S11.ALL.02";
const EXPORTS = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports";

/** Identity-document types read for organisations; every other type (passports, personal ids) is never read. */
const ID_TYPES: Record<string, IdentifierType> = {
  "Registration Number": "registration",
  "Business Registration Number": "registration",
  "Company Number": "registration",
  "UK Company Number": "registration",
  "Commercial Registry Number": "registration",
  "Registration ID": "registration",
  "Folio Mercantil No.": "registration",
  "Tax ID No.": "tax",
  "V.A.T. Number": "tax",
  "US FEIN": "tax",
  "Legal Entity Number": "lei",
  "Identification Number": "other",
};

export const OFAC_FIELD_MAP: FieldMap = [
  { field: "publicationInfo/dataAsOf", target: { resolutionKey: "upstream_as_of" }, personal: false },
  { field: "entity/@id", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "generalInfo/entityType", target: { resolutionKey: "subject_type" }, personal: false },
  { field: "sanctionsLists/sanctionsList", target: { prop: "authority" }, itemId: ITEM, personal: false },
  { field: "sanctionsList/@datePublished", target: { prop: "listingDate" }, itemId: ITEM, personal: false },
  { field: "sanctionsPrograms/sanctionsProgram", target: { prop: "program" }, itemId: ITEM, personal: false },
  { field: "names/name/formattedFullName", target: { prop: "name" }, itemId: ITEM, personal: false },
  { field: "names/name/isLowQuality", target: { prop: "weakAlias" }, itemId: ITEM, personal: false },
  { field: "names/name/aliasType", target: { prop: "previousName" }, itemId: ITEM, personal: false },
  { field: "identityDocument/documentNumber", target: { prop: "number" }, itemId: ITEM, personal: false },
  { field: "identityDocument/type", target: { prop: "type" }, itemId: ITEM, personal: false },
  { field: "identityDocument/issuingCountry", target: { resolutionKey: "identifier_country" }, personal: false },
  { field: "feature/Birthdate", target: { dropped: "person_entry" }, personal: true },
  { field: "feature/Nationality Country", target: { dropped: "person_entry" }, personal: true },
  { field: "feature/Citizenship Country", target: { dropped: "person_entry" }, personal: true },
  { field: "feature/Organization Established Date", target: { prop: "incorporationDate" }, itemId: ITEM, personal: false },
  { field: "feature/Website", target: { prop: "website" }, itemId: ITEM, personal: false },
  { field: "addresses/address/country", target: { prop: "country" }, itemId: ITEM, personal: false },
  { field: "derived:entity", target: { prop: "entity" }, itemId: ITEM, personal: false },
  { field: "derived:holder", target: { prop: "holder" }, itemId: ITEM, personal: false },
  { field: "identityDocument/documentNumber", target: { prop: "leiCode" }, itemId: ITEM, personal: false },
  { field: "names/name/formattedFullName", target: { prop: "alias" }, itemId: ITEM, personal: false },
];

const ENTITY_OPEN = Buffer.from("<entity id=");
const ENTITY_CLOSE = Buffer.from("</entity>");
const FILE_CLOSE = Buffer.from("</sanctionsData>");

class Truncated extends Error {
  override name = "truncated";
}

/**
 * Each `<entity>` block of the file, decoded on its own, comments removed. A file cut anywhere,
 * even between two blocks, throws, so the sync ends partial and nothing is purged (qa S3).
 */
function* entityBlocks(bytes: Uint8Array): Generator<string> {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let last = 0;
  for (let at = buf.indexOf(ENTITY_OPEN); at >= 0; ) {
    const end = buf.indexOf(ENTITY_CLOSE, at);
    if (end < 0) throw new Truncated();
    yield withoutComments(decoder.decode(buf.subarray(at, end + ENTITY_CLOSE.length)));
    last = end + ENTITY_CLOSE.length;
    at = buf.indexOf(ENTITY_OPEN, last);
  }
  if (buf.indexOf(FILE_CLOSE, last) < 0) throw new Truncated();
}

function features(block: string): { type: string; value: string; from: string | null }[] {
  return elements(block, "feature").map((f) => ({ type: text(f.inner, "type") ?? "", value: text(f.inner, "value") ?? "", from: text(f.inner, "fromDateBegin") }));
}

/** Latin-script names first; other scripts become aliases with their script as `lang`. */
function names(block: string): { value: string; primary: boolean; weak: boolean; former: boolean; script: string }[] {
  const section = elements(block, "names")[0]?.inner ?? "";
  return elements(section, "name").flatMap((n) => {
    const primary = text(n.inner, "isPrimary") === "true";
    const weak = text(n.inner, "isLowQuality") === "true";
    const former = (text(n.inner, "aliasType") ?? "") === "F.K.A.";
    return elements(n.inner, "translation").flatMap((t) => {
      const value = text(t.inner, "formattedFullName");
      return value ? [{ value, primary: primary && text(t.inner, "isPrimary") === "true", weak, former, script: text(t.inner, "script") ?? "" }] : [];
    });
  });
}

export function* parseOfac(raw: RawArtifact[], ctx: ParseContext, sourceId: string): Generator<ParsedRecord> {
  for (const artifact of raw) {
    for (const block of entityBlocks(artifact.bytes)) {
      const id = /^<entity id="(\d+)"/.exec(block)?.[1];
      if (!id) continue;
      const general = elements(block, "generalInfo")[0]?.inner ?? "";
      const type = text(general, "entityType");
      const lists = elements(block, "sanctionsList");
      const authority = lists.map((l) => decodeXml(l.inner).trim()).find(Boolean) ?? "OFAC";
      const listDate = lists.map((l) => attr(l.attrs, "datePublished")).find((d): d is string => !!d) ?? null;
      const programs = elements(block, "sanctionsProgram").map((p) => decodeXml(p.inner).trim()).filter(Boolean);
      const all = names(block);
      const feats = features(block);
      if (type === "Individual") {
        const birth = feats.find((f) => f.type === "Birthdate");
        ctx.onPerson?.({
          list: sourceId,
          entryId: id,
          names: [...new Set(all.map((n) => n.value))],
          program: programs[0] ?? null,
          listDate: isoDate(listDate ?? ""),
          birthYear: birth?.from ? Number(birth.from.slice(0, 4)) : null,
          nationalities: [
            ...new Set(feats.filter((f) => f.type === "Nationality Country" || f.type === "Citizenship Country").map((f) => countryCode(f.value)).filter((c): c is string => c !== null)),
          ],
        });
        ctx.onDrop?.("person_entry");
        continue;
      }
      if (type === "Vessel" || type === "Aircraft") {
        ctx.onDrop?.("subject_out_of_scope");
        continue;
      }
      if (type !== "Entity" || all.length === 0) {
        ctx.onDrop?.("unknown_subject_type");
        continue;
      }
      const primary = all.find((n) => n.primary && n.script === "Latin") ?? all.find((n) => n.script === "Latin") ?? all[0]!;
      const listNames: ListName[] = [
        { value: primary.value, kind: "name" },
        ...all
          .filter((n) => n !== primary)
          .map((n): ListName => ({ value: n.value, kind: n.weak ? "weakAlias" : n.former ? "previousName" : "alias", ...(n.script && n.script !== "Latin" ? { lang: n.script.toLowerCase() } : {}) })),
      ];
      const docs = elements(elements(block, "identityDocuments")[0]?.inner ?? "", "identityDocument");
      const identifiers: Identifier[] = docs.flatMap((d) => {
        const idType = ID_TYPES[text(d.inner, "type") ?? ""];
        const number = normalizeId(text(d.inner, "documentNumber") ?? "");
        const issuing = text(d.inner, "issuingCountry");
        return idType && number ? [{ type: idType, number, country: issuing ? countryCode(issuing) : null }] : [];
      });
      const established = feats.find((f) => f.type === "Organization Established Date");
      const addresses = elements(elements(block, "addresses")[0]?.inner ?? "", "country").map((c) => countryCode(decodeXml(c.inner)));
      yield subjectRecord({
        list: "ofac",
        id,
        itemId: ITEM,
        names: listNames,
        countries: addresses.filter((c): c is string => c !== null),
        websites: feats.filter((f) => f.type === "Website").map((f) => hostOf(f.value)).filter((h): h is string => h !== null),
        lei: identifiers.find((i) => i.type === "lei")?.number ?? null,
        identifiers: identifiers.filter((i) => i.type !== "lei"),
        incorporationDate: established?.from ? isoDate(established.from) : null,
        sanction: { authority, programs, listingDate: isoDate(listDate ?? "") },
      });
    }
  }
}

function ofacLoader(id: "us-ofac-sdn" | "us-ofac-cons", file: string): SourceLoader {
  const meta: SourceMeta = {
    id,
    country: "intl",
    publisher: "US Department of the Treasury, Office of Foreign Assets Control",
    homepage: "https://ofac.treasury.gov/sanctions-list-service",
    // The export answers with a 302 to a signed URL on one fixed storage host, listed here.
    officialHosts: ["ofac.treasury.gov", "sanctionslistservice.ofac.treas.gov", "sanctionssearch.ofac.treas.gov", "wc2h-sls-prod-public-published.s3.us-gov-west-1.amazonaws.com"],
    licence: "us-public-domain",
    attribution: "Source: US Department of the Treasury, Office of Foreign Assets Control (OFAC)",
    storage: "store",
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["in_file_field"],
    maxPurgeShare: 0.02,
    purgeScope: "full",
    deepLink: "https://sanctionssearch.ofac.treas.gov/Details.aspx?id={recordKey}",
    rawCache: false,
    personIndex: true,
    orderUrl: null,
    requires: [],
    limits: { maxBytes: 300 * 1024 ** 2 },
    items: [ITEM],
  };
  return {
    meta,
    parserVersion: parserVersion(id, 3, OFAC_FIELD_MAP, meta.items),
    fieldMap: OFAC_FIELD_MAP,
    async fetch(ctx) {
      const res = await ctx.fetcher(`${EXPORTS}/${file}`);
      return { artifacts: [{ name: file, bytes: res.bytes, headers: res.headers, fetchedAt: ctx.now }] };
    },
    asOf(raw) {
      const head = raw[0] ? new TextDecoder().decode(raw[0].bytes.subarray(0, 4096)) : "";
      return { in_file_field: isoDate(text(head, "dataAsOf") ?? "") };
    },
    parse(raw, ctx) {
      return parseOfac(raw, ctx, id);
    },
  };
}

export const usOfacSdn = ofacLoader("us-ofac-sdn", "SDN_ENHANCED.XML");
export const usOfacCons = ofacLoader("us-ofac-cons", "CONS_ENHANCED.XML");
