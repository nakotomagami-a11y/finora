import { InvestigationEvent } from "@finora/api-contract";

/**
 * The client of the investigation event stream (architecture §7.6, docs/plan/ui-build-plan.md §6.1). It reads
 * `text/event-stream` with `fetch`, because `EventSource` cannot send a header or a body, resumes after a drop
 * with `Last-Event-ID` (and `?lastEventId=` as the fallback the server also accepts), backs off 1, 2, 4, 8, 15 s
 * with jitter, treats 45 s of silence as a drop, and tells the page it is `reconnecting` only after 3 s.
 */

export type StreamStatus = "connecting" | "live" | "reconnecting" | "failed";

export const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000] as const;
export const SILENCE_MS = 45_000;
export const RECONNECTING_AFTER_MS = 3000;

export type SseMessage = { event: string; data: string };

/** The most the parser holds for one line or one message: a server that sends more is misbehaving, and is cut off. */
export const MAX_SSE_BYTES = 1024 * 1024;

/**
 * A parser for the event-stream text format: feed it chunks, and it calls back for each complete message. It looks for
 * a line break only in what is new (never in what it already holds), holds at most `MAX_SSE_BYTES` for a line or a message (then calls `onOverflow` and
 * ignores everything after), and reports activity only for a complete line, so a trickle of bytes with no line break
 * cannot keep a connection alive.
 */
export function createSseParser(onMessage: (message: SseMessage) => void, onActivity: () => void = () => undefined, onOverflow: () => void = () => undefined, maxBytes: number = MAX_SSE_BYTES) {
  let parts: string[] = []; // the unfinished line, kept in pieces so nothing is joined or searched twice
  let partsLength = 0;
  let skipLineFeed = false; // the last chunk ended with a carriage return: a line feed first in the next one is its pair
  let event = "";
  let data: string[] = [];
  let dataSize = 0;
  let stopped = false;

  const overflow = () => {
    stopped = true;
    parts = [];
    data = [];
    onOverflow();
  };

  const line = (text: string) => {
    onActivity();
    if (text === "") {
      if (data.length > 0) onMessage({ event: event || "message", data: data.join("\n") });
      event = "";
      data = [];
      dataSize = 0;
      return;
    }
    if (text.startsWith(":")) return; // a comment: the server's heartbeat
    const colon = text.indexOf(":");
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") {
      dataSize += value.length + 1;
      if (dataSize > maxBytes) {
        overflow();
        return;
      }
      data.push(value);
    }
    // `id` and `retry` are not used: the event carries its own id, and the backoff is fixed here.
  };

  return {
    push(chunk: string) {
      if (stopped) return;
      let i = 0;
      if (skipLineFeed) {
        skipLineFeed = false;
        if (chunk.charCodeAt(0) === 10) i = 1;
      }
      let start = i;
      for (; i < chunk.length; i += 1) {
        const c = chunk.charCodeAt(i);
        if (c !== 10 && c !== 13) continue;
        const text = parts.length === 0 ? chunk.slice(start, i) : parts.join("") + chunk.slice(start, i);
        parts = [];
        partsLength = 0;
        if (text.length > maxBytes) {
          overflow();
          return;
        }
        line(text);
        if (stopped) return;
        if (c === 13) {
          if (i + 1 < chunk.length) {
            if (chunk.charCodeAt(i + 1) === 10) i += 1;
          } else skipLineFeed = true;
        }
        start = i + 1;
      }
      // What is left has no line break yet: keep it, unless it is already too large to be a line.
      if (start < chunk.length) {
        const rest = chunk.slice(start);
        parts.push(rest);
        partsLength += rest.length;
        if (partsLength > maxBytes) overflow();
      }
    },
  };
}

export type EventStreamOptions = {
  url: string;
  /** The id of the last event the page applied; asked again on every (re)connect. */
  lastEventId: () => number;
  /**
   * Returns whether the event moved the page forward. The backoff starts over only for an event that did: a duplicate, or
   * an event that raised a gap, proves nothing. Returning nothing counts as moved.
   */
  onEvent: (event: InvestigationEvent) => boolean | void;
  onStatus: (status: StreamStatus) => void;
  /** A message that is not a valid event is dropped, and this says why (never the content). */
  onInvalid?: (reason: string) => void;
  /** Whether to reconnect after the server ends the stream: false once the investigation is over. */
  shouldReconnect?: () => boolean;
  fetch?: typeof fetch;
  random?: () => number;
};

