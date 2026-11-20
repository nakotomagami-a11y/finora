"""Check that the LV officer `id` and the EE `kirje_id` are row-local keys, not derived from a person's code.

Legal's condition for using them as the role-line identity inside a company's role set (architecture §3.3):
the key must not be a function of the person. Three aggregate tests per source:
  1. unique per row;
  2. the same person key (LV: name + masked code; EE: isikukood_hash) in different companies always gets
     different row ids, so the id is not a function of the person;
  3. no numeric relation: the id never contains the person key's digits (LV: the six visible digits of the masked
     code), and the rank correlation between id and those digits is near zero.
Person keys are read only in memory to run the test; nothing about a person is printed or written.

Reads, under research/.cache/baltics/:
  lv/raw/officers/officers.csv
  ee/raw/ariregister/x/ettevotja_rekvisiidid__kaardile_kantud_isikud.json

Usage: python -I research/probes/baltics/common/role_key_check.py
"""

import collections
import csv
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE.parents[2] / ".cache" / "baltics"
sys.path.insert(0, str(HERE.parent / "ee"))
from jsonstream import iter_objects  # noqa: E402


def spearman(pairs: list[tuple[float, float]]) -> float:
    def ranks(values):
        order = sorted(range(len(values)), key=values.__getitem__)
        r = [0.0] * len(values)
        for rank, i in enumerate(order):
            r[i] = rank
        return r
    xs, ys = ranks([p[0] for p in pairs]), ranks([p[1] for p in pairs])
    n = len(pairs)
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    vx = sum((a - mx) ** 2 for a in xs) ** 0.5
    vy = sum((b - my) ** 2 for b in ys) ** 0.5
    return cov / (vx * vy)


def report(label: str, rows: list[tuple[str, str, str, str]]) -> None:
    """rows: (row id, company code, person key, digits of the person key or '')."""
    ids = [r[0] for r in rows]
    print(f"{label}: rows {len(rows)}; distinct row ids {len(set(ids))}; all numeric {all(i.isdigit() for i in ids)}")
    by_person = collections.defaultdict(set)
    for rid, company, person, _ in rows:
        if person:
            by_person[person].add((company, rid))
    multi = [v for v in by_person.values() if len({c for c, _ in v}) > 1]
    same_id = sum(1 for v in multi if len({rid for _, rid in v}) < len(v))
    print(f"  persons in more than one company: {len(multi)}; of those, sharing a row id across companies: {same_id}")
    digits = [(int(r[0]), int(r[3])) for r in rows if r[3]]
    if digits:
        contained = sum(1 for rid, d in digits if f"{d:06d}" in str(rid))
        sample = random.Random(20261120).sample(digits, min(50_000, len(digits)))
        print(f"  ids containing the person key's visible digits: {contained} of {len(digits)}; "
              f"rank correlation id vs digits: {spearman(sample):+.4f}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    lv = []
    with open(CACHE / "lv" / "raw" / "officers" / "officers.csv", encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            code = r["latvian_identity_number_masked"]
            m = re.match(r"(\d{6})", code or "")
            person = f"{r['name']}|{code}" if code else ""
            lv.append((r["id"], r["at_legal_entity_registration_number"], person, m.group(1) if m else ""))
    report("LV officers.csv `id`", lv)

    ee = []
    for obj in iter_objects(CACHE / "ee" / "raw" / "ariregister" / "x" / "ettevotja_rekvisiidid__kaardile_kantud_isikud.json"):
        for p in obj.get("kaardile_kantud_isikud") or []:
            ee.append((str(p["kirje_id"]), str(obj["ariregistri_kood"]), p.get("isikukood_hash") or "", ""))
    report("EE persons on the card `kirje_id`", ee)


if __name__ == "__main__":
    main()
