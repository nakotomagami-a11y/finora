import {
  CrashResponse,
  EstimateResponse,
  InvestigationEvent,
  InvestigationSnapshot,
  LibraryResponse,
  NetworkResponse,
  SearchResponse,
  type Usage,
} from "@finora/api-contract";
import { fixtureRegisterCode } from "@finora/domain";
import { AT, EID, agentsStatus, companyReport, snapshot as sampleSnapshot, source, usage as sampleUsage, verdict } from "@finora/api-contract/samples";

/**
 * The synthetic data behind `FINORA_DEMO=1` pages and the `/design` gallery (docs/plan/ui-build-plan.md §12).
 * Names are plainly fictional and every id follows the fixture rules. `writeUiFixtures` turns these builders into the
 * JSON files under `fixtures/ui/` and `fixtures/agents/`; a test checks that the committed files equal this output and
 * that each one validates against the contract, so neither can drift from the other.
 */

/** The first fixture register code at or after `start` that has a check digit (architecture §3.4: fixture codes are the true digit plus one). */
function fx(country: "lv" | "ee" | "lt", start: string): string {
  for (let n = 0; n < 50; n += 1) {
    const code = fixtureRegisterCode(country, String(Number(start) + n).padStart(start.length, "0"));
    if (code) return code;
  }
  throw new Error(`no fixture code near ${start}`);
}
const LV1 = EID.slice(3);
const LV2 = fx("lv", "4000300020");
const LV3 = fx("lv", "4000300040");
const LV9 = fx("lv", "4000300090");
const EE1 = fx("ee", "1000000");
const LT1 = fx("lt", EE1);

const INV = "inv-fixture-1";
const NAME = "Example Company 1 SIA";
const ZERO: Usage = { unit: "st", used: 0, held: 0, cap: 0, extensionGranted: false };
const usage = (over: Partial<Usage> = {}): Usage => sampleUsage(over);

type EventInput = { type: InvestigationEvent["type"]; data: unknown };

/** Numbers the events 1, 2, 3 ... and stamps them, so a scenario is just a list of what happened. */
function events(entries: EventInput[]): InvestigationEvent[] {
  return entries.map((entry, index) => InvestigationEvent.parse({ id: index + 1, at: AT, investigationId: INV, type: entry.type, data: entry.data }));
}

const finding = (id: string, runId: string, over: Record<string, unknown> = {}) => ({
  id,
  investigationId: INV,
  runId,
  entityId: EID,
  checkId: 2,
  itemId: "S01.LV.01",
  kind: "signal",
  signalIds: ["status_not_active"],
  severity: "point_to_check",
  statement: "The register lists the company as in liquidation.",
  citations: [{ kind: "statement", statementIds: ["st-1"], snapshot: [{ itemId: "S01.LV.01", prop: "status", value: "liquidation", sourceId: "fx-lv-register", asOf: "2026-11-21" }] }],
  generatedBy: "ai",
  ...over,
});

const task = (runId: string, taskId: string, labelKey: string, status: string, sourcesRead = 0, over: Record<string, unknown> = {}) => ({ runId, taskId, labelKey, params: {}, status, sourcesRead, ...over });

const PLAN = [
  { runId: "run-lead", role: "lead", dependsOn: [] },
  { runId: "run-registry", role: "registry", dependsOn: [] },
  { runId: "run-money", role: "money", dependsOn: [] },
  { runId: "run-legal", role: "legal", dependsOn: [] },
  { runId: "run-web", role: "web", dependsOn: [] },
  { runId: "run-verdict", role: "verdict", dependsOn: [] },
];

