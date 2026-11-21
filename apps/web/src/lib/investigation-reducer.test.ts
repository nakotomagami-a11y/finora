import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { InvestigationEvent, InvestigationSnapshot } from "@finora/api-contract";
import { AT, EID, snapshot as sampleSnapshot, usage, verdict } from "@finora/api-contract/samples";
import { describe, expect, it } from "vitest";
import { emptyState, fromSnapshot, isActive, reduce, setConnection, type InvestigationState } from "./investigation-reducer.ts";

const ID = "inv-1";
const ev = (id: number, type: string, data: unknown): InvestigationEvent => InvestigationEvent.parse({ id, at: AT, investigationId: ID, type, data });

const finding = {
  id: "f1",
  investigationId: ID,
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
};

const task = { runId: "run-registry", taskId: "t1", labelKey: "agents.tasks.read_register", params: {}, status: "done", sourcesRead: 2 };

/** One whole investigation, as the stream sends it. */
const STREAM: InvestigationEvent[] = [
  ev(1, "investigation.status", { status: "planning" }),
  ev(2, "plan", { runs: [{ runId: "run-registry", role: "registry", dependsOn: [] }, { runId: "run-web", role: "web", dependsOn: [] }] }),
  ev(3, "investigation.status", { status: "running" }),
  ev(4, "run.status", { runId: "run-registry", status: "running" }),
  ev(5, "run.step", { runId: "run-registry", stepKey: "agents.steps.reading_register", params: { page: 1 } }),
  ev(6, "run.task", { ...task, status: "running", sourcesRead: 0 }),
  ev(7, "run.source", { runId: "run-registry", documentId: "d1", domain: "register.example", title: "Entry", kind: "register", sourcesRead: 1 }),
  ev(8, "run.source", { runId: "run-registry", documentId: "d2", domain: "register.example", title: "Entry 2", kind: "register", sourcesRead: 2 }),
  ev(9, "run.task", task),
  ev(10, "finding", finding),
  ev(11, "usage", { runId: "run-registry", usage: usage({ held: 0 }) }),
  ev(12, "run.status", { runId: "run-registry", status: "done" }),
  ev(13, "run.status", { runId: "run-web", status: "waiting", waitingOn: "question" }),
  ev(14, "question", { id: "q1", runId: "run-web", kind: "scope", text: "Which site?", options: [{ id: "a", label: "Site A" }], defaultOptionId: "a", timeoutAt: AT, blocks: "run" }),
  ev(15, "question.answered", { questionId: "q1", optionId: "a", by: "human" }),
  ev(16, "run.status", { runId: "run-web", status: "done" }),
  ev(17, "usage", { runId: null, usage: usage({ held: 0 }) }),
  ev(18, "verdict", verdict()),
  ev(19, "investigation.status", { status: "done" }),
];

/** The snapshot of the same investigation, taken after the last event. */
const FINAL = InvestigationSnapshot.parse({
  id: ID,
  subject: { eid: EID, country: "lv", caption: "Example Company 1 SIA" },
  status: "done",
  plan: [
    { runId: "run-registry", role: "registry", dependsOn: [] },
    { runId: "run-web", role: "web", dependsOn: [] },
  ],
  runs: [
    { id: "run-registry", role: "registry", status: "done", usage: usage({ held: 0 }), startedAt: null, endedAt: null },
    { id: "run-web", role: "web", status: "done", usage: { unit: "st", used: 0, held: 0, cap: 0, extensionGranted: false }, startedAt: null, endedAt: null },
  ],
  tasks: [task],
  findings: [finding],
  questions: [{ id: "q1", runId: "run-web", kind: "scope", text: "Which site?", options: [{ id: "a", label: "Site A" }], defaultOptionId: "a", timeoutAt: AT, blocks: "run", answer: { optionId: "a", by: "human" } }],
  verdict: verdict(),
  usage: usage({ held: 0 }),
  lastEventId: STREAM.length,
});

const replay = (events: InvestigationEvent[], from: InvestigationState = emptyState(ID)) => events.reduce(reduce, from);

/** What two states must share to show the same page; the step line is live only. */
function shown(state: InvestigationState) {
  const { connection: _c, gap: _g, lastError: _e, ...rest } = state;
  const runs = Object.fromEntries(Object.entries(rest.runs).map(([id, run]) => {
    const { stepKey: _s, stepParams: _p, ...kept } = run;
    return [id, kept];
  }));
  return { ...rest, runs };
}

