"""Fail on obvious secret material in tracked project files."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PATTERNS = (
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\b(?:sk|rk)-[A-Za-z0-9]{20,}\b"),
    re.compile(r"\b(?:OPENAI|ANTHROPIC)_API_KEY\s*=\s*['\"]?[^\s'\"]+"),
)


def main() -> int:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    paths = [Path(raw.decode("utf-8")) for raw in result.stdout.split(b"\0") if raw]
    findings: list[str] = []
    for relative in paths:
        path = ROOT / relative
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for pattern in PATTERNS:
            if pattern.search(text):
                findings.append(f"{relative}: matched {pattern.pattern}")
    if findings:
        print("Secret scan failed:")
        print("\n".join(findings))
        return 1
    print(f"Secret scan passed: {len(paths)} tracked files checked")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
