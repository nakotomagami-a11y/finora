"""Estonian reality check: pick 8 sample companies by rule, build their profiles, compute fill rates.

Reads research/.cache/baltics/ee/{ee,procurement,notices}.sqlite (built by build_index.py,
procurement.py, official_notices.py). Writes, all under research/.cache/baltics/ee/:
  profiles/<n>.json   one profile per sample company (entity-level, stays in the cache)
  fillrates.json      aggregate fill rates per canonical report field: sample and population

Population = active (status R) companies of the commercial forms OÜ, AS, UÜ, TÜ, TÜH.
Sample = 2 micro, 2 small, 1 medium, 1 large (by EMTA employee count, latest quarter),
1 in bankruptcy (status N), 1 on the tax-debtor list; chosen with a fixed seed.

Usage: python -I research/probes/baltics/ee/reality_check.py
"""

import json
import random
import sqlite3
from pathlib import Path

EE = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "ee"
FORMS = ("OÜ", "AS", "UÜ", "TÜ", "TÜH")
BOARD = ("JUHL", "JJUH", "N", "PROK", "LIKV", "PANKH", "O", "FIE")
KEY = {"revenue": "Revenue", "net_profit": "TotalAnnualPeriodProfitLoss", "total_assets": "Assets",
       "equity": "Equity", "fs_employees": "AverageNumberOfEmployeesInFullTimeEquivalentUnits"}


def connect():
    db = sqlite3.connect(EE / "ee.sqlite")
    db.execute(f"ATTACH '{EE / 'procurement.sqlite'}' AS p")
    db.execute(f"ATTACH '{EE / 'notices.sqlite'}' AS n")
    return db


def latest_quarter(db):
    return db.execute("SELECT year, q FROM tax WHERE employees IS NOT NULL ORDER BY year DESC, q DESC LIMIT 1").fetchone()


def prepare(db):
    y, q = latest_quarter(db)
    db.executescript(f"""
      DROP TABLE IF EXISTS temp.latest_report;
      CREATE TEMP TABLE latest_report AS
        SELECT r.code, r.year, MAX(r.report_id) AS report_id FROM report r
        JOIN (SELECT code, MAX(year) AS y FROM report GROUP BY code) m ON m.code = r.code AND m.y = r.year
        GROUP BY r.code;
      CREATE INDEX temp.lr_code ON latest_report(code);
      DROP TABLE IF EXISTS temp.emp;
      CREATE TEMP TABLE emp AS SELECT code, employees, state_taxes, labour_taxes, turnover FROM tax WHERE year={y} AND q={q};
      CREATE INDEX temp.emp_code ON emp(code);
    """)
    return y, q


def profile(db, code):
    one = lambda sql, *a: db.execute(sql, a).fetchone()
    c = dict(zip([d[0] for d in db.execute("SELECT * FROM company WHERE code=?", (code,)).description],
                 one("SELECT * FROM company WHERE code=?", code)))
    roles = db.execute("SELECT src, role, person_type, has_name, has_hash, has_birth, start, end, share_pct FROM role WHERE code=?", (code,)).fetchall()
    cur = [r for r in roles if not r[7]]
    lr = one("SELECT year, report_id FROM latest_report WHERE code=?", code)
    elements = {}
    if lr:
        elements = {k: one("SELECT value FROM element WHERE report_id=? AND name=?", lr[1], v) for k, v in KEY.items()}
        elements = {k: (v[0] if v else None) for k, v in elements.items()}
    emp = one("SELECT employees, state_taxes, labour_taxes, turnover FROM emp WHERE code=?", code)
    debt = one("SELECT debt, scheduled, disputed, oldest_due FROM debtor WHERE code=?", code)
    pledges = one("SELECT COUNT(*), SUM(CAST(amount AS REAL)) FROM pledge WHERE code=? AND end IS NULL", code)
    rulings = one("SELECT COUNT(*), MAX(ruling_date) FROM ruling WHERE code=?", code)
    awards = one("SELECT COUNT(*), SUM(amount) FROM p.award WHERE code=?", code)
    notices = db.execute("SELECT sub, published FROM n.notice WHERE code=?", (code,)).fetchall()
    return {
        "identity": {k: c[k] for k in ("code", "legal_form", "status", "reg_date", "closed_date", "has_address", "emtak_main",
                                       "nace_main", "vat_no", "has_email", "has_phone", "has_web", "capital", "employees_ar")},
        "people": {
            "officers_current": sum(1 for r in cur if r[0] == "card" and r[1] in BOARD),
            "officer_roles": sorted({r[1] for r in cur if r[0] == "card"}),
            "officers_with_start_date": sum(1 for r in cur if r[0] == "card" and r[6]),
            "officers_with_person_hash": sum(1 for r in cur if r[0] == "card" and r[2] == "F" and r[4]),
            "officers_with_birth_date": sum(1 for r in cur if r[0] == "card" and r[5]),
            "shareholders_current": sum(1 for r in cur if r[0] == "shareholder"),
            "shareholders_with_pct": sum(1 for r in cur if r[0] == "shareholder" and r[8]),
            "corporate_shareholders": sum(1 for r in cur if r[0] == "shareholder" and r[2] == "J"),
            "annual_reports_listed": c["n_reports_listed"],
            "beneficial_owners_current": sum(1 for r in cur if r[0] == "bo"),
            "noncard_persons_current": sum(1 for r in cur if r[0] == "noncard"),
        },
        "financials": {"latest_year": lr[0] if lr else None, **elements},
        "tax_latest_quarter": dict(zip(("employees", "state_taxes", "labour_taxes", "turnover"), emp)) if emp else None,
        "tax_debt": dict(zip(("debt", "scheduled", "disputed", "oldest_due"), debt)) if debt else None,
        "pledges_active": {"count": pledges[0], "sum": pledges[1]},
        "rulings": {"count": rulings[0], "latest": rulings[1]},
        "procurement_12m": {"awards": awards[0], "value": awards[1]},
        "insolvency_notices_6m": [n[0] for n in notices],
    }


