// One valid and one invalid sample per remaining schema file (S04b acceptance 1).
import { describe, expect, it } from "vitest";
import { AgentsStatusResponse } from "./agents.ts";
import { DisputeRequest } from "./disputes.ts";
import { InvestigationEvent } from "./events.ts";
import { ExportResponse } from "./export.ts";
import { HealthResponse } from "./health.ts";
import { NetworkResponse } from "./network.ts";
import { PurposeRequest } from "./purpose.ts";
import { SearchResponse } from "./search.ts";
import { SettingsStatusResponse } from "./settings.ts";
import { SourcesResponse } from "./sources.ts";
import { agentsStatus, AT, EID, source, usage, verdict } from "./testing/samples.ts";

const hit = { eid: EID, caption: "Example Company 1 SIA", code: "40003000018", country: "lv", legalForm: "lv-sia", status: "active", match: "prefix", isNaturalPerson: false };
const sourceInfo = { id: "fx-lv-register", country: "lv", publisher: "Example register", licenceId: "cc0-1.0", licenceName: "CC0 1.0", attribution: null, storage: "store", cadence: "daily", freshness: "current", asOf: "2026-11-21", lastSync: null };

describe("search.ts", () => {
  it("accepts groups and refuses a loading group with no progress or a failed bulk group", () => {
    expect(SearchResponse.safeParse({ groups: [{ id: "lv", kind: "bulk", country: "lv", state: "ready", results: [hit] }] }).success).toBe(true);
    expect(SearchResponse.safeParse({ groups: [{ id: "ee", kind: "bulk", country: "ee", state: "loading", results: [] }] }).success).toBe(false);
    expect(SearchResponse.safeParse({ groups: [{ id: "lv", kind: "bulk", country: "lv", state: "error", results: [] }] }).success).toBe(false);
  });
});

describe("network.ts", () => {
  it("accepts company edges and refuses a share on an address edge", () => {
    const node = { eid: EID, name: "Example Company 1 SIA", code: "40003000018", status: "active", country: "lv" };
    const edge = { from: EID, to: "lv-40003000022", relation: "corporate_member", source: source(), share: 40 };
    expect(NetworkResponse.safeParse({ nodes: [node], edges: [edge], hubs: [], truncated: false }).success).toBe(true);
    expect(NetworkResponse.safeParse({ nodes: [node], edges: [{ ...edge, relation: "shared_address" }], hubs: [], truncated: false }).success).toBe(false);
  });
});

describe("export.ts", () => {
  it("holds open data only (R4, P1, R17)", () => {
    const row = { itemId: "S01.LV.01", prop: "name", value: "Example Company 1 SIA", sources: [source()] };
    expect(ExportResponse.safeParse({ eid: EID, generatedAt: AT, statements: [row], licences: [] }).success).toBe(true);
    expect(ExportResponse.safeParse({ eid: EID, generatedAt: AT, statements: [{ ...row, sources: [source({ accessTier: "purpose" })] }], licences: [] }).success).toBe(false);
  });
});

describe("purpose.ts and disputes.ts", () => {
  it("lists no blocked purpose (P7) and caps a dispute note", () => {
    expect(PurposeRequest.safeParse({ purposeId: "counterparty_check" }).success).toBe(true);
    expect(PurposeRequest.safeParse({ purposeId: "employment_decision" }).success).toBe(false);
    expect(DisputeRequest.safeParse({ companyEid: EID, itemId: "S01.LV.01", kind: "correction", note: "Wrong status" }).success).toBe(true);
    expect(DisputeRequest.safeParse({ companyEid: EID, itemId: "S01.LV.01", kind: "correction", note: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("sources.ts, settings.ts, agents.ts, health.ts", () => {
  it("accepts valid responses and refuses the invalid ones", () => {
    expect(SourcesResponse.safeParse({ sources: [sourceInfo] }).success).toBe(true);
    expect(SourcesResponse.safeParse({ sources: [{ ...sourceInfo, id: "../x" }] }).success).toBe(false);
    const status = { agents: agentsStatus(), secContactSet: false, providersConfigured: ["c1"], shareAlikeMode: "store", lawyerSwitches: {}, historyBytes: 0, historyMaxBytes: 1, sources: [sourceInfo], usage: { today: usage(), month: usage() } };
    expect(SettingsStatusResponse.safeParse(status).success).toBe(true);
    expect(SettingsStatusResponse.safeParse({ ...status, secContact: "app contact" }).success).toBe(false);
    expect(AgentsStatusResponse.safeParse(agentsStatus()).success).toBe(true);
    expect(AgentsStatusResponse.safeParse({ ...agentsStatus(), cli: "ready" }).success).toBe(false);
    expect(HealthResponse.safeParse({ status: "ok", version: "0.0.0", store: null }).success).toBe(true);
    expect(HealthResponse.safeParse({ status: "down", version: "0.0.0", store: null }).success).toBe(false);
  });
});

describe("events.ts (architecture §7.6)", () => {
  it("accepts each event shape on its envelope and refuses a step with model text", () => {
    const env = { id: 7, at: AT, investigationId: "inv-1" };
    expect(InvestigationEvent.safeParse({ ...env, type: "verdict", data: verdict() }).success).toBe(true);
    expect(InvestigationEvent.safeParse({ ...env, type: "usage", data: { runId: null, usage: usage() } }).success).toBe(true);
    expect(InvestigationEvent.safeParse({ ...env, type: "investigation.status", data: { status: "paused", code: "plan_limit", resetsAt: AT } }).success).toBe(true);
    expect(InvestigationEvent.safeParse({ ...env, type: "run.step", data: { runId: "r1", stepKey: "I think the company is fine", params: {} } }).success).toBe(false);
    expect(InvestigationEvent.safeParse({ ...env, id: 0, type: "usage", data: { runId: null, usage: usage() } }).success).toBe(false);
  });
});
