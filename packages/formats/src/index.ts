// File-format readers shared by `sources` and `markets` (one set of archive limits; S22 review M1).
export { columns, CsvError, csvRows, csvRowsChunked } from "./csv.ts";
export { attr, decodeXml, elements, text, withoutComments, XmlError } from "./xml.ts";
export { readXlsx, readXlsxSheet, XLSX_LIMITS } from "./xlsx.ts";
export { ArchiveError, readZip, type ZipBudget, type ZipLimits } from "./zip.ts";