/** The first lines every investigation shares: the plan, the lead done, the specialists starting. */
const START: EventInput[] = [
  { type: "investigation.status", data: { status: "planning" } },
  { type: "plan", data: { runs: PLAN } },
  { type: "investigation.status", data: { status: "running" } },
  { type: "run.status", data: { runId: "run-lead", status: "running" } },
  { type: "run.task", data: task("run-lead", "t-lead-1", "agents.tasks.resolve_company", "done", 1) },
  { type: "run.source", data: { runId: "run-lead", documentId: "doc-0", domain: "register.example", title: "Register entry", kind: "register", sourcesRead: 1 } },
  { type: "run.status", data: { runId: "run-lead", status: "done" } },
  { type: "run.status", data: { runId: "run-registry", status: "running" } },
  { type: "run.status", data: { runId: "run-money", status: "running" } },
  { type: "run.status", data: { runId: "run-legal", status: "running" } },
  { type: "run.status", data: { runId: "run-web", status: "running" } },
  { type: "run.step", data: { runId: "run-registry", stepKey: "agents.steps.reading_register", params: {} } },
  { type: "run.task", data: task("run-registry", "t-reg-1", "agents.tasks.read_register", "running") },
  { type: "run.source", data: { runId: "run-registry", documentId: "doc-1", domain: "register.example", title: "Register entry", kind: "register", sourcesRead: 1 } },
  { type: "run.task", data: task("run-registry", "t-reg-1", "agents.tasks.read_register", "done", 1) },
  { type: "finding", data: finding("f1", "run-registry") },
  { type: "usage", data: { runId: "run-registry", usage: usage({ used: 60_000, held: 20_000 }) } },
  { type: "usage", data: { runId: null, usage: usage({ used: 120_000, held: 80_000 }) } },
];

const FINISH: EventInput[] = [
  { type: "run.status", data: { runId: "run-registry", status: "done" } },
  { type: "run.status", data: { runId: "run-money", status: "done" } },
  { type: "run.status", data: { runId: "run-legal", status: "done" } },
  { type: "run.status", data: { runId: "run-web", status: "done" } },
  { type: "investigation.status", data: { status: "synthesising" } },
  { type: "run.status", data: { runId: "run-verdict", status: "running" } },
  { type: "verdict", data: verdict() },
  { type: "run.status", data: { runId: "run-verdict", status: "done" } },
  { type: "usage", data: { runId: null, usage: usage({ used: 190_000, held: 0 }) } },
  { type: "investigation.status", data: { status: "done" } },
];

const question = (id: string, kind: string, text: string, options: { id: string; label: string }[], over: Record<string, unknown> = {}) => ({
  id,
  runId: "run-lead",
  kind,
  text,
  options,
  defaultOptionId: null,
  timeoutAt: null,
  blocks: "run",
  ...over,
});

const QUESTION_EVENTS: Record<string, EventInput[]> = {
  entity: [
    { type: "run.status", data: { runId: "run-lead", status: "waiting", waitingOn: "question" } },
    { type: "question", data: question("q1", "entity_choice", "Two registered companies match. Which one do you mean?", [{ id: "a", label: `${NAME} (${LV1})` }, { id: "b", label: `Example Company 2 SIA (${LV2})` }]) },
  ],
  sanctions: [
    { type: "run.status", data: { runId: "run-legal", status: "waiting", waitingOn: "question" } },
    { type: "question", data: question("q1", "sanctions_match", "A name on an official list is close to a name in the register. Is it the same party?", [{ id: "same", label: "Same party" }, { id: "different", label: "Different party" }, { id: "unsure", label: "I cannot tell" }], { runId: "run-legal" }) },
  ],
  scope: [
    { type: "run.status", data: { runId: "run-web", status: "waiting", waitingOn: "question" } },
    { type: "question", data: question("q1", "scope", "The register lists two websites. Check both?", [{ id: "both", label: "Check both" }, { id: "first", label: "First only" }], { runId: "run-web", defaultOptionId: "both", timeoutAt: "2026-11-22T08:10:00.000Z" }) },
  ],
  cap: [
    { type: "run.status", data: { runId: "run-web", status: "waiting", waitingOn: "cap" } },
    { type: "question", data: question("q1", "cap_reached", "This investigation reached its cap. Stop here and write the report, or allow up to a third more?", [{ id: "stop", label: "Stop here and write the report" }, { id: "extend", label: "Allow up to a third more of the cap (170k standard tokens)" }], { runId: "run-web", defaultOptionId: "stop", timeoutAt: "2026-11-22T08:10:00.000Z", blocks: "investigation" }) },
  ],
  "cap-used": [
    { type: "run.status", data: { runId: "run-web", status: "waiting", waitingOn: "cap" } },
    { type: "question", data: question("q1", "cap_reached", "The extension was already used. The investigation can only stop here and write the report.", [{ id: "stop", label: "Stop here and write the report" }], { runId: "run-web", defaultOptionId: "stop", timeoutAt: "2026-11-22T08:10:00.000Z", blocks: "investigation" }) },
    { type: "usage", data: { runId: null, usage: usage({ used: 640_000, held: 0, cap: 670_000, extensionGranted: true }) } },
  ],
};

