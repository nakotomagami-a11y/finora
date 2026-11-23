"use client";

import { InvestigationSnapshot } from "@finora/api-contract";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { callApi } from "./api.ts";
import { emptyState, fromSnapshot, isActive, reduce, setConnection, type InvestigationState } from "./investigation-reducer.ts";
import { BACKOFF_MS, openEventStream, RECONNECTING_AFTER_MS, type EventStreamOptions, type StreamStatus } from "./sse.ts";

/** After this long without a snapshot the page gives up on the connection and says so (DESIGN.md §9.1). */
export const GIVE_UP_AFTER_MS = 5 * 60 * 1000;

type Action =
  | { kind: "snapshot"; snapshot: InvestigationSnapshot }
  | { kind: "event"; event: Parameters<typeof reduce>[1] }
  | { kind: "connection"; status: StreamStatus }
  | { kind: "failed" };

function step(state: InvestigationState, action: Action): InvestigationState {
  switch (action.kind) {
    case "snapshot":
      // A snapshot older than what is already applied would move the page backwards: keep the newer state.
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
  /** How many times the snapshot has been asked for again after a gap and failed: the banner's "attempt N". */
  attempt: number;
  refetch(): void;
};

/**
 * One open investigation: fetch its snapshot, then follow the event stream (docs/plan/ui-build-plan.md §6.1).
 *
 * When the reducer reports a gap in the event ids, it applies nothing more (so no finding, question or verdict can
 * show before its predecessors). The snapshot is fetched again, and a failed fetch is retried on the stream's
 * backoff until 5 minutes have passed. Once a snapshot lands the stream is closed and opened again, so the server
 * replays every event after the snapshot's id: an event that arrived while the snapshot was loading is not lost.
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

  /** Reads the snapshot once. True when it landed. */
  const load = useCallback(async (): Promise<boolean> => {
    const result = await callApi("investigation", { params: { id } }, injected.current.fetchFn);
    if (!result.ok) {
      setError(result.code);
      return false;
    }
    setError(null);
    dispatch({ kind: "snapshot", snapshot: InvestigationSnapshot.parse(result.data) });
    setLoaded(true);
    return true;
  }, [id]);

  useEffect(() => {
    setLoaded(false);
    let cancelled = false;
    void load().then((ok) => {
      if (!ok && !cancelled) dispatch({ kind: "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // A gap in the ids: ask for the snapshot again, with backoff, and say "reconnecting" if it takes over 3 s.
  const gap = state.gap;
  useEffect(() => {
    if (!gap) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const random = injected.current.random ?? Math.random;
    const startedAt = Date.now();
    let tries = 0;
    const reconnecting = setTimeout(() => dispatch({ kind: "connection", status: "reconnecting" }), RECONNECTING_AFTER_MS);

    const attemptLoad = async () => {
      const ok = await load();
      if (cancelled) return;
      if (ok) {
        setAttempt(0);
        setGeneration((n) => n + 1); // reopen the stream: the server replays from the new snapshot's id
        return;
      }
      tries += 1;
      setAttempt(tries);
      if (Date.now() - startedAt >= GIVE_UP_AFTER_MS) {
        dispatch({ kind: "failed" });
        return;
      }
      const base = BACKOFF_MS[Math.min(tries - 1, BACKOFF_MS.length - 1)] as number;
      timer = setTimeout(() => void attemptLoad(), Math.round(base * (0.8 + 0.4 * random())));
    };
    void attemptLoad();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(reconnecting);
    };
  }, [gap, load]);

  const streaming = live !== false && loaded && isActive(state.status);
  useEffect(() => {
    if (!streaming) return;
    const open = injected.current.openStream ?? openEventStream;
    const fetchFn = injected.current.fetchFn;
    const stream = open({
      url: `/api/v1/investigations/${encodeURIComponent(id)}/events`,
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
