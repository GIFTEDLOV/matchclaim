"""CI guard against reporting a release result for a different Git head."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()


def main() -> int:
    head = git("rev-parse", "HEAD")
    expected = os.environ.get("GITHUB_SHA")
    if expected and head != expected:
        print(f"exact-head gate failed: HEAD={head} GITHUB_SHA={expected}")
        return 1
    event = os.environ.get("GITHUB_EVENT_NAME", "")
    ref = os.environ.get("GITHUB_REF", "")
    if event == "push" and ref == "refs/heads/main":
        remote_main = git("rev-parse", "refs/remotes/origin/main")
        if head != remote_main:
            print(f"exact-head gate failed: HEAD={head} origin/main={remote_main}")
            return 1
    print(f"exact-head gate passed: {head}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
