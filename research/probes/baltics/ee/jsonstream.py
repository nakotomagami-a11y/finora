"""Stream the top-level objects of the e-Business Register's pretty-printed JSON arrays.

The open-data JSON files are single arrays of several GB, pretty-printed with a 4-space
indent, so each top-level object starts with a line "    {" and ends with "    }" or "    },".
Reading them line by line keeps memory flat.
"""

import json


def iter_objects(path):
    buf = []
    inside = False
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if not inside:
                if line.startswith("    {"):
                    inside = True
                    buf = [line]
                continue
            buf.append(line)
            if line.startswith("    }"):
                inside = False
                text = "".join(buf).rstrip().rstrip(",")
                yield json.loads(text)


def shape(value, path="", out=None):
    """Map every leaf path (lists as []) to the set of Python type names seen."""
    out = {} if out is None else out
    if isinstance(value, dict):
        for k, v in value.items():
            shape(v, f"{path}.{k}" if path else k, out)
    elif isinstance(value, list):
        for item in value:
            shape(item, path + "[]", out)
        if not value:
            out.setdefault(path + "[]", set()).add("empty")
    else:
        out.setdefault(path, set()).add(type(value).__name__)
    return out
