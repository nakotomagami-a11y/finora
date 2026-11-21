// Valid sample DTOs for the contract tests and the FINORA_DEMO responses: fixture-world ids and
// plainly fictional names only (fixtures rule; H4).
import type { z } from "zod";
import type { AgentsStatusResponse } from "../agents.ts";
import type { SourceRef, Usage } from "../common.ts";
import type { InvestigationSnapshot, Verdict } from "../investigations.ts";
import type { CompanyReport } from "../report.ts";

export const AT = "2026-11-22T08:00:00.000Z";
export const EID = "lv-00000000001";

export const source = (over: Partial<SourceRef> = {}): SourceRef => ({
  sourceId: "fx-lv-register",
  licenceId: "cc0-1.0",
  retrievedAt: AT,
  asOf: "2026-11-21",
  asOfBasis: "in_file_field",
  checkedAt: AT,
  accessTier: "open",
  derived: false,
  ...over,
});

export const usage = (over: Partial<Usage> = {}): Usage => ({ unit: "st", used: 120_000, held: 20_000, cap: 500_000, extensionGranted: false, ...over });

const checks = Array.from({ length: 11 }, (_, i) => ({ checkId: i + 1, state: "ran" as const, outcome: "none_found" as const, signals: [], statementIds: [] }));

export const companyReport = (): z.input<typeof CompanyReport> => ({
  header: { eid: EID, country: "lv", code: "00000000001", legalForm: "lv-sia", status: "active", name: "Example Company 1 SIA", caption: "Example Company 1 SIA" },
  isNaturalPerson: false,
  containsPersonalData: true,
  coverage: { ran: 11, total: 11, skipped: [] },
  checks,
  sections: {
    S01: {
      state: "data",
      value: [{ value: { itemId: "S01.LV.01", prop: "name", value: "Example Company 1 SIA" }, sources: [source()] }],
      freshness: "current",
      asOf: "2026-11-21",
      completeness: "full",
    },
    S03: { state: "not_checked", reason: { reason: "needs_purpose", purposes: ["counterparty_check"] } },
    S10: { state: "not_checked", reason: { reason: "manual_lookup", url: "https://manas.tiesas.lv/" } },
    S08: { state: "checked_none", source: source({ sourceId: "fx-lt-arrears" }), checkedAt: AT, asOf: "2026-11-21" },
  },
});

export const verdict = (): z.input<typeof Verdict> => ({
  level: "points_to_check",
  firedRules: [{ ruleId: "R-status", findingIds: ["f1"] }],
  coverage: { ran: 9, total: 11, skipped: [{ checkId: 10, reason: "manual_lookup" }, { checkId: 11, reason: "no_website_known" }] },
  sourceCount: 4,
  explanation: [{ text: "The register lists the company as in liquidation.", findingIds: ["f1"] }],
  keyFindingIds: ["f1"],
  explanationGeneratedBy: "ai",
});

export const snapshot = (): z.input<typeof InvestigationSnapshot> => ({
  id: "inv-1",
  subject: { eid: EID, country: "lv", caption: "Example Company 1 SIA" },
  status: "done",
  plan: [{ runId: "run-registry", role: "registry", dependsOn: [] }],
  runs: [{ id: "run-registry", role: "registry", status: "done", usage: usage({ held: 0 }), startedAt: AT, endedAt: AT }],
  tasks: [{ runId: "run-registry", taskId: "t1", labelKey: "agents.tasks.read_register", params: {}, status: "done", sourcesRead: 1 }],
  findings: [
    {
      id: "f1",
      investigationId: "inv-1",
      runId: "run-registry",
      entityId: EID,
      checkId: 2,
      itemId: "S01.LV.01",
      kind: "signal",
      signalIds: ["status_not_active"],
      severity: "point_to_check",
      statement: "The register lists the company as in liquidation.",
      citations: [{ kind: "statement", statementIds: ["st-1"], snapshot: [{ itemId: "S01.LV.01", prop: "status", value: "liquidation", sourceId: "fx-lv-register", asOf: "2026-11-21" }] }],
      generatedBy: "ai",
    },
  ],
  questions: [],
  verdict: verdict(),
  usage: usage({ held: 0 }),
  lastEventId: 42,
});

export const agentsStatus = (): z.input<typeof AgentsStatusResponse> => ({ backend: "off", cli: null, overage: "unknown", running: null });