FIELD_SQL = {
    # identity
    "legal_name": "1", "reg_code": "1", "legal_form": "c.legal_form IS NOT NULL", "status": "c.status IS NOT NULL",
    "reg_date": "c.reg_date IS NOT NULL", "address": "c.has_address = 1", "activity_code": "c.emtak_main IS NOT NULL",
    "vat_number": "c.vat_no = 1", "website_or_contact": "(c.has_email + c.has_phone + c.has_web) > 0",
    # people
    "officers": "EXISTS (SELECT 1 FROM role r WHERE r.code=c.code AND r.src='card' AND r.end IS NULL AND r.role IN {board})",
    "officer_roles_dates": "EXISTS (SELECT 1 FROM role r WHERE r.code=c.code AND r.src='card' AND r.end IS NULL AND r.start IS NOT NULL)",
    "members_shareholders": "EXISTS (SELECT 1 FROM role r WHERE r.code=c.code AND r.src='shareholder' AND r.end IS NULL)",
    "beneficial_owners": "EXISTS (SELECT 1 FROM role r WHERE r.code=c.code AND r.src='bo' AND r.end IS NULL)",
    "person_identifier": "EXISTS (SELECT 1 FROM role r WHERE r.code=c.code AND r.src='card' AND r.end IS NULL AND r.person_type='F' AND r.has_hash=1)",
    # financials
    "fs_latest_year": "EXISTS (SELECT 1 FROM latest_report l WHERE l.code=c.code AND l.year >= {fs_year})",
    **{k: f"EXISTS (SELECT 1 FROM latest_report l JOIN element e ON e.report_id=l.report_id WHERE l.code=c.code AND l.year >= {{fs_year}} AND e.name='{v}' AND e.value IS NOT NULL)" for k, v in KEY.items()},
    # employment and taxes
    "employees_current": "EXISTS (SELECT 1 FROM emp WHERE emp.code=c.code AND emp.employees IS NOT NULL)",
    "taxes_paid": "EXISTS (SELECT 1 FROM emp WHERE emp.code=c.code AND emp.state_taxes IS NOT NULL)",
    "vat_registered": "c.vat_no = 1",
    # status-type fields: share of companies flagged (the field itself is known for all)
    "tax_debt": "EXISTS (SELECT 1 FROM debtor d WHERE d.code=c.code)",
    "pledges_securing_measures": "EXISTS (SELECT 1 FROM pledge pl WHERE pl.code=c.code AND pl.end IS NULL)",
    "court_or_official_notices": "EXISTS (SELECT 1 FROM ruling ru WHERE ru.code=c.code)",
    "procurement_contracts": "EXISTS (SELECT 1 FROM p.award a WHERE a.code=c.code)",
    "corporate_owner": "EXISTS (SELECT 1 FROM role r WHERE r.code=c.code AND r.src='shareholder' AND r.end IS NULL AND r.person_type='J')",
    "filings_listed": "c.n_reports_listed > 0",
    "website": "c.has_web = 1",
    "insolvency": "c.status IN ('N','L') OR EXISTS (SELECT 1 FROM n.notice nn WHERE nn.code=c.code)",
}

