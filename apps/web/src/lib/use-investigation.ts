"use client";

import { API_ROUTES, InvestigationSnapshot } from "@finora/api-contract";
import { useCallback, useEffect, useRef, useState } from "react";
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
    case "snapshot": {
      // A snapshot of another investigation must not move the page.
      if (action.snapshot.id !== state.id) return state;
      // One older than what is already applied changes nothing but the gap flag: the page is already further on.
      if (action.snapshot.lastEventId < state.lastEventId) return { ...state, gap: false };
      return { ...fromSnapshot(action.snapshot, state.connection), applied: state.applied };
    }
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
  /** The page gave up after 5 minutes. Nothing more is asked until `refetch` is called. */
  gaveUp: boolean;
  /** Ask for the snapshot now, by hand: the only thing that replaces a failed connection. */
  refetch(): void;
};

/** What the gap path knows about the snapshots it has applied and whether they cured the gap. */
type Cure = {
  /** A snapshot was applied for a gap, and no event has applied since. */
  awaiting: boolean;
  /** The reducer's applied-event counter when that snapshot landed: it must go up for the gap to count as cured. */
  appliedAtLanding: number;
  /** Gaps in a row that a snapshot did not cure. */
  uncured: number;
  /** When the first of them happened. */
  since: number | null;
};

