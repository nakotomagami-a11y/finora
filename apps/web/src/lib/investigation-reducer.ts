import type { InvestigationEvent, InvestigationSnapshot, Usage } from "@finora/api-contract";

/**
 * The state of one investigation as the page shows it, built from the snapshot and the event stream
 * (docs/plan/ui-build-plan.md §6.2). Everything here is plain data: the reducer is pure, an event that was
 * already applied changes nothing, and an event that skips an id is refused so the caller refetches the snapshot.
 * Usage is integer standard tokens end to end; no currency exists in this file.
 */

export type Connection = "connecting" | "live" | "reconnecting" | "failed";

type Snapshot = InvestigationSnapshot;
type Run = Snapshot["runs"][number];
type Task = Snapshot["tasks"][number];
type Finding = Snapshot["findings"][number];
type Question = Snapshot["questions"][number];

export type RunState = Pick<Run, "role" | "status" | "usage" | "startedAt" | "endedAt"> & {
  waitingOn?: Run["waitingOn"];
  code?: string;
  stepKey?: string;
  stepParams?: Record<string, string | number>;
  sourcesRead: number;
};

export type InvestigationState = {
  id: string;
  /** The id of the last event applied; the stream resumes after it. */
  lastEventId: number;
  /** How many events have actually been applied since this state was created from nothing; a snapshot keeps it. */
  applied: number;
  status: Snapshot["status"];
  code?: string;
  resetsAt?: string;
  /** Run ids in plan order, so lanes keep their order. */
  order: string[];
  runs: Record<string, RunState>;
  tasks: Record<string, Task>;
  /** Keyed by id, so a replay cannot duplicate a finding. */
  findings: Record<string, Finding>;
  questions: Record<string, Question>;
  usage: Usage;
  verdict: Snapshot["verdict"];
  /** The last error event, for the banner. */
  lastError: { code: string; runId?: string } | null;
  /** True after an event skipped an id: the caller refetches the snapshot and calls `fromSnapshot`. */
  gap: boolean;
  connection: Connection;
};

export const NO_USAGE: Usage = { unit: "st", used: 0, held: 0, cap: 0, extensionGranted: false };

/** The state at a snapshot. Events with an id up to `lastEventId` are already in it. */
export function fromSnapshot(snapshot: Snapshot, connection: Connection = "connecting"): InvestigationState {
  const runs: Record<string, RunState> = {};
  for (const run of snapshot.runs) {
    runs[run.id] = {
      role: run.role,
      status: run.status,
      usage: run.usage,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      sourcesRead: sumSources(snapshot.tasks, run.id),
      ...(run.waitingOn ? { waitingOn: run.waitingOn } : {}),
      ...(run.code ? { code: run.code } : {}),
    };
  }
  const order = snapshot.plan.map((entry) => entry.runId);
  for (const id of Object.keys(runs)) if (!order.includes(id)) order.push(id);
  return {
    id: snapshot.id,
    lastEventId: snapshot.lastEventId,
    applied: 0,
    status: snapshot.status,
    ...(snapshot.code ? { code: snapshot.code } : {}),
    ...(snapshot.resetsAt ? { resetsAt: snapshot.resetsAt } : {}),
    order,
    runs,
    tasks: Object.fromEntries(snapshot.tasks.map((task) => [task.taskId, task])),
    findings: Object.fromEntries(snapshot.findings.map((finding) => [finding.id, finding])),
    questions: Object.fromEntries(snapshot.questions.map((question) => [question.id, question])),
    usage: snapshot.usage,
    verdict: snapshot.verdict,
    lastError: null,
    gap: false,
    connection,
  };
}

function sumSources(tasks: Task[], runId: string): number {
  return tasks.filter((task) => task.runId === runId).reduce((total, task) => total + task.sourcesRead, 0);
}

/** An empty state before the snapshot arrives. */
export function emptyState(id: string): InvestigationState {
  return {
    id,
    lastEventId: 0,
    applied: 0,
    status: "planning",
    order: [],
    runs: {},
    tasks: {},
    findings: {},
    questions: {},
    usage: NO_USAGE,
    verdict: null,
    lastError: null,
    gap: false,
    connection: "connecting",
  };
}

