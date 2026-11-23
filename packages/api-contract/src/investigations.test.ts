import { describe, expect, it } from "vitest";
import { EstimateResponse, Finding, FollowUpResponse, InvestigationSnapshot, Question, StartRequest, Verdict } from "./investigations.ts";
import { EID, snapshot, usage, verdict } from "./testing/samples.ts";

describe("investigations.ts (architecture §7.2)", () => {
  it("accepts a valid snapshot and verdict", () => {
    expect(InvestigationSnapshot.safeParse(snapshot()).success).toBe(true);
    expect(Verdict.safeParse(verdict()).success).toBe(true);
  });

  it("requires generatedBy: ai on findings, explanations and follow-ups (R9)", () => {
    const finding = snapshot().findings[0]!;
    const { generatedBy: _g, ...noLabel } = finding;
    expect(Finding.safeParse(noLabel).success).toBe(false);
    const { explanationGeneratedBy: _e, ...noExplanationLabel } = verdict();
    expect(Verdict.safeParse(noExplanationLabel).success).toBe(false);
    expect(FollowUpResponse.safeParse({ id: "q1", sentences: [{ text: "x", findingIds: ["f1"], documentIds: [] }], usage: usage() }).success).toBe(false);
  });

  it("holds the verdict's coverage at 11, at most 3 key findings and 8 sentences", () => {
    const v = verdict();
    expect(Verdict.safeParse({ ...v, coverage: { ...v.coverage, total: 12 } }).success).toBe(false);
    expect(Verdict.safeParse({ ...v, keyFindingIds: ["a", "b", "c", "d"] }).success).toBe(false);
    expect(Verdict.safeParse({ ...v, explanation: null }).success).toBe(false);
    expect(Verdict.safeParse({ ...v, explanation: null, explanationFallbackReason: "banned_term_fallback" }).success).toBe(true);
  });

  it("refuses an uncited sentence and a too-short quote", () => {
    const v = verdict();
    expect(Verdict.safeParse({ ...v, explanation: [{ text: "x", findingIds: [] }] }).success).toBe(false);
    const finding = { ...snapshot().findings[0]!, citations: [{ kind: "document", documentId: "d1", quote: "too short", snapshot: { url: "https://x.invalid/", title: "t", retrievedAt: "x", sourceId: "s", licenceId: "l" } }] };
    expect(Finding.safeParse(finding).success).toBe(false);
  });

  it("gives entity_choice no default and no countdown", () => {
    const base = { id: "q1", runId: null, kind: "entity_choice", text: "Which company?", options: [{ id: "a", label: "A" }], blocks: "investigation" };
    expect(Question.safeParse({ ...base, defaultOptionId: null, timeoutAt: null }).success).toBe(true);
    expect(Question.safeParse({ ...base, defaultOptionId: "a", timeoutAt: null }).success).toBe(false);
  });

  it("orders the estimate and keeps it under the cap", () => {
    const e = { low: 50_000, typical: 150_000, high: 310_000, basis: "default", drivers: [], typicalSeconds: { registry: 60 }, cap: usage({ used: 0, held: 0 }), daily: usage({ cap: 3_300_000 }), dailyResetsAt: "x" };
    expect(EstimateResponse.safeParse(e).success).toBe(true);
    expect(EstimateResponse.safeParse({ ...e, high: 600_000 }).success).toBe(false);
  });

  it("takes an eid or text with an optional domain, and refuses a blocked purpose", () => {
    expect(StartRequest.safeParse({ subject: { eid: EID, offerDomain: "Example-Shop.invalid" }, purposeId: "supplier_check", locale: "lv" }).success).toBe(true);
    expect(StartRequest.safeParse({ subject: { eid: EID }, purposeId: "credit_decision", locale: "en" }).success).toBe(false);
    expect(StartRequest.safeParse({ subject: { eid: EID, offerDomain: "not a domain" }, purposeId: "supplier_check", locale: "en" }).success).toBe(false);
  });
});
