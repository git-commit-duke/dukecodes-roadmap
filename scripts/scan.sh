#!/usr/bin/env bash
# Code and dependency scans. CI runs this file as-is, so local and CI results match.
# Fails closed: a scanner that can't run counts as a failure, never as a pass.
set -euo pipefail

# uvx ignores pyproject.toml, so it gets the release cooldown here (`make scan` passes the
# Makefile's COOLDOWN; this default covers running the script directly).
export UV_EXCLUDE_NEWER="${UV_EXCLUDE_NEWER:-7 days}"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "== semgrep (code)"
# site/ds is another repo's code (the design system), copied byte for byte and locked by
# sha256 in site/ds.lock.json. Its findings belong upstream; this repo never edits it.
# scripts/check_site.py still bans HTML and code sinks in it on every commit. Semgrep's own
# defaults already skip vendor/ and *.min.js, which covers React in site/vendor.
rc=0
uvx semgrep@1.180.0 scan --config p/default --exclude site/ds --metrics off --json \
  --time --quiet --output "$work/semgrep.json" . || rc=$?
uv run --frozen python - "$work/semgrep.json" "$rc" <<'PY'
import json
import sys

path, rc = sys.argv[1], sys.argv[2]
try:
    with open(path, encoding="utf-8") as f:
        report = json.load(f)
except (OSError, ValueError):
    sys.exit(f"FAIL: semgrep wrote no report (exit {rc}). Is semgrep.dev reachable?")
rules = len(report.get("time", {}).get("rules", []))
found = report.get("results", [])
print(f"semgrep: {rules} rules, {len(found)} finding(s)")
for r in found:
    print(f"  {r['path']}:{r['start']['line']} {r['check_id']}")
if rules == 0:
    sys.exit("FAIL: semgrep loaded no rules, so nothing was checked")
sys.exit(1 if found else 0)
PY

echo "== pip-audit (locked dependencies)"
uv export --frozen --all-groups --no-emit-project --quiet --output-file "$work/requirements.txt"
uvx pip-audit@2.10.1 --strict --disable-pip --require-hashes -r "$work/requirements.txt"
