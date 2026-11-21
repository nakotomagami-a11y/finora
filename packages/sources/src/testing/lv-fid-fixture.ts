// The LV frozen-assets fixture (sanctions.md §4), built at run time: an XLSX is a binary, so it is
// never committed. Fictional rows with the real column numbering: an LV company on a fixture
// code, a foreign company with a form word, a foreign row with an id but no form word, a natural
// person with a birth date, and an LV code no register holds.
import { writeXlsx } from "./xlsx-writer.ts";

export const LV_FID_HEADER = [
  "1. Sankciju subjekts, kā līdzekļi un saimnieciskie resursi ir iesaldēti",
  "2. Dzimšanas datums / reģistrācijas Nr.",
  "3. Valstspiederība / reģistrācijas valsts",
  "4. Iesaldēto līdzekļu un saimniecisko resursu veids",
  "5. Līdzekļu un saimniecisko resursu iesaldēšanas pamatojums",
  "6. Sankciju sarakstā iekļautās personas vārds, uzvārds vai nosaukums",
  "7. Datums, no kura spēkā ir sankcijas",
  "8. Normatīvais akts",
  "9. FID pārbaudīts",
  "10. Datums, kad FID pirmo reizi publicējis informāciju",
];

export const LV_FID_ROWS: readonly string[][] = [
  ['SIA "Placeholder Bakery 1"', "40103000014", "Latvija", "Naudas līdzekļi; Nekustamais īpašums", "Golfa Listedpersona Sentinela kontrolē", "Sentinel Listedperson Golf", "01.03.2026.", "Regula FX/2026", "Pārbaudīts; saistīts ar Sentinelu Golfu", "05.03.2026."],
  ["OOO Mock Northern Trade", "FX99887766", "Krievija", "Naudas līdzekļi", "Pieder sarakstā iekļautai personai", "Sentinel Listedperson Hotel", "02.04.2026.", "Regula FX/2026", "", "06.04.2026."],
  ["Mock Northern Holder", "FX55443322", "Krievija", "Naudas līdzekļi", "Pieder sarakstā iekļautai personai", "Sentinel Listedperson India", "02.04.2026.", "Regula FX/2026", "", "06.04.2026."],
  ["Sentinel Personfive Echo", "12.03.1965.", "Krievija", "Naudas līdzekļi", "Iekļauts sarakstā", "Sentinel Personfive Echo", "03.05.2026.", "Regula FX/2026", "", "07.05.2026."],
  ['SIA "Unknown Fixture"', "40003999990", "Latvija", "Naudas līdzekļi", "Pieder sarakstā iekļautai personai", "Sentinel Listedperson Juliet", "04.06.2026.", "Regula FX/2026", "", "08.06.2026."],
];

export const LV_FID_AS_OF = "2026-11-16";

/** The XLSX as the portal serves it: a title row, the numbered header, the rows; sheet 2 dates it. */
export function lvFidXlsx(rows: readonly string[][] = LV_FID_ROWS): Uint8Array {
  return writeXlsx([
    [["Sankciju subjekti, kuru līdzekļi iesaldēti Latvijā"], LV_FID_HEADER, ...rows],
    [["Informācija tabulā pēdējo reizi atjaunota 16.11.2026."]],
  ]);
}
