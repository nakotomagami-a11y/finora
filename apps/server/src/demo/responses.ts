// FINORA_DEMO responses (S04b): one schema-valid fixture DTO per route, built from the contract's
// samples (fixture-world ids, plainly fictional names). Real services replace them route by route.
import type { ApiRoute } from "@finora/api-contract";
import { agentsStatus, AT, companyReport, EID, snapshot, source, usage, verdict } from "@finora/api-contract/samples";
import type { ValidInput } from "../contract-route.ts";

const hit = { eid: EID, caption: "Example Company 1 SIA", code: "40003000018", country: "lv", legalForm: "lv-sia", status: "active", match: "prefix", isNaturalPerson: false };
const sourceInfo = { id: "fx-lv-register", country: "lv", publisher: "Example register", licenceId: "cc0-1.0", licenceName: "CC0 1.0", attribution: null, storage: "store", cadence: "daily", freshness: "current", asOf: "2026-11-21", lastSync: null };

const BODIES: Record<string, (input: ValidInput) => unknown> = {
  search: () => ({ groups: [{ id: "lv", kind: "bulk", country: "lv", state: "ready", results: [hit] }, { id: "ee", kind: "bulk", country: "ee", state: "loading", percent: 40, results: [] }] }),
  searchLive: ({ params }) => ({ groups: [{ id: `us-${String(params.register)}`, kind: "live", country: "us", state: "error", results: [] }] }),
  company: ({ params }) => ({ ...companyReport(), header: { ...companyReport().header, eid: params.eid } }),
  companySection: ({ params }) => ({ eid: params.eid, section: params.section, result: { state: "not_checked", reason: { reason: "needs_purpose", purposes: ["counterparty_check"] } } }),
  companyNetwork: () => ({
    nodes: [{ eid: EID, name: "Example Company 1 SIA", code: "40003000018", status: "active", country: "lv" }, { eid: "lv-40003000022", name: "Example Company 2 SIA", code: "40003000022", status: "active", country: "lv" }],
    edges: [{ from: EID, to: "lv-40003000022", relation: "shared_address", source: source() }],
    hubs: [],
    truncated: false,
  }),
  companyExport: ({ params }) => ({ eid: params.eid, generatedAt: AT, statements: [{ itemId: "S01.LV.01", prop: "name", value: "Example Company 1 SIA", sources: [source()] }], licences: [{ licenceId: "cc0-1.0", attribution: null }] }),
  purpose: ({ body }) => ({ purposeId: (body as { purposeId: string }).purposeId, expiresAt: AT }),
  dispute: () => ({ disputeId: "dispute-demo-1", status: "open" }),
  sources: () => ({ sources: [sourceInfo] }),
  investigationEstimate: () => ({ low: 60_000, typical: 150_000, high: 310_000, basis: "default", drivers: [], typicalSeconds: { registry: 90, money: 120, legal: 150, web: 180 }, cap: usage({ used: 0, held: 0 }), daily: usage({ used: 400_000, held: 0, cap: 3_300_000 }), dailyResetsAt: "2026-11-23T00:00:00.000Z" }),
  investigationStart: () => ({ id: "inv-demo-1" }),
  investigationLibrary: () => ({
    investigations: [{ id: "inv-demo-1", subject: "Example Company 1 SIA", country: "lv", eid: EID, level: "points_to_check", coverage: { ran: 9, total: 11 }, usage: usage({ held: 0 }), status: "done", startedAt: AT, finishedAt: AT }],
  }),
  investigation: ({ params }) => ({ ...snapshot(), id: params.id }),
  investigationFollowUp: () => ({ id: "fu-demo-1", sentences: [{ text: "The register lists the company as in liquidation.", findingIds: ["f1"], documentIds: [] }], usage: usage({ cap: 85_000, used: 9_000, held: 0 }), generatedBy: "ai" }),
  settingsStatus: () => ({ agents: agentsStatus(), secContactSet: false, providersConfigured: [], shareAlikeMode: "store", lawyerSwitches: {}, historyBytes: 0, historyMaxBytes: 1_073_741_824, sources: [sourceInfo], usage: { today: usage({ used: 0, held: 0, cap: 3_300_000 }), month: usage({ used: 0, held: 0, cap: 3_300_000 }) } }),
  settingsStartup: () => ({ enabled: false, supported: false }),
  settingsStartupUpdate: () => ({ enabled: false, supported: false }),
  agentsStatus: () => agentsStatus(),
};

/** A short, finished event stream: the plan, a run, a finding, the verdict. */
function demoEvents(id: string): string[] {
  const s = snapshot();
  const envelope = (n: number, type: string, data: unknown) => ({ id: n, at: AT, investigationId: id, type, data });
  return [
    envelope(1, "investigation.status", { status: "running" }),
    envelope(2, "plan", { runs: s.plan }),
    envelope(3, "run.status", { runId: "run-registry", status: "running" }),
    envelope(4, "finding", { ...s.findings[0], investigationId: id }),
    envelope(5, "usage", { runId: "run-registry", usage: usage({ held: 0 }) }),
    envelope(6, "verdict", verdict()),
    envelope(7, "investigation.status", { status: "done" }),
  ].map((e) => `id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
}

export function demoResponse(route: ApiRoute, input: ValidInput): Response {
  if (route.stream === "sse") {
    const after = Number(input.request.headers.get("last-event-id") ?? input.query.lastEventId ?? 0);
    const events = demoEvents(String(input.params.id)).filter((_, i) => i + 1 > after);
    return new Response(events.join(""), { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" } });
  }
  if (route.response === null) return new Response(null, { status: route.status });
  const body = BODIES[route.operationId];
  if (!body) throw new Error(`no demo body for ${route.operationId}`);
  return Response.json(body(input), { status: route.status });
}
