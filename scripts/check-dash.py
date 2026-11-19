#!/usr/bin/env python3
"""Fail if any tracked or untracked (not ignored) file contains an em dash or en dash (CLAUDE.md rule 1)."""
import subprocess
import sys

DASH = (chr(0x2013), chr(0x2014))
files = subprocess.run(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    capture_output=True, text=True, check=True,
).stdout.split("\0")
hits = 0
for p in files:
    if not p:
        continue
    try:
        with open(p, encoding="utf-8") as f:
            for i, line in enumerate(f, 1):
                if any(d in line for d in DASH):
                    print(f"{p}:{i}: {line.rstrip()}")
                    hits += 1
    except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
        continue
print(f"dash hits={hits}")
sys.exit(1 if hits else 0)
