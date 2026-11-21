// Every parsed record is validated before it is gated or written; an invalid one is a counted skip.
import { findPersonalCodes, PERSON_EID, SCHEMAS } from "@finora/domain";
import type { ParsedRecord } from "@finora/sources";
import { z } from "zod";

const text = z.string().min(1);
const statement = z.object({ prop: text, value: z.string(), itemId: text, lang: z.string().optional(), line: z.number().int().nonnegative().optional() });
const entity = z.object({
  eid: text,
  schema: z.enum(SCHEMAS as unknown as [string, ...string[]]),
  country: text,
  legalForm: z.string().nullish(),
  status: z.string().nullish(),
  code: z.string().nullish(),
  statements: z.array(statement),
});
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

const record = z.object({
  recordKey: text,
  hashInput: z.array(z.string()),
  entities: z.array(entity),
  reports: z
    .array(
      z.object({
        entityEid: text,
        kind: text,
        periodStart: isoDate.nullish(),
        periodEnd: isoDate,
        currency: z.string().nullish(),
        unitScale: z.number().int().positive().optional(),
        itemId: text,
        facts: z.array(z.object({ concept: text, value: z.number().finite() })),
      }),
    )
    .optional(),
  events: z.array(z.object({ entityEid: text, type: text, date: isoDate, data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(), itemId: text })).optional(),
  parties: z
    .array(
      z.object({
        type: z.string().nullish(),
        code: z.object({ country: text, value: text }).nullish(),
        entities: z.array(entity),
      }),
    )
    .optional(),
  lineIds: z.array(z.string().nullable()).optional(),
  rowRef: z.string().optional(),
  period: isoDate.optional(),
  op: z.enum(["upsert", "delete"]).optional(),
  dropped: z.array(z.object({ reason: text, prop: z.string().optional() })).optional(),
});

export type Validation = { ok: true; record: ParsedRecord } | { ok: false; reason: "invalid_record" | "person_field" };

/**
 * Validates one parsed record. The returned record is the schema's output, so a key the contract
 * does not name (a stray `value` in a drop) never reaches the store or the report (SEC-2). A
 * record about a person whose key, hash input, line ids or row reference holds a personal code or
 * a person row id is refused whole (PS6, qa S9): a loader bug must not get a code into the store.
 */
export function validateRecord(value: unknown): Validation {
  const parsed = record.safeParse(value);
  if (!parsed.success) return { ok: false, reason: "invalid_record" };
  const r = parsed.data as ParsedRecord;
  const aboutPeople = r.entities.some((e) => e.schema === "Person") || (r.parties ?? []).some((p) => p.entities.some((e) => e.schema === "Person"));
  if (aboutPeople) {
    const keys = [r.recordKey, ...r.hashInput, ...(r.lineIds ?? []).filter((x): x is string => x !== null), r.rowRef ?? ""];
    if (keys.some((k) => findPersonalCodes(k).length > 0 || PERSON_EID.test(k))) return { ok: false, reason: "person_field" };
  }
  return { ok: true, record: r };
}

export function validRecord(value: unknown): value is ParsedRecord {
  return validateRecord(value).ok;
}