# A section counts as filled when all of its core fields are filled (status-type sections: always known).
SECTIONS = {
    "S01": ["legal_name", "reg_code", "legal_form", "address", "activity_code", "reg_date"],
    "S02": ["status"],
    "S03": ["officers", "officer_roles_dates"],
    "S04": ["members_shareholders|beneficial_owners"],
    "S05": ["corporate_owner"],
    "S06": ["fs_latest_year", "revenue", "net_profit", "total_assets", "equity"],
    "S07": ["employees_current"],
    "S08": ["taxes_paid"],
    "S09": ["status"],
    "S10": ["court_or_official_notices"],
    "S12": ["procurement_contracts"],
    "S13": ["filings_listed"],
    "S15": ["website"],
    "S17": ["person_identifier"],
}
SECTION_NOTES = {
    "S02": "current status + status start date only; open data carries no name/address history",
    "S04": "OÜ members are in the register; AS shareholders are not (kept by the securities depository)",
    "S05": "parent known only via a legal-entity shareholder; no subsidiaries list or consolidation links",
    "S08": "tax debt is known for every company (on the debtor list or not)",
    "S09": "known for every company: status + pledges + insolvency notices; value = section determinable",
    "S10": "register rulings only; court case data not in these sources",
    "S12": "share of companies with an award in the last 12 months (not a gap when 0)",
    "S17": "officers carry a pseudonymous person hash usable for linking across companies",
}
NOT_AVAILABLE = {
    "closed_date": "bulk files hold only current entities (registered, in liquidation, in bankruptcy); deleted ones are absent",
    "avg_salary": "not published; EMTA warns labour taxes / employees is not an average salary",
    "lei": "GLEIF, measured by the cross-border worker",
    "eu_funds": "Kohesio, measured by the cross-border worker",
    "sanctions_eu": "EU list, measured by the cross-border worker",
    "sanctions_un": "UN list, measured by the cross-border worker",
}
FLAG_FIELDS = {"tax_debt", "pledges_securing_measures", "court_or_official_notices", "procurement_contracts"}


def sample_filled(p):
    i, pe, f, t = p["identity"], p["people"], p["financials"], p["tax_latest_quarter"] or {}
    fresh = (f.get("latest_year") or 0) >= FS_YEAR
    return {
        "legal_name": True, "reg_code": True, "legal_form": bool(i["legal_form"]), "status": bool(i["status"]),
        "reg_date": bool(i["reg_date"]), "address": bool(i["has_address"]), "activity_code": bool(i["emtak_main"]),
        "vat_number": bool(i["vat_no"]), "website_or_contact": bool(i["has_email"] or i["has_phone"] or i["has_web"]),
        "officers": pe["officers_current"] > 0, "officer_roles_dates": pe["officers_with_start_date"] > 0,
        "members_shareholders": pe["shareholders_current"] > 0, "beneficial_owners": pe["beneficial_owners_current"] > 0,
        "person_identifier": pe["officers_with_person_hash"] > 0,
        "fs_latest_year": fresh, **{k: fresh and f.get(k) is not None for k in KEY},
        "employees_current": t.get("employees") is not None, "taxes_paid": t.get("state_taxes") is not None,
        "vat_registered": bool(i["vat_no"]), "tax_debt": p["tax_debt"] is not None,
        "insolvency": i["status"] in ("N", "L") or bool(p["insolvency_notices_6m"]),
        "pledges_securing_measures": p["pledges_active"]["count"] > 0,
        "court_or_official_notices": p["rulings"]["count"] > 0, "procurement_contracts": p["procurement_12m"]["awards"] > 0,
        "corporate_owner": pe["corporate_shareholders"] > 0, "filings_listed": pe["annual_reports_listed"] > 0,
        "website": bool(i["has_web"]),
    }


def section_filled(filled, keys):
    return all(any(filled.get(alt) for alt in k.split("|")) for k in keys)


def pick(db, rng, sql, n):
    rows = [r[0] for r in db.execute(sql)]
    return rng.sample(rows, n) if len(rows) >= n else rows


