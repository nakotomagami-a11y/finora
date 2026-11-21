"""Round-2 measurements for Lithuania (load volume, UI facts, search), from the files already in the cache.

Usage: python -I research/probes/baltics/lt/round2.py
Reads research/.cache/baltics/lt/raw/ (see fetch_uapi.py and build_profiles.py for what is there) and prints
labelled aggregate lines only: no names or codes. Sections:
  [volume]     rows, rows we would load, fields kept, statements, MB at 123 bytes per statement
               (the statement-line counts are fixed values from the API's count() on 2026-11-19, because only
               the 2024+ lines are downloaded: ...?laikotarpis_iki>="2021-01-01"&count())
  [address]    share of active register entities whose address the API address join recovers
  [vocab]      status, legal form, document type and management-body counts
  [fiscal]     share of companies whose statement period does not end on 31 December
  [sizes]      longest name and address, board size and member-count percentiles
  [names]      share of companies whose normalised name is shared with another company
"""
import csv
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

RAW = Path(__file__).resolve().parents[3] / ".cache" / "baltics" / "lt" / "raw"
BYTES_PER_STATEMENT = 123
csv.field_size_limit(1 << 30)
sys.stdout.reconfigure(encoding="utf-8")


def rows(path, delimiter=",", encoding="utf-8"):
    with open(RAW / path, encoding=encoding, newline="") as fh:
        yield from csv.DictReader(fh, delimiter=delimiter)


def sodra_rows(path):
    with open(RAW / path, encoding="cp1257") as fh:
        for line in fh.read().splitlines()[3:]:
            parts = [p.strip() for p in line.split(";")]
            if parts and parts[0].isdigit():
                yield parts


def pct(part, whole):
    return f"{100 * part / max(whole, 1):.1f}%"


def percentiles(values):
    values = sorted(values)
    if not values:
        return "n/a"
    pick = lambda q: values[min(len(values) - 1, int(q * len(values)))]  # noqa: E731
    return f"p50 {pick(0.5)} / p95 {pick(0.95)} / max {values[-1]} (n {len(values)})"


def count(path, **kw):
    return sum(1 for _ in rows(path, **kw))


def volume(reg, dereg):
    taxes = [r for r in rows("ja_mokesciai/Moketojas.csv") if r["metai"] >= "2024"]
    companies_mm = {r["ja_kodas"] for r in rows("mm_registras/MokesciuMoketojas.csv")}
    sodra_2026 = count("sodra/m2026/monthly-2026.csv", delimiter=";", encoding="utf-8-sig")
    lines = [
        # source, rows total, rows we would load, fields kept, note
        ("JAR daily: registered + deregistered", len(reg) + len(dereg), len(reg) + len(dereg), 9, "all entities"),
        ("JAR daily: management bodies", count("rc/JAR_VALDYMAS.csv", delimiter="|"),
         count("rc/JAR_VALDYMAS.csv", delimiter="|"), 10, "one row per company, current only"),
        ("JAR daily: share capital", count("rc/JAR_KAPITALAS.csv", delimiter="|"),
         count("rc/JAR_KAPITALAS.csv", delimiter="|"), 4, ""),
        ("JAR API: P&L lines", 6643810, 3236907, 6, "periods ending 2021 or later (5 fiscal years)"),
        ("JAR API: balance-sheet lines", None, 5226601, 6, "periods ending 2021 or later; full-table count blocked"),
        ("JAR API: documents (since 2024)", count("dokumentai/Dokumentas.csv"), count("dokumentai/Dokumentas.csv"), 5, ""),
        ("JAR API: non-filers + late filers", count("fa_dokumentu_nepateike/Nepateikes.csv")
         + count("fa_veluojantys/VeluojantisPateikti.csv"), count("fa_dokumentu_nepateike/Nepateikes.csv")
         + count("fa_veluojantys/VeluojantisPateikti.csv"), 3, ""),
        ("JADIS member counts", count("dalyviai/Dalyvis.csv"), count("dalyviai/Dalyvis.csv"), 5, ""),
        ("VMI tax-payer register", count("mm_registras/MokesciuMoketojas.csv"), len(companies_mm), 6,
         "collapsed to one row per company (VAT + main activity)"),
        ("VMI taxes paid", count("ja_mokesciai/Moketojas.csv"), len(taxes), 4, "years 2024-2026 (3 years)"),
        ("VMI tax arrears", count("ja_nepriemokos/NepriemokosSuma.csv"), count("ja_nepriemokos/NepriemokosSuma.csv"), 6, ""),
        ("Sodra daily insured", sum(1 for _ in sodra_rows("sodra/Apdraustuju_skaicius/APDRAUSTUJU_SKAICIUS.CSV")),
         sum(1 for _ in sodra_rows("sodra/Apdraustuju_skaicius/APDRAUSTUJU_SKAICIUS.CSV")), 3, ""),
        ("Sodra daily debts", sum(1 for _ in sodra_rows("sodra/Skolos/SKOLA.CSV")),
         sum(1 for _ in sodra_rows("sodra/Skolos/SKOLA.CSV")), 4, ""),
        ("Sodra monthly (24 months)", sodra_2026, round(sodra_2026 / 9 * 24), 5,
         "estimate: 9 months of 2026 scaled to 24 months (8 quarters)"),
        ("AVNT bankruptcy reports", count("imoniu_bankrotas/BankrotoAtaskaitosDatos.csv"),
         count("imoniu_bankrotas/BankrotoAtaskaitosDatos.csv"), 10, ""),
        ("AVNT intentional bankruptcies", count("tyciniai_bankrotai/TycinisBankrotas.csv"),
         count("tyciniai_bankrotai/TycinisBankrotas.csv"), 5, ""),
        ("EU funds 2014-2020 contracts", count("sutartys/Contract.csv"), count("sutartys/Contract.csv"), 6, ""),
        ("VPT tenderers (to 2023-05)", count("new/Atn1TendererList.csv"), count("new/Atn1TendererList.csv"), 4, ""),
    ]
    total_statements = 0
    print("[volume] source | rows total | rows we would load | fields kept | statements | MB | note")
    for name, total, load, fields, note in lines:
        statements = load * fields
        total_statements += statements
        mb = statements * BYTES_PER_STATEMENT / 1e6
        print(f"[volume] {name} | {total if total is not None else 'unknown'} | {load} | {fields} | {statements} | "
              f"{mb:.0f} | {note}")
    print(f"[volume] TOTAL | | | | {total_statements} | {total_statements * BYTES_PER_STATEMENT / 1e6:.0f} |")


