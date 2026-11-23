import { InvestigationEvent } from "@finora/api-contract";
import { AT } from "@finora/api-contract/samples";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKOFF_MS, createSseParser, openEventStream, RECONNECTING_AFTER_MS, SILENCE_MS, type SseMessage, type StreamStatus } from "./sse.ts";

const frame = (id: number, status = "running") => {
  const event = InvestigationEvent.parse({ id, at: AT, investigationId: "inv-1", type: "investigation.status", data: { status } });
  return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
};

describe("createSseParser", () => {
  const parse = (...chunks: string[]) => {
    const messages: SseMessage[] = [];
    const parser = createSseParser((message) => messages.push(message));
    for (const chunk of chunks) parser.push(chunk);
    return messages;
  };

  it("reads an event name and a data line", () => {
    expect(parse("event: finding\ndata: {}\n\n")).toEqual([{ event: "finding", data: "{}" }]);
  });

  it("joins several data lines, accepts CRLF, and ignores comments and unknown fields", () => {
    expect(parse(": heartbeat\r\nid: 4\r\nretry: 10\r\ndata: a\r\ndata: b\r\n\r\n")).toEqual([{ event: "message", data: "a\nb" }]);
  });

  it("copes with a message split anywhere, even between the CR and the LF", () => {
    const whole = "event: x\r\ndata: one\r\n\r\nevent: y\r\ndata: two\r\n\r\n";
    for (let cut = 1; cut < whole.length; cut += 1) {
      expect(parse(whole.slice(0, cut), whole.slice(cut)), `cut at ${cut}`).toEqual([
        { event: "x", data: "one" },
        { event: "y", data: "two" },
      ]);
    }
  });

  it("does not deliver a message that never ended", () => {
    expect(parse("data: half\n")).toEqual([]);
  });

  it("reports activity for every chunk, comments included", () => {
    let activity = 0;
    const parser = createSseParser(() => undefined, () => (activity += 1));
    parser.push(": heartbeat\n\n");
    parser.push("");
    expect(activity).toBe(2);
  });
});

/** A fetch that serves scripted connections and records how it was called. */
function fakeServer() {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const connections: ReadableStreamDefaultController<Uint8Array>[] = [];
  const statuses: (number | "throw")[] = [];
  const encoder = new TextEncoder();
  const fetchFn = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)) });
    const status = statuses.shift() ?? 200;
    if (status === "throw") return Promise.reject(new TypeError("network"));
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    init?.signal?.addEventListener("abort", () => {
      try {
        controller.error(new DOMException("aborted", "AbortError"));
      } catch {
        // already closed
      }
    });
    connections.push(controller);
    return Promise.resolve(new Response(status === 200 ? body : null, { status }));
  }) as typeof fetch;
  return {
    fetch: fetchFn,
    calls,
    statuses,
    send: (index: number, text: string) => connections[index]?.enqueue(encoder.encode(text)),
    end: (index: number) => connections[index]?.close(),
    connections: () => connections.length,
  };
}