export type EventStream = { close(): void };

export function openEventStream(options: EventStreamOptions): EventStream {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const random = options.random ?? Math.random;
  let closed = false;
  let controller: AbortController | null = null;
  let reconnectingTimer: ReturnType<typeof setTimeout> | undefined;
  let backoffTimer: ReturnType<typeof setTimeout> | undefined;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let wake: (() => void) | undefined;

  const clear = (timer: ReturnType<typeof setTimeout> | undefined) => {
    if (timer !== undefined) clearTimeout(timer);
  };

  const live = () => {
    clear(reconnectingTimer);
    reconnectingTimer = undefined;
    options.onStatus("live");
  };

  const armSilence = () => {
    clear(silenceTimer);
    silenceTimer = setTimeout(() => controller?.abort(), SILENCE_MS);
  };

  const urlFor = () => {
    const last = options.lastEventId();
    if (last <= 0) return options.url;
    const url = new URL(options.url, "http://placeholder.invalid");
    url.searchParams.set("lastEventId", String(last));
    return options.url.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
  };

  /** One connection. Resolves `true` to try again and `false` to stop for good. */
  async function connect(): Promise<boolean> {
    controller = new AbortController();
    const last = options.lastEventId();
    const parser = createSseParser((message) => {
      // The server names each message after the event type; the data is the whole envelope, and is what is checked.
      let json: unknown;
      try {
        json = JSON.parse(message.data);
      } catch {
        options.onInvalid?.("not_json");
        return;
      }
      const parsed = InvestigationEvent.safeParse(json);
      if (!parsed.success) {
        options.onInvalid?.("not_an_event");
        return;
      }
      // The backoff starts over only when the server has sent something that moved the page forward. A server that
      // accepts a connection and closes it at once, or keeps replaying an event that changes nothing, must not be
      // asked again every second for ever.
      if (options.onEvent(parsed.data) !== false) attempt = 0;
    }, armSilence, () => {
      // The server sent a line or a message that is far too large: cut the connection and try again, on the backoff.
      options.onInvalid?.("too_large");
      controller?.abort();
    });

    let response: Response;
    try {
      response = await doFetch(urlFor(), {
        headers: { Accept: "text/event-stream", ...(last > 0 ? { "Last-Event-ID": String(last) } : {}) },
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      return !closed;
    }
    // A refusal that retrying cannot fix (not found, forbidden, bad request) ends the stream.
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      controller.abort(); // free the connection: nobody will read this body
      clear(reconnectingTimer);
      reconnectingTimer = undefined;
      options.onStatus("failed");
      return false;
    }
    if (!response.ok || !response.body) {
      controller.abort();
      return !closed;
    }

    live();
    armSilence();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
    } catch {
      return !closed;
    } finally {
      clear(silenceTimer);
    }
    return !closed && (options.shouldReconnect?.() ?? true);
  }

  async function run() {
    options.onStatus("connecting");
    try {
      while (!closed) {
        const again = await connect();
        if (closed || !again) return;
        // The connection is gone. The page hears about it only if it stays gone for 3 s.
        reconnectingTimer ??= setTimeout(() => options.onStatus("reconnecting"), RECONNECTING_AFTER_MS);
        const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] as number;
        attempt += 1;
        const delay = Math.round(base * (0.8 + 0.4 * random()));
        await new Promise<void>((resolve) => {
          wake = resolve;
          backoffTimer = setTimeout(resolve, delay);
        });
      }
    } finally {
      // However the loop ends, no timer is left to say "reconnecting" after it.
      clear(reconnectingTimer);
      reconnectingTimer = undefined;
    }
  }

  void run();

  return {
    close() {
      closed = true;
      clear(reconnectingTimer);
      clear(backoffTimer);
      clear(silenceTimer);
      controller?.abort();
      wake?.();
    },
  };
}
