// The investigation routes (architecture §5.1, §7.2, agents.md §5-§8). AI-written text always says
// so (`generatedBy: "ai"`, R9); the level comes from the rule table, never the model.
import { z } from "zod";
import { CheckId, Country, Eid, IsoDateTime, ItemId, PurposeId, Role, SkipReason, Usage } from "./common.ts";

const Domain = z.string().trim().toLowerCase().regex(/^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(\.(?!-)[a-z0-9-]{1,63})+$/);

export const Subject = z.union([z.object({ eid: Eid, offerDomain: Domain.optional() }).strict(), z.object({ text: z.string().trim().min(2).max(200), offerDomain: Domain.optional() }).strict()]);

export const EstimateRequest = z.object({ subject: Subject, roles: z.array(Role).min(1) }).strict();
export const EstimateResponse = z
  .object({
    low: z.number().int().nonnegative(),
    typical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    basis: z.enum(["default", "measured"]),
    drivers: z.array(z.string()),
    typicalSeconds: z.partialRecord(Role, z.number().nonnegative()),
    cap: Usage,
    daily: Usage,
    dailyResetsAt: z.string().min(1),
  })
  .strict()
  .refine((e) => e.low <= e.typical && e.typical <= e.high && e.high <= e.cap.cap, { message: "low <= typical <= high <= cap" });

export const StartRequest = z.object({ subject: Subject, purposeId: PurposeId, locale: z.enum(["en", "lv", "lt", "et"]) }).strict();
export const StartResponse = z.object({ id: z.string().min(1) }).strict();

export const RunStatus = z.enum(["queued", "running", "waiting", "done", "failed", "stopped", "budget_exceeded"]);
export const WaitingOn = z.enum(["question", "cap", "cli_retry", "plan_limit", "overage"]);
export const InvestigationStatus = z.enum(["planning", "running", "waiting", "paused", "synthesising", "done", "stopped", "budget_exceeded", "failed"]);
export type InvestigationStatus = z.infer<typeof InvestigationStatus>;

export const Citation = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("statement"),
      statementIds: z.array(z.string().min(1)).min(1),
      snapshot: z.array(z.object({ itemId: ItemId, prop: z.string().min(1), value: z.union([z.string(), z.number()]), sourceId: z.string().min(1), asOf: z.string().nullable() }).strict()).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("document"),
      documentId: z.string().min(1),
      quote: z.string().min(40).max(300),
      snapshot: z.object({ url: z.url(), title: z.string(), retrievedAt: z.string().min(1), sourceId: z.string().min(1), licenceId: z.string().min(1) }).strict(),
    })
    .strict(),
]);

export const Finding = z
  .object({
    id: z.string().min(1),
    investigationId: z.string().min(1),
    runId: z.string().min(1),
    entityId: Eid,
    checkId: CheckId.nullable(),
    itemId: ItemId,
    kind: z.enum(["signal", "context"]),
    signalIds: z.array(z.string()),
    severity: z.enum(["none_found", "point_to_check", "concern"]).nullable(),
    statement: z.string().min(1),
    citations: z.array(Citation).min(1),
    generatedBy: z.literal("ai"),
  })
  .strict()
  .refine((f) => f.kind === "context" || f.signalIds.length > 0, { message: "a signal finding explains at least one signal" })
  .refine((f) => f.kind === "signal" || f.severity === null, { message: "a context finding has no severity" });
export type Finding = z.infer<typeof Finding>;

export const Verdict = z
  .object({
    level: z.enum(["no_concerns_found", "points_to_check", "serious_concerns", "not_enough_data"]),
    firedRules: z.array(z.object({ ruleId: z.string().min(1), findingIds: z.array(z.string()) }).strict()),
    coverage: z.object({ ran: z.number().int().min(0).max(11), total: z.literal(11), skipped: z.array(z.object({ checkId: CheckId, reason: SkipReason }).strict()) }).strict(),
    sourceCount: z.number().int().nonnegative(),
    explanation: z.array(z.object({ text: z.string().min(1), findingIds: z.array(z.string().min(1)).min(1) }).strict()).max(8).nullable(),
    keyFindingIds: z.array(z.string()).max(3),
    explanationFallbackReason: z.enum(["banned_term_fallback", "no_cited_sentence"]).optional(),
    explanationGeneratedBy: z.literal("ai"),
  })
  .strict()
  .refine((v) => v.explanation !== null || v.explanationFallbackReason !== undefined, { message: "a missing explanation says why" });