export type Scenario = { scenario: string; events: InvestigationEvent[]; final: InvestigationSnapshot };

/**
 * The snapshot after a list of events, folded here with plain loops and no reducer, so the replay test compares two
 * independent implementations of the same rules.
 */
export function foldSnapshot(list: InvestigationEvent[]): InvestigationSnapshot {
  type Mutable = { -readonly [K in keyof InvestigationSnapshot]: InvestigationSnapshot[K] };
  const out: Mutable = {
    id: INV,
    subject: { eid: EID, country: "lv", caption: NAME },
    status: "planning",
    plan: [],
    runs: [],
    tasks: [],
    findings: [],
    questions: [],
    verdict: null,
    usage: ZERO,
    lastEventId: 0,
  };
  for (const e of list) {
    out.lastEventId = e.id;
    if (e.type === "investigation.status") {
      out.status = e.data.status;
      delete out.code;
      delete out.resetsAt;
      if (e.data.code) out.code = e.data.code;
      if (e.data.resetsAt) out.resetsAt = e.data.resetsAt;
    } else if (e.type === "plan") {
      out.plan = e.data.runs.map((r) => ({ runId: r.runId, role: r.role, dependsOn: [...r.dependsOn] }));
      out.runs = e.data.runs.map((r) => ({ id: r.runId, role: r.role, status: "queued" as const, usage: ZERO, startedAt: null, endedAt: null }));
    } else if (e.type === "run.status") {
      const run = out.runs.find((r) => r.id === e.data.runId);
      if (run) {
        run.status = e.data.status;
        delete run.waitingOn;
        delete run.code;
        if (e.data.waitingOn) run.waitingOn = e.data.waitingOn;
        if (e.data.code) run.code = e.data.code;
      }
    } else if (e.type === "run.task") {
      const at = out.tasks.findIndex((t) => t.taskId === e.data.taskId);
      if (at === -1) out.tasks.push(e.data);
      else out.tasks[at] = e.data;
    } else if (e.type === "finding") {
      const at = out.findings.findIndex((f) => f.id === e.data.id);
      if (at === -1) out.findings.push(e.data);
      else out.findings[at] = e.data;
    } else if (e.type === "question") {
      const at = out.questions.findIndex((q) => q.id === e.data.id);
      if (at === -1) out.questions.push(e.data);
      else out.questions[at] = e.data;
    } else if (e.type === "question.answered") {
      const found = out.questions.find((q) => q.id === e.data.questionId);
      if (found) found.answer = { optionId: e.data.optionId, by: e.data.by };
    } else if (e.type === "usage") {
      if (e.data.runId === null) out.usage = e.data.usage;
      else {
        const run = out.runs.find((r) => r.id === e.data.runId);
        if (run) run.usage = e.data.usage;
      }
    } else if (e.type === "verdict") out.verdict = e.data;
  }
  return InvestigationSnapshot.parse(out);
}

const scenario = (name: string, entries: EventInput[]): Scenario => {
  const list = events(entries);
  return { scenario: name, events: list, final: foldSnapshot(list) };
};

