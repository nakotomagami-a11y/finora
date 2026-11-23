"""Measure every Estonian bulk file and load the fields the reality check needs into SQLite.

Inputs (downloaded by fetch_ariregister.py and fetch_emta.py), under research/.cache/baltics/ee/raw/:
  ariregister/x/*.json, *.csv   e-Business Register open data (CC BY 4.0)
  emta/*.csv                    Tax and Customs Board: taxes paid per quarter, tax debtors (CC BY-SA 3.0)

Outputs, under research/.cache/baltics/ee/:
  stats/<file>.json   per field: occurrences, filled count, null %, types, max date seen
  ee.sqlite           companies, roles, pledges, rulings, reports, key figures, taxes, debtors

Person names, personal codes and contact values are NOT copied into SQLite: only flags
(has name, has hash, has birth date) and counts, which is all the fill-rate work needs.

Usage: python -I research/probes/baltics/ee/build_index.py [--only NAME]
"""

import csv
import json
import re
import sqlite3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from jsonstream import iter_objects  # noqa: E402

csv.field_size_limit(1 << 30)
EE = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "ee"
RAW = EE / "raw"
X = RAW / "ariregister" / "x"
STATS = EE / "stats"
DATE = re.compile(r"^(\d{2})\.(\d{2})\.(\d{4})$")

SCHEMA = """
CREATE TABLE IF NOT EXISTS company(code INTEGER PRIMARY KEY, legal_form TEXT, form_short TEXT, status TEXT,
  reg_date TEXT, closed_date TEXT, has_address INT, has_ads_id INT, vat_no INT, emtak_main TEXT, nace_main TEXT,
  n_activities INT, employees_ar TEXT, has_email INT, has_phone INT, has_web INT, capital TEXT,
  accounting_obliged INT, files_bo INT, n_statuses INT, n_reports_listed INT);
CREATE TABLE IF NOT EXISTS role(code INTEGER, src TEXT, role TEXT, person_type TEXT, has_name INT, has_hash INT,
  has_reg_code INT, has_foreign_code INT, has_birth INT, country TEXT, start TEXT, end TEXT, share_pct TEXT);
CREATE TABLE IF NOT EXISTS pledge(code INTEGER, amount TEXT, status TEXT, start TEXT, end TEXT, n_pledgees INT);
CREATE TABLE IF NOT EXISTS ruling(code INTEGER, ruling_date TEXT, kind TEXT, entry_type TEXT, entry_text TEXT, state TEXT);
CREATE TABLE IF NOT EXISTS report(report_id INTEGER PRIMARY KEY, code INTEGER, year INT, period_end TEXT,
  submitted TEXT, consolidated TEXT, audited TEXT, category TEXT, auditor_present INT);
CREATE TABLE IF NOT EXISTS element(report_id INTEGER, tbl TEXT, name TEXT, value REAL);
CREATE TABLE IF NOT EXISTS tax(code INTEGER, kind TEXT, year INT, q INT, state_taxes REAL, labour_taxes REAL,
  turnover REAL, employees REAL, as_of TEXT);
CREATE TABLE IF NOT EXISTS debtor(code INTEGER, as_of TEXT, debt REAL, disputed REAL, scheduled REAL,
  schedule_end TEXT, oldest_due TEXT);
"""


def iso(d):
    m = DATE.match(d or "")
    return f"{m[3]}-{m[2]}-{m[1]}" if m else None


def filled(v):
    return v not in (None, "", [], {})


