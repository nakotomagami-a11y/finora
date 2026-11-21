// Licence registry and the source invariants (architecture §4.2; R12, R13, P1, P11). Each loader
// slice adds its source's licence here, with the wording and the date docs/research verified it.
import { isLoadable } from "@finora/domain";
import type { FieldMap, SourceMeta, StorageClass } from "./types.ts";

export type Licence = {
  id: string;
  name: string;
  url: string;
  attributionRequired: boolean;
  shareAlike: boolean;
  nonCommercial: boolean;
  redistribution: boolean;
  /** Where and when docs/research read the terms; null means not verified, so the source cannot be enabled. */
  verifiedOn: { date: string; url: string } | null;
};

export const LICENCES: Readonly<Record<string, Licence>> = {
  "cc0-1.0": {
    id: "cc0-1.0",
    name: "CC0 1.0",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    attributionRequired: false,
    shareAlike: false,
    nonCommercial: false,
    redistribution: true,
    verifiedOn: { date: "2026-11-19", url: "https://data.gov.lv/dati/lv/dataset/uz" },
  },
  "cc-by-4.0": {
    id: "cc-by-4.0",
    name: "CC BY 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
    attributionRequired: true,
    shareAlike: false,
    nonCommercial: false,
    redistribution: true,
    verifiedOn: { date: "2026-11-19", url: "https://avaandmed.ariregister.rik.ee/en" },
  },
  "cc-by-sa-3.0": {
    id: "cc-by-sa-3.0",
    name: "CC BY-SA 3.0",
    url: "https://creativecommons.org/licenses/by-sa/3.0/",
    attributionRequired: true,
    shareAlike: true,
    nonCommercial: false,
    redistribution: true,
    verifiedOn: { date: "2026-11-19", url: "https://andmed.eesti.ee" },
  },
  // Sanctions lists (sanctions.md): reuse with acknowledgement, a US government work, OGL.
  "eu-reuse-2011-833": {
    id: "eu-reuse-2011-833",
    name: "Commission Decision 2011/833/EU (reuse of Commission documents)",
    url: "https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng",
    attributionRequired: true,
    shareAlike: false,
    nonCommercial: false,
    redistribution: true,
    verifiedOn: { date: "2026-11-19", url: "https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng" },
  },
  "us-public-domain": {
    id: "us-public-domain",
    name: "US government work (17 U.S.C. §105)",
    url: "https://www.copyright.gov/title17/92chap1.html#105",
    attributionRequired: false,
    shareAlike: false,
    nonCommercial: false,
    redistribution: true,
    verifiedOn: { date: "2026-11-19", url: "https://ofac.treasury.gov/sanctions-list-service" },
  },
  "ogl-uk-3.0": {
    id: "ogl-uk-3.0",
    name: "Open Government Licence v3.0",
    url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    attributionRequired: true,
    shareAlike: false,
    nonCommercial: false,
    redistribution: true,
    verifiedOn: { date: "2026-11-19", url: "https://www.gov.uk/government/publications/the-uk-sanctions-list" },
  },
  "esma-reuse-notice": {
    id: "esma-reuse-notice",
    name: "ESMA legal notice (reproduction authorised, source acknowledged)",
    url: "https://www.esma.europa.eu/legal-notice",
    attributionRequired: true,
    shareAlike: false,
    nonCommercial: false,
    redistribution: true,
    verifiedOn: { date: "2026-11-19", url: "https://www.esma.europa.eu/legal-notice" },
  },
  // Live-only lists (sanctions.md §9): no reuse grant, so agent-only, never stored.
  "un-site-terms": {
    id: "un-site-terms",
    name: "UN website terms (personal, non-commercial use)",
    url: "https://www.un.org/en/about-us/terms-of-use",
    attributionRequired: true,
    shareAlike: false,
    nonCommercial: true,
    redistribution: false,
    verifiedOn: { date: "2026-11-19", url: "https://www.un.org/en/about-us/terms-of-use" },
  },
  "none-stated": {
    id: "none-stated",
    name: "No licence stated (copyright applies)",
    url: "https://fntt.lrv.lt/en/international-financial-sanctions/a-list-of-sanctioned-subjects/",
    attributionRequired: true,
    shareAlike: false,
    nonCommercial: false,
    redistribution: false,
    verifiedOn: { date: "2026-11-19", url: "https://fntt.lrv.lt/en/international-financial-sanctions/a-list-of-sanctioned-subjects/" },
  },
  "lb-credit-source": {
    id: "lb-credit-source",
    name: "Bank of Lithuania: cite as the source, no reuse grant",
    url: "https://www.lb.lt/illegalwww",
    attributionRequired: true,
    shareAlike: false,
    nonCommercial: false,
    redistribution: false,
    verifiedOn: { date: "2026-11-19", url: "https://www.lb.lt/illegalwww" },
  },
  "all-rights-reserved-link-quote": {
    id: "all-rights-reserved-link-quote",
    name: "All rights reserved: link and quote only",
    url: "https://www.bank.lv/",
    attributionRequired: true,
    shareAlike: false,
    nonCommercial: false,
    redistribution: false,
    verifiedOn: { date: "2026-11-19", url: "https://www.bank.lv/" },
  },
};