export function scenarios(): Scenario[] {
  const limitPause: EventInput[] = [
    { type: "run.status", data: { runId: "run-web", status: "waiting", waitingOn: "plan_limit" } },
    { type: "investigation.status", data: { status: "paused", code: "plan_limit", resetsAt: "2026-11-22T14:00:00.000Z" } },
  ];
  return [
    scenario("streaming", START),
    ...Object.entries(QUESTION_EVENTS).map(([name, extra]) => scenario(`question-${name}`, [...START, ...extra])),
    scenario("partial", [
      ...START,
      { type: "run.status", data: { runId: "run-money", status: "failed", code: "agents_unavailable" } },
      { type: "error", data: { code: "agents_unavailable", runId: "run-money" } },
      ...FINISH.filter((e) => !(e.type === "run.status" && (e.data as { runId: string }).runId === "run-money")),
    ]),
    scenario("error", [...START, { type: "run.status", data: { runId: "run-registry", status: "failed", code: "internal_error" } }, { type: "error", data: { code: "internal_error", runId: "run-registry" } }, { type: "investigation.status", data: { status: "failed", code: "internal_error" } }]),
    scenario("report", [...START, ...FINISH]),
    scenario("limit", [...START, ...limitPause]),
    scenario("overage", [
      ...START,
      { type: "run.status", data: { runId: "run-web", status: "waiting", waitingOn: "overage" } },
      { type: "investigation.status", data: { status: "paused", code: "overage" } },
    ]),
  ];
}

const hit = (code: string, caption: string, country: "lv" | "lt" | "ee" | "us", over: Record<string, unknown> = {}) => ({
  eid: `${country}-${code}`,
  caption,
  code,
  country,
  legalForm: null,
  status: "active",
  match: "prefix",
  isNaturalPerson: false,
  ...over,
});

const row = (rowKey: string, itemId: string, label: string, over: Record<string, unknown> = {}) => ({
  rowKey,
  itemId,
  label,
  state: "ok",
  unit: "usd_cap",
  cadence: "daily_exchange",
  delayed: false,
  sources: [source({ sourceId: "fx-markets" })],
  ...over,
});

const CRASH_ROWS = {
  live: row("m06-total", "M06.X.02", "Total crypto market", { value: 2_400_000_000_000, peak: { value: 3_000_000_000_000, date: "2026-03-01", basis: "since" }, drawdownPct: -20, valueLostUsd: 600_000_000_000, asOf: AT, cadence: "live", unit: "usd_cap" }),
  delayed: row("m06-total", "M06.X.02", "Total crypto market", { value: 2_400_000_000_000, drawdownPct: -20, asOf: AT, cadence: "live", delayed: true }),
  stale: row("m06-total", "M06.X.02", "Total crypto market", { state: "stale", value: 2_400_000_000_000, drawdownPct: -20, asOf: "2026-11-19T08:00:00.000Z", cadence: "live" }),
  error: row("m06-total", "M06.X.02", "Total crypto market", { state: "error", sources: [] }),
  "peak-unknown": row("m06-total", "M06.X.02", "Total crypto market", { state: "peak_unknown", value: 2_400_000_000_000, asOf: AT, cadence: "live", trackingSince: "2026-11-01" }),
  "not-configured": row("m06-total", "M06.X.02", "Total crypto market", { state: "not_configured", sources: [] }),
};

export function crashFixtures(): Record<string, CrashResponse> {
  const withRow = (r: unknown) => CrashResponse.parse({ tiles: [{ tileId: "M06", rows: [r] }] });
  const out: Record<string, CrashResponse> = {};
  for (const [name, r] of Object.entries(CRASH_ROWS)) out[name] = withRow(r);
  out.mixed = CrashResponse.parse({
    tiles: [
      { tileId: "M06", rows: [CRASH_ROWS.live, row("m06-eth", "M06.X.01b", "Largest coin", { state: "not_configured", sources: [] })] },
      { tileId: "M08", rows: [row("m08-debt", "M08.X.01", "US national debt", { unit: "usd", value: 38_000_000_000_000, cadence: "daily_exchange", asOf: "2026-11-20", ticker: { total: 38_000_000_000_000, anchor: AT, perSecond: 50_000 } })] },
    ],
    totalWiped: { valueUsd: 600_000_000_000, rowItemIds: ["M06.X.02"], excludedItemIds: [], oldestAsOf: AT },
  });
  return out;
}

