// Layout fixtures for the five lv-vid-* sources (lv-tax.md § Fixtures): the real headers, `,`,
// every field quoted, a byte-order mark and CRLF, as data.gov.lv serves them, over the LV fixture
// companies. VAT and suspension dates are space-padded and suspension codes wrapped in `'…'`, as upstream.
import { lvCsv } from "../fixture-csv.ts";
import { lvFx } from "../fixture-world.ts";

const vid = (header: readonly string[], rows: readonly (readonly string[])[]) => lvCsv(header, rows, { separator: ",", quoteAll: true });
const name = (n: number) => lvFx(n).name;
const code = (n: number) => lvFx(n).code;

/** A letter-prefixed code, as 16 rows of the quarterly file carry. */
export const LV_VID_LETTER_CODE = `X${lvFx(5).code.slice(1)}`;
/** A natural person's VAT number shape: LV and a DDMMYY-dated 11-digit code (built here, never written out). */
export const LV_VID_PERSON_VAT = `LV${["01", "01", "90", "1", "2345"].join("")}`;

export const LV_VID_QUARTERLY_HEADER = ["Registracijas_kods", "Nosaukums", "Taksacijas_gads_ceturksnis", "Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR", "Taja_skaita_PVN_iemaksa", "Taja_skaita_PVN_atmaksa", "Taja_skaita_IIN_summa", "Taja_skaita_VSAOI_summa", "Videjais_nodarbinato_personu_skaits_cilv"];

const quarter = (q: number) => `2026. gada ${q}. ceturksnis`;

export const lvVidQuarterlyCsv = () =>
  vid(LV_VID_QUARTERLY_HEADER, [
    ...[1, 2, 3].flatMap((q) => [
      [code(1), name(1), quarter(q), `${10 + q}.50`, `${4 + q}.25`, "0.00", `${2 + q}.10`, `${3 + q}.20`, String(8 + q)],
      [code(2), name(2), quarter(q), "-1.75", "0.00", "6.40", "0.30", "0.90", q === 2 ? "0" : "1"], // a VAT refund larger than the taxes; never read
      [code(22), name(22), quarter(q), "0.12", "", "0.00", "0.05", "0.07", "1"],
      [code(23), name(23), quarter(q), "250.00", "180.00", "12.00", q === 3 ? "" : "20.00", q === 3 ? "" : "35.00", "42"], // Q3: no labour taxes
    ]),
    [code(4), name(4), quarter(3), "0.80", "0.00", "0.00", "0.20", "0.40", "1"], // a sole trader: the gate drops the row
    [LV_VID_LETTER_CODE, "Fixture Foreign Branch", quarter(3), "1.00", "0.00", "0.00", "0.00", "0.00", "0"],
    [code(3), name(3), "2026. gada 5. ceturksnis", "1.00", "0.00", "0.00", "0.00", "0.00", "0"], // a bad quarter label
  ]);

export const LV_VID_YEARLY_HEADER = ["Registracijas_kods", "Nosaukums", "Taksacijas_gads", "Uznemejdarbibas_forma", "Pamatdarbibas_NACE_kods", "Juridiska_adrese_ATVK_kods", "Juridiska_adrese_ATVK_nosaukums", "Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR", "Taja_skaita_IIN", "Taja_skaita_VSAOI", "Videjais_nodarbinato_personu_skaits_cilv"];

const LTD = "Sabiedrība ar ierobežotu atbildību";

export const lvVidYearlyCsv = () =>
  vid(LV_VID_YEARLY_HEADER, [
    [code(1), name(1), "2023", LTD, "4120", "0010000", "Fixture Town", "40.20", "10.00", "15.00", "9"],
    [code(1), name(1), "2024", LTD, "4110", "0010000", "Fixture Town", "48.60", "12.00", "18.00", "11"], // the newest year's NACE wins
    [code(2), name(2), "2024", LTD, "?     ", "0010000", "Fixture Town", "-3.10", "1.00", "3.00", "0"], // a placeholder NACE
    [code(2), name(2), "2023", LTD, "4941", "0010000", "Fixture Town", "2.00", "1.00", "3.00", "1"],
    [code(23), name(23), "2024", LTD, "4690.", "0010000", "Fixture Town", "1000.00", "80.00", "140.00", "40"], // a trailing dot
    [code(4), name(4), "2024", "Individuālais komersants", "0111", "0010000", "Fixture Town", "1.00", "0.50", "0.50", "1"],
    [code(3), name(3), "20x4", "Akciju sabiedrība", "1071", "0010000", "Fixture Town", "1.00", "0.00", "0.00", "0"], // a bad year
  ]);