export type Verdict = z.infer<typeof Verdict>;

export const QuestionKind = z.enum(["entity_choice", "sanctions_match", "scope", "cap_reached", "free_text"]);
export const Question = z
  .object({
    id: z.string().min(1),
    runId: z.string().nullable(),
    kind: QuestionKind,
    text: z.string().min(1),
    options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) }).strict()),
    defaultOptionId: z.string().nullable(),
    timeoutAt: z.string().nullable(),
    blocks: z.enum(["run", "investigation"]),
    answer: z.object({ optionId: z.string().nullable(), text: z.string().optional(), by: z.enum(["human", "default"]) }).strict().optional(),
  })
  .strict()
  .refine((q) => q.kind !== "entity_choice" || (q.defaultOptionId === null && q.timeoutAt === null), { message: "entity_choice has no default and no countdown" });

export const Run = z
  .object({
    id: z.string().min(1),
    role: Role,
    status: RunStatus,
    waitingOn: WaitingOn.optional(),
    code: z.string().optional(),
    usage: Usage,
    startedAt: z.string().nullable(),
    endedAt: z.string().nullable(),
  })
  .strict()
  .refine((r) => (r.status === "waiting") === (r.waitingOn !== undefined), { message: "waitingOn exactly when waiting" });

export const RunTask = z
  .object({
    runId: z.string().min(1),
    taskId: z.string().min(1),
    labelKey: z.string().regex(/^agents\./),
    params: z.record(z.string(), z.union([z.string(), z.number()])),
    sourceId: z.string().optional(),
    status: z.enum(["queued", "running", "done", "failed", "skipped"]),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
    sourcesRead: z.number().int().nonnegative(),
  })
  .strict();

export const InvestigationSnapshot = z
  .object({
    id: z.string().min(1),
    subject: z.object({ eid: Eid.nullable(), country: Country.nullable(), caption: z.string().nullable() }).strict(),
    status: InvestigationStatus,
    code: z.string().optional(),
    resetsAt: z.string().optional(),
    plan: z.array(z.object({ runId: z.string().min(1), role: Role, dependsOn: z.array(z.string()) }).strict()),
    runs: z.array(Run),
    tasks: z.array(RunTask),
    findings: z.array(Finding),
    questions: z.array(Question),
    verdict: Verdict.nullable(),
    usage: Usage,
    lastEventId: z.number().int().nonnegative(),
  })
  .strict();
export type InvestigationSnapshot = z.infer<typeof InvestigationSnapshot>;

export const LibraryResponse = z
  .object({
    investigations: z.array(
      z
        .object({
          id: z.string().min(1),
          subject: z.string().min(1),
          country: Country.nullable(),
          eid: Eid.nullable(),
          level: Verdict.shape.level.nullable(),
          coverage: z.object({ ran: z.number().int().min(0).max(11), total: z.literal(11) }).strict().nullable(),
          usage: Usage,
          status: InvestigationStatus,
          startedAt: IsoDateTime,
          finishedAt: IsoDateTime.nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const AnswerRequest = z.object({ optionId: z.string().min(1).nullable(), text: z.string().trim().max(500).optional() }).strict();
export const FollowUpRequest = z.object({ question: z.string().trim().min(2).max(500) }).strict();
export const FollowUpResponse = z
  .object({
    id: z.string().min(1),
    sentences: z.array(z.object({ text: z.string().min(1), findingIds: z.array(z.string()), documentIds: z.array(z.string()) }).strict().refine((s) => s.findingIds.length + s.documentIds.length > 0, { message: "every sentence cites" })),
    usage: Usage,
    generatedBy: z.literal("ai"),
  })
  .strict();
