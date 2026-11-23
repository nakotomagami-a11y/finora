"use client";

import { API_ROUTES, InvestigationSnapshot } from "@finora/api-contract";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { buildUrl, callApi, UnsafePathParameter } from "./api.ts";
import { emptyState, fromSnapshot, isActive, reduce, setConnection, type InvestigationState } from "./investigation-reducer.ts";
import { BACKOFF_MS, openEventStream, RECONNECTING_AFTER_MS, type EventStreamOptions, type StreamStatus } from "./sse.ts";

/** After this long without a cure the page gives up on the connection and says so (DESIGN.md §9.1). */
export const GIVE_UP_AFTER_MS = 5 * 60 * 1000;

const EVENTS_ROUTE = API_ROUTES.find((route) => route.operationId === "investigationEvents");

type Action =
  | { kind: "reset"; id: string }
  | { kind: "snapshot"; snapshot: InvestigationSnapshot }
  | { kind: "event"; event: Parameters<typeof reduce>[1] }
  | { kind: "connection"; status: StreamStatus }
  | { kind: "failed" };

function step(state: InvestigationState, action: Action): InvestigationState {
  switch (action.kind) {
    case "reset":
      return state.id === action.id ? state : emptyState(action.id);
    case "snapshot":
      // A snapshot of another investigation, or older than what is already applied, must not move the page.
      if (action.snapshot.id !== state.id) return state;
      return action.snapshot.lastEventId < state.lastEventId ? { ...state, gap: false } : fromSnapshot(action.snapshot, state.connection);
    case "event":
      return reduce(state, action.event);
    case "connection":
      return setConnection(state, action.status);
    case "failed":
      return setConnection(state, "failed");
  }
}

export type UseInvestigationOptions = {
  /** Injected for tests. */
  fetchFn?: typeof fetch;
  openStream?: (options: EventStreamOptions) => { close(): void };
  random?: () => number;
  /** False shows the snapshot only: a finished investigation, or a fixture. */
  live?: boolean;
};

export type UseInvestigation = {
  state: InvestigationState;
  /** True until the first snapshot arrives. */
  loading: boolean;
  /** The snapshot could not be read: the error code to show. */
  error: string | null;
  /** How many times in a row the page has had to ask for the snapshot again without a cure: the banner's "attempt N". */
  attempt: number;
  refetch(): void;
};

/** What the gap path knows about the snapshots it has applied and whether they cured the gap. */
type Cure = {
  /** A snapshot was applied for a gap, and no event has applied since. */
  awaiting: boolean;
  /** The event id that snapshot was at. */
  snapshotId: number;
  /** Gaps in a row that a snapshot did not cure. */
  uncured: number;
  /** When the first of them happened. */
  since: number | null;
};

const freshCure = (): Cure => ({ awaiting: false, snapshotId: 0, uncured: 0, since: null });

const backoff = (count: number, random: () => number): number => {
  const base = BACKOFF_MS[Math.min(Math.max(count, 1) - 1, BACKOFF_MS.length - 1)] as number;
  return Math.round(base * (0.8 + 0.4 * random()));
};

/**
 * One open investigation: fetch its snapshot, then follow the event stream (docs/plan/ui-build-plan.md §6.1).
 *
 * When the reducer reports a gap in the event ids, it applies nothing more (so no finding, question or verdict can
 * show before its predecessors). The snapshot is fetched again, and a failed fetch is retried on the stream's backoff.
 * Once a snapshot lands the stream is closed and opened again, so the server replays every event after the snapshot's
 * id: an event that arrived while the snapshot was loading is not lost.
 *
 * A snapshot can fail to cure a gap (the server's snapshot lags its event log, so the replayed event names a run the
 * snapshot does not have). The page counts those gaps in a row, backs off on the same schedule, and gives up after 5
 * minutes; the count starts over only when an event applies after a reopen.
 */
