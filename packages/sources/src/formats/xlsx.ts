// Reads the first two sheets of an XLSX as rows of strings, under the archive limits of
// sanctions.md §4: only the shared strings and the two sheets are inflated, nothing else.
import { readZip, type ZipLimits } from "./zip.ts";
import { attr, decodeXml, elements } from "./xml.ts";

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
  const decode = (name: string) => new TextDecoder().decode(members.get(name) ?? new Uint8Array());
  const shared = elements(decode("xl/sharedStrings.xml"), "si").map((si) => runText(si.inner));
  return [sheetRows(decode("xl/worksheets/sheet1.xml"), shared), sheetRows(decode("xl/worksheets/sheet2.xml"), shared)];
}
