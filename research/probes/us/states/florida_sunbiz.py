"""Profile Florida Sunbiz corporate data files (fixed-width, 1440 bytes per record).

Florida publishes daily and quarterly files on a public SFTP server. The public login is
printed on the Sunbiz "Data Usage Guide" page; pass it in FL_SFTP_USER / FL_SFTP_PASS.

    python -I research/probes/us/states/florida_sunbiz.py list
    python -I research/probes/us/states/florida_sunbiz.py profile <daily .txt or quarterly cordata.zip>

Only aggregates are printed.
"""
import collections
import io
import os
import subprocess
import sys

HOST = "sftp://sftp.floridados.gov/Public/doc/"
FOLDERS = ["cor/", "Quarterly/Cor/"]

FIELDS = {
    "document_number": (0, 12),
    "name": (12, 204),
    "status": (204, 205),
    "filing_type": (205, 220),
    "principal_zip": (334, 344),
    "file_date": (472, 480),
    "fei_number": (480, 494),
    "more_than_six_officers": (494, 495),
    "last_transaction_date": (495, 503),
    "state_country": (503, 505),
    "registered_agent_name": (544, 586),
    "registered_agent_type": (586, 587),
}
OFFICER_START, OFFICER_WIDTH, OFFICER_SLOTS = 668, 128, 6


def officer(rec, slot):
    base = OFFICER_START + slot * OFFICER_WIDTH
    return {"title": rec[base:base + 4].strip(), "type": rec[base + 4:base + 5].strip(), "name": rec[base + 5:base + 47].strip()}


def records(path):
    if path.lower().endswith(".zip"):
        # The quarterly zip uses Deflate64, which Python's zipfile can't read.
        proc = subprocess.Popen(["unzip", "-p", path], stdout=subprocess.PIPE)
        yield from io.TextIOWrapper(proc.stdout, encoding="latin-1", newline="")
        proc.wait()
    else:
        with open(path, encoding="latin-1", newline="") as fh:
            yield from fh


def profile(path):
    n = 0
    status, ftype, titles, otype = (collections.Counter() for _ in range(4))
    officers_per = collections.Counter()
    filled = collections.Counter()
    longest_name = 0
    years = collections.Counter()
    for line in records(path):
        rec = line.rstrip("\r\n")
        if len(rec) < 1400:
            continue
        n += 1
        status[rec[204]] += 1
        ftype[rec[205:220].strip()] += 1
        for field, (a, b) in FIELDS.items():
            if rec[a:b].strip():
                filled[field] += 1
        longest_name = max(longest_name, len(rec[12:204].strip()))
        fd = rec[472:480]
        if fd.strip():
            years[fd[4:8]] += 1
        k = 0
        for slot in range(OFFICER_SLOTS):
            o = officer(rec, slot)
            if o["name"]:
                k += 1
                titles[o["title"]] += 1
                otype[o["type"]] += 1
        officers_per[k] += 1
    print(f"records={n}")
    print("status:", status.most_common())
    print("filing types:", ftype.most_common(12))
    print("field fill %:", {f: round(100 * c / n, 1) for f, c in filled.items()})
    print("officers per record:", sorted(officers_per.items()))
    print("officer titles:", titles.most_common(15))
    print("officer type (P person, C company):", otype.most_common())
    print("longest name:", longest_name)
    print("file years (last 8):", sorted(years.items())[-8:])


def list_files():
    user, password = os.environ.get("FL_SFTP_USER"), os.environ.get("FL_SFTP_PASS")
    if not (user and password):
        sys.exit("set FL_SFTP_USER and FL_SFTP_PASS (public login from the Sunbiz data usage guide)")
    for folder in FOLDERS:
        out = subprocess.run(
            ["curl", "-s", "-k", "--max-time", "120", "-u", f"{user}:{password}", HOST + folder],
            capture_output=True, text=True,
        ).stdout
        print(f"== {folder}")
        print("\n".join(out.splitlines()[-12:]))


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "profile":
        profile(sys.argv[2])
    elif len(sys.argv) >= 2 and sys.argv[1] == "list":
        list_files()
    else:
        sys.exit(__doc__)
