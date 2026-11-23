"""Measurements behind the LT loader specs (phase 3), from the files already in the cache.

Usage: python -I research/probes/baltics/lt/spec_checks.py
Prints aggregate lines only:
  [activity]  Statistics Lithuania activity table: fill among active entities, classifier resolution
  [codes]     code shapes in the tax and social-insurance files (9-digit company code, other lengths)
  [gate]      rows the proven-company gate would drop, by reason, per party file
  [natural]   natural-person legal forms: entities, and their share of the debtor lists
  [fs]        statement periods per company, duplicate line IDs per report, amended filings
"""
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

RAW = Path(__file__).resolve().parents[3] / ".cache" / "baltics" / "lt" / "raw"
NATURAL_FORMS = {"810", "811", "812", "210", "211", "212", "220", "221", "222"}
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


def check_digit_ok(code: str) -> bool:
    if len(code) != 9 or not code.isdigit():
        return False
    digits = [int(c) for c in code]
    s = sum(d * w for d, w in zip(digits[:8], range(1, 9))) % 11
    if s == 10:
        s = sum(d * w for d, w in zip(digits[:8], [3, 4, 5, 6, 7, 8, 9, 1])) % 11
        if s == 10:
            s = 0
    return s == digits[8]


def pct(a, b):
    return f"{100 * a / max(b, 1):.1f}%"


def main():
    reg = {r["ja_kodas"]: r for r in rows("rc/JAR_IREGISTRUOTI.csv", "|")}
    dereg = {r["ja_kodas"]: r for r in rows("rc/JAR_ISREGISTRUOTI.csv", "|")}
    forms = {c: r["form_kodas"] for c, r in list(reg.items()) + list(dereg.items())}
    active = {c for c, r in reg.items() if r["stat_kodas"] == "0"}

    evrk = {r["_id"]: r for r in rows("evrk/EkonominesVeiklosRusis.csv")}
    lsd = {r["kodas"]: r for r in rows("ja_asmenys/LsdJuridinisAsmuo.csv")}
    has_act = sum(1 for c in active if lsd.get(c, {}).get("veikla._id"))
    resolves = sum(1 for c in active if lsd.get(c, {}).get("veikla._id") in evrk)
    has_21 = sum(1 for c in active if lsd.get(c, {}).get("evrk_2_1._id"))
    en = sum(1 for c in active if evrk.get(lsd.get(c, {}).get("veikla._id"), {}).get("pavadinimas_en"))
    print(f"[activity] active {len(active)}; in table {pct(sum(1 for c in active if c in lsd), len(active))}; "
          f"activity ref {pct(has_act, len(active))}; resolves in EVRK classifier {pct(resolves, len(active))}; "
          f"English label {pct(en, len(active))}; EVRK 2.1 ref {pct(has_21, len(active))}")
    lengths = Counter(len(r["kodas"]) for r in evrk.values())
    print(f"[activity] EVRK classifier rows {len(evrk)}; code lengths {dict(sorted(lengths.items()))}")

    files = {
        "vmi arrears": [r["ja_kodas"] for r in rows("ja_nepriemokos/NepriemokosSuma.csv")],
        "sodra debts": [p[0] for p in sodra_rows("sodra/Skolos/SKOLA.CSV")],
        "sodra insured": [p[0] for p in sodra_rows("sodra/Apdraustuju_skaicius/APDRAUSTUJU_SKAICIUS.CSV")],
        "sodra monthly": [r["Juridinių asmenų registro kodas (jarCode)"]
                          for r in rows("sodra/m2026/monthly-2026.csv", ";", "utf-8-sig")],
        "vmi taxpayers": [r["ja_kodas"] for r in rows("mm_registras/MokesciuMoketojas.csv")],
        "avnt bankruptcy": [r["imones_kodas"] for r in rows("imoniu_bankrotas/BankrotoAtaskaitosDatos.csv")],
    }
    for name, codes in files.items():
        shapes = Counter("empty" if not c else f"{len(c)} digits" if c.isdigit() else "other" for c in codes)
        gate = Counter()
        for c in codes:
            if not c:
                gate["no_code"] += 1
            elif not check_digit_ok(c):
                gate["invalid_code"] += 1
            elif c not in forms:
                gate["code_not_in_register"] += 1
            elif forms[c] in NATURAL_FORMS:
                gate["natural_person_form"] += 1
            else:
                gate["loaded"] += 1
        print(f"[codes] {name}: rows {len(codes)}; shapes {dict(shapes)}")
        print(f"[gate] {name}: " + ", ".join(f"{k} {v} ({pct(v, len(codes))})" for k, v in gate.most_common()))

    nat_reg = sum(1 for r in reg.values() if r["form_kodas"] in NATURAL_FORMS)
    nat_dereg = sum(1 for r in dereg.values() if r["form_kodas"] in NATURAL_FORMS)
    print(f"[natural] natural-person forms: registered {nat_reg} ({pct(nat_reg, len(reg))}), deregistered {nat_dereg}")

    uuid_to_code = {r["_id"]: r["ja_kodas"] for r in rows("iregistruoti/JuridinisAsmuo.csv")}
    reports = defaultdict(lambda: defaultdict(list))
    filings = defaultdict(set)
    for path in ("pelno_ataskaitos/PelnoAtaskaita_2024plus.csv", "balanso_ataskaitos/BalansoAtaskaita_2024plus.csv"):
        for r in rows(path):
            key = (r["juridinis_asmuo._id"], r["laikotarpis_iki"])
            reports[key][r["line_type_id"]].append(r["reiksme"])
            filings[key].add(r["reg_date"])
    dup = sum(1 for lines in reports.values() if any(len(v) > 1 for v in lines.values()))
    amended = sum(1 for f in filings.values() if len(f) > 1)
    ends_by_company = defaultdict(set)
    for u, end in reports:
        ends_by_company[u].add(end)
    periods = Counter(len(e) for e in ends_by_company.values())
    unresolved = sum(1 for (u, _) in reports if u not in uuid_to_code)
    print(f"[fs] reports (company, period end) since 2024: {len(reports)}; with a repeated line ID {dup} "
          f"({pct(dup, len(reports))}); with more than one filing date {amended} ({pct(amended, len(reports))}); "
          f"company UUID not in the register copy {unresolved}")
    print(f"[fs] periods per company since 2024: {dict(sorted(periods.items()))}")


if __name__ == "__main__":
    main()