export const LV_VID_RATING_HEADER = ["Registracijas_kods", "Nosaukums", "Reitings", "Skaidrojums", "Informacijas_atjaunosanas_datums"];

export const LV_VID_RATING_DATE = "11.11.2026";

export const lvVidRatingCsv = () =>
  vid(LV_VID_RATING_HEADER, [
    [code(1), name(1), "A", "Fiktīvs skaidrojums A", LV_VID_RATING_DATE],
    [code(2), name(2), "B", "Fiktīvs skaidrojums B", LV_VID_RATING_DATE],
    [code(22), name(22), "C", "Fiktīvs skaidrojums C", LV_VID_RATING_DATE],
    [code(6), name(6), "N", "Fiktīvs skaidrojums N", LV_VID_RATING_DATE],
    [code(21), name(21), "J", "Fiktīvs skaidrojums J", LV_VID_RATING_DATE],
    [code(3), name(3), "X", "Fiktīvs skaidrojums X", LV_VID_RATING_DATE], // an unknown letter: kept, counted
    [code(4), name(4), "B", "Fiktīvs skaidrojums B", LV_VID_RATING_DATE], // a sole trader: the gate drops the line
  ]);

export const LV_VID_VAT_HEADER = ["Numurs", "Nosaukums", "Aktivs", "Registrets", "Buvniecibas_pazime", "PVN139_2_pazime", "Izslegts"];

const pad = (date: string) => (date ? ` ${date} ` : "  ");

export const lvVidVatCsv = () =>
  vid(LV_VID_VAT_HEADER, [
    [`LV${code(23)}`, name(23), "nav", pad("01.03.2012"), "Nē", "Nē", pad("30.06.2015")], // two rows for one number, one active
    [`LV${code(23)}`, name(23), "ir", pad("01.07.2016"), "Jā", "Nē", pad("")],
    [`LV${code(1)}`, name(1), "ir", pad("15.04.2014"), "Nē", "Nē", pad("")],
    [`LV${code(2)}`, name(2), "nav", pad("10.10.2010"), "Nē", "Nē", pad("19.11.2026")], // inactive
    [`LV${code(22)}`, name(22), "ir", pad("05.05.2020"), "Nē", "Nē", pad("01.01.2053")], // a removal date in the future: not the as-of
    [`LV${code(4)}`, name(4), "ir", pad("02.02.2022"), "Nē", "Nē", pad("")], // a sole trader: yes / no only
    [LV_VID_PERSON_VAT, "Test Person D", "ir", pad("03.03.2023"), "Nē", "Nē", pad("")], // a natural person's number: never read on
  ]);

export const LV_VID_SUSPENSIONS_HEADER = ["Registracijas_kods", "Nosaukums", "Lemuma_datums", "Aizliegts_veikt_darijumus_no", "Aizliegts_veikt_darijumus_lidz", "Lemuma_par_atjaunosanu_datums"];

const quoted = (n: number) => `'${code(n)}'`;

export const lvVidSuspensionsCsv = () =>
  vid(LV_VID_SUSPENSIONS_HEADER, [
    [quoted(24), name(24), pad("10.10.2026"), "11.10.2026", "", pad("")], // open
    [quoted(1), name(1), pad("01.02.2024"), "02.02.2024", "", pad("01.06.2024")], // restored
    [quoted(2), name(2), pad("01.01.2025"), "02.01.2025 (fiktīva piezīme)", "01.03.2025", pad("")], // a ban that ended; a note after the date
    [quoted(6), name(6), pad("05.05.2019"), "", "", pad("")], // a struck-off company's old suspension
    [quoted(3), name(3), pad("31.02.2026"), "", "", pad("")], // no such date
  ]);
