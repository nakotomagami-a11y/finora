// Reads one worksheet of an xlsx file as a grid of cell texts, by sheet name. Only what the World
// Bank monthly prices file needs: shared strings, inline strings and numbers.
import { readZip } from "./zip.ts";

const decoder = new TextDecoder();
const text = (files: Map<string, Uint8Array>, name: string) => {
  const f = files.get(name);
  return f ? decoder.decode(f) : null;
};

export function unescapeXml(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "amp") return "&";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    const code = k.startsWith("#x") ? Number.parseInt(k.slice(2), 16) : Number.parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}

const runText = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1] ?? "")).join("");

/** Column letters of a cell reference to a 0-based index ("A" → 0, "BR" → 69). */
export function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "";
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** Rows keyed by their 1-based row number; each row maps a column index to the cell's text. */
export function readSheet(xlsx: Uint8Array, sheetName: string): Map<number, Map<number, string>> {
  const files = readZip(xlsx);
  const workbook = text(files, "xl/workbook.xml");
  const rels = text(files, "xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("not an xlsx workbook");
  const sheet = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => m[0]).find((tag) => unescapeXml(/name="([^"]*)"/.exec(tag)?.[1] ?? "") === sheetName);
  const rid = sheet && /r:id="([^"]*)"/.exec(sheet)?.[1];
  if (!rid) throw new Error(`no sheet named ${sheetName}`);
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((tag) => /Id="([^"]*)"/.exec(tag)?.[1] === rid);
  const target = rel && /Target="([^"]*)"/.exec(rel)?.[1];
  if (!target) throw new Error(`sheet ${sheetName} has no target`);
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const xml = text(files, path);
  if (!xml) throw new Error(`sheet file ${path} is missing`);
  const shared = (text(files, "xl/sharedStrings.xml") ?? "").match(/<si>[\s\S]*?<\/si>/g)?.map(runText) ?? [];
  const rows = new Map<number, Map<number, string>>();
  for (const row of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = new Map<number, string>();
    for (const cell of (row[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      if (!ref) continue;
      const body = cell[2] ?? "";
      const type = /t="([^"]*)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: string | undefined;
      if (type === "s" && v !== undefined) value = shared[Number(v)];
      else if (type === "inlineStr") value = runText(body);
      else if (v !== undefined) value = unescapeXml(v);
      if (value !== undefined) cells.set(columnIndex(ref), value);
    }
    rows.set(Number(row[1]), cells);
  }
  return rows;
}
