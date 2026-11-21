// Every parsed record is validated before it is gated or written; an invalid one is a counted skip.
import { SCHEMAS } from "@finora/domain";
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

export function validRecord(value: unknown): value is ParsedRecord {
  return record.safeParse(value).success;
}
