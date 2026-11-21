// S06 and S22 security review (docs/plan/reviews/slices/S06.md): SEC-1, SEC-2, SEC-6, SEC-9, SEC-10.
import { describe, expect, it } from "vitest";
import { writeXlsx, writeZip } from "./testing/xlsx-writer.ts";
import { CsvError, csvRows, MAX_FIELDS } from "./csv.ts";
import { elements, withoutComments, XmlError } from "./xml.ts";
import { readXlsx, readXlsxSheet, XLSX_LIMITS } from "./xlsx.ts";
import { ArchiveError, readZip } from "./zip.ts";

const utf8 = (s: string) => new TextEncoder().encode(s);
const sheetXml = (rows: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
const xlsxWith = (sheet1: string) =>
  writeZip([
    { name: "xl/sharedStrings.xml", data: utf8('<sst><si><t>x</t></si></sst>') },
    { name: "xl/worksheets/sheet1.xml", data: utf8(sheetXml(sheet1)) },
  ]);
const workbookWith = (sheet: string) =>
  writeZip([
    { name: "xl/workbook.xml", data: utf8('<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>') },
    { name: "xl/_rels/workbook.xml.rels", data: utf8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
    { name: "xl/sharedStrings.xml", data: utf8("<sst><si><t>x</t></si></sst>") },
    { name: "xl/worksheets/sheet1.xml", data: utf8(sheetXml(sheet)) },
  ]);

describe("SEC-1: XLSX references are bounded", () => {
  it("refuses a row far past the end instead of allocating it (the 578-byte r=300000000 file)", () => {
    expect(() => readXlsxSheet(workbookWith('<row r="300000000"><c r="A300000000" t="s"><v>0</v></c></row>'), "Data")).toThrow(ArchiveError);
  });

  it("refuses a column past XFD, and a cell that jumps far past the row's end", () => {
    expect(() => readXlsx(xlsxWith('<row r="1"><c r="XFE1" t="s"><v>0</v></c></row>'))).toThrow(/last column/);
    expect(() => readXlsx(xlsxWith('<row r="1"><c r="ZZZ1" t="s"><v>0</v></c></row>'))).toThrow(ArchiveError);
    expect(() => readXlsx(xlsxWith('<row r="1"><c r="AXA1" t="s"><v>0</v></c></row>'))).toThrow(/out of range/);
    expect(() => readXlsx(xlsxWith('<row r="1"><c r="1A" t="s"><v>0</v></c></row>'))).toThrow(/bad cell reference/);
  });

  it("still reads a sheet with modest gaps between rows and columns", () => {
    const sheet = readXlsxSheet(workbookWith('<row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="40"><c r="J40" t="s"><v>0</v></c></row>'), "Data");
    expect(sheet).toHaveLength(40);
    expect(sheet[39]?.[9]).toBe("x");
  });
});

describe("SEC-2: the XML helpers scan in linear time", () => {
  it("an opening tag with no '>', repeated over 200 KB, returns at once", () => {
    const hostile = "<row a=1 ".repeat(25_000);
    const t0 = performance.now();
    expect(elements(hostile, "row")).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it("an unterminated comment throws at once instead of scanning", () => {
    const hostile = "<!-- ".repeat(40_000);
    const t0 = performance.now();
    expect(() => withoutComments(hostile)).toThrow(XmlError);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it("many well-formed comments and elements stay fast", () => {
    const xml = "<!-- c --><row r=\"1\">x</row>".repeat(40_000);
    const t0 = performance.now();
    expect(elements(withoutComments(xml), "row")).toHaveLength(40_000);
    expect(performance.now() - t0).toBeLessThan(2_000);
  });
});

describe("SEC-6: CSV rows and fields are capped", () => {
  it("throws on a row with too many fields", () => {
    expect(() => [...csvRows(",".repeat(MAX_FIELDS + 5))]).toThrow(CsvError);
  });

  it("throws on a field longer than the cap, quoted or not", () => {
    const long = "x".repeat(1_000_001);
    expect(() => [...csvRows(`a,${long}\n`)]).toThrow(/too long/);
    expect(() => [...csvRows(`a,"${long}"\n`)]).toThrow(/too long/);
  });
});

describe("SEC-9 and SEC-10", () => {
  it("throws on a duplicate wanted member", () => {
    const zip = writeZip([
      { name: "a.xml", data: utf8("<a/>") },
      { name: "a.xml", data: utf8("<b/>") },
    ]);
    expect(() => readZip(zip, ["a.xml"], XLSX_LIMITS)).toThrow(/duplicate/);
  });

  it("carries the total across both reads of one workbook", () => {
    const filler = new Uint8Array(700);
    const zip = writeZip([
      { name: "xl/workbook.xml", data: utf8('<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>') },
      { name: "xl/_rels/workbook.xml.rels", data: utf8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
      { name: "xl/sharedStrings.xml", data: filler },
      { name: "xl/worksheets/sheet1.xml", data: new Uint8Array(700) },
    ]);
    expect(() => readXlsxSheet(zip, "Data", { maxMemberBytes: 1_000, maxTotalBytes: 1_200 })).toThrow(ArchiveError);
  });

  it("matches a sheet name with an entity once decoded (no double decoding)", () => {
    const zip = writeZip([
      { name: "xl/workbook.xml", data: utf8('<workbook><sheets><sheet name="A &amp;amp; B" sheetId="1" r:id="rId1"/></sheets></workbook>') },
      { name: "xl/_rels/workbook.xml.rels", data: utf8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
      { name: "xl/worksheets/sheet1.xml", data: utf8(sheetXml("")) },
    ]);
    expect(readXlsxSheet(zip, "A &amp; B")).toEqual([]);
    expect(() => readXlsxSheet(zip, "A & B")).toThrow(/no sheet/);
  });

  it("still reads a normal workbook", () => {
    expect(readXlsx(writeXlsx([[["a", "b"]]]))[0]).toEqual([["a", "b"]]);
  });
});
