"use client";

import { InvestigationSnapshot } from "@finora/api-contract";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { callApi } from "./api.ts";
import { emptyState, fromSnapshot, isActive, reduce, setConnection, type InvestigationState } from "./investigation-reducer.ts";
import { openEventStream, type EventStreamOptions, type StreamStatus } from "./sse.ts";

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
  /** False shows the snapshot only: a finished investigation, or a fixture. */
  live?: boolean;
};

export type UseInvestigation = {
  state: InvestigationState;
  /** True until the first snapshot arrives. */
  loading: boolean;
  /** The snapshot could not be read: the error code to show. */
  error: string | null;
  refetch(): void;
};

/**
 * One open investigation: fetch its snapshot, then follow the event stream (docs/plan/ui-build-plan.md §6.1). When the
 * reducer reports a gap in the event ids, the snapshot is fetched again and the stream resumes after it, so no finding
 * is lost or doubled. The stream closes when the investigation is over, and with the page.
 */
export function useInvestigation(id: string, options: UseInvestigationOptions = {}): UseInvestigation {
  const { live } = options;
  // Injected functions are read through a ref, so a new function on every render does not restart the stream.
  const injected = useRef(options);
  injected.current = options;
  const [state, dispatch] = useReducer(step, id, emptyState);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(state);
  latest.current = state;

  const load = useCallback(async () => {
    const result = await callApi("investigation", { params: { id } }, injected.current.fetchFn);
    if (!result.ok) {
      setError(result.code);
      dispatch({ kind: "failed" });
      return;
    }
    setError(null);
    dispatch({ kind: "snapshot", snapshot: InvestigationSnapshot.parse(result.data) });
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    setLoaded(false);
    void load();
  }, [load]);

  // A gap in the ids: read the snapshot again; the stream then asks for the events after it.
  useEffect(() => {
    if (state.gap) void load();
  }, [state.gap, load]);

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
  }, [streaming, id]);

  return { state, loading: !loaded && error === null, error, refetch: () => void load() };
}
