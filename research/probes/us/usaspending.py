"""Probe USAspending.gov API: recipient search, recipient profile, awards by recipient, bulk archive.

Usage: python -I research/probes/us/usaspending.py [keyword]
Writes raw responses to research/.cache/us/usaspending/.
"""
import json
import pathlib
import sys
import time
import urllib.request

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
BASE = "https://api.usaspending.gov/api/v2"
OUT = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "usaspending"


def call(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers={"User-Agent": UA, "Content-Type": "application/json"})
    t = time.time()
    with urllib.request.urlopen(req, timeout=120) as r:
        payload = json.load(r)
    time.sleep(0.25)
    return payload, round(time.time() - t, 2)


def save(name, payload):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(payload, indent=1), encoding="utf-8")


def main():
    keyword = sys.argv[1] if len(sys.argv) > 1 else "roofing"
    last, _ = call("/awards/last_updated/")
    print("awards last_updated:", last)

    recipients, secs = call("/recipient/", {"keyword": keyword, "limit": 10, "page": 1, "award_type": "all"})
    save("recipient_search", recipients)
    print(f"recipient search '{keyword}': total={recipients['page_metadata']['total']} ({secs}s)")
    total_all, _ = call("/recipient/", {"limit": 1, "page": 1, "award_type": "all"})
    print("all recipient rows (P/C/R levels):", total_all["page_metadata"]["total"])

    first = recipients["results"][0]
    profile, secs = call(f"/recipient/{first['id']}/?year=all")
    save("recipient_profile", profile)
    print("recipient profile fields:", sorted(profile.keys()), f"({secs}s)")
    print("  location fields:", sorted((profile.get("location") or {}).keys()))
    print("  business_types sample:", profile.get("business_types", [])[:6])

    uei = first.get("uei")
    body = {
        "filters": {
            "recipient_search_text": [uei],
            "award_type_codes": ["A", "B", "C", "D"],
            "time_period": [{"start_date": "2007-10-01", "end_date": "2026-09-30"}],
        },
        "fields": ["Award ID", "Recipient Name", "Recipient UEI", "Award Amount", "Start Date", "End Date",
                   "Awarding Agency", "Awarding Sub Agency", "Description", "NAICS", "PSC", "Place of Performance State Code"],
        "limit": 10,
        "page": 1,
        "sort": "Award Amount",
        "order": "desc",
    }
    awards, secs = call("/search/spending_by_award/", body)
    save("awards_by_recipient", awards)
    print(f"contracts for recipient: {len(awards['results'])} on page 1, hasNext={awards['page_metadata'].get('hasNext')} ({secs}s)")
    if awards["results"]:
        print("  award keys:", sorted(awards["results"][0].keys()))
        detail, _ = call(f"/awards/{awards['results'][0]['generated_internal_id']}/")
        save("award_detail", detail)
        print("  award detail top-level keys:", sorted(detail.keys()))
        print("  recipient keys:", sorted((detail.get("recipient") or {}).keys()))
        print("  executive_details:", json.dumps(detail.get("executive_details"))[:200] if detail.get("executive_details") else None)

    counts, _ = call("/search/spending_by_award_count/", {"filters": {"time_period": [{"start_date": "2025-10-01", "end_date": "2026-09-30"}]}})
    print("award counts FY2026:", counts.get("results"))

    archive, _ = call("/bulk_download/list_monthly_files/", {"agency": "all", "fiscal_year": 2026, "type": "contracts"})
    save("monthly_files", archive)
    files = archive.get("monthly_files", [])
    print("monthly archive files FY2026 contracts:", len(files), [f.get("file_name") for f in files[:3]])


if __name__ == "__main__":
    main()
