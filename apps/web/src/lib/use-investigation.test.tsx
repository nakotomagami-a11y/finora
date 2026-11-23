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

  it("loses no event that arrives while the snapshot is loading: the stream is opened again from the snapshot's id", async () => {
    const stream = fakeStream();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const fetchFn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response(JSON.stringify(snapshot()), { status: 200 });
      await gate; // the gap snapshot is slow
      return new Response(JSON.stringify(snapshot({ lastEventId: 5 })), { status: 200 });
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useInvestigation(ID, { fetchFn, openStream: stream.open }));
    await waitFor(() => expect(stream.opened).toHaveLength(1));
    act(() => stream.opened[0]?.onEvent(event(5, "investigation.status", { status: "running" }))); // a gap: 4 is missing
    await waitFor(() => expect(result.current.state.gap).toBe(true));
    // Event 6 arrives while the snapshot is still loading. It cannot be applied yet, and it must not be forgotten.
    act(() => stream.opened[0]?.onEvent(event(6, "investigation.status", { status: "waiting" })));
    expect(result.current.state.status).toBe("running");
    await act(async () => release());
    await waitFor(() => expect(result.current.state.lastEventId).toBe(5));
    // The stream was closed and opened again, and it asks for what comes after the snapshot.
    await waitFor(() => expect(stream.opened).toHaveLength(2));
    expect(stream.closed).toContain(0);
    expect(stream.opened[1]?.lastEventId()).toBe(5);
    // The server replays event 6 on the new stream, and now it applies.
    act(() => stream.opened[1]?.onEvent(event(6, "investigation.status", { status: "waiting" })));
    expect(result.current.state.lastEventId).toBe(6);
    expect(result.current.state.status).toBe("waiting");
    expect(result.current.state.gap).toBe(false);
  });

  it("applies nothing past a gap, so no event shows before its predecessors", async () => {
    const stream = fakeStream();
    let calls = 0;
    const fetchFn = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? new Response(JSON.stringify(snapshot()), { status: 200 }) : new Promise<Response>(() => undefined);
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useInvestigation(ID, { fetchFn, openStream: stream.open }));
    await waitFor(() => expect(stream.opened).toHaveLength(1));
    act(() => {
      stream.opened[0]?.onEvent(event(6, "question", { id: "q1", runId: null, kind: "scope", text: "Which site?", options: [{ id: "a", label: "A" }], defaultOptionId: null, timeoutAt: null, blocks: "run" }));
    });
    expect(result.current.state.gap).toBe(true);
    expect(Object.keys(result.current.state.questions)).toEqual([]);
  });

  describe("a snapshot that fails after a gap", () => {
    const setup = (failures: number) => {
      const stream = fakeStream();
      let calls = 0;
      const fetchFn = vi.fn(async () => {
        calls += 1;
        if (calls === 1) return new Response(JSON.stringify(snapshot()), { status: 200 });
        if (calls <= 1 + failures) return new Response(JSON.stringify({ error: { code: "internal_error" } }), { status: 500 });
        return new Response(JSON.stringify(snapshot({ lastEventId: 5 })), { status: 200 });
      }) as unknown as typeof fetch;
      const hook = renderHook(() => useInvestigation(ID, { fetchFn, openStream: stream.open, random: () => 0.5 }));
      return { stream, hook, calls: () => calls };
    };

    it("is asked for again on the stream's backoff, counts its attempts, says reconnecting after 3 s, and then resumes the stream", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const { stream, hook, calls } = setup(3);
        await waitFor(() => expect(stream.opened).toHaveLength(1));
        act(() => stream.opened[0]?.onEvent(event(5, "investigation.status", { status: "running" })));
        await waitFor(() => expect(calls()).toBe(2)); // the first gap fetch fails
        await waitFor(() => expect(hook.result.current.attempt).toBe(1));
        expect(hook.result.current.state.connection).not.toBe("reconnecting"); // under 3 s
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000); // the first retry, after 1 s: fails
        });
        await waitFor(() => expect(hook.result.current.attempt).toBe(2));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000); // the second retry, after 2 s more: fails
        });
        await waitFor(() => expect(hook.result.current.attempt).toBe(3));
        expect(hook.result.current.state.connection).toBe("reconnecting"); // 3 s without a snapshot
        await act(async () => {
          await vi.advanceTimersByTimeAsync(4000); // the third retry, after 4 s more: it lands
        });
        await waitFor(() => expect(hook.result.current.state.lastEventId).toBe(5));
        expect(hook.result.current.attempt).toBe(0);
        expect(hook.result.current.state.gap).toBe(false);
        await waitFor(() => expect(stream.opened).toHaveLength(2));
      } finally {
        vi.useRealTimers();
      }
    });

    it("gives up after five minutes and says the connection is lost", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const { stream, hook } = setup(1000);
        await waitFor(() => expect(stream.opened).toHaveLength(1));
        act(() => stream.opened[0]?.onEvent(event(5, "investigation.status", { status: "running" })));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 20_000);
        });
        expect(hook.result.current.state.connection).toBe("failed");
        expect(hook.result.current.attempt).toBeGreaterThan(10);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("an event the snapshot cannot cure", () => {
    /** Time passes in one-second steps, each flushed, so the hook's effects run between timers as they do in a page. */
    const advance = async (ms: number) => {
      for (let spent = 0; spent < ms; spent += 1000) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
    };

    /** The server's snapshot lags its log: it never lists run-x, yet the stream replays an event for it, every time. */
    const setup = (curedAfter: number | null) => {
      let fetches = 0;
      let opens = 0;
      const stream: { opened: EventStreamOptions[] } = { opened: [] };
      const fetchFn = vi.fn(async () => {
        fetches += 1;
        const cured = curedAfter !== null && fetches > curedAfter;
        const runs = cured
          ? [...base.runs, { id: "run-x", role: "money", status: "running", usage: { unit: "st", used: 0, held: 0, cap: 0, extensionGranted: false }, startedAt: null, endedAt: null }]
          : base.runs;
        const plan = cured ? [...base.plan, { runId: "run-x", role: "money", dependsOn: [] }] : base.plan;
        return new Response(JSON.stringify(snapshot({ runs, plan })), { status: 200 });
      }) as unknown as typeof fetch;
      const openStream = (options: EventStreamOptions) => {
        opens += 1;
        stream.opened.push(options);
        const timer = setTimeout(() => options.onEvent(event(4, "run.status", { runId: "run-x", status: "done" })), 0);
        return { close: () => clearTimeout(timer) };
      };
      const hook = renderHook(() => useInvestigation(ID, { fetchFn, openStream, random: () => 0.5 }));
      return { hook, fetches: () => fetches, opens: () => opens };
    };

    it("is asked for on the backoff and not in a loop, and the page gives up after five minutes", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const { hook, fetches } = setup(null);
        await advance(60_000);
        // 1, 2, 4, 8 and 15 s apart: under ten snapshots in the first minute, not hundreds.
        expect(fetches()).toBeLessThan(10);
        expect(hook.result.current.attempt).toBeGreaterThanOrEqual(3);
        expect(hook.result.current.state.connection).not.toBe("failed");
        await advance(5 * 60 * 1000);
        expect(hook.result.current.state.connection).toBe("failed");
        const settled = fetches();
        await advance(120_000);
        expect(fetches()).toBe(settled); // it stopped asking
      } finally {
        vi.useRealTimers();
      }
    });

    it("starts the count over once a snapshot cures the gap and an event applies after the reopen", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const { hook } = setup(3); // the fourth snapshot finally lists run-x
        await advance(30_000);
        await waitFor(() => expect(hook.result.current.state.runs["run-x"]?.status).toBe("done"));
        expect(hook.result.current.state.gap).toBe(false);
        expect(hook.result.current.attempt).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("starts from nothing when the investigation id changes, and drops the old one's late answer", async () => {
    const stream = fakeStream();
    let releaseOld!: () => void;
    const oldGate = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/inv-1")) {
        await oldGate; // the old investigation's snapshot is slow
        return new Response(JSON.stringify(snapshot({ id: "inv-1", status: "done", lastEventId: 50 })), { status: 200 });
      }
      return new Response(JSON.stringify(snapshot({ id: "inv-2", status: "running", lastEventId: 7 })), { status: 200 });
    }) as unknown as typeof fetch;
    const { result, rerender } = renderHook(({ id }) => useInvestigation(id, { fetchFn, openStream: stream.open }), { initialProps: { id: "inv-1" } });
    rerender({ id: "inv-2" });
    await waitFor(() => expect(result.current.state.id).toBe("inv-2"));
    await waitFor(() => expect(result.current.state.lastEventId).toBe(7));
    await act(async () => releaseOld());
    // The old answer arrives late and must change nothing.
    expect(result.current.state.id).toBe("inv-2");
    expect(result.current.state.lastEventId).toBe(7);
    expect(result.current.state.status).toBe("running");
  });

  it("ignores an event of another investigation", async () => {
    const stream = fakeStream();
    const { result } = renderHook(() => useInvestigation(ID, { fetchFn: asFetch(() => json(snapshot())), openStream: stream.open }));
    await waitFor(() => expect(stream.opened).toHaveLength(1));
    const other = InvestigationEvent.parse({ id: 4, at: AT, investigationId: "inv-other", type: "investigation.status", data: { status: "failed" } });
    act(() => stream.opened[0]?.onEvent(other));
    expect(result.current.state.status).toBe("running");
    expect(result.current.state.lastEventId).toBe(3);
  });

  it("reports a bad id as a failed load without a request", async () => {
    const fetchFn = vi.fn();
    const stream = fakeStream();
    const { result } = renderHook(() => useInvestigation("..", { fetchFn: fetchFn as unknown as typeof fetch, openStream: stream.open }));
    await waitFor(() => expect(result.current.error).toBe("bad_request"));
    expect(fetchFn).not.toHaveBeenCalled();
    expect(stream.opened).toHaveLength(0);
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
