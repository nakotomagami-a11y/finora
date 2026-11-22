// S05: the chunked reader gives the same rows as the whole-text reader, wherever the chunks split.
import { describe, expect, it } from "vitest";
import { CsvError, csvRows, csvRowsChunked, MAX_ROW_CHARS } from "./csv.ts";

const SAMPLE = '﻿a;b;c\r\n"x;1";"say ""hi""";"two\r\nlines"\r\n;;\n"";"";""\r\nlast;row;"q"""';

function splits(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

describe("csvRowsChunked", () => {
  it("reads the same rows as csvRows for every chunk size", () => {
    const whole = [...csvRows(SAMPLE, ";")];
    for (let size = 1; size <= SAMPLE.length; size++) expect([...csvRowsChunked(splits(SAMPLE, size), ";")], `size ${size}`).toEqual(whole);
  });

  it("keeps a byte-order mark out of the first field when it arrives alone, and skips empty chunks", () => {
    expect([...csvRowsChunked(["", "﻿", "a,b\n1,2"])]).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("throws on a quote left open at the end, and on an unfinished row past the row limit", () => {
    expect(() => [...csvRowsChunked(['a,b\n"open', ",1\nx,y\n"])]).toThrow(CsvError);
    const long = function* () {
      yield '"';
      for (let n = 0; n <= MAX_ROW_CHARS; n += 100_000) yield "x".repeat(100_000);
    };
    expect(() => [...csvRowsChunked(long())]).toThrow(CsvError);
  });

  it("reads each character once, however small the chunks (N7)", () => {
    const big = `a,"${"x".repeat(400_000)}"
1,2
`;
    const started = performance.now();
    const rows = [...csvRowsChunked(big.split(""))];
    expect(rows.map((r) => r[1]!.length)).toEqual([400_000, 1]);
    expect(performance.now() - started).toBeLessThan(5_000);
  });
});
