"""Aggregate profile of a local SQLite store of SEC Forms 3/4/5.

The store is another tool's live database, so it is opened read-only and only
aggregate numbers are printed (no issuer or owner names).

    FORMS345_DB=<path to .db> python -I research/probes/us/forms345_local.py
"""
import json
import os
import sqlite3
import sys


def one(con, sql):
    return con.execute(sql).fetchone()[0]


def table_exists(con, name):
    return one(con, f"select count(*) from sqlite_master where name = '{name}'") == 1


def main():
    path = os.environ.get("FORMS345_DB")
    if not path:
        sys.exit("set FORMS345_DB")
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    out = {}

    if table_exists(con, "hist_filings"):
        out["hist"] = {
            "filings": one(con, "select count(*) from hist_filings"),
            "first_filing_date": one(con, "select min(filing_date) from hist_filings"),
            "last_filing_date": one(con, "select max(filing_date) from hist_filings"),
            "quarters": one(con, "select count(*) from hist_quarters"),
            "first_quarter": one(con, "select min(quarter) from hist_quarters"),
            "last_quarter": one(con, "select max(quarter) from hist_quarters"),
            "issuers": one(con, "select count(distinct issuer_cik) from hist_filings"),
            "issuers_with_ticker": one(
                con, "select count(distinct issuer_cik) from hist_filings where ticker <> ''"
            ),
            "by_form": dict(
                con.execute("select doc_type, count(*) from hist_filings group by 1 order by 2 desc")
            ),
            "aff10b5one_values": dict(
                con.execute("select aff10b5one, count(*) from hist_filings group by 1 order by 2 desc limit 6")
            ),
            "owner_rows": one(con, "select count(*) from hist_owners"),
            "owners": one(con, "select count(distinct owner_cik) from hist_owners"),
            "owner_title_filled_pct": one(
                con,
                "select round(100.0 * sum(title <> '') / count(*), 1) from hist_owners",
            ),
            "relationships": dict(
                con.execute("select relationship, count(*) from hist_owners group by 1 order by 2 desc limit 12")
            ),
            "tx": one(con, "select count(*) from hist_tx"),
            "tx_codes": dict(
                con.execute("select code, count(*) from hist_tx group by 1 order by 2 desc limit 12")
            ),
            "tx_price_filled_pct": one(
                con, "select round(100.0 * sum(price is not null and price <> '') / count(*), 1) from hist_tx"
            ),
        }

    if table_exists(con, "filings"):
        out["live"] = {
            "filings": one(con, "select count(*) from filings"),
            "first_filed": one(con, "select min(filed_date) from filings"),
            "last_filed": one(con, "select max(filed_date) from filings"),
            "officer_title_filled_pct": one(
                con,
                "select round(100.0 * sum(officer_title <> '') / max(sum(is_officer), 1), 1) from filings",
            ),
            "transactions": one(con, "select count(*) from transactions"),
            "holdings": one(con, "select count(*) from holdings"),
        }

    if table_exists(con, "events"):
        rows = con.execute("select form, items from events").fetchall()
        forms, item_502 = {}, 0
        for form, items in rows:
            forms[form] = forms.get(form, 0) + 1
            try:
                if "5.02" in json.loads(items or "[]"):
                    item_502 += 1
            except ValueError:
                pass
        out["events"] = {
            "rows": len(rows),
            "by_form": forms,
            "with_item_5_02": item_502,
            "first_filed": one(con, "select min(filed_date) from events"),
            "last_filed": one(con, "select max(filed_date) from events"),
        }

    json.dump(out, sys.stdout, indent=2, default=str)
    print()


if __name__ == "__main__":
    main()
