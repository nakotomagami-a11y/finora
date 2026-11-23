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

/** A parser for the event-stream text format: feed it chunks, and it calls back for each complete message. */
export function createSseParser(onMessage: (message: SseMessage) => void, onActivity: () => void = () => undefined) {
  let buffer = "";
  let event = "";
  let data: string[] = [];

  const line = (text: string) => {
    if (text === "") {
      if (data.length > 0) onMessage({ event: event || "message", data: data.join("\n") });
      event = "";
      data = [];
      return;
    }
    if (text.startsWith(":")) return; // a comment: the server's heartbeat
    const colon = text.indexOf(":");
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    // `id` and `retry` are not used: the event carries its own id, and the backoff is fixed here.
  };

  return {
    push(chunk: string) {
      onActivity();
      buffer += chunk;
      let match = /\r\n|\n|\r/u.exec(buffer);
      while (match) {
        // A lone "\r" at the very end may be half of "\r\n": wait for the next chunk.
        if (match[0] === "\r" && match.index === buffer.length - 1) break;
        line(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
        match = /\r\n|\n|\r/u.exec(buffer);
      }
    },
  };
}

export type EventStreamOptions = {
  url: string;
  /** The id of the last event the page applied; asked again on every (re)connect. */
  lastEventId: () => number;
  onEvent: (event: InvestigationEvent) => void;
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
      // The backoff starts over only once the server has really sent something. A server that accepts a connection and
      // closes it at once must not be asked again every second for ever.
      attempt = 0;
      options.onEvent(parsed.data);
    }, armSilence);

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
