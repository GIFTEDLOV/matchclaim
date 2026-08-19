"""Write a reproducible SHA-256 report for the deployable contract source."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "matchclaim.py"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path, default=ROOT / "artifacts" / "contract-hash.json")
    args = parser.parse_args()
    digest = hashlib.sha256(CONTRACT.read_bytes()).hexdigest()
    report = {
        "contract": str(CONTRACT.relative_to(ROOT)).replace("\\", "/"),
        "sha256": digest,
    }
    output = args.write if args.write.is_absolute() else ROOT / args.write
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