describe("openEventStream", () => {
  let lastId = 0;
  let events: InvestigationEvent[];
  let statuses: StreamStatus[];
  let invalid: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    lastId = 0;
    events = [];
    statuses = [];
    invalid = [];
  });
  afterEach(() => vi.useRealTimers());

  const open = (server: ReturnType<typeof fakeServer>, over: Partial<Parameters<typeof openEventStream>[0]> = {}) =>
    openEventStream({
      url: "/api/v1/investigations/inv-1/events",
      fetch: server.fetch,
      random: () => 0.5, // a jitter factor of exactly 1
      lastEventId: () => lastId,
      onEvent: (event) => {
        events.push(event);
        lastId = event.id;
      },
      onStatus: (status) => statuses.push(status),
      onInvalid: (reason) => invalid.push(reason),
      ...over,
    });

  const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  it("connects, goes live, and delivers each valid event once", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    server.send(0, frame(1) + frame(2, "waiting"));
    await tick(0);
    expect(statuses).toEqual(["connecting", "live"]);
    expect(events.map((e) => e.id)).toEqual([1, 2]);
  });

  it("drops a message that is not JSON or not an event, and says why but never what", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    server.send(0, "data: {nope\n\n" + 'data: {"id":1,"type":"made_up"}\n\n' + frame(1));
    await tick(0);
    expect(invalid).toEqual(["not_json", "not_an_event"]);
    expect(events.map((e) => e.id)).toEqual([1]);
  });

  it("resumes after a drop with Last-Event-ID, and the same id as the query fallback", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    expect(server.calls[0]).toEqual({ url: "/api/v1/investigations/inv-1/events", headers: { Accept: "text/event-stream" } });
    server.send(0, frame(1) + frame(2) + frame(3));
    await tick(0);
    server.end(0);
    await tick(BACKOFF_MS[0]);
    expect(server.calls).toHaveLength(2);
    expect(server.calls[1]?.headers["Last-Event-ID"]).toBe("3");
    expect(server.calls[1]?.url).toBe("/api/v1/investigations/inv-1/events?lastEventId=3");
    server.send(1, frame(4));
    await tick(0);
    expect(events.map((e) => e.id)).toEqual([1, 2, 3, 4]);
  });

  it("backs off 1, 2, 4, 8, 15 and then stays at 15 seconds", async () => {
    const server = fakeServer();
    server.statuses.push(503, 503, 503, 503, 503, 503, 503);
    open(server);
    await tick(0);
    const seen: number[] = [];
    let waited = 0;
    for (const expected of [1000, 2000, 4000, 8000, 15000, 15000]) {
      const before = server.calls.length;
      await tick(expected - 1);
      expect(server.calls.length, `before ${expected}`).toBe(before);
      await tick(1);
      expect(server.calls.length, `at ${expected}`).toBe(before + 1);
      seen.push(expected);
      waited += expected;
    }
    expect(seen).toEqual([...BACKOFF_MS, 15000]);
    expect(waited).toBe(45_000);
  });

  it("applies jitter within 20 percent", async () => {
    const low = fakeServer();
    low.statuses.push(503);
    open(low, { random: () => 0 });
    await tick(0);
    await tick(799);
    expect(low.calls).toHaveLength(1);
    await tick(1);
    expect(low.calls).toHaveLength(2);
  });

  it("tells the page it is reconnecting only after 3 seconds without a connection", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    server.send(0, frame(1));
    await tick(0);
    server.statuses.push(503, 503, 503); // the server stays down
    server.end(0);
    await tick(RECONNECTING_AFTER_MS - 1);
    expect(statuses).not.toContain("reconnecting");
    await tick(1);
    expect(statuses.at(-1)).toBe("reconnecting");
  });

  it("never shows reconnecting when the connection comes back within 3 seconds", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    server.send(0, frame(1));
    await tick(0);
    server.end(0);
    await tick(BACKOFF_MS[0]);
    server.send(1, frame(2));
    await tick(RECONNECTING_AFTER_MS * 2);
    expect(statuses).not.toContain("reconnecting");
    expect(statuses.at(-1)).toBe("live");
  });

  it("goes live again after a reconnect", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    server.statuses.push(503, 503); // down for the first two tries, then back
    server.end(0);
    await tick(RECONNECTING_AFTER_MS + 100);
    expect(statuses.at(-1)).toBe("reconnecting");
    await tick(BACKOFF_MS[1] + BACKOFF_MS[2]);
    expect(statuses.at(-1)).toBe("live");
  });

  it("forces a reconnect after 45 seconds of silence", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    server.send(0, frame(1));
    await tick(SILENCE_MS - 1);
    expect(server.calls).toHaveLength(1);
    await tick(1 + BACKOFF_MS[0]);
    expect(server.calls).toHaveLength(2);
  });

  it("counts a heartbeat as life: 20-second comments keep the connection open", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    for (let i = 0; i < 6; i += 1) {
      await tick(20_000);
      server.send(0, ": heartbeat\n\n");
    }
    expect(server.calls).toHaveLength(1);
  });

  it("stops for good on a refusal that retrying cannot fix", async () => {
    const server = fakeServer();
    server.statuses.push(404);
    open(server);
    await tick(60_000);
    expect(statuses).toEqual(["connecting", "failed"]);
    expect(server.calls).toHaveLength(1);
  });

  it("keeps trying on a server error, a rate limit and a network failure", async () => {
    const server = fakeServer();
    server.statuses.push(500, 429, "throw");
    open(server);
    await tick(1000 + 2000 + 4000 + 10);
    expect(server.calls).toHaveLength(4);
    expect(statuses).not.toContain("failed");
  });

  it("does not reconnect after the server ends a finished investigation", async () => {
    const server = fakeServer();
    open(server, { shouldReconnect: () => false });
    await tick(0);
    server.send(0, frame(1, "done"));
    await tick(0);
    server.end(0);
    await tick(60_000);
    expect(server.calls).toHaveLength(1);
  });

  it("does not start the backoff over for a server that accepts a connection and closes it at once", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    const waits: number[] = [];
    let index = 0;
    for (const expected of [1000, 2000, 4000, 8000]) {
      server.end(index); // accepted, nothing sent, closed
      const before = server.calls.length;
      await tick(expected - 1);
      expect(server.calls.length, `before ${expected}`).toBe(before);
      await tick(1);
      expect(server.calls.length, `at ${expected}`).toBe(before + 1);
      waits.push(expected);
      index += 1;
    }
    expect(waits).toEqual([1000, 2000, 4000, 8000]);
  });

  it("starts the backoff over once the server has sent an event", async () => {
    const server = fakeServer();
    open(server);
    await tick(0);
    server.end(0);
    await tick(1000); // second connection after 1 s
    server.end(1);
    await tick(2000); // third after 2 s
    server.send(2, frame(1)); // a real event
    await tick(0);
    server.end(2);
    const before = server.calls.length;
    await tick(1000); // back to 1 s
    expect(server.calls.length).toBe(before + 1);
  });

  it("frees the connection when the answer is a refusal", async () => {
    const aborted: boolean[] = [];
    const inner = fakeServer();
    inner.statuses.push(404);
    const fetchFn = ((input: RequestInfo | URL, init?: RequestInit) => {
      init?.signal?.addEventListener("abort", () => aborted.push(true));
      return inner.fetch(input, init);
    }) as typeof fetch;
    open({ ...inner, fetch: fetchFn });
    await tick(0);
    expect(statuses.at(-1)).toBe("failed");
    expect(aborted).toEqual([true]);
  });

  it("close() stops the reads, the timers and any later reconnect", async () => {
    const server = fakeServer();
    const stream = open(server);
    await tick(0);
    server.end(0);
    await tick(10);
    stream.close();
    await tick(120_000);
    expect(server.calls).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