FS_YEAR = 2024


def main():
    db = connect()
    yq = prepare(db)
    forms = "(" + ",".join(f"'{f}'" for f in FORMS) + ")"
    board = "(" + ",".join(f"'{b}'" for b in BOARD) + ")"
    base = f"SELECT c.code FROM company c JOIN emp ON emp.code=c.code WHERE c.status='R' AND c.form_short IN {forms}"
    rng = random.Random(2026)
    groups = {
        "micro": pick(db, rng, base + " AND emp.employees BETWEEN 1 AND 9 ORDER BY c.code", 2),
        "small": pick(db, rng, base + " AND emp.employees BETWEEN 10 AND 49 ORDER BY c.code", 2),
        "medium": pick(db, rng, base + " AND emp.employees BETWEEN 50 AND 249 ORDER BY c.code", 1),
        "large": pick(db, rng, base + " AND emp.employees >= 250 ORDER BY c.code", 1),
        "bankrupt": pick(db, rng, f"SELECT code FROM company WHERE status='N' AND form_short IN {forms} ORDER BY code", 1),
        "tax_debt": pick(db, rng, f"SELECT c.code FROM company c JOIN debtor d ON d.code=c.code WHERE c.status='R' AND c.form_short IN {forms} AND d.debt > 10000 ORDER BY c.code", 1),
    }
    (EE / "profiles").mkdir(exist_ok=True)
    (EE / "sample.json").write_text(json.dumps(groups))
    filled_counts, n, seg = {}, 0, {}
    for group, codes in groups.items():
        for code in codes:
            n += 1
            p = {"group": group, **profile(db, code)}
            (EE / "profiles" / f"{n:02d}_{group}.json").write_text(json.dumps(p, indent=1, ensure_ascii=False), encoding="utf-8")
            f = sample_filled(p)
            for k, v in f.items():
                filled_counts[k] = filled_counts.get(k, 0) + bool(v)
            for sec, keys in SECTIONS.items():
                cell = seg.setdefault(sec, {}).setdefault(group, [0, 0])
                cell[0] += section_filled(f, keys) or sec in ("S09",)
                cell[1] += 1
    sample = {k: round(100 * v / n) for k, v in filled_counts.items()}

    total = db.execute(f"SELECT COUNT(*) FROM company c WHERE c.status='R' AND c.form_short IN {forms}").fetchone()[0]
    population = {}
    for field, cond in FIELD_SQL.items():
        cond = cond.format(board=board, fs_year=FS_YEAR)
        hit = db.execute(f"SELECT COUNT(*) FROM company c WHERE c.status='R' AND c.form_short IN {forms} AND {cond}").fetchone()[0]
        population[field] = round(100 * hit / total, 1)
    sections = {}
    for sec, keys in SECTIONS.items():
        conds = []
        for k in keys:
            alts = [(FIELD_SQL[a] if a in FIELD_SQL else "1").format(board=board, fs_year=FS_YEAR) for a in k.split("|")]
            conds.append("(" + " OR ".join(alts) + ")")
        hit = total if sec == "S09" else db.execute(f"SELECT COUNT(*) FROM company c WHERE c.status='R' AND c.form_short IN {forms} AND {' AND '.join(conds)}").fetchone()[0]
        sections[sec] = {"sample_filled": sum(v[0] for v in seg[sec].values()), "sample_n": n,
                         "population_pct": round(100 * hit / total, 1), "by_segment": seg[sec],
                         "note": SECTION_NOTES.get(sec, "")}
    status_counts = dict(db.execute(f"SELECT status, COUNT(*) FROM company WHERE form_short IN {forms} GROUP BY status").fetchall())
    out = {
        "country": "EE", "n_sample": n, "population_size_active_companies": total, "status_counts_all_forms": status_counts,
        "tax_quarter_used": f"{yq[0]}Q{yq[1]}", "fs_year_threshold": FS_YEAR,
        "sample_method": "random.Random(2026).sample over registry-code-sorted candidates within each segment; "
                         "size segments by EMTA employee count in the latest quarter; active OÜ/AS/UÜ/TÜ/TÜH only",
        "sections": sections, "sample": sample, "population": population,
        "flag_fields_note": "for " + ", ".join(sorted(FLAG_FIELDS)) + " the value is the share of companies flagged; "
                            "the field itself is determinable for every company",
        "not_available": NOT_AVAILABLE,
    }
    (EE / "fillrates.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(out, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
