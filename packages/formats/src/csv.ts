// A small RFC 4180 reader: quoted fields, doubled quotes, line breaks inside quotes, CRLF, a
// leading byte-order mark. Rows come out one at a time, so a large file is never split up front.
// A quote left open at the end of the file throws: it would swallow every row after it (qa S4).
// A row with more than MAX_FIELDS fields, or a field longer than MAX_FIELD_CHARS, throws too: one
// huge row would otherwise take gigabytes before failing (S06 security review, SEC-6).

export const MAX_FIELDS = 1_000;
export const MAX_FIELD_CHARS = 1_000_000;

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