export function useInvestigation(id: string, options: UseInvestigationOptions = {}): UseInvestigation {
  const { live } = options;
  // Injected functions are read through a ref, so a new function on every render does not restart the stream.
  const injected = useRef(options);
  injected.current = options;
  const [state, dispatch] = useReducer(step, id, emptyState);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [generation, setGeneration] = useState(0);
  const latest = useRef(state);
  latest.current = state;
  const currentId = useRef(id);
  currentId.current = id;
  const cure = useRef<Cure>(freshCure());

  // A different investigation: start from nothing, so nothing of the old one can show on the new.
  useEffect(() => {
    dispatch({ kind: "reset", id });
    cure.current = freshCure();
    setLoaded(false);
    setError(null);
    setAttempt(0);
    setGeneration(0);
  }, [id]);

  /** Reads the snapshot once. Returns its last event id when it landed, null when it did not (or is for an old id). */
  const load = useCallback(async (): Promise<number | null> => {
    const asked = id;
    const result = await callApi("investigation", { params: { id: asked } }, injected.current.fetchFn);
    if (currentId.current !== asked) return null; // the page has moved to another investigation: drop this answer
    if (!result.ok) {
      setError(result.code);
      return null;
    }
    const snapshot = InvestigationSnapshot.parse(result.data);
    setError(null);
    dispatch({ kind: "snapshot", snapshot });
    setLoaded(true);
    return snapshot.lastEventId;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void load().then((landed) => {
      if (landed === null && !cancelled && currentId.current === id) dispatch({ kind: "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [load, id]);

  // An event applied after a snapshot that was fetched for a gap: that snapshot cured it.
  useEffect(() => {
    const c = cure.current;
    if (c.awaiting && !state.gap && state.lastEventId > c.snapshotId) {
      cure.current = freshCure();
      setAttempt(0);
    }
  }, [state.lastEventId, state.gap]);

  // A gap in the ids: ask for the snapshot again, with backoff, and say "reconnecting" if it takes over 3 s.
  const gap = state.gap;
  useEffect(() => {
    if (!gap) return;
    const random = injected.current.random ?? Math.random;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const startedAt = Date.now();
    const reconnecting = setTimeout(() => dispatch({ kind: "connection", status: "reconnecting" }), RECONNECTING_AFTER_MS);

    // A gap that returns right after a snapshot was applied for the last one: the snapshot did not cure it.
    const c = cure.current;
    if (c.awaiting) {
      c.uncured += 1;
      c.since ??= Date.now();
      c.awaiting = false;
      setAttempt(c.uncured);
    }
    const giveUp = () => c.since !== null && Date.now() - c.since >= GIVE_UP_AFTER_MS;

    const attemptLoad = async () => {
      if (giveUp()) {
        dispatch({ kind: "failed" });
        return;
      }
      const landed = await load();
      if (cancelled) return;
      if (landed !== null) {
        cure.current = { awaiting: true, snapshotId: landed, uncured: c.uncured, since: c.since };
        setAttempt(c.uncured); // the failed fetches are over; only gaps a snapshot did not cure still count
        setGeneration((n) => n + 1); // reopen the stream: the server replays from the new snapshot's id
        return;
      }
      tries += 1;
      setAttempt(c.uncured + tries);
      if (Date.now() - startedAt >= GIVE_UP_AFTER_MS || giveUp()) {
        dispatch({ kind: "failed" });
        return;
      }
      timer = setTimeout(() => void attemptLoad(), backoff(c.uncured + tries, random));
    };

    // The first try for an uncured gap waits its turn on the backoff, so the page never hammers the server.
    if (c.uncured > 0) timer = setTimeout(() => void attemptLoad(), backoff(c.uncured, random));
    else void attemptLoad();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(reconnecting);
    };
  }, [gap, load]);

  const streaming = live !== false && loaded && state.id === id && isActive(state.status);
  useEffect(() => {
    if (!streaming || !EVENTS_ROUTE) return;
    let url: string;
    try {
      url = buildUrl(EVENTS_ROUTE, { params: { id } });
    } catch (error) {
      if (error instanceof UnsafePathParameter) return;
      throw error;
    }
    const open = injected.current.openStream ?? openEventStream;
    const fetchFn = injected.current.fetchFn;
    const stream = open({
      url,
      lastEventId: () => latest.current.lastEventId,
      onEvent: (event) => dispatch({ kind: "event", event }),
      onStatus: (status) => dispatch({ kind: "connection", status }),
      shouldReconnect: () => isActive(latest.current.status),
      ...(fetchFn ? { fetch: fetchFn } : {}),
    });
    return () => stream.close();
  }, [streaming, id, generation]);

  return { state, loading: !loaded && error === null, error, attempt, refetch: () => void load() };
}
