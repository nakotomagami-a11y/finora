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
    // A source that could not be read is a failed task with its source id (architecture 7.6); the run still ends, and the
    // verdict says which checks did not run. An error event is for request-level codes only.
    scenario("partial", [
      ...START,
      { type: "run.task", data: task("run-money", "t-money-1", "agents.tasks.read_tax_file", "failed", 0, { sourceId: "fx-lv-tax" }) },
      ...FINISH,
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

const CRASH_SOURCE: Record<string, string> = {
  "M01.X.01:us_equities": "us-fred-open",
  "M01.X.03:us_large": "us-fred-cited",
  "M01.X.03:us_broad": "us-fred-cited",
  "M01.X.03:us_tech": "us-fred-cited",
  "M03.X.01:japan": "us-fred-cited",
  "M03.X.01:taiwan": "e1-taiwan",
  "M05.X.01:gold_monthly": "intl-worldbank-pinksheet",
  "M06.X.01b:bitcoin": "crypto-x4-ohlc",
  "M06.X.01b:ether": "crypto-x4-ohlc",
  "M06.X.02:total_crypto": "crypto-c1",
  "M07.X.01:brent": "us-fred-open",
  "M07.X.01:wti": "us-fred-open",
  "M08.X.01:us_debt": "us-treasury-debt",
};

const row = (rowKey: string, itemId: string, label: string, over: Record<string, unknown> = {}) => ({
  rowKey,
  itemId,
  label,
  state: "ok",
  unit: "usd",
  cadence: "daily_exchange",
  delayed: false,
  // The source each row comes from (its real id in the market loaders), dated with the row's own as-of.
  sources: [source({ sourceId: CRASH_SOURCE[rowKey] ?? "fx-markets", asOf: String(over.asOf ?? "2026-11-21").slice(0, 10) })],
  ...over,
});

const PERSONAL_USE = "For personal use only. Example Index Owner's copyright, via FRED; 1-day lag";

/** One row of the full page. Names and figures are invented. */
const CRASH = {
  usEquities: row("M01.X.01:us_equities", "M01.X.01", "crash.rows.us_equities", {
    value: 51_000_000_000_000,
    asOf: "2026-06-30",
    cadence: "quarterly",
    delayed: true,
    peak: { value: 55_700_000_000_000, date: "2025-12-31", basis: "since" },
    drawdownPct: -8.4,
    valueLostUsd: 4_700_000_000_000,
    attribution: "Board of Governors of the Federal Reserve System, via FRED",
  }),
  usLarge: row("M01.X.03:us_large", "M01.X.03", "crash.rows.us_large", { unit: "index_points", value: 5000, asOf: "2026-11-18", delayed: true, peak: { value: 5540, date: "2026-06-12", basis: "since" }, drawdownPct: -9.7, attribution: PERSONAL_USE }),
  usBroad: row("M01.X.03:us_broad", "M01.X.03", "crash.rows.us_broad", { unit: "index_points", value: 2500, asOf: "2026-11-18", delayed: true, peak: { value: 2784, date: "2026-06-12", basis: "since" }, drawdownPct: -10.2, attribution: PERSONAL_USE }),
  usTech: row("M01.X.03:us_tech", "M01.X.03", "crash.rows.us_tech", { unit: "index_points", value: 17_000, asOf: "2026-11-18", delayed: true, peak: { value: 19_560, date: "2026-06-12", basis: "since" }, drawdownPct: -13.1, attribution: PERSONAL_USE }),
  japan: row("M03.X.01:japan", "M03.X.01", "crash.rows.japan_index", { unit: "index_points", value: 38_000, asOf: "2026-11-19", delayed: true, peak: { value: 40_470, date: "2026-07-09", basis: "since" }, drawdownPct: -6.1, attribution: "Citation required. Kept on this machine." }),
  taiwan: row("M03.X.01:taiwan", "M03.X.01", "crash.rows.taiwan_index", { state: "peak_unknown", unit: "index_points", asOf: "2026-11-19", trackingSince: "2026-11-16", delayed: true, attribution: "Taiwan exchange, official open data" }),
  gold: row("M05.X.01:gold_monthly", "M05.X.01", "crash.rows.gold_monthly", { unit: "usd_per_oz", value: 2910, asOf: "2026-10-31", cadence: "monthly", delayed: true, peak: { value: 3000, date: "2026-08-31", basis: "since" }, drawdownPct: -3, attribution: "World Bank Commodity Price Data, CC BY 4.0" }),
  bitcoin: row("M06.X.01b:bitcoin", "M06.X.01b", "crash.rows.bitcoin", { value: 71_000, asOf: "2026-11-22T08:20:00Z", cadence: "live", peak: { value: 94_000, date: "2025-10-06", basis: "all_time" }, drawdownPct: -24.5, valueLostUsd: 660_000_000_000 }),
  ether: row("M06.X.01b:ether", "M06.X.01b", "crash.rows.ether", { value: 3000, asOf: "2026-11-22T08:20:00Z", cadence: "live", peak: { value: 4850, date: "2025-10-06", basis: "all_time" }, drawdownPct: -38.2, valueLostUsd: 210_000_000_000 }),
  crypto: row("M06.X.02:total_crypto", "M06.X.02", "crash.rows.total_crypto", {
    unit: "usd_cap",
    value: 2_900_000_000_000,
    asOf: "2026-11-22T08:20:00Z",
    cadence: "live",
    peak: { value: 4_080_000_000_000, date: "2025-10-06", basis: "all_time" },
    drawdownPct: -29,
    valueLostUsd: 1_180_000_000_000,
    attribution: "Crypto market data, provider C1. Values older than 24 hours are dropped.",
  }),
  brent: row("M07.X.01:brent", "M07.X.01", "crash.rows.brent", { unit: "usd_per_bbl", value: 70, asOf: "2026-11-17", delayed: true, peak: { value: 79.5, date: "2025-04-14", basis: "since" }, drawdownPct: -12, attribution: "U.S. Energy Information Administration, via FRED" }),
  wti: row("M07.X.01:wti", "M07.X.01", "crash.rows.wti", { unit: "usd_per_bbl", value: 66, asOf: "2026-11-17", delayed: true, peak: { value: 76.2, date: "2025-04-14", basis: "since" }, drawdownPct: -13.4, attribution: "U.S. Energy Information Administration, via FRED" }),
  debt: row("M08.X.01:us_debt", "M08.X.01", "crash.rows.us_debt", {
    value: 38_610_227_451_903,
    asOf: "2026-11-18",
    delayed: true,
    drawdownPct: -0.01,
    ticker: { total: 38_610_227_451_903, anchor: "2026-11-18T21:00:00Z", perSecond: 76_000 },
    // Two official figures a month apart, never the ticker.
    change30d: { valueUsd: 214_000_000_000, from: "2026-10-18", to: "2026-11-18" },
    attribution: "U.S. Treasury, Fiscal Data (Debt to the Penny)",
  }),
};

type CrashRows = Record<keyof typeof CRASH, Record<string, unknown>>;

/** The whole page from its rows: tiles in order, each with its rows, and the value-below-peaks summary. */
function crashPage(rows: CrashRows, wiped: Record<string, unknown> | null): CrashResponse {
  const R = rows;
  return CrashResponse.parse({
    peakSince: "2025-01-01",
    tiles: [
      { tileId: "M01", rows: [R.usEquities, R.usLarge, R.usBroad, R.usTech] },
      { tileId: "M03", rows: [R.japan, R.taiwan] },
      { tileId: "M05", rows: [R.gold] },
      { tileId: "M06", rows: [R.bitcoin, R.ether, R.crypto] },
      { tileId: "M07", rows: [R.brent, R.wti] },
      { tileId: "M08", rows: [R.debt] },
    ],
    ...(wiped ? { totalWiped: wiped } : {}),
  });
}

const WIPED = { valueUsd: 5_880_000_000_000, rowItemIds: ["M01.X.01", "M06.X.02"], excludedItemIds: [], oldestAsOf: "2026-06-30" };
const notConfigured = (r: Record<string, unknown>, provider: string) => ({ ...r, state: "not_configured", provider, sources: [], value: undefined, asOf: undefined, peak: undefined, drawdownPct: undefined, valueLostUsd: undefined, attribution: undefined });
const noNumber = (r: Record<string, unknown>) => ({ ...r, value: undefined, drawdownPct: undefined, valueLostUsd: undefined, peak: undefined });
const stale = (r: Record<string, unknown>, asOf: string) => ({ ...r, state: "stale", asOf });
const OLD_CRYPTO = "2026-11-22T06:40:00Z";

export function crashFixtures(): Record<string, CrashResponse> {
  const full: CrashRows = { ...CRASH };
  const noDaily = { usLarge: notConfigured(CRASH.usLarge, "fred-cited"), usBroad: notConfigured(CRASH.usBroad, "fred-cited"), usTech: notConfigured(CRASH.usTech, "fred-cited") };
  return {
    live: crashPage(full, WIPED),
    // Crypto is published a quarter of an hour late.
    delayed: crashPage({ ...full, crypto: { ...CRASH.crypto, delayed: true } }, WIPED),
    // The crypto sources have not answered since 07:40: their values stay, and their dates turn amber.
    stale: crashPage({ ...full, bitcoin: stale(CRASH.bitcoin, OLD_CRYPTO), ether: stale(CRASH.ether, OLD_CRYPTO), crypto: stale(CRASH.crypto, OLD_CRYPTO) }, WIPED),
    // One source failed: the rows keep their shape with no number, and the sum names what it left out. Bitcoin
    // keeps a last good value with its time; the crypto total never does (C1's 24 h rule).
    error: crashPage(
      { ...full, bitcoin: { ...noNumber(CRASH.bitcoin), state: "error", lastGood: { value: 70_500, asOf: "2026-11-22T05:10:00Z" } }, ether: { ...noNumber(CRASH.ether), state: "error" }, crypto: { ...noNumber(CRASH.crypto), state: "error", sources: [] } },
      { valueUsd: 4_700_000_000_000, rowItemIds: ["M01.X.01", "M06.X.02"], excludedItemIds: ["M06.X.02"], oldestAsOf: "2026-06-30" },
    ),
    // No provider file: every coded source reads "not configured", and no number is shown for it.
    "not-configured": crashPage(
      { ...full, ...noDaily, japan: notConfigured(CRASH.japan, "fred-cited"), taiwan: notConfigured(CRASH.taiwan, "e1"), bitcoin: notConfigured(CRASH.bitcoin, "x4"), ether: notConfigured(CRASH.ether, "x4"), crypto: notConfigured(CRASH.crypto, "c1") },
      { valueUsd: 4_700_000_000_000, rowItemIds: ["M01.X.01"], excludedItemIds: ["M06.X.02"], oldestAsOf: "2026-06-30" },
    ),
    // Taiwan's peak is not known yet (tracking since 16 Nov), so the tile that leads with it shows no percentage.
    "peak-unknown": crashPage({ ...full, japan: { ...CRASH.taiwan, rowKey: CRASH.japan.rowKey, label: CRASH.japan.label } }, WIPED),
    // A mix: some rows not configured, one still loading, one stale.
    mixed: crashPage({ ...full, ...noDaily, taiwan: { ...noNumber(CRASH.taiwan), state: "loading", trackingSince: undefined, asOf: undefined, sources: [] }, bitcoin: stale(CRASH.bitcoin, OLD_CRYPTO) }, WIPED),
  };
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
