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
});
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

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
  events: z
    .array(z.strictObject({ entityEid: text, type: text, date: isoDate, data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(), itemId: text }))
    .optional(),
  parties: z
    .array(
      z.strictObject({
        type: z.string().nullish(),
        code: z.strictObject({ country: text, value: text }).nullish(),
        entities: z.array(entity),
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

/** The public entity ids a key may hold by design: a country prefix and its code (§3.4). */
const EID_TOKEN = /\b(?:lv|ee|lt)-\d{8,11}\b|\bus-cik-\d{10}\b|\bus-[a-z]{2}-[A-Za-z0-9]+\b|\borg-[0-9a-f]{20}\b|\blei-[A-Z0-9]{20}\b/g;

/**
 * A record about people gets the strict any-country rule on everything it stores or hashes, after
 * removing only the entity id tokens a key is meant to hold (legal on S04i): a personal code that
 * also passes the LV register check digit is refused here, never read as a company code.
 */
function personKeyLeaks(key: string): boolean {
  return PERSON_EID.test(key) || freeTextHoldsPersonalCode(key.replace(EID_TOKEN, " "));
}

/**
 * Validates one parsed record and returns the schema's output. A record whose stored keys (record
 * key, line ids) hold a personal code or a person row id is refused whole, and so is a person
 * record whose hash input or row reference does (PS6, qa S9): a loader bug must not get a code
 * into the store.
 */
export function validateRecord(value: unknown): Validation {
  const parsed = record.safeParse(value);
  if (!parsed.success) return { ok: false, reason: "invalid_record" };
  const r = parsed.data as ParsedRecord;
  const countries = new Set(r.entities.map((e) => e.country));
  const stored = [r.recordKey, ...(r.lineIds ?? []).filter((x): x is string => x !== null)];
  const aboutPeople = r.entities.some((e) => e.schema === "Person") || (r.parties ?? []).some((p) => p.entities.some((e) => e.schema === "Person"));
  if (aboutPeople) {
    if ([...stored, ...r.hashInput, r.rowRef ?? ""].some(personKeyLeaks)) return { ok: false, reason: "person_field" };
  } else if (stored.some((k) => keyLeaks(k, countries))) {
    return { ok: false, reason: "person_field" };
  }
  return { ok: true, record: r };
}

export function validRecord(value: unknown): value is ParsedRecord {
  return validateRecord(value).ok;
}