def address(reg):
    active = {c for c, r in reg.items() if r["stat_kodas"] == "0"}
    uuid_to_code = {r["_id"]: r["ja_kodas"] for r in rows("iregistruoti/JuridinisAsmuo.csv")}
    in_api = {r["ja_kodas"] for r in rows("iregistruoti/JuridinisAsmuo.csv")}
    with_row, with_ref = set(), set()
    for r in rows("buveines/Buveine.csv"):
        code = uuid_to_code.get(r["juridinis_asmuo._id"])
        with_row.add(code)
        if r["adresas._id"]:
            with_ref.add(code)
    daily_text = sum(1 for c in active if reg[c]["adresas"])
    print(f"[address] active entities {len(active)}; present in API copy {pct(len(active & in_api), len(active))}")
    print(f"[address] API address join: row {pct(len(active & with_row), len(active))}, "
          f"address-register ref {pct(len(active & with_ref), len(active))}")
    print(f"[address] daily file full-text address {pct(daily_text, len(active))}")


def vocab(reg, dereg):
    status = Counter((r["stat_kodas"], r["stat_pavadinimas"]) for r in reg.values())
    for (code, label), n in status.most_common():
        print(f"[vocab] status {code} | {label} | {n}")
    english = {r["kodas"]: r["name"] for r in rows("formos_statusai/Forma.csv")}
    forms = Counter((r["form_kodas"], r["form_pavadinimas"]) for r in list(reg.values()) + list(dereg.values()))
    for (code, label), n in forms.most_common(25):
        print(f"[vocab] form {code} | {label} | {english.get(code, '')} | {n}")
    print(f"[vocab] forms total distinct {len(forms)}")
    types = {r["_id"]: (r["kodas"], r["pavadinimas"], r["name"]) for r in rows("dokumentu_tipai_potipiai/DokumentoTipas.csv")}
    subtypes = {r["_id"]: (r["kodas"], r["pavadinimas"], r["name"]) for r in rows("dokumentu_tipai_potipiai/DokumentoPotipis.csv")}
    docs = Counter()
    subs = Counter()
    for r in rows("dokumentai/Dokumentas.csv"):
        docs[types.get(r["dokumento_tipas._id"], ("?", "?", "?"))] += 1
        subs[subtypes.get(r["dokumento_potipis._id"], ("?", "?", "?"))] += 1
    for (code, label, en), n in docs.most_common():
        print(f"[vocab] document type {code} | {label} | {en} | {n}")
    for (code, label, en), n in subs.most_common():
        print(f"[vocab] document subtype {code} | {label} | {en} | {n}")
    bodies = Counter()
    for r in rows("rc/JAR_VALDYMAS.csv", delimiter="|"):
        for flag, label in (("vadovas", "manager (vadovas)"), ("valdyba", "board (valdyba)"),
                            ("taryba", "council (taryba)"), ("steb_taryba", "supervisory board (stebėtojų taryba)"),
                            ("kiti_valdymo_organai", "other bodies (kiti valdymo organai)")):
            bodies[label] += r[flag] == "1"
    for label, n in bodies.most_common():
        print(f"[vocab] management body {label} | {n} companies")
    initiators = Counter(r["bankroto_iniciatorius"] for r in rows("imoniu_bankrotas/BankrotoAtaskaitosDatos.csv"))
    for label, n in initiators.most_common():
        print(f"[vocab] bankruptcy initiator | {label or '(empty)'} | {n}")