describe("the reducer", () => {
  it("replaying the stream reaches the state of the snapshot taken at its end (live equals reload)", () => {
    expect(shown(replay(STREAM))).toEqual(shown(fromSnapshot(FINAL)));
  });

  it("applying any event twice, or an event with an id up to lastEventId, changes nothing", () => {
    const state = replay(STREAM);
    for (const event of STREAM) expect(reduce(state, event)).toBe(state);
  });

  it("survives duplicates and replays in a seeded shuffle (property test)", () => {
    const expected = shown(replay(STREAM));
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let round = 0; round < 200; round += 1) {
      const delivered: InvestigationEvent[] = [];
      let state = emptyState(ID);
      for (const event of STREAM) {
        delivered.push(event);
        // After each event, deliver a few earlier ones again, in any order.
        for (let again = Math.floor(random() * 4); again > 0; again -= 1) delivered.push(STREAM[Math.floor(random() * delivered.length) % (event.id)] as InvestigationEvent);
      }
      state = replay(delivered, state);
      expect(state.gap, `round ${round}`).toBe(false);
      expect(shown(state), `round ${round}`).toEqual(expected);
    }
  });

  it("refuses an event that skips an id: nothing is applied and the gap is flagged", () => {
    const before = replay(STREAM.slice(0, 9));
    const after = reduce(before, STREAM[10] as InvestigationEvent);
    expect(after.gap).toBe(true);
    expect(after.lastEventId).toBe(before.lastEventId);
    expect(after.findings).toEqual(before.findings);
  });

  it("does not count an event for a run it never saw as applied", () => {
    const state = reduce(emptyState(ID), ev(1, "run.status", { runId: "run-x", status: "running" }));
    expect(state.gap).toBe(true);
    expect(state.lastEventId).toBe(0);
  });

  it("a snapshot after a gap resumes the stream with no duplicate and no lost finding", () => {
    const gapped = reduce(replay(STREAM.slice(0, 9)), STREAM[11] as InvestigationEvent);
    expect(gapped.gap).toBe(true);
    const snapshotAt9 = InvestigationSnapshot.parse({ ...FINAL, status: "running", verdict: null, findings: [], questions: [], runs: FINAL.runs.map((r) => ({ ...r, status: "queued" })), lastEventId: 9 });
    const resumed = replay(STREAM.slice(9), fromSnapshot(snapshotAt9, "live"));
    expect(resumed.gap).toBe(false);
    expect(Object.keys(resumed.findings)).toEqual(["f1"]);
    expect(resumed.lastEventId).toBe(STREAM.length);
    expect(resumed.status).toBe("done");
  });

  it("keeps a source count from going down", () => {
    const state = replay(STREAM.slice(0, 8));
    expect(state.runs["run-registry"]?.sourcesRead).toBe(2);
    const stale = reduce(state, ev(9, "run.source", { runId: "run-registry", documentId: "d1", domain: "register.example", title: "Entry", kind: "register", sourcesRead: 1 }));
    expect(stale.runs["run-registry"]?.sourcesRead).toBe(2);
  });

  it("clears waitingOn when a run leaves waiting, and a pause carries its code and reset time", () => {
    const waiting = replay(STREAM.slice(0, 13));
    expect(waiting.runs["run-web"]?.waitingOn).toBe("question");
    const done = reduce(replay(STREAM.slice(0, 15)), STREAM[15] as InvestigationEvent);
    expect(done.runs["run-web"]?.waitingOn).toBeUndefined();
    const paused = reduce(done, ev(17, "investigation.status", { status: "paused", code: "plan_limit", resetsAt: "2026-11-22T14:00:00.000Z" }));
    expect(paused.status).toBe("paused");
    expect(paused.code).toBe("plan_limit");
    expect(paused.resetsAt).toBe("2026-11-22T14:00:00.000Z");
    const resumed = reduce(paused, ev(18, "investigation.status", { status: "running" }));
    expect(resumed.code).toBeUndefined();
    expect(resumed.resetsAt).toBeUndefined();
  });

  it("changes the connection without touching the data", () => {
    const state = replay(STREAM.slice(0, 3));
    const lost = setConnection(state, "reconnecting");
    expect(lost.connection).toBe("reconnecting");
    expect({ ...lost, connection: state.connection }).toEqual(state);
    expect(setConnection(lost, "reconnecting")).toBe(lost);
  });

  it("knows which statuses can still change", () => {
    expect(["planning", "running", "waiting", "paused", "synthesising"].every((s) => isActive(s as InvestigationState["status"]))).toBe(true);
    expect(["done", "stopped", "budget_exceeded", "failed"].some((s) => isActive(s as InvestigationState["status"]))).toBe(false);
  });

  it("builds a state from a contract sample snapshot", () => {
    const state = fromSnapshot(InvestigationSnapshot.parse(sampleSnapshot()));
    expect(state.lastEventId).toBe(42);
    expect(state.order).toEqual(["run-registry"]);
  });
});

describe("usage in the reducer", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "investigation-reducer.ts"), "utf8");

  it("has no currency field and no float arithmetic on usage", () => {
    expect(source).not.toMatch(/usd|cost|price|eur\b|micro/iu);
    expect(source).not.toMatch(/parseFloat|toFixed|Math\.(round|floor|ceil|trunc)\(|\*\s*0\.\d|\/\s*100\b/u);
  });
});
