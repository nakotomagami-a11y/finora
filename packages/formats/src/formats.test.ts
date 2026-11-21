import { describe, expect, it } from "vitest";
import { writeXlsx, writeZip } from "./testing/xlsx-writer.ts";
import { CsvError, csvRows } from "./csv.ts";
import { elements, withoutComments } from "./xml.ts";
import { readXlsx, readXlsxSheet } from "./xlsx.ts";
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

describe("csvRows on a cut file", () => {
  it("throws on a quote left open at the end, instead of swallowing the rows after it (qa S4)", () => {
    expect(() => [...csvRows('a,b\n"open,1\nx,y\n')]).toThrow(CsvError);
  });
});

describe("xml helpers", () => {
  it("reads an element whose quoted attribute holds '>'", () => {
    expect(elements('<a note="x > y" id="1">in</a>', "a")).toEqual([{ attrs: ' note="x > y" id="1"', inner: "in" }]);
  });

  it("never matches a tag inside a comment once comments are removed", () => {
    expect(elements(withoutComments("<!-- <a>hidden</a> --><a>shown</a>"), "a").map((e) => e.inner)).toEqual(["shown"]);
  });
});

describe("the archive limits (S04i loader-contract note)", () => {
  it("refuses a member whose checksum does not match", () => {
    const zip = writeZip([{ name: "a.xml", data: utf8("<a/>") }]);
    // Local header (30 bytes) + "a.xml" (5) puts the stored "<a/>" at 35: flip its "a".
    zip[36] = utf8("b")[0]!;
    expect(() => readZip(zip, ["a.xml"], { maxMemberBytes: 1000, maxTotalBytes: 1000 })).toThrow(/checksum/);
  });

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

describe("archive limits hold against lying headers (S22 review M1)", () => {
  /** Rewrites every central-directory entry to declare a 1-byte member. */
  function lie(zip: Uint8Array): Uint8Array {
    const out = new Uint8Array(zip);
    const view = new DataView(out.buffer);
    for (let p = 0; p + 46 <= out.length; p++) if (view.getUint32(p, true) === 0x02014b50) view.setUint32(p + 24, 1, true);
    return out;
  }

  it("refuses members that declare 1 byte each but together inflate past the total", () => {
    const members = ["a", "b", "c", "d", "e", "f"].map((name) => ({ name, data: new Uint8Array(600), deflate: true }));
    const zip = lie(writeZip(members));
    expect(() => readZip(zip, ["a", "b", "c", "d", "e", "f"], { maxMemberBytes: 1000, maxTotalBytes: 2000 })).toThrow(ArchiveError);
  });

  it("caps one member's inflation at what is left of the total, not only at the member limit", () => {
    const zip = lie(writeZip([{ name: "a", data: new Uint8Array(900), deflate: true }, { name: "b", data: new Uint8Array(900), deflate: true }]));
    expect(() => readZip(zip, ["a", "b"], { maxMemberBytes: 1000, maxTotalBytes: 1200 })).toThrow(ArchiveError);
    expect(readZip(zip, ["a"], { maxMemberBytes: 1000, maxTotalBytes: 1200 }).get("a")?.length).toBe(900);
  });
});

describe("readXlsxSheet", () => {
  it("finds a sheet by its name through the workbook relationships, keeping row numbers", () => {
    const enc = (t: string) => new TextEncoder().encode(t);
    const zip = writeZip([
      { name: "xl/workbook.xml", data: enc('<workbook><sheets><sheet name="Notes" r:id="rId1"/><sheet name="Monthly Prices" r:id="rId7"/></sheets></workbook>') },
      { name: "xl/_rels/workbook.xml.rels", data: enc('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId7" Target="worksheets/sheet9.xml"/></Relationships>') },
      { name: "xl/sharedStrings.xml", data: enc("<sst><si><t>Gold</t></si></sst>") },
      { name: "xl/worksheets/sheet1.xml", data: enc("<worksheet><sheetData/></worksheet>") },
      { name: "xl/worksheets/sheet9.xml", data: enc('<worksheet><sheetData><row r="5"><c r="B5" t="s"><v>0</v></c></row><row r="7"><c r="A7" t="inlineStr"><is><t>2026M10</t></is></c><c r="B7"><v>2500</v></c></row></sheetData></worksheet>') },
    ]);
    const rows = readXlsxSheet(zip, "Monthly Prices");
    expect(rows[4]).toEqual(["", "Gold"]);
    expect(rows[6]).toEqual(["2026M10", "2500"]);
    expect(() => readXlsxSheet(zip, "Missing")).toThrow(ArchiveError);
  });
});
