// A small RFC 4180 reader: quoted fields, doubled quotes, line breaks inside quotes, CRLF, a
// leading byte-order mark. Rows come out one at a time, so a large file is never split up front.
// A quote left open at the end of the file throws: it would swallow every row after it (qa S4).
// A row with more than MAX_FIELDS fields, or a field longer than MAX_FIELD_CHARS, throws too: one
// huge row would otherwise take gigabytes before failing (S06 security review, SEC-6).
// `csvRowsChunked` reads the same rows from text chunks, so a file is never decoded whole (S05:
// the LV register as one string cost about 375 MB). It keeps its parser state between chunks, so
// each character is read once however small the chunks are (S05 security re-check, N7).

export const MAX_FIELDS = 1_000;
export const MAX_FIELD_CHARS = 1_000_000;
/** The most text one row may hold across its fields. */
export const MAX_ROW_CHARS = 4 * MAX_FIELD_CHARS;

export class CsvError extends Error {
  override name = "csv_malformed";
  readonly code = "csv_malformed";
}

export function* csvRows(text: string, separator = ","): Generator<string[]> {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;
  while (i < n) {
    const row: string[] = [];
    for (;;) {
      let field = "";
      if (text[i] === '"') {
        i++;
        for (;;) {
          const q = text.indexOf('"', i);
          if (q < 0) throw new CsvError("a quoted field runs to the end of the file");
          if (field.length + (q - i) > MAX_FIELD_CHARS) throw new CsvError("field too long");
          field += text.slice(i, q);
          i = q + 1;
          if (text[i] !== '"') break;
          field += '"';
          i++;
        }
      }
      // Unquoted text, or what follows a closing quote up to the separator (kept, as most readers do).
      let end = i;
      while (end < n && text[end] !== separator && text[end] !== "\n" && text[end] !== "\r") end++;
      if (field.length + (end - i) > MAX_FIELD_CHARS) throw new CsvError("field too long");
      field += text.slice(i, end);
      i = end;
      if (row.length >= MAX_FIELDS) throw new CsvError("too many fields in a row");
      row.push(field);
      if (text[i] !== separator) break;
      i++;
    }
    if (text[i] === "\r") i++;
    if (text[i] === "\n") i++;
    if (row.length === 1 && row[0] === "") continue;
    yield row;
  }
}

/** Where the chunked reader stands between two characters. */
const At = {
  FieldStart: 0,
  Unquoted: 1,
  Quoted: 2,
  /** A quote inside a quoted field: the end of the quotes, or the first of a doubled quote. */
  QuoteInQuoted: 3,
} as const;

/** The rows of a CSV given as consecutive text chunks (a streamed decode); same rules as `csvRows`. */
export function* csvRowsChunked(chunks: Iterable<string>, separator = ","): Generator<string[]> {
  let at: (typeof At)[keyof typeof At] = At.FieldStart;
  let row: string[] = [];
  let field = "";
  let rowChars = 0;
  let afterCr = false;
  let first = true;
  const add = (text: string) => {
    if (field.length + text.length > MAX_FIELD_CHARS) throw new CsvError("field too long");
    rowChars += text.length;
    if (rowChars > MAX_ROW_CHARS) throw new CsvError("row too long");
    field += text;
  };
  const endField = () => {
    if (row.length >= MAX_FIELDS) throw new CsvError("too many fields in a row");
    row.push(field);
    field = "";
  };
  /** The finished row, or null for an empty line. */
  const endRow = (): string[] | null => {
    const done = row;
    row = [];
    rowChars = 0;
    at = At.FieldStart;
    return done.length === 1 && done[0] === "" ? null : done;
  };
  for (let chunk of chunks) {
    if (chunk === "") continue;
    if (first) {
      first = false;
      if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
    }
    const n = chunk.length;
    let i = 0;
    while (i < n) {
      if (afterCr) {
        afterCr = false;
        if (chunk[i] === "\n") {
          i++;
          continue;
        }
      }
      if (at === At.Quoted) {
        const q = chunk.indexOf('"', i);
        add(chunk.slice(i, q < 0 ? n : q));
        if (q < 0) break;
        i = q + 1;
        at = At.QuoteInQuoted;
        continue;
      }
      if (at === At.QuoteInQuoted) {
        if (chunk[i] === '"') {
          add('"');
          i++;
          at = At.Quoted;
          continue;
        }
        at = At.Unquoted;
      } else if (at === At.FieldStart) {
        if (chunk[i] === '"') {
          i++;
          at = At.Quoted;
          continue;
        }
        at = At.Unquoted;
      }
      let end = i;
      while (end < n && chunk[end] !== separator && chunk[end] !== "\n" && chunk[end] !== "\r") end++;
      add(chunk.slice(i, end));
      if (end >= n) break;
      const c = chunk[end];
      i = end + 1;
      endField();
      if (c === separator) {
        at = At.FieldStart;
        continue;
      }
      if (c === "\r") afterCr = true;
      const done = endRow();
      if (done) yield done;
    }
  }
  if (at === At.Quoted) throw new CsvError("a quoted field runs to the end of the file");
  if (at !== At.FieldStart || row.length > 0) {
    endField();
    const done = endRow();
    if (done) yield done;
  }
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
