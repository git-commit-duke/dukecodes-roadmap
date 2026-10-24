#!/usr/bin/env bash
# Code and dependency scans. CI runs this file as-is, so local and CI results match.
# Fails closed: a scanner that can't run counts as a failure, never as a pass.
set -euo pipefail

# uvx ignores pyproject.toml, so it gets the same 7-day release cooldown here.
export UV_EXCLUDE_NEWER="7 days"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "== semgrep (code)"
# One rule skipped by ID. It's a regex meant for Java Server Faces pages: it flags any
# .html line holding "escape", "=" and "false" in that order. The page's one-line JSON
# data matches ("escape routes" in the M1 break-it drill, "done":false). No JSF here.
skip=java.lang.security.audit.xss.jsf.autoescape-disabled.autoescape-disabled
echo "semgrep: skipping $skip (reason in scripts/scan.sh)"
rc=0
uvx semgrep@1.180.0 scan --config p/default --exclude-rule "$skip" --metrics off --json \
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
