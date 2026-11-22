// @vitest-environment jsdom
import { InvestigationEvent, InvestigationSnapshot } from "@finora/api-contract";
import { AT } from "@finora/api-contract/samples";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EventStreamOptions } from "./sse.ts";
import { useInvestigation } from "./use-investigation.ts";

const ID = "inv-1";
const base = {
  id: ID,
  subject: { eid: "lv-40003000018", country: "lv", caption: "Example Company 1 SIA" },
  status: "running",
  plan: [{ runId: "run-registry", role: "registry", dependsOn: [] }],
  runs: [{ id: "run-registry", role: "registry", status: "running", usage: { unit: "st", used: 0, held: 0, cap: 0, extensionGranted: false }, startedAt: null, endedAt: null }],
  tasks: [],
  findings: [],
  questions: [],
  verdict: null,
  usage: { unit: "st", used: 0, held: 0, cap: 500_000, extensionGranted: false },
  lastEventId: 3,
};
const snapshot = (over: Record<string, unknown> = {}) => InvestigationSnapshot.parse({ ...base, ...over });
const event = (id: number, type: string, data: unknown) => InvestigationEvent.parse({ id, at: AT, investigationId: ID, type, data });
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
const asFetch = (fn: () => Promise<Response>) => fn as unknown as typeof fetch;

/** A stream the test drives by hand. */
function fakeStream() {
  const opened: EventStreamOptions[] = [];
  const closed: number[] = [];
  return {
    opened,
    closed,
    open: (options: EventStreamOptions) => {
      opened.push(options);
      const index = opened.length - 1;
      return { close: () => closed.push(index) };
    },
  };
}

describe("useInvestigation", () => {
  it("loads the snapshot, then follows the stream from its last event id", async () => {
    const stream = fakeStream();
    const fetchFn = asFetch(() => json(snapshot()));
    const { result } = renderHook(() => useInvestigation(ID, { fetchFn, openStream: stream.open }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.lastEventId).toBe(3);
    await waitFor(() => expect(stream.opened).toHaveLength(1));
    expect(stream.opened[0]?.url).toBe("/api/v1/investigations/inv-1/events");
    expect(stream.opened[0]?.lastEventId()).toBe(3);
  });

  it("applies events from the stream in order, and ignores one it already has", async () => {
    const stream = fakeStream();
    const { result } = renderHook(() => useInvestigation(ID, { fetchFn: asFetch(() => json(snapshot())), openStream: stream.open }));
    await waitFor(() => expect(stream.opened).toHaveLength(1));
    const options = stream.opened[0] as EventStreamOptions;
    act(() => {
      options.onEvent(event(3, "investigation.status", { status: "waiting" }));
      options.onEvent(event(4, "run.status", { runId: "run-registry", status: "done" }));
    });
    expect(result.current.state.status).toBe("running");
    expect(result.current.state.runs["run-registry"]?.status).toBe("done");
    expect(result.current.state.lastEventId).toBe(4);
  });

  it("fetches the snapshot again after a gap, and the stream resumes after the new one", async () => {
    const stream = fakeStream();
    let calls = 0;
    const fetchFn = vi.fn(() => {
      calls += 1;
      return json(calls === 1 ? snapshot() : snapshot({ lastEventId: 9 }));
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useInvestigation(ID, { fetchFn, openStream: stream.open }));
    await waitFor(() => expect(stream.opened).toHaveLength(1));
    act(() => stream.opened[0]?.onEvent(event(7, "investigation.status", { status: "running" })));
    await waitFor(() => expect(result.current.state.lastEventId).toBe(9));
    expect(result.current.state.gap).toBe(false);
    expect(calls).toBe(2);
    expect(stream.opened.at(-1)?.lastEventId()).toBe(9);
  });

  it("reports the connection state, and closes the stream when the investigation is over", async () => {
    const stream = fakeStream();
    const { result } = renderHook(() => useInvestigation(ID, { fetchFn: asFetch(() => json(snapshot())), openStream: stream.open }));
    await waitFor(() => expect(stream.opened).toHaveLength(1));
    act(() => stream.opened[0]?.onStatus("reconnecting"));
    expect(result.current.state.connection).toBe("reconnecting");
    act(() => stream.opened[0]?.onEvent(event(4, "investigation.status", { status: "done" })));
    await waitFor(() => expect(stream.closed).toContain(0));
  });

  it("closes the stream when the page goes away", async () => {
    const stream = fakeStream();
    const { unmount } = renderHook(() => useInvestigation(ID, { fetchFn: asFetch(() => json(snapshot())), openStream: stream.open }));
    await waitFor(() => expect(stream.opened).toHaveLength(1));
    unmount();
    expect(stream.closed).toContain(0);
  });

  it("opens no stream for a finished investigation, or when live is off", async () => {
    const stream = fakeStream();
    const done = renderHook(() => useInvestigation(ID, { fetchFn: asFetch(() => json(snapshot({ status: "done" }))), openStream: stream.open }));
    await waitFor(() => expect(done.result.current.loading).toBe(false));
    const off = renderHook(() => useInvestigation(ID, { live: false, fetchFn: asFetch(() => json(snapshot())), openStream: stream.open }));
    await waitFor(() => expect(off.result.current.loading).toBe(false));
    expect(stream.opened).toHaveLength(0);
  });

  it("names the error code when the snapshot cannot be read, and opens no stream", async () => {
    const stream = fakeStream();
    const fetchFn = asFetch(() => Promise.resolve(new Response(JSON.stringify({ error: { code: "not_found" } }), { status: 404 })));
    const { result } = renderHook(() => useInvestigation(ID, { fetchFn, openStream: stream.open }));
    await waitFor(() => expect(result.current.error).toBe("not_found"));
    expect(result.current.state.connection).toBe("failed");
    expect(stream.opened).toHaveLength(0);
  });
});
