"""Independent MatchClaim canonical digest reproducer.

The tool intentionally repeats the fixed serialization rules instead of
importing contract code. Fields are supplied in the documented order as a JSON
array, so another implementation can reproduce the same digest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def encode(value):
    if isinstance(value, bool):
        return b"b1" if value else b"b0"
    if isinstance(value, int):
        raw = str(value).encode("ascii")
        return b"i" + str(len(raw)).encode("ascii") + b":" + raw
    if isinstance(value, str):
        raw = value.encode("utf-8")
        return b"s" + str(len(raw)).encode("ascii") + b":" + raw
    if isinstance(value, list):
        return b"a" + str(len(value)).encode("ascii") + b":" + b"".join(encode(item) for item in value)
    raise TypeError(f"unsupported value type: {type(value).__name__}")


def digest(tag: str, values: list[object]) -> str:
    payload = b"MATCHCLAIM-V1\x00" + encode(tag) + b"".join(encode(value) for value in values)
    return hashlib.sha256(payload).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", required=True, choices=("policy", "purchase", "result", "assessment", "authorization"))
    parser.add_argument("--fields-json", required=True, help="JSON array in the tag's fixed field order")
    args = parser.parse_args()
    fields = json.loads(args.fields_json)
    if not isinstance(fields, list):
        raise SystemExit("--fields-json must decode to a JSON array")
    print(digest(args.tag, fields))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