function withRun(state: InvestigationState, runId: string, change: (run: RunState) => RunState): InvestigationState {
  const run = state.runs[runId];
  // An event for a run the plan did not announce cannot be placed: ask for the snapshot.
  if (!run) return { ...state, gap: true };
  return { ...state, runs: { ...state.runs, [runId]: change(run) } };
}

/**
 * Applies one event. An id that was already applied returns the same state object. An id that skips ahead sets
 * `gap` and applies nothing, so no finding can be lost or doubled. Otherwise the event moves `lastEventId` to its id.
 */
export function reduce(state: InvestigationState, event: InvestigationEvent): InvestigationState {
  // An event of another investigation (a stale stream after the page moved on) is not this page's.
  if (event.investigationId !== state.id) return state;
  if (event.id <= state.lastEventId) return state;
  // While a gap is open nothing applies, so no event can show before its predecessors; the snapshot clears the gap.
  if (state.gap) return state;
  if (event.id !== state.lastEventId + 1) return state.gap ? state : { ...state, gap: true };
  const next = apply(state, event);
  // An event that could not be placed (an unknown run) is not counted as applied: the gap it raised stays open.
  if (next.gap) return next;
  return { ...next, lastEventId: event.id, applied: state.applied + 1 };
}

function apply(state: InvestigationState, event: InvestigationEvent): InvestigationState {
  switch (event.type) {
    case "investigation.status": {
      const { status, code, resetsAt } = event.data;
      const { code: _code, resetsAt: _resetsAt, ...rest } = state;
      return { ...rest, status, ...(code ? { code } : {}), ...(resetsAt ? { resetsAt } : {}) };
    }
    case "plan": {
      const runs = { ...state.runs };
      const order = [...state.order];
      for (const entry of event.data.runs) {
        if (!runs[entry.runId]) runs[entry.runId] = { role: entry.role, status: "queued", usage: NO_USAGE, startedAt: null, endedAt: null, sourcesRead: 0 };
        if (!order.includes(entry.runId)) order.push(entry.runId);
      }
      return { ...state, runs, order };
    }
    case "run.status": {
      const { runId, status, waitingOn, code } = event.data;
      return withRun(state, runId, (run) => {
        const { waitingOn: _w, code: _c, ...rest } = run;
        return { ...rest, status, ...(waitingOn ? { waitingOn } : {}), ...(code ? { code } : {}) };
      });
    }
    case "run.task": {
      const task = event.data;
      return { ...state, tasks: { ...state.tasks, [task.taskId]: task } };
    }
    case "run.step":
      return withRun(state, event.data.runId, (run) => ({ ...run, stepKey: event.data.stepKey, stepParams: event.data.params }));
    case "run.source":
      // A count never goes down: a late duplicate with a smaller number is harmless.
      return withRun(state, event.data.runId, (run) => ({ ...run, sourcesRead: Math.max(run.sourcesRead, event.data.sourcesRead) }));
    case "finding":
      return { ...state, findings: { ...state.findings, [event.data.id]: event.data } };
    case "question":
      return { ...state, questions: { ...state.questions, [event.data.id]: event.data } };
    case "question.answered": {
      const { questionId, optionId, by } = event.data;
      const question = state.questions[questionId];
      if (!question) return { ...state, gap: true };
      return { ...state, questions: { ...state.questions, [questionId]: { ...question, answer: { optionId, by } } } };
    }
    case "usage": {
      const { runId, usage } = event.data;
      if (runId === null) return { ...state, usage };
      return withRun(state, runId, (run) => ({ ...run, usage }));
    }
    case "verdict":
      return { ...state, verdict: event.data };
    case "error":
      return { ...state, lastError: { code: event.data.code, ...(event.data.runId ? { runId: event.data.runId } : {}) } };
  }
}

/** The connection state changes without touching the investigation's data. */
export function setConnection(state: InvestigationState, connection: Connection): InvestigationState {
  return state.connection === connection ? state : { ...state, connection };
}

/** Whether the investigation can still change: the page keeps the stream open while it can. */
export function isActive(status: InvestigationState["status"]): boolean {
  return status === "planning" || status === "running" || status === "waiting" || status === "paused" || status === "synthesising";
}
