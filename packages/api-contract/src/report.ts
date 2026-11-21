// GET /api/v1/companies/:eid and /sections/:section (architecture §5.1, §5.4, §7.2).
import { z } from "zod";
import { CheckId, Country, Eid, ItemId, Page, SectionId, SectionResult, SkipReason } from "./common.ts";

/** One displayed field: its item, the property it came from, and the value as text or a number. */
export const FieldValue = z
  .object({
    itemId: ItemId,
    prop: z.string().min(1),
    value: z.union([z.string(), z.number()]),
    label: z.string().optional(),
    period: z.string().optional(),
  })
  .strict();
export type FieldValue = z.infer<typeof FieldValue>;
export const Section = SectionResult(FieldValue);

export const Check = z
  .object({
    checkId: CheckId,
    state: z.enum(["ran", "not_run", "not_possible", "not_evaluated"]),
    trackedSince: z.string().optional(),
    outcome: z.enum(["none_found", "point_to_check", "concern"]).optional(),
    signals: z.array(z.string()),
    statementIds: z.array(z.string()),
    reason: SkipReason.optional(),
  })
  .strict()
  .refine((c) => c.state === "ran" || c.outcome === undefined, { message: "only a check that ran has an outcome" });

/** The coverage line, always "of 11" (council session 2, item 8). */
export const Coverage = z
  .object({ ran: z.number().int().min(0).max(11), total: z.literal(11), skipped: z.array(z.object({ checkId: CheckId, reason: SkipReason }).strict()) })
  .strict();

export const CompanyHeader = z
  .object({
    eid: Eid,
    country: Country,
    code: z.string().min(1),
    legalForm: z.string().nullable(),
    status: z.string().nullable(),
    /** The company's name; absent for a natural person or sole trader, shown as legal form + code (L3, P6). */
    name: z.string().min(1).optional(),
    caption: z.string().min(1),
  })
  .strict();

export const CompanyReport = z
  .object({
    header: CompanyHeader,
    isNaturalPerson: z.boolean(),
    containsPersonalData: z.boolean(),
    coverage: Coverage,
    checks: z.array(Check).length(11),
    sections: z.record(SectionId, Section),
  })
  .strict()
  .refine((r) => !r.isNaturalPerson || r.header.name === undefined, { message: "a natural person is never named in a header" })
  .refine((r) => new Set(r.checks.map((c) => c.checkId)).size === 11, { message: "each of the 11 checks once" });
export type CompanyReport = z.infer<typeof CompanyReport>;

export const SectionQuery = z.object({ purpose: z.string().optional(), cursor: z.string().optional() }).strict();
export const SectionResponse = z.object({ eid: Eid, section: SectionId, result: Section, page: Page.optional() }).strict();
export type SectionResponse = z.infer<typeof SectionResponse>;
