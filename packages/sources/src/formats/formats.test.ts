import { describe, expect, it } from "vitest";
import { writeXlsx, writeZip } from "../testing/xlsx-writer.ts";
import { csvRows } from "./csv.ts";
import { readXlsx } from "./xlsx.ts";
import { ArchiveError, readZip } from "./zip.ts";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("csvRows", () => {
  it("reads quotes, doubled quotes, line breaks in quotes, CRLF and a BOM", () => {
    const text = '\uFEFFa;b;c\r\n"x;1";"say ""hi""";"two\nlines"\r\n;;\n';
    expect([...csvRows(text, ";")]).toEqual([
      ["a", "b", "c"],
      ["x;1", 'say "hi"', "two\nlines"],
      ["", "", ""],
    ]);
  });
});

describe("the archive limits (S04i loader-contract note)", () => {
  const limits = { maxMemberBytes: 1000, maxTotalBytes: 1500 };

  it("reads the wanted members only", () => {
    const zip = writeZip([
      { name: "a.xml", data: utf8("<a/>") },
      { name: "b.xml", data: utf8("<b/>"), deflate: true },
    ]);
    const out = readZip(zip, ["b.xml"], limits);
    expect([...out.keys()]).toEqual(["b.xml"]);
    expect(new TextDecoder().decode(out.get("b.xml"))).toBe("<b/>");
  });

  it("refuses a member path that climbs out, uses a backslash or is absolute", () => {
    // A drive-letter member name, built here so the repository holds no machine path.
    const drive = `${String.fromCharCode(90)}:/evil`;
    for (const name of ["../evil.xml", "xl/../../evil.xml", "xl\\evil.xml", "/etc/evil", drive]) {
      expect(() => readZip(writeZip([{ name, data: utf8("x") }]), ["a"], limits), name).toThrow(ArchiveError);
    }
  });

  it("caps a member's inflated size, whatever its header claims, and the total", () => {
    const bomb = writeZip([{ name: "a.xml", data: new Uint8Array(5000), deflate: true }]);
    expect(() => readZip(bomb, ["a.xml"], limits)).toThrow(ArchiveError);
    // The same member with a central directory that claims 10 bytes: inflation still stops at the cap.
    const view = new DataView(bomb.buffer);
    view.setUint32(view.getUint32(bomb.length - 6, true) + 24, 10, true);
    expect(() => readZip(bomb, ["a.xml"], limits)).toThrow(/inflates past its limit/);
    const two = writeZip([
      { name: "a.xml", data: new Uint8Array(900) },
      { name: "b.xml", data: new Uint8Array(900) },
    ]);
    expect(() => readZip(two, ["a.xml", "b.xml"], limits)).toThrow(ArchiveError);
  });

  it("refuses a file that is not a zip", () => {
    expect(() => readZip(utf8("not a zip at all, just text that is long enough"), ["a"], limits)).toThrow(ArchiveError);
  });
});

describe("readXlsx", () => {
  it("reads both sheets as rows of strings, sparse cells as empty", () => {
    const sheets = readXlsx(writeXlsx([[["a", "", "c & d"], ["1"]], [["sheet two"]]]));
    expect(sheets).toEqual([[["a", "", "c & d"], ["1"]], [["sheet two"]]]);
  });
});