const freshCure = (): Cure => ({ awaiting: false, appliedAtLanding: 0, uncured: 0, since: null });

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
 * A snapshot can fail to cure a gap (the server's snapshot lags its event log, or is older than the page). The cure is
 * judged by the reducer's own count of events applied: after a reopen the count must go up, or the gap was not cured.
 * Gaps in a row that were not cured are counted and backed off on the stream's schedule. After 5 minutes the page
 * gives up: the stream is closed, nothing more is requested, and only a manual `refetch` starts again.
 */
export function useInvestigation(id: string, options: UseInvestigationOptions = {}): UseInvestigation {
  const { live } = options;
  // Injected functions are read through a ref, so a new function on every render does not restart the stream.
  const injected = useRef(options);
  injected.current = options;
  // The state lives in a ref as well as in React state, so the stream can learn synchronously whether an event moved it.
  const [state, setState] = useState<InvestigationState>(() => emptyState(id));
  const ref = useRef(state);
  const apply = useCallback((action: Action) => {
    const next = step(ref.current, action);
    if (next !== ref.current) {
      ref.current = next;
      setState(next);
    }
  }, []);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const currentId = useRef(id);
  currentId.current = id;
  const cure = useRef<Cure>(freshCure());
  /** When the last snapshot was asked for because of a gap: a cure cannot make the next one come sooner than the first backoff step. */
  const lastGapFetch = useRef(0);
  const inflight = useRef(0);

  // A different investigation: start from nothing, so nothing of the old one can show on the new.
  useEffect(() => {
    apply({ kind: "reset", id });
    cure.current = freshCure();
    setLoaded(false);
    setError(null);
    setAttempt(0);
    setGeneration(0);
    setGaveUp(false);
  }, [id, apply]);

  /** Reads the snapshot once. Returns the applied-event count at landing when it landed, null when it did not (or is for an old id). */
  const load = useCallback(async (): Promise<number | null> => {
    const asked = id;
    inflight.current += 1;
    let result: Awaited<ReturnType<typeof callApi>>;
    try {
      result = await callApi("investigation", { params: { id: asked } }, injected.current.fetchFn);
    } finally {
      inflight.current -= 1;
    }
    if (currentId.current !== asked) return null; // the page has moved to another investigation: drop this answer
    if (!result.ok) {
      setError(result.code);
      return null;
    }
    const snapshot = InvestigationSnapshot.parse(result.data);
    // The server answered with another investigation's snapshot: it can never cure this page, so it counts as a failed fetch.
    if (snapshot.id !== asked) {
      setError("bad_response");
      return null;
    }
    setError(null);
    apply({ kind: "snapshot", snapshot });
    setLoaded(true);
    return ref.current.applied;
  }, [id, apply]);

  useEffect(() => {
    let cancelled = false;
    void load().then((landed) => {
      if (landed === null && !cancelled && currentId.current === id) apply({ kind: "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [load, id, apply]);

  // An event applied after a snapshot that was fetched for a gap: that snapshot cured it.
  useEffect(() => {
    const c = cure.current;
    if (c.awaiting && !state.gap && state.applied > c.appliedAtLanding) {
      cure.current = freshCure();
      setAttempt(0);
    }
  }, [state.applied, state.gap]);

  // A gap in the ids: ask for the snapshot again, with backoff, and say "reconnecting" if it takes over 3 s.
  const gap = state.gap;
  useEffect(() => {
    if (!gap || gaveUp) return;
    const random = injected.current.random ?? Math.random;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const startedAt = Date.now();
    let reconnecting: ReturnType<typeof setTimeout> | undefined = setTimeout(() => apply({ kind: "connection", status: "reconnecting" }), RECONNECTING_AFTER_MS);

    // A gap that returns right after a snapshot was applied for the last one: the snapshot did not cure it.
    const c = cure.current;
    if (c.awaiting) {
      c.uncured += 1;
      c.since ??= Date.now();
      c.awaiting = false;
      setAttempt(c.uncured);
    }

    /** Stop for good: no timer left, the stream closed (streaming goes false), and the page says the connection is lost. */
    const giveUp = () => {
      clearTimeout(reconnecting);
      reconnecting = undefined;
      clearTimeout(timer);
      setGaveUp(true);
      apply({ kind: "failed" });
    };
    const overdue = () => c.since !== null && Date.now() - c.since >= GIVE_UP_AFTER_MS;

    const attemptLoad = async () => {
      if (overdue()) return giveUp();
      lastGapFetch.current = Date.now();
      const landedAt = await load();
      if (cancelled) return;
      if (landedAt !== null) {
        cure.current = { awaiting: true, appliedAtLanding: landedAt, uncured: c.uncured, since: c.since };
        setAttempt(c.uncured); // the failed fetches are over; only gaps a snapshot did not cure still count
        setGeneration((n) => n + 1); // reopen the stream: the server replays from the new snapshot's id
        return;
      }
      tries += 1;
      setAttempt(c.uncured + tries);
      if (Date.now() - startedAt >= GIVE_UP_AFTER_MS || overdue()) return giveUp();
      timer = setTimeout(() => void attemptLoad(), backoff(c.uncured + tries, random));
    };

    // The first try waits its turn: on the backoff for an uncured gap, and in any case at least the first backoff step
    // after the last gap-triggered fetch, so a server that cures every gap and raises the next at once cannot be hammered.
    const floor = Math.max(0, lastGapFetch.current + (BACKOFF_MS[0] as number) - Date.now());
    const wait = Math.max(c.uncured > 0 ? backoff(c.uncured, random) : 0, floor);
    if (wait > 0) timer = setTimeout(() => void attemptLoad(), wait);
    else void attemptLoad();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(reconnecting);
    };
  }, [gap, gaveUp, load, apply]);

  // The stream is closed while a gap is open (nothing could apply, and it would only be asked for the same events
  // again and again) and opened again, from the snapshot's id, when the snapshot has landed.
  const streaming = live !== false && loaded && !gaveUp && !state.gap && state.id === id && isActive(state.status);
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
      lastEventId: () => ref.current.lastEventId,
      onEvent: (event) => {
        const before = ref.current.applied;
        apply({ kind: "event", event });
        // Only an event that moved the page forward proves the connection works.
        return ref.current.applied > before;
      },
      onStatus: (status) => apply({ kind: "connection", status }),
      shouldReconnect: () => isActive(ref.current.status),
      ...(fetchFn ? { fetch: fetchFn } : {}),
    });
    return () => stream.close();
  }, [streaming, id, generation, apply]);

  const refetch = useCallback(() => {
    if (inflight.current > 0) return; // a fetch is already running: a second click changes nothing
    // By hand: forget the failure, and start the whole path again from a clean count.
    cure.current = freshCure();
    setGaveUp(false);
    setAttempt(0);
    apply({ kind: "connection", status: "connecting" });
    void load();
  }, [apply, load]);

  return { state, loading: !loaded && error === null, error, attempt, gaveUp, refetch };
}
