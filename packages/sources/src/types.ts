// The loader contract (architecture §4.2-§4.3). Parsers are pure given their artifacts, so every
// loader is tested on committed synthetic fixtures with no network.
import type { DropReason, SchemaName } from "@finora/domain";

export type StorageClass = "store" | "share-alike-store" | "live-no-store" | "live-cached" | "agent-only" | "connector-cache";
export type AsOfStrategy = "in_file_field" | "in_file_name" | "max_date_in_data" | "portal_metadata" | "http_last_modified";
export type PurgeScope = "full" | "window" | "periods_in_file" | "none";
export type Cadence = "daily" | "weekly" | "monthly" | "quarterly" | "on-view";

export type SourceMeta = {
  id: string;
  country: "lt" | "lv" | "ee" | "us" | "intl";
  publisher: string;
  homepage: string;
  /** Every host the loader, deep links and orderUrl may use (R14). */
  officialHosts: string[];
  licence: string;
  attribution: string | null;
  storage: StorageClass;
  cadence: Cadence;
  publishedAtUtc: string | null;
  /** Ordered strategies, strongest first; the first that yields a date wins (§4.2). */
  asOf: AsOfStrategy[];
  /** Largest share of records one sync may delete. */
  maxPurgeShare: number;
  purgeScope: PurgeScope;
  /** What a removed record leaves behind: nothing, or its identity with tombstone_since (EE). */
  onRemoval?: "delete" | "tombstone";
  deepLink: string | null;
  /** Default true; false for files that hold natural persons who are never stored. */
  rawCache?: boolean;
  orderUrl: string | null;
  cacheTtl?: { refetchHours: number; purgeUnviewedDays: number };
  requires: string[];
  limits: { requestsPerSecond?: number; dailyRequests?: number };
  /** Every item the source fills; must equal the item ids of its field map. */
  items: string[];
};

export type ParsedStatement = { prop: string; value: string; itemId: string; lang?: string; line?: number };
export type ParsedEntity = {
  eid: string;
  schema: SchemaName;
  country: string;
  legalForm?: string | null;
  status?: string | null;
  code?: string | null;
  statements: ParsedStatement[];
};
export type FactReportInput = {
  entityEid: string;
  kind: string;
  periodStart?: string | null;
  periodEnd: string;
  currency?: string | null;
  unitScale?: number;
  itemId: string;
  facts: { concept: string; value: number }[];
};
export type EventInput = { entityEid: string; type: string; date: string; data?: Record<string, string | number | null>; itemId: string };

/** A party row (member, debtor, insolvency subject, sanctions link): loaded only if proven a company. */
export type PartyRef = {
  /** The register's own party type value, when it has one (LV `LEGAL_ENTITY`, EE `J`). */
  type?: string | null;
  /** The party's register code, when the row has one; resolved against the store. */
  code?: { country: string; value: string } | null;
  /** Entities to load when the party is proven a company (the relationship row, the party itself). */
  entities: ParsedEntity[];
};

export type { DropReason } from "@finora/domain";

export type ParsedRecord = {
  recordKey: string;
  hashInput: string[];
  entities: ParsedEntity[];
  reports?: FactReportInput[];
  events?: EventInput[];
  parties?: PartyRef[];
  /** Role-line identities, in line order: the source's row-local id, or null (architecture §3.3). */
  lineIds?: (string | null)[];
  /** A row-local reference for drop reports; never a code or a name. */
  rowRef?: string;
  /** For window and periods_in_file sources: the record's period (ISO date). */
  period?: string;
  /** Change feeds: an explicit delete of this key. */
  op?: "upsert" | "delete";
  /** Fields the parser itself dropped by rule, counted in the sync report. */
  dropped?: { reason: DropReason; prop?: string }[];
};

export type RawArtifact = { name: string; bytes: Uint8Array; headers?: Record<string, string>; fetchedAt: string };

export type FetchContext = {
  fetcher: PoliteFetch;
  /** Values of `meta.requires`, read by the caller's env module. */
  keys: Record<string, string>;
  now: string;
  /** The last change token seen, if the source has one. */
  lastToken: string | null;
};
export type FetchResult = { unchanged: true; token?: string } | { unchanged?: false; artifacts: RawArtifact[]; token?: string };
export type ParseContext = { now: string };

export type PoliteFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number; headers: Record<string, string>; bytes: Uint8Array }>;

export interface SourceLoader {
  meta: SourceMeta;
  /** Changes whenever the parser, its field map or the item list changes (A1). */
  parserVersion: string;
  fieldMap: FieldMap;
  fetch(ctx: FetchContext): Promise<FetchResult>;
  /** The date each strategy yields for these artifacts; the pipeline takes the first in `meta.asOf` order. */
  asOf(raw: RawArtifact[]): Partial<Record<AsOfStrategy, string | null>>;
  parse(raw: RawArtifact[], ctx: ParseContext): AsyncIterable<ParsedRecord> | Iterable<ParsedRecord>;
  /** For window sources: records whose period is before this date are expected deletions. */
  windowStart?(raw: RawArtifact[]): string | null;
}

/** Every field the loader reads (architecture §4.7). Fields not in the map are never read. */
export type FieldMapEntry = {
  field: string;
  target: { prop: string } | { concept: string } | { event: string } | { resolutionKey: string } | { dropped: DropReason };
  /** The Part G item, for every target except a resolution key or a drop. */
  itemId?: string;
  personal: boolean;
};
export type FieldMap = readonly FieldMapEntry[];
