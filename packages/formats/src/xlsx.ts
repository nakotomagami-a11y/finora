// Reads the first two sheets of an XLSX as rows of strings, under the archive limits of
// sanctions.md §4: only the shared strings and the two sheets are inflated, nothing else.
import { ArchiveError, readZip, type ZipBudget, type ZipLimits } from "./zip.ts";
import { attr, decodeXml, elements, withoutComments } from "./xml.ts";

export const XLSX_LIMITS: ZipLimits = { maxMemberBytes: 20 * 1024 * 1024, maxTotalBytes: 40 * 1024 * 1024 };
const MEMBERS = ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"];

/** The spreadsheet format's own bounds: column XFD and row 1,048,576 (S06 security review, SEC-1). */
const MAX_COLUMN = 16_383;
const MAX_ROW = 1_048_576;
/** How far one cell or row may jump past the current length; a sparse jump of millions is an attack. */
const MAX_JUMP = 1_000;

function columnIndex(ref: string): number {
  const letters = /^([A-Z]{1,3})\d*$/.exec(ref)?.[1];
  if (!letters) throw new ArchiveError("bad cell reference");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  if (n - 1 > MAX_COLUMN) throw new ArchiveError("cell reference past the last column");
  return n - 1;
}

/** Puts a value at `index`, refusing an index past the format's bound or a jump far past the end. */
function place<T>(list: T[], index: number, value: T, max: number): void {
  if (!Number.isInteger(index) || index < 0 || index > max || index > list.length + MAX_JUMP) throw new ArchiveError("cell or row reference out of range");
  list[index] = value;
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
      place(cells, ref ? columnIndex(ref) : cells.length, value, MAX_COLUMN);
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
  // One total across both reads, so the archive limit holds for the whole workbook (SEC-10).
  const budget: ZipBudget = { used: 0 };
  const index = readZip(bytes, ["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml"], limits, budget);
  const decode = (m: Map<string, Uint8Array>, name: string) => withoutComments(new TextDecoder().decode(m.get(name) ?? new Uint8Array()));
  const sheet = elements(decode(index, "xl/workbook.xml"), "sheet").find((s) => attr(s.attrs, "name") === sheetName);
  const rid = sheet ? attr(sheet.attrs, "r:id") : null;
  if (!rid) throw new ArchiveError(`no sheet named ${sheetName}`);
  const rel = elements(decode(index, "xl/_rels/workbook.xml.rels"), "Relationship").find((r) => attr(r.attrs, "Id") === rid);
  const target = rel ? attr(rel.attrs, "Target") : null;
  if (!target) throw new ArchiveError(`sheet ${sheetName} has no target`);
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const sheetFile = readZip(bytes, [path], limits, budget).get(path);
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
      place(cells, ref ? columnIndex(ref) : cells.length, type === "s" ? (shared[Number(v)] ?? "") : type === "inlineStr" ? runText(c.inner) : decodeXml(v), MAX_COLUMN);
    }
    place(rows, Number.isInteger(n) && n > 0 ? n - 1 : rows.length, Array.from(cells, (v) => v ?? ""), MAX_ROW - 1);
  }
  return Array.from(rows, (r) => r ?? []);
}
