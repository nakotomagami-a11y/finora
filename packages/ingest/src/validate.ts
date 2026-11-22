// Every parsed record is validated before it is gated or written; an invalid one is a counted skip.
import { DROP_REASONS, freeTextHoldsPersonalCode, PERSON_EID, SCHEMAS, textHoldsPersonalCode } from "@finora/domain";
import type { ParsedRecord } from "@finora/sources";
import { z } from "zod";

// Strict everywhere: a key the contract does not name makes the record invalid, so a loader's
// stray field (a `value` inside a drop) can never reach the store or the report (SEC-2).
const text = z.string().min(1);
const statement = z.strictObject({ prop: text, value: z.string(), itemId: text, lang: z.string().optional(), line: z.number().int().nonnegative().optional() });
const entity = z.strictObject({
  eid: text,
  schema: z.enum(SCHEMAS),
  country: text,
  legalForm: z.string().nullish(),
  status: z.string().nullish(),
  code: z.string().nullish(),
  statements: z.array(statement),
  ref: z.boolean().optional(),
});
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);
const event = z.strictObject({ entityEid: text, type: text, date: isoDate, data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(), itemId: text });

const record = z.strictObject({
  recordKey: text,
  hashInput: z.array(z.string()),
  entities: z.array(entity),
  reports: z
    .array(
      z.strictObject({
        entityEid: text,
        kind: text,
        periodStart: isoDate.nullish(),
        periodEnd: isoDate,
        currency: z.string().nullish(),
        unitScale: z.number().int().positive().optional(),
        itemId: text,
        facts: z.array(z.strictObject({ concept: text, value: z.number().finite() })),
      }),
    )
    .optional(),
  events: z.array(event).optional(),
  parties: z
    .array(
      z.strictObject({
        type: z.string().nullish(),
        code: z.strictObject({ country: text, value: text }).nullish(),
        entities: z.array(entity),
        events: z.array(event).optional(),
      }),
    )
    .optional(),
  lineIds: z.array(z.string().nullable()).optional(),
  rowRef: z.string().optional(),
  period: isoDate.optional(),
  op: z.enum(["upsert", "delete"]).optional(),
  dropped: z.array(z.strictObject({ reason: z.enum(DROP_REASONS), prop: z.string().optional() })).optional(),
});

export type Validation = { ok: true; record: ParsedRecord } | { ok: false; reason: "invalid_record" | "person_field" };

/** Whether a company-only record's stored key holds a personal code or a person row id (country-aware). */
function keyLeaks(key: string, countries: ReadonlySet<string>): boolean {
  return PERSON_EID.test(key) || textHoldsPersonalCode(key, countries.has("lv") ? "lv" : null);
}

/**
 * A record about people gets the strict any-country rule on everything it stores or hashes, after
 * removing only the exact eids of the companies the record holds or is about (legal on S04i). No
 * token is removed by its shape: an id-shaped prefix on a personal code is scanned like any text.
 */
function personKeyLeaks(key: string, ownEids: readonly string[]): boolean {
  let rest = key;
  for (const eid of ownEids) rest = rest.split(eid).join(" ");
  return PERSON_EID.test(rest) || freeTextHoldsPersonalCode(rest);
}

/**
 * The eids a person record's keys may hold: its own non-Person entities, and the company it is
 * about (the `organization` or `asset` of its relationship rows) when the store holds that company.
 */
function companyEidsOf(r: ParsedRecord, knownCompany: (eid: string) => boolean): string[] {
  const all = [...r.entities, ...(r.parties ?? []).flatMap((p) => p.entities)];
  const own = all.filter((e) => e.schema !== "Person" && !PERSON_EID.test(e.eid) && !/^rel-\d+-\d+$/.test(e.eid)).map((e) => e.eid);
  const about = all
    .flatMap((e) => e.statements.filter((s) => s.prop === "organization" || s.prop === "asset").map((s) => s.value))
    .filter(knownCompany);
  // Longest first, so one eid never leaves a fragment of a longer one behind.
  return [...new Set([...own, ...about])].sort((a, b) => b.length - a.length);
}

/**
 * Validates one parsed record and returns the schema's output. A record whose stored keys (record
 * key, line ids) hold a personal code or a person row id is refused whole, and so is a person
 * record whose hash input or row reference does (PS6, qa S9): a loader bug must not get a code
 * into the store.
 */
export function validateRecord(value: unknown, context: { knownCompany?: (eid: string) => boolean } = {}): Validation {
  const parsed = record.safeParse(value);
  if (!parsed.success) return { ok: false, reason: "invalid_record" };
  const r = parsed.data as ParsedRecord;
  const countries = new Set(r.entities.map((e) => e.country));
  const stored = [r.recordKey, ...(r.lineIds ?? []).filter((x): x is string => x !== null)];
  const aboutPeople = r.entities.some((e) => e.schema === "Person") || (r.parties ?? []).some((p) => p.entities.some((e) => e.schema === "Person"));
  if (aboutPeople) {
    const own = companyEidsOf(r, context.knownCompany ?? (() => false));
    if ([...stored, ...r.hashInput, r.rowRef ?? ""].some((k) => personKeyLeaks(k, own))) return { ok: false, reason: "person_field" };
  } else if (stored.some((k) => keyLeaks(k, countries))) {
    return { ok: false, reason: "person_field" };
  }
  return { ok: true, record: r };
}

export function validRecord(value: unknown): value is ParsedRecord {
  return validateRecord(value).ok;
}
