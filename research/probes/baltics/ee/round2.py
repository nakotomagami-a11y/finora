"""Round-2 measurements for Estonia: load volumes, UI vocabularies, field sizes, name collisions, headline counts.

Reads research/.cache/baltics/ee/{ee,procurement,notices}.sqlite (build_index.py, procurement.py,
official_notices.py) and the raw register files; writes research/.cache/baltics/ee/round2_stats.json
and prints a HEADLINE block. Output is aggregate only (counts, percentiles, lengths).

Usage: python -I research/probes/baltics/ee/round2.py
"""

import csv
import json
import re
import sqlite3
import sys
import unicodedata
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from jsonstream import iter_objects  # noqa: E402

EE = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "ee"
X = EE / "raw" / "ariregister" / "x"
FORMS = "('OÜ','AS','UÜ','TÜ','TÜH')"
BOARD = "('JUHL','JJUH','N','PROK','LIKV','PANKH','O','FIE')"
LEGAL_WORDS = r"\b(osaühing|oü|aktsiaselts|as|usaldusühing|uü|täisühing|tü|tulundusühistu|tüh|mtü|sa|fie|filiaal)\b"

# Fields we would keep per row (canonical fields + keys + dates), per loaded table.
KEPT = {
    "entity": ["reg_code", "name", "legal_form", "status", "status_since", "reg_date", "address", "ads_adr_id", "ehak",
               "postcode", "vat_no", "emtak_main", "nace_main", "capital", "fy_end", "website", "files_bo", "source_date"],
    "officer": ["reg_code", "record_id", "role", "person_type", "first_name", "surname_or_name", "person_hash",
                "legal_entity_code", "country", "start"],
    "member": ["reg_code", "record_id", "role", "person_type", "first_name", "surname_or_name", "person_hash",
               "legal_entity_code", "country", "share_pct", "share_amount", "currency", "ownership_type", "start"],
    "beneficial_owner": ["reg_code", "record_id", "first_name", "surname", "person_hash", "country", "control_method", "start"],
    "pledge": ["reg_code", "pledge_id", "amount", "currency", "state", "rank", "start", "pledgee_name", "pledgee_code"],
    "ruling": ["reg_code", "ruling_no", "ruling_date", "kind", "entry_type", "state", "in_force_date"],
    "fs_report": ["report_id", "reg_code", "year", "period_start", "period_end", "submitted", "consolidated", "audited", "category"],
    "fs_figure": ["report_id", "element", "value"],
    "tax_quarter": ["reg_code", "year", "quarter", "state_taxes", "labour_taxes", "turnover", "employees", "as_of"],
    "tax_debt": ["reg_code", "as_of", "debt", "disputed", "scheduled", "schedule_end", "oldest_due"],
    "award": ["reg_code", "notice_id", "month", "amount", "buyer"],
    "notice": ["reg_code", "notice_no", "type", "subtype", "published"],
}
FIGURES = ("Revenue", "TotalAnnualPeriodProfitLoss", "Assets", "Equity", "CurrentLiabilities", "NonCurrentLiabilities",
           "AverageNumberOfEmployeesInFullTimeEquivalentUnits", "OperatingProfitLoss", "CashAndCashEquivalents")


def pct(values, p):
    values = sorted(values)
    return values[min(len(values) - 1, int(p / 100 * len(values)))] if values else 0


def dist(rows):
    v = [r[0] for r in rows]
    return {"companies": len(v), "p50": pct(v, 50), "p95": pct(v, 95), "max": max(v) if v else 0}


def norm(name):
    s = re.sub(LEGAL_WORDS, " ", name.casefold())
    s = "".join(ch for ch in unicodedata.normalize("NFKD", s) if not unicodedata.combining(ch))
    s = re.sub(r"[^\w]+", " ", s)
    return " ".join(s.split())


