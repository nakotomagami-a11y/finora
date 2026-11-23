// Shapes every area shares (architecture §5.1, §5.4, §7.2). Strict objects throughout: a field the
// contract does not name is a contract error, so no DTO can grow an unreviewed field (a value, a
// currency, a person's name) without a schema change.
import "./zod-config.ts";
import { COUNTRIES, eidKind, ERROR_CODES, isInternalEid, ITEMS, PURPOSES } from "@finora/domain";
import { z } from "zod";

const ITEM_IDS = new Set<string>(ITEMS.map((i) => i.id));

export const IsoDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const Country = z.enum(COUNTRIES);
export const ItemId = z.string().refine((id) => ITEM_IDS.has(id), { message: "unknown item id" });
export const PurposeId = z.enum(PURPOSES);
export const ErrorCode = z.enum(ERROR_CODES);
/**
 * A public entity id, by the domain's eid table (§3.4): person and relationship row ids never
 * reach a URL, title, log or export (PS5), and an LV eid needs a register check digit.
 */
export const Eid = z.string().max(80).refine((eid) => eidKind(eid) !== null && !isInternalEid(eid), { message: "not a public entity id" });
export const SectionId = z.string().regex(/^S(0[1-9]|1[0-8])$/);
export const Role = z.enum(["lead", "registry", "money", "legal", "web", "verdict", "followup"]);
export const CheckId = z.number().int().min(1).max(11);
export const SkipReason = z.enum(["not_possible_in_country", "not_published", "not_run", "failed", "stopped", "no_website_known", "manual_lookup"]);

export const SourceRef = z
  .object({
    sourceId: z.string().min(1),
    licenceId: z.string().min(1),
    retrievedAt: z.string().min(1),
    asOf: z.string().nullable(),
    asOfBasis: z.string().nullable(),
    checkedAt: z.string().nullable(),
    accessTier: z.enum(["open", "purpose"]),
    derived: z.boolean(),
  })
  .strict();
export type SourceRef = z.infer<typeof SourceRef>;

/** A displayed value and the sources it came from; never without one (R3, R16). */
export const SourcedValue = <T extends z.ZodType>(value: T) => z.object({ value, sources: z.array(SourceRef).min(1) }).strict();

/** Usage in standard tokens (C16, cto 7070446775): integers only, and never a currency field. */
const st = z.number().int().nonnegative();
export const Usage = z
  .object({
    unit: z.literal("st"),
    used: st,
    held: st,
    cap: st,
    extensionGranted: z.boolean(),
    turns: st.optional(),
    perModel: z
      .array(z.object({ model: z.string().min(1), inputTokens: st, outputTokens: st, cacheReadTokens: st, cacheWriteTokens: st }).strict())
      .optional(),
  })
  .strict();
export type Usage = z.infer<typeof Usage>;

/** Official hosts only (§4.2): the URL is checked against the source's host list by the service. */
const OfficialUrl = z.url({ protocol: /^https$/u });

export const NotCheckedReason = z.discriminatedUnion("reason", [
  z.object({ reason: z.literal("later") }).strict(),
  z.object({ reason: z.literal("error"), code: ErrorCode }).strict(),
  z.object({ reason: z.literal("skipped") }).strict(),
  z.object({ reason: z.literal("paid_only"), orderUrl: OfficialUrl.nullable() }).strict(),
  z.object({ reason: z.literal("needs_key"), key: z.literal("SEC_USER_AGENT") }).strict(),
  z.object({ reason: z.literal("needs_source") }).strict(),
  z.object({ reason: z.literal("needs_purpose"), purposes: z.array(PurposeId).min(1) }).strict(),
  z.object({ reason: z.literal("restricted"), basis: z.string().regex(/^[a-z0-9_.]+$/) }).strict(),
  z.object({ reason: z.literal("agent_only"), agentId: Role }).strict(),
  z.object({ reason: z.literal("manual_lookup"), url: OfficialUrl }).strict(),
]);
export type NotCheckedReason = z.infer<typeof NotCheckedReason>;

/**
 * Every section is one of these states (§5.4). "None found" comes only from `checked_none` with its
 * source and date: a `data` result with an empty list is a contract error (qa 12).
 */
export const SectionResult = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion("state", [
    z.object({ state: z.literal("not_published"), country: Country }).strict(),
    z.object({ state: z.literal("checked_none"), source: SourceRef, checkedAt: z.string().min(1), asOf: z.string().min(1) }).strict(),
    z.object({ state: z.literal("not_checked"), reason: NotCheckedReason }).strict(),
    z.object({ state: z.literal("disputed"), disputeId: z.string().min(1) }).strict(),
    z
      .object({
        state: z.literal("data"),
        value: z.array(SourcedValue(value)).min(1),
        freshness: z.enum(["current", "stale"]),
        asOf: z.string().min(1),
        completeness: z.enum(["full", "partial"]),
        missing: z.array(z.string()).optional(),
        caveatKey: z.string().optional(),
      })
      .strict(),
  ]);

/** A paginated slice of a long list. */
export const Page = z.object({ cursor: z.string().nullable(), total: z.number().int().nonnegative() }).strict();
