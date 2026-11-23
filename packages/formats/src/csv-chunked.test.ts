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

  it("handles a 400k-character field in 1-character chunks in linear time (N7)", { timeout: 60_000 }, () => {
    // Quadratic re-parsing would take hours here; linear parsing takes well under a second.
    const big = `a,"${"x".repeat(400_000)}"\n1,2\n`;
    expect([...csvRowsChunked(big.split(""))].map((r) => r[1]!.length)).toEqual([400_000, 1]);
  });

  it("agrees with csvRows on 5,000 seeded random CSV texts split into random chunks, errors included", () => {
    let seed = 20261122;
    const next = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    const alphabet = ['"', '"', ",", ";", "\n", "\r", "a", "b", "1", " ", "\uFEFF"];
    const outcome = (run: () => string[][]) => {
      try {
        return run();
      } catch (error) {
        return (error as Error).name;
      }
    };
    for (let k = 0; k < 5_000; k++) {
      const text = Array.from({ length: next(40) }, () => alphabet[next(alphabet.length)]!).join("");
      const chunks: string[] = [];
      for (let i = 0; i < text.length; ) {
        const size = 1 + next(4);
        chunks.push(text.slice(i, i + size));
        i += size;
      }
      expect(outcome(() => [...csvRowsChunked(chunks)]), JSON.stringify(text)).toEqual(outcome(() => [...csvRows(text)]));
    }
  });
});
