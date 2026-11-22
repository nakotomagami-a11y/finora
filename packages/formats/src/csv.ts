// A small RFC 4180 reader: quoted fields, doubled quotes, line breaks inside quotes, CRLF, a
// leading byte-order mark. Rows come out one at a time, so a large file is never split up front.
// A quote left open at the end of the file throws: it would swallow every row after it (qa S4).
// A row with more than MAX_FIELDS fields, or a field longer than MAX_FIELD_CHARS, throws too: one
// huge row would otherwise take gigabytes before failing (S06 security review, SEC-6).
// `csvRowsChunked` reads the same rows from text chunks, so a file is never decoded whole (S05:
// the LV register as one string cost about 375 MB).

export const MAX_FIELDS = 1_000;
export const MAX_FIELD_CHARS = 1_000_000;
/** The most text one unfinished row may hold while the chunked reader waits for the next chunk. */
export const MAX_ROW_CHARS = 4 * MAX_FIELD_CHARS;

export class CsvError extends Error {
  override name = "csv_malformed";
  readonly code = "csv_malformed";
}

/**
 * One row starting at `start`, and where the next one starts. Not `final`: the text may continue
 * in a later chunk, so a row that reaches the end of the text is unfinished and gives null.
 */
function readRow(text: string, start: number, separator: string, final: boolean): { row: string[]; next: number } | null {
  const n = text.length;
  let i = start;
  const row: string[] = [];
  for (;;) {
    let field = "";
    if (text[i] === '"') {
      i++;
      for (;;) {
        const q = text.indexOf('"', i);
        if (q < 0) {
          if (!final) return null;
          throw new CsvError("a quoted field runs to the end of the file");
        }
        if (field.length + (q - i) > MAX_FIELD_CHARS) throw new CsvError("field too long");
        field += text.slice(i, q);
        i = q + 1;
        // A quote at the end of a chunk may be the first of a doubled quote.
        if (i >= n && !final) return null;
        if (text[i] !== '"') break;
        field += '"';
        i++;
      }
    }
    // Unquoted text, or what follows a closing quote up to the separator (kept, as most readers do).
    let end = i;
    while (end < n && text[end] !== separator && text[end] !== "\n" && text[end] !== "\r") end++;
    if (field.length + (end - i) > MAX_FIELD_CHARS) throw new CsvError("field too long");
    if (end >= n && !final) return null;
    field += text.slice(i, end);
    i = end;
    if (row.length >= MAX_FIELDS) throw new CsvError("too many fields in a row");
    row.push(field);
    if (text[i] !== separator) break;
    i++;
  }
  if (text[i] === "\r") {
    i++;
    if (i >= n && !final) return null;
  }
  if (text[i] === "\n") i++;
  return { row, next: i };
}

export function* csvRows(text: string, separator = ","): Generator<string[]> {
  yield* csvRowsChunked([text], separator);
}

/** The rows of a CSV given as consecutive text chunks (a streamed decode); same rules as `csvRows`. */
export function* csvRowsChunked(chunks: Iterable<string>, separator = ","): Generator<string[]> {
  let buffer = "";
  let pos = 0;
  let started = false;
  const rows = function* (final: boolean): Generator<string[]> {
    if (!started && buffer.length > 0) {
      started = true;
      if (buffer.charCodeAt(0) === 0xfeff) pos = 1;
    }
    while (pos < buffer.length) {
      const read = readRow(buffer, pos, separator, final);
      if (read === null) {
        if (buffer.length - pos > MAX_ROW_CHARS) throw new CsvError("row too long");
        return;
      }
      pos = read.next;
      if (read.row.length === 1 && read.row[0] === "") continue;
      yield read.row;
    }
  };
  for (const chunk of chunks) {
    if (chunk === "") continue;
    buffer = pos === 0 ? buffer + chunk : buffer.slice(pos) + chunk;
    pos = 0;
    yield* rows(false);
  }
  yield* rows(true);
}

/** Column positions by header name; the names it cannot find are returned, so a loader fails `schema_changed`. */
export function columns<const T extends readonly string[]>(header: readonly string[], names: T): { at: Record<T[number], number>; missing: string[] } {
  const at = {} as Record<T[number], number>;
  const missing: string[] = [];
  for (const name of names) {
    const i = header.findIndex((h) => h.trim() === name);
    if (i < 0) missing.push(name);
    at[name as T[number]] = i;
  }
  return { at, missing };
}
