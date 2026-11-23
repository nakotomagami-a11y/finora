// GET /api/v1/investigations/:id/events (architecture §7.6): every event carries a monotonic id, so
// Last-Event-ID resumes exactly. Model text never reaches a lane: steps carry catalogue keys.
import { z } from "zod";
import { ErrorCode, Role, Usage } from "./common.ts";
import { Finding, InvestigationStatus, Question, RunStatus, RunTask, Verdict, WaitingOn } from "./investigations.ts";

const envelope = <T extends string, D extends z.ZodType>(type: T, data: D) =>
  z.object({ id: z.number().int().positive(), at: z.string().min(1), investigationId: z.string().min(1), type: z.literal(type), data }).strict();

export const InvestigationEvent = z.discriminatedUnion("type", [
  envelope("investigation.status", z.object({ status: InvestigationStatus, code: z.string().optional(), resetsAt: z.string().optional() }).strict()),
  envelope("plan", z.object({ runs: z.array(z.object({ runId: z.string().min(1), role: Role, dependsOn: z.array(z.string()).length(0) }).strict()) }).strict()),
  envelope("run.status", z.object({ runId: z.string().min(1), status: RunStatus, waitingOn: WaitingOn.optional(), code: z.string().optional() }).strict()),
  envelope("run.task", RunTask),
  envelope("run.step", z.object({ runId: z.string().min(1), stepKey: z.string().regex(/^agents\./), params: z.record(z.string(), z.union([z.string(), z.number()])) }).strict()),
  envelope("run.source", z.object({ runId: z.string().min(1), documentId: z.string().min(1), domain: z.string().min(1), title: z.string(), kind: z.string().min(1), sourcesRead: z.number().int().nonnegative() }).strict()),
  envelope("finding", Finding),
  envelope("question", Question),
  envelope("question.answered", z.object({ questionId: z.string().min(1), optionId: z.string().nullable(), by: z.enum(["human", "default"]) }).strict()),
  envelope("usage", z.object({ runId: z.string().nullable(), usage: Usage }).strict()),
  envelope("verdict", Verdict),
  envelope("error", z.object({ code: ErrorCode, runId: z.string().optional() }).strict()),
]);
export type InvestigationEvent = z.infer<typeof InvestigationEvent>;