def fiscal():
    ends = defaultdict(set)
    for path in ("pelno_ataskaitos/PelnoAtaskaita_2024plus.csv", "balanso_ataskaitos/BalansoAtaskaita_2024plus.csv"):
        for r in rows(path):
            ends[r["juridinis_asmuo._id"]].add(r["laikotarpis_iki"][5:])
    off = sum(1 for e in ends.values() if any(x != "12-31" for x in e))
    print(f"[fiscal] companies with a 2024+ statement {len(ends)}; any period not ending 31 Dec {pct(off, len(ends))}")


def sizes(reg, dereg):
    every = list(reg.values()) + list(dereg.values())
    print(f"[sizes] longest legal name {max(len(r['ja_pavadinimas']) for r in every)} chars; "
          f"longest address {max(len(r['adresas']) for r in every)} chars")
    board = []
    for r in rows("rc/JAR_VALDYMAS.csv", delimiter="|"):
        if r["valdyba"] == "1":
            n = sum(int(r[k] or 0) for k in ("vyr_sk_valdyboje", "mot_sk_valdyboje", "nd_apie_lyt_sk_valdyboje"))
            if n:
                board.append(n)
    print(f"[sizes] board members per company with a board: {percentiles(board)}")
    members = [sum(int(float(r[k] or 0)) for k in ("lr_fiziniai", "lr_juridiniai", "uzsienio_fiziniai", "uzsienio_juridiniai"))
               for r in rows("dalyviai/Dalyvis.csv")]
    print(f"[sizes] members per company (JADIS counts): {percentiles([m for m in members if m])}")


FORM_WORDS = None


def normalise(name):
    text = unicodedata.normalize("NFKD", name.casefold())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(FORM_WORDS.sub(" ", text).split())


def names(reg, dereg):
    global FORM_WORDS
    raw_forms = set()
    for r in rows("formos_statusai/Forma.csv"):
        raw_forms.update({r["pavadinimas"], r["pav_ilgas"]})
    raw_forms.update({"uab", "ab", "mb", "ii", "vsi", "ivi", "zub", "kub", "tub", "kb", "ki", "sb", "vi", "bi"})
    words = sorted({" ".join(re.sub(r"[^\w\s]", " ", "".join(
        ch for ch in unicodedata.normalize("NFKD", f.casefold()) if not unicodedata.combining(ch))).split())
        for f in raw_forms if f}, key=len, reverse=True)
    FORM_WORDS = re.compile(r"\b(?:" + "|".join(re.escape(w) for w in words if w) + r")\b")
    active = [c for c, r in reg.items() if r["stat_kodas"] == "0"]
    norm = {c: normalise(r["ja_pavadinimas"]) for c, r in list(reg.items()) + list(dereg.items())}
    norm_active = Counter(norm[c] for c in active)
    norm_all = Counter(norm.values())
    shared_active = sum(1 for c in active if norm_active[norm[c]] > 1)
    shared_all = sum(1 for c in active if norm_all[norm[c]] > 1)
    empty = sum(1 for c in active if not norm[c])
    print(f"[names] active {len(active)}: normalised name shared with another active company {pct(shared_active, len(active))}; "
          f"with any company incl. deregistered {pct(shared_all, len(active))}; empty after normalising {empty}")


def main():
    reg = {r["ja_kodas"]: r for r in rows("rc/JAR_IREGISTRUOTI.csv", delimiter="|")}
    dereg = {r["ja_kodas"]: r for r in rows("rc/JAR_ISREGISTRUOTI.csv", delimiter="|")}
    volume(reg, dereg)
    address(reg)
    vocab(reg, dereg)
    fiscal()
    sizes(reg, dereg)
    names(reg, dereg)


if __name__ == "__main__":
    main()