def main():
    db = sqlite3.connect(EE / "ee.sqlite")
    db.execute(f"ATTACH '{EE / 'procurement.sqlite'}' AS p")
    db.execute(f"ATTACH '{EE / 'notices.sqlite'}' AS n")
    q = lambda sql: db.execute(sql).fetchone()[0]
    out = {}

    # A. volumes
    years = [r[0] for r in db.execute("SELECT DISTINCT year FROM report ORDER BY year DESC LIMIT 5")]
    quarters = db.execute("SELECT DISTINCT year, q FROM tax ORDER BY year DESC, q DESC LIMIT 8").fetchall()
    qcond = " OR ".join(f"(year={y} AND q={qq})" for y, qq in quarters)
    ylist = ",".join(map(str, years))
    figs = ",".join(f"'{f}'" for f in FIGURES)
    vol = {
        "entity": (q("SELECT COUNT(*) FROM company"), q("SELECT COUNT(*) FROM company")),
        "officer": (q("SELECT COUNT(*) FROM role WHERE src='card'"), q("SELECT COUNT(*) FROM role WHERE src='card'")),
        "member": (q("SELECT COUNT(*) FROM role WHERE src='shareholder'"), q("SELECT COUNT(*) FROM role WHERE src='shareholder'")),
        "beneficial_owner": (q("SELECT COUNT(*) FROM role WHERE src='bo'"), q("SELECT COUNT(*) FROM role WHERE src='bo'")),
        "pledge": (q("SELECT COUNT(*) FROM pledge"), q("SELECT COUNT(*) FROM pledge")),
        "ruling": (q("SELECT COUNT(*) FROM ruling"), q("SELECT COUNT(*) FROM ruling WHERE ruling_date >= '2021-01-01'")),
        "fs_report": (q("SELECT COUNT(*) FROM report"), q(f"SELECT COUNT(*) FROM report WHERE year IN ({ylist})")),
        "fs_figure": (q("SELECT COUNT(*) FROM element"),
                      q(f"SELECT COUNT(*) FROM element e JOIN report r ON r.report_id=e.report_id WHERE r.year IN ({ylist}) AND e.name IN ({figs})")),
        "tax_quarter": (q("SELECT COUNT(*) FROM tax"), q(f"SELECT COUNT(*) FROM tax WHERE {qcond}")),
        "tax_debt": (q("SELECT COUNT(*) FROM debtor"), q("SELECT COUNT(*) FROM debtor")),
        "award": (q("SELECT COUNT(*) FROM p.award"), q("SELECT COUNT(*) FROM p.award")),
        "notice": (q("SELECT COUNT(*) FROM n.notice"), q("SELECT COUNT(*) FROM n.notice")),
    }
    out["volumes"] = {k: {"rows_total": t, "rows_loaded": l, "fields_kept": len(KEPT[k]), "statements": l * len(KEPT[k]),
                          "mb_at_123B": round(l * len(KEPT[k]) * 123 / 1e6, 1)} for k, (t, l) in vol.items()}
    out["volumes_window"] = {"fs_years": years, "tax_quarters": [f"{y}Q{qq}" for y, qq in quarters], "rulings_since": "2021-01-01"}
    out["volumes_total_mb"] = round(sum(v["mb_at_123B"] for v in out["volumes"].values()), 1)

    # B. vocabularies, history, money, sizes
    out["status"] = dict(db.execute("SELECT status, COUNT(*) FROM company GROUP BY status ORDER BY 2 DESC").fetchall())
    out["legal_forms"] = dict(db.execute("SELECT legal_form, COUNT(*) FROM company GROUP BY legal_form ORDER BY 2 DESC").fetchall())
    out["ruling_kinds"] = dict(db.execute("SELECT kind, COUNT(*) FROM ruling GROUP BY kind ORDER BY 2 DESC").fetchall())
    out["entry_types"] = dict(db.execute("SELECT COALESCE(entry_text,'(none)'), COUNT(*) FROM ruling GROUP BY 1 ORDER BY 2 DESC LIMIT 25").fetchall())
    roles = Counter()
    for fname, key in (("kaardile_kantud_isikud", "kaardile_kantud_isikud"), ("kandevalised_isikud", "kaardivalised_isikud"),
                       ("osanikud", "osanikud")):
        for o in iter_objects(X / f"ettevotja_rekvisiidid__{fname}.json"):
            for p in o.get(key) or []:
                roles[(fname, p.get("isiku_roll"), p.get("isiku_roll_tekstina"))] += 1
    out["roles"] = [{"file": f, "code": c, "label": t, "count": n} for (f, c, t), n in roles.most_common()]
    bo = Counter()
    for o in iter_objects(X / "ettevotja_rekvisiidid__kasusaajad.json"):
        for p in o.get("kasusaajad") or []:
            bo[(p.get("kontrolli_teostamise_viis"), p.get("kontrolli_teostamise_viis_tekstina"))] += 1
    out["bo_control"] = [{"code": c, "label": t, "count": n} for (c, t), n in bo.most_common()]

    out["history"] = {
        "fs_years": [r[0] for r in db.execute("SELECT DISTINCT year FROM report ORDER BY year")],
        "tax_quarters": q("SELECT COUNT(DISTINCT year*10+q) FROM tax"),
        "tax_first": db.execute("SELECT MIN(year), MIN(q) FROM tax WHERE year=(SELECT MIN(year) FROM tax)").fetchone(),
        "roles_with_end_date": q("SELECT COUNT(*) FROM role WHERE end IS NOT NULL"),
    }
    out["fiscal_year"] = {
        "latest_reports": q("SELECT COUNT(*) FROM report r WHERE year=(SELECT MAX(year) FROM report r2 WHERE r2.code=r.code)"),
        "not_calendar": q("SELECT COUNT(*) FROM report r WHERE year=(SELECT MAX(year) FROM report r2 WHERE r2.code=r.code) AND substr(period_end,6,5) <> '12-31'"),
    }
    out["people_per_company"] = {
        "officers": dist(db.execute(f"SELECT COUNT(*) FROM role WHERE src='card' AND role IN {BOARD} GROUP BY code").fetchall()),
        "members": dist(db.execute("SELECT COUNT(*) FROM role WHERE src='shareholder' GROUP BY code").fetchall()),
        "beneficial_owners": dist(db.execute("SELECT COUNT(*) FROM role WHERE src='bo' GROUP BY code").fetchall()),
    }
    active = {r[0] for r in db.execute(f"SELECT code FROM company WHERE status='R' AND form_short IN {FORMS}")}
    name_len = addr_len = 0
    keys_all, keys_active = Counter(), Counter()
    rows = []
    with open(X / "ettevotja_rekvisiidid__lihtandmed.csv", encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            name_len = max(name_len, len(r["nimi"]))
            addr_len = max(addr_len, len(r["ads_normaliseeritud_taisaadress"] or ""))
            k = norm(r["nimi"])
            keys_all[k] += 1
            rows.append((int(r["ariregistri_kood"]), k))
    for code, k in rows:
        if code in active:
            keys_active[k] += 1
    act = [(c, k) for c, k in rows if c in active]
    out["sizes"] = {"longest_name_chars": name_len, "longest_address_chars": addr_len}
    out["name_collisions"] = {
        "active_companies": len(act),
        "shared_with_any_entity": round(100 * sum(1 for _, k in act if keys_all[k] > 1) / len(act), 1),
        "shared_with_another_active": round(100 * sum(1 for _, k in act if keys_active[k] > 1) / len(act), 1),
    }

    # C. headline counts
    out["headline"] = {
        "entities_in_register_files": q("SELECT COUNT(*) FROM company"),
        "active_companies_population": len(active),
        "current_board_and_card_role_rows": q("SELECT COUNT(*) FROM role WHERE src='card'"),
        "beneficial_owner_rows": q("SELECT COUNT(*) FROM role WHERE src='bo'"),
        "active_companies_on_debtor_list_pct": round(100 * q(f"SELECT COUNT(*) FROM company c WHERE c.status='R' AND c.form_short IN {FORMS} AND EXISTS (SELECT 1 FROM debtor d WHERE d.code=c.code)") / len(active), 1),
    }
    (EE / "round2_stats.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    for k, v in out["headline"].items():
        print(f"HEADLINE {k} {v}")


if __name__ == "__main__":
    main()
