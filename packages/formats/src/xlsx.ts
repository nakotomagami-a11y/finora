// Reads the first two sheets of an XLSX as rows of strings, under the archive limits of
// sanctions.md §4: only the shared strings and the two sheets are inflated, nothing else.
import { ArchiveError, readZip, type ZipLimits } from "./zip.ts";
import { attr, decodeXml, elements, withoutComments } from "./xml.ts";

export const XLSX_LIMITS: ZipLimits = { maxMemberBytes: 20 * 1024 * 1024, maxTotalBytes: 40 * 1024 * 1024 };
const MEMBERS = ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"];

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const runText = (xml: string) => elements(xml, "t").map((t) => decodeXml(t.inner)).join("");

function sheetRows(xml: string, shared: readonly string[]): string[][] {
  return elements(xml, "row").map((row) => {
    const cells: string[] = [];
    for (const c of elements(row.inner, "c")) {
      const ref = attr(c.attrs, "r");
      const type = attr(c.attrs, "t");
      const v = elements(c.inner, "v")[0]?.inner ?? "";
      const value = type === "s" ? (shared[Number(v)] ?? "") : type === "inlineStr" ? runText(c.inner) : decodeXml(v);
      cells[ref ? columnIndex(ref) : cells.length] = value;
    }
    return Array.from(cells, (v) => v ?? "");
  });
}

/** Sheets 1 and 2 (sheet 2 empty when absent), each as rows of cell strings. */
export function readXlsx(bytes: Uint8Array): string[][][] {
  const members = readZip(bytes, MEMBERS, XLSX_LIMITS);
  const decode = (name: string) => withoutComments(new TextDecoder().decode(members.get(name) ?? new Uint8Array()));
  const shared = elements(decode("xl/sharedStrings.xml"), "si").map((si) => runText(si.inner));
  return [sheetRows(decode("xl/worksheets/sheet1.xml"), shared), sheetRows(decode("xl/worksheets/sheet2.xml"), shared)];
}

/**
 * One sheet, found by its name through the workbook and its relationships (a sheet's file number
 * need not match its position). Rows keep their row numbers: row n is at index n - 1.
 */
export function readXlsxSheet(bytes: Uint8Array, sheetName: string, limits: ZipLimits = XLSX_LIMITS): string[][] {
  const index = readZip(bytes, ["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml"], limits);
  const decode = (m: Map<string, Uint8Array>, name: string) => withoutComments(new TextDecoder().decode(m.get(name) ?? new Uint8Array()));
  const sheet = elements(decode(index, "xl/workbook.xml"), "sheet").find((s) => decodeXml(attr(s.attrs, "name") ?? "") === sheetName);
  const rid = sheet ? attr(sheet.attrs, "r:id") : null;
  if (!rid) throw new ArchiveError(`no sheet named ${sheetName}`);
  const rel = elements(decode(index, "xl/_rels/workbook.xml.rels"), "Relationship").find((r) => attr(r.attrs, "Id") === rid);
  const target = rel ? attr(rel.attrs, "Target") : null;
  if (!target) throw new ArchiveError(`sheet ${sheetName} has no target`);
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const sheetFile = readZip(bytes, [path], limits).get(path);
  if (!sheetFile) throw new ArchiveError(`sheet file ${path} is missing`);
  const shared = elements(decode(index, "xl/sharedStrings.xml"), "si").map((si) => runText(si.inner));
  const xml = withoutComments(new TextDecoder().decode(sheetFile));
  const rows: string[][] = [];
  for (const row of elements(xml, "row")) {
    const n = Number(attr(row.attrs, "r"));
    const cells: string[] = [];
    for (const c of elements(row.inner, "c")) {
      const ref = attr(c.attrs, "r");
      const type = attr(c.attrs, "t");
      const v = elements(c.inner, "v")[0]?.inner ?? "";
      cells[ref ? columnIndex(ref) : cells.length] = type === "s" ? (shared[Number(v)] ?? "") : type === "inlineStr" ? runText(c.inner) : decodeXml(v);
    }
    rows[Number.isInteger(n) && n > 0 ? n - 1 : rows.length] = Array.from(cells, (v) => v ?? "");
  }
  return Array.from(rows, (r) => r ?? []);
}