class Stats:
    def __init__(self, name):
        self.name, self.top, self.fields, self.t0 = name, 0, {}, time.time()

    def add(self, obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                p = f"{path}.{k}" if path else k
                if isinstance(v, (dict, list)):
                    self.add(v, p)
                else:
                    self._leaf(p, v)
        elif isinstance(obj, list):
            for item in obj:
                self.add(item, path + "[]")

    def _leaf(self, p, v):
        f = self.fields.setdefault(p, {"n": 0, "filled": 0, "types": set(), "max_date": None})
        f["n"] += 1
        if filled(v):
            f["filled"] += 1
            f["types"].add(type(v).__name__)
            if isinstance(v, str) and (d := iso(v)) and d <= "2027-12-31" and (f["max_date"] or "") < d:
                f["max_date"] = d

    def save(self, extra=None):
        STATS.mkdir(parents=True, exist_ok=True)
        out = {"file": self.name, "top_level_records": self.top, "seconds": round(time.time() - self.t0), **(extra or {}),
               "fields": {p: {"n": f["n"], "null_pct": round(100 * (1 - f["filled"] / f["n"]), 1) if f["n"] else None,
                              "types": sorted(f["types"]), "max_date": f["max_date"]} for p, f in self.fields.items()}}
        (STATS / f"{self.name}.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
        print(self.name, self.top, "records", out["seconds"], "s", file=sys.stderr)


def stream(name, db, handle):
    st = Stats(name)
    for obj in iter_objects(X / name):
        st.top += 1
        st.add(obj)
        handle(db, obj)
    st.save()
    db.commit()


def general(db, o):
    y = o.get("yldandmed") or {}
    contacts = {c.get("liik") for c in y.get("sidevahendid") or [] if not c.get("lopp_kpv")}
    acts = [a for a in y.get("teatatud_tegevusalad") or [] if not a.get("lopp_kpv")]
    main = next((a for a in acts if a.get("on_pohitegevusala")), acts[0] if acts else {})
    reports = y.get("info_majandusaasta_aruannetest") or []
    latest = max(reports, key=lambda r: iso(r.get("majandusaasta_perioodi_lopp_kpv")) or "", default={})
    addr = next((a for a in y.get("aadressid") or [] if not a.get("lopp_kpv")), {})
    cap = next((c for c in y.get("kapitalid") or [] if not c.get("lopp_kpv")), {})
    db.execute("INSERT OR REPLACE INTO company(code, legal_form, form_short, status, reg_date, closed_date, has_address,"
               " has_ads_id, emtak_main, nace_main, n_activities, employees_ar, has_email, has_phone, has_web, capital,"
               " accounting_obliged, files_bo, n_statuses, n_reports_listed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
               (o["ariregistri_kood"], y.get("oiguslik_vorm_tekstina"), y.get("oiguslik_vorm"), y.get("staatus"),
                iso(y.get("esmaregistreerimise_kpv")), iso(y.get("kustutamise_kpv")),
                int(filled(addr.get("tanav_maja_korter"))), int(filled(addr.get("aadress_ads__adr_id"))),
                main.get("emtak_kood"), main.get("nace_kood"), len(acts), latest.get("tootajate_arv"),
                int("EMAIL" in contacts), int(bool(contacts & {"TEL", "MOB"})), int(bool(contacts & {"WWW"})),
                cap.get("kapitali_suurus"), int(bool(y.get("on_raamatupidamiskohustuslane"))),
                int(bool(y.get("esitab_kasusaajad"))), len(y.get("staatused") or []), len(reports)))


def roles(src, key):
    def handle(db, o):
        rows = []
        for p in o.get(key) or []:
            name = p.get("nimi_arinimi") or p.get("nimi")
            rows.append((o["ariregistri_kood"], src, p.get("isiku_roll") or p.get("kontrolli_teostamise_viis"),
                         p.get("isiku_tyyp"), int(filled(name)), int(filled(p.get("isikukood_hash"))),
                         int(filled(p.get("isikukood_registrikood"))), int(filled(p.get("valis_kood"))),
                         int(filled(p.get("synniaeg"))), p.get("aadress_riik") or p.get("valis_kood_riik"),
                         iso(p.get("algus_kpv")), iso(p.get("lopp_kpv")), p.get("osaluse_protsent")))
        db.executemany("INSERT INTO role VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return handle


def pledges(db, o):
    for p in o.get("kommertspandiandmed") or []:
        db.execute("INSERT INTO pledge VALUES (?,?,?,?,?,?)",
                   (o["ariregistri_kood"], p.get("pandi_summa"), p.get("pandi_olek"), iso(p.get("algus_kpv")),
                    iso(p.get("lopp_kpv")), len(p.get("pandipidajad") or [])))


def rulings(db, o):
    db.executemany("INSERT INTO ruling VALUES (?,?,?,?,?,?)",
                   [(o["ariregistri_kood"], iso(m.get("maaruse_kpv")), m.get("maaruse_liik_tekstina"),
                     m.get("kandeliik"), m.get("kandeliik_tekstina"), m.get("maaruse_olek")) for m in o.get("maarused") or []])


def csv_stats(path, name, delimiter, encoding="utf-8-sig", handle=None, db=None):
    st = Stats(name)
    with open(path, encoding=encoding, newline="") as fh:
        r = csv.reader(fh, delimiter=delimiter)
        header = next(r)
        for row in r:
            st.top += 1
            st.add(dict(zip(header, row)))
            if handle:
                handle(db, header, row)
    st.save({"columns": header})


def num(v):
    v = (v or "").replace(" ", "").replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


def basic(db, header, row):
    d = dict(zip(header, row))
    db.execute("UPDATE company SET vat_no=? WHERE code=?", (int(filled(d["kmkr_nr"])), int(d["ariregistri_kood"])))


def report_row(db, header, row):
    d = dict(zip(header, row))
    db.execute("INSERT OR REPLACE INTO report VALUES (?,?,?,?,?,?,?,?,?)",
               (int(d["report_id"]), int(d["registrikood"]), int(d["aruandeaasta"] or 0), iso(d["period_end"]),
                iso(d["esitatud_kpv"]), d["kas konsolideeritud?"], d["kas auditeeritud?"],
                d["valitud aruanne kategooria"], int(filled(d["Audiitorettevõtja (AEV)"]))))


def element_row(db, header, row):
    db.execute("INSERT INTO element VALUES (?,?,?,?)", (int(row[0]), row[1], row[3], num(row[4])))


def tax_row(db, header, row):
    d = dict(zip(header, row))
    if not d["Registrikood"].isdigit():
        return
    for q, roman in enumerate(["I", "II", "III", "IV"], 1):
        vals = [num(d[f"{k} {roman} kv"]) for k in ("Riiklikud maksud", "Tööjõumaksud", "Käive", "Töötajate arv")]
        if any(v is not None for v in vals):
            db.execute("INSERT INTO tax VALUES (?,?,?,?,?,?,?,?,?)",
                       (int(d["Registrikood"]), d["Liik"], int(d["Aasta"]), q, *vals, iso(d["Andmete seis"])))


def debtor_row(db, header, row):
    d = dict(zip(header, row))
    if not d["Registrikood"].isdigit():
        return
    db.execute("INSERT INTO debtor VALUES (?,?,?,?,?,?,?)",
               (int(d["Registrikood"]), iso(d["Andmed on seisuga"]), num(d["Maksuvõlg"]), num(d["sh vaidlustatud"]),
                num(d["sh tasumisgraafikus"]), iso(d["Tasumisgraafiku lõppkuupäev"]),
                iso(d["Vanima tasumata nõude tasumise tähtpäev"])))


JOBS = {
    "yldandmed": lambda db: stream("ettevotja_rekvisiidid__yldandmed.json", db, general),
    "lihtandmed": lambda db: csv_stats(X / "ettevotja_rekvisiidid__lihtandmed.csv", "lihtandmed.csv", ";", handle=basic, db=db),
    "card": lambda db: stream("ettevotja_rekvisiidid__kaardile_kantud_isikud.json", db, roles("card", "kaardile_kantud_isikud")),
    "noncard": lambda db: stream("ettevotja_rekvisiidid__kandevalised_isikud.json", db, roles("noncard", "kaardivalised_isikud")),
    "shareholders": lambda db: stream("ettevotja_rekvisiidid__osanikud.json", db, roles("shareholder", "osanikud")),
    "bo": lambda db: stream("ettevotja_rekvisiidid__kasusaajad.json", db, roles("bo", "kasusaajad")),
    "pledges": lambda db: stream("ettevotja_rekvisiidid__kommertspandid.json", db, pledges),
    "rulings": lambda db: stream("ettevotja_rekvisiidid__maarused.json", db, rulings),
    "cards": lambda db: stream("ettevotja_rekvisiidid__registrikaardid.json", db, lambda db, o: None),
    "reports": lambda db: csv_stats(X / "1.aruannete_yldandmed_kuni_31102026.csv", "aruannete_yldandmed.csv", ";", handle=report_row, db=db),
    "emtak_revenue": lambda db: csv_stats(X / "2.EMTAK_myygitulu_kuni_31102026.csv", "EMTAK_myygitulu.csv", ";"),
    "geo_revenue": lambda db: csv_stats(X / "3.myygitulu_geograafiline_kuni_31102026.csv", "myygitulu_geograafiline.csv", ";"),
    **{f"elements_{y}": (lambda y: lambda db: csv_stats(X / f"4.{y}_aruannete_elemendid_kuni_31102026.csv",
                                                       f"aruannete_elemendid_{y}.csv", ";", handle=element_row, db=db))(y)
       for y in range(2019, 2026)},
    "tax_current": lambda db: csv_stats(RAW / "emta" / "tasutud_maksud_kaesolev_aasta.csv", "emta_tasutud_maksud_kaesolev.csv", ",", handle=tax_row, db=db),
    "tax_previous": lambda db: csv_stats(RAW / "emta" / "tasutud_maksud_varasemad_aastad.csv", "emta_tasutud_maksud_varasemad.csv", ",", handle=tax_row, db=db),
    "debtors": lambda db: csv_stats(RAW / "emta" / "maksuvolglaste_nimekiri.csv", "emta_maksuvolglased.csv", ";", handle=debtor_row, db=db),
}


def main():
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else list(JOBS)
    db = sqlite3.connect(EE / "ee.sqlite")
    db.executescript("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;" + SCHEMA)
    for name in only:
        JOBS[name](db)
        db.commit()
    db.executescript("""
      CREATE INDEX IF NOT EXISTS role_code ON role(code); CREATE INDEX IF NOT EXISTS pledge_code ON pledge(code);
      CREATE INDEX IF NOT EXISTS ruling_code ON ruling(code); CREATE INDEX IF NOT EXISTS report_code ON report(code);
      CREATE INDEX IF NOT EXISTS element_rid ON element(report_id, name); CREATE INDEX IF NOT EXISTS tax_code ON tax(code); CREATE INDEX IF NOT EXISTS tax_yq ON tax(year, q);
      CREATE INDEX IF NOT EXISTS debtor_code ON debtor(code);""")
    db.close()


if __name__ == "__main__":
    main()