export const SOURCE_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;

const SHARE_ALIKE_OK: StorageClass[] = ["share-alike-store", "live-no-store"];
const RESTRICTED_OK: StorageClass[] = ["agent-only", "live-no-store", "connector-cache"];

function host(url: string): string | null {
  try {
    return new URL(url.replace(/\{[^}]+\}/g, "x")).hostname;
  } catch {
    return null;
  }
}

/**
 * The invariants every source must hold; returns one message per problem. `fetchHosts` are the
 * hosts the loader fetches from, which must all be official.
 */
export function checkSource(meta: SourceMeta, fieldMap: FieldMap, fetchHosts: readonly string[] = []): string[] {
  const problems: string[] = [];
  // The id names files and directories (raw cache, leases), so it is never a path (SEC-8).
  if (!SOURCE_ID.test(meta.id)) problems.push(`${meta.id}: a source id matches ${SOURCE_ID}`);
  const licence = LICENCES[meta.licence];
  if (!licence) return [`${meta.id}: licence ${meta.licence} is not in LICENCES`];
  if (meta.storage === "store" && (licence.shareAlike || licence.nonCommercial || !licence.redistribution)) {
    problems.push(`${meta.id}: storage "store" needs a licence without share-alike or non-commercial terms that allows redistribution`);
  }
  if (licence.shareAlike && !SHARE_ALIKE_OK.includes(meta.storage)) {
    problems.push(`${meta.id}: a share-alike licence needs share-alike-store or live-no-store`);
  }
  if ((licence.nonCommercial || !licence.redistribution) && !RESTRICTED_OK.includes(meta.storage)) {
    problems.push(`${meta.id}: a non-commercial or no-redistribution licence needs agent-only, live-no-store or connector-cache`);
  }
  if (!licence.verifiedOn) problems.push(`${meta.id}: licence ${licence.id} has no verifiedOn date, so the source cannot be enabled (P11)`);
  for (const url of [meta.orderUrl, meta.deepLink].filter((u): u is string => u !== null)) {
    const h = host(url);
    if (!h || !meta.officialHosts.includes(h)) problems.push(`${meta.id}: ${url} is not on an official host`);
  }
  for (const h of fetchHosts) if (!meta.officialHosts.includes(h)) problems.push(`${meta.id}: fetch host ${h} is not official`);
  const mapped = new Set(fieldMap.map((e) => e.itemId).filter((id): id is string => id !== undefined));
  const declared = new Set(meta.items);
  for (const id of mapped) if (!declared.has(id)) problems.push(`${meta.id}: field map item ${id} is missing from meta.items`);
  for (const id of declared) {
    if (!mapped.has(id)) problems.push(`${meta.id}: meta.items lists ${id}, which no field-map entry fills`);
    if (!isLoadable(id)) problems.push(`${meta.id}: item ${id} is not a SHOW or CAVEAT item`);
  }
  return problems;
}