export function searchFixtures(): Record<string, SearchResponse> {
  return {
    empty: SearchResponse.parse({ groups: [{ id: "lv", kind: "bulk", country: "lv", state: "ready", results: [] }] }),
    loading: SearchResponse.parse({
      groups: [
        { id: "lv", kind: "bulk", country: "lv", state: "ready", results: [hit(LV1, NAME, "lv"), hit(LV2, "Example Company 2 SIA", "lv")] },
        { id: "ee", kind: "bulk", country: "ee", state: "loading", percent: 62, results: [] },
      ],
    }),
    results: SearchResponse.parse({
      groups: [
        { id: "lv", kind: "bulk", country: "lv", state: "ready", results: [hit(LV1, NAME, "lv"), hit(LV2, "Example Company 2 SIA", "lv")] },
        { id: "ee", kind: "bulk", country: "ee", state: "ready", results: [hit(EE1, "Placeholder Foods OÜ", "ee")] },
        { id: "lt", kind: "bulk", country: "lt", state: "ready", results: [hit(LT1, "Sample Trading UAB", "lt")] },
        { id: "us-ny", kind: "live", country: "us", state: "error", results: [] },
      ],
    }),
  };
}

export function networkFixtures(): Record<string, NetworkResponse> {
  const node = (code: string, name: string) => ({ eid: `lv-${code}`, name, code, status: "active", country: "lv" as const });
  const edge = (from: string, to: string, over: Record<string, unknown> = {}) => ({ from: `lv-${from}`, to: `lv-${to}`, relation: "shared_address", source: source(), ...over });
  const graph = NetworkResponse.parse({
    nodes: [node(LV1, NAME), node(LV2, "Example Company 2 SIA"), node(LV3, "Example Company 3 SIA")],
    edges: [edge(LV1, LV2), edge(LV1, LV3, { relation: "corporate_member", share: 40 })],
    hubs: [],
    truncated: false,
  });
  return {
    graph,
    list: graph,
    empty: NetworkResponse.parse({ nodes: [node(LV1, NAME)], edges: [], hubs: [], truncated: false }),
    "too-large": NetworkResponse.parse({ ...graph, hubs: [{ addressKey: "addr-fixture-1", companyCount: 412, collapsed: true }], truncated: true }),
  };
}

export function libraryFixtures(): Record<string, unknown> {
  return {
    list: LibraryResponse.parse({
      investigations: [
        { id: INV, subject: NAME, country: "lv", eid: EID, level: "points_to_check", coverage: { ran: 9, total: 11 }, usage: usage({ used: 190_000, held: 0 }), status: "done", startedAt: AT, finishedAt: AT },
        { id: "inv-fixture-2", subject: "Placeholder Foods OÜ", country: "ee", eid: `ee-${EE1}`, level: null, coverage: null, usage: usage({ used: 40_000, held: 0 }), status: "stopped", startedAt: AT, finishedAt: AT },
      ],
    }),
    empty: LibraryResponse.parse({ investigations: [] }),
  };
}

export function estimateFixtures(): Record<string, unknown> {
  const base = { low: 90_000, typical: 150_000, high: 310_000, drivers: ["registry", "web"], typicalSeconds: { registry: 40, web: 90 }, cap: usage({ used: 0, held: 0, cap: 500_000 }), daily: usage({ used: 400_000, held: 0, cap: 3_300_000 }), dailyResetsAt: "2026-11-23T00:00:00.000Z" };
  return {
    default: EstimateResponse.parse({ ...base, basis: "default" }),
    measured: EstimateResponse.parse({ ...base, basis: "measured" }),
    "daily-cap": EstimateResponse.parse({ ...base, basis: "measured", daily: usage({ used: 3_300_000, held: 0, cap: 3_300_000 }) }),
  };
}

