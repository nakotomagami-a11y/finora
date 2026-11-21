// Writes a minimal XLSX (stored, uncompressed zip members) for tests and the fixture profile: an
// XLSX is a binary, so the LV frozen-assets fixture is built at run time, never committed.
import { crc32, deflateRawSync } from "node:zlib";

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function column(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function sheet(rows: readonly (readonly string[])[], strings: string[]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (value === "") return "";
          strings.push(value);
          return `<c r="${column(c)}${r + 1}" t="s"><v>${strings.length - 1}</v></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export type ZipMember = { name: string; data: Uint8Array; deflate?: boolean };

/** A zip of the given members, stored or deflated; member names are written as given. */
export function writeZip(members: readonly ZipMember[]): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const m of members) {
    const name = Buffer.from(m.name, "utf8");
    const data = m.deflate ? deflateRawSync(m.data) : Buffer.from(m.data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(m.deflate ? 8 : 0, 8);
    header.writeUInt32LE(crc32(m.data), 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(m.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(m.deflate ? 8 : 0, 10);
    entry.writeUInt32LE(crc32(m.data), 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(m.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    chunks.push(header, name, data);
    central.push(entry, name);
    offset += header.length + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, directory, end]));
}

/** An XLSX with up to two sheets of text cells (shared strings), enough for the readers here. */
export function writeXlsx(sheets: readonly (readonly (readonly string[])[])[]): Uint8Array {
  const strings: string[] = [];
  const parts = sheets.map((rows) => sheet(rows, strings));
  const shared = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${escape(s)}</t></si>`).join("")}</sst>`;
  const utf8 = (s: string) => new TextEncoder().encode(s);
  return writeZip([
    { name: "[Content_Types].xml", data: utf8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>') },
    { name: "xl/sharedStrings.xml", data: utf8(shared), deflate: true },
    ...parts.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(xml), deflate: true })),
  ]);
}