export function agentsFixtures(): Record<string, unknown> {
  const status = agentsStatus();
  return {
    off: status,
    ready: { ...status, backend: "cli", cli: "ready", cliVersion: "2.1.327", overage: "off" },
    "cli-missing": { ...status, backend: "cli", cli: "missing" },
    "cli-signed-out": { ...status, backend: "cli", cli: "signed_out", cliVersion: "2.1.327" },
    unsafe: { ...status, backend: "cli", cli: "unsafe", cliVersion: "2.1.327" },
    busy: { ...status, backend: "cli", cli: "ready", cliVersion: "2.1.327", overage: "off", running: INV },
    "overage-permitted": { ...status, backend: "cli", cli: "ready", cliVersion: "2.1.327", overage: "permitted" },
    "overage-in-use": { ...status, backend: "cli", cli: "ready", cliVersion: "2.1.327", overage: "in_use" },
  };
}

/** One company page per country, plus the sole trader's facts-only variant and the report. */
export function companyFixtures(): Record<string, unknown> {
  const base = companyReport();
  const header = (country: "lv" | "lt" | "ee" | "us", code: string, over: Record<string, unknown> = {}) => ({ ...base.header, eid: `${country}-${code}`, country, code, legalForm: null, ...over });
  return {
    lv: base,
    lt: { ...base, header: header("lt", LT1, { name: "Sample Trading UAB", caption: "Sample Trading UAB" }) },
    ee: { ...base, header: header("ee", EE1, { name: "Placeholder Foods OÜ", caption: "Placeholder Foods OÜ" }) },
    us: { ...base, header: header("us", "ny-fx000001", { name: "Example Holdings Inc", caption: "Example Holdings Inc" }) },
    // The purpose is set: the officers section (S03) is open. Names are fictional.
    "purpose-set": {
      ...base,
      sections: {
        ...base.sections,
        S03: {
          state: "data",
          value: [
            { value: { itemId: "S03.LV.01", prop: "officer", value: "Example Person One", label: "Board member" }, sources: [source({ accessTier: "purpose" })] },
            { value: { itemId: "S03.LV.01", prop: "officer", value: "Example Person Two", label: "Chair" }, sources: [source({ accessTier: "purpose" })] },
          ],
          freshness: "current",
          asOf: "2026-11-21",
          completeness: "full",
        },
      },
    },
    "sole-trader": {
      ...base,
      header: { eid: `lv-${LV9}`, country: "lv", code: LV9, legalForm: "lv-ik", status: "active", caption: `Sole trader (IK) · ${LV9}` },
      isNaturalPerson: true,
    },
  };
}

/** A full investigation snapshot as the report screen reads it. */
export function reportSnapshot(): InvestigationSnapshot {
  return InvestigationSnapshot.parse({ ...sampleSnapshot(), id: INV });
}

export type FixtureFile = { path: string; json: unknown };

/** Every file the fixture set holds, as repo-relative paths with their content. */
export function uiFixtureFiles(): FixtureFile[] {
  const files: FixtureFile[] = [];
  const add = (path: string, json: unknown) => files.push({ path, json });
  for (const s of scenarios()) {
    add(`fixtures/agents/${s.scenario}.json`, s);
    add(`fixtures/ui/investigation/${s.scenario}.json`, s.final);
  }
  for (const [name, json] of Object.entries(crashFixtures())) add(`fixtures/ui/crash/${name}.json`, json);
  for (const [name, json] of Object.entries(searchFixtures())) add(`fixtures/ui/search/${name}.json`, json);
  for (const [name, json] of Object.entries(networkFixtures())) add(`fixtures/ui/network/${name}.json`, json);
  for (const [name, json] of Object.entries(libraryFixtures())) add(`fixtures/ui/library/${name}.json`, json);
  for (const [name, json] of Object.entries(estimateFixtures())) add(`fixtures/ui/estimate/${name}.json`, json);
  for (const [name, json] of Object.entries(agentsFixtures())) add(`fixtures/ui/agents-status/${name}.json`, json);
  for (const [name, json] of Object.entries(companyFixtures())) add(`fixtures/ui/company/${name}.json`, json);
  add("fixtures/ui/errors/internal.json", { error: { code: "internal_error" } });
  return files;
}

/** The text of a fixture file: stable key order is the builder's, with a final newline. */
export function fixtureText(json: unknown): string {
  return `${JSON.stringify(json, null, 2)}\n`;
}
