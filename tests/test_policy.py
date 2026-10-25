"""Supply-chain rules that live in several files at once must agree.

The cooldown, tool versions and pins are written in the Makefile, pyproject.toml, the
workflow, Dependabot, the hooks file and the scan script. Change one and forget another,
and the repo quietly runs two policies. These tests fail on the first drift. The page's
pipeline simulator is checked against the config it describes, too.

Adapted from dukecodes-project-template's tests/test_policy.py.
"""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = sorted((ROOT / ".github" / "workflows").glob("*.yml"))
SHA = r"[0-9a-f]{40}"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def days(value: str) -> int:
    match = re.fullmatch(r"(\d+) days?", value.strip())
    assert match, f"cooldown {value!r} is not written as 'N days'"
    return int(match.group(1))


def one(pattern: str, text: str, where: str) -> str:
    found: set[str] = set(re.findall(pattern, text, re.MULTILINE))
    assert len(found) == 1, f"{where}: expected one value for {pattern!r}, found {sorted(found)}"
    return found.pop()


def cooldowns() -> dict[str, int]:
    dependabot = read(".github/dependabot.yml")
    ecosystems = re.findall(r"^\s*- package-ecosystem:", dependabot, re.MULTILINE)
    per_ecosystem = re.findall(r"cooldown: \{default-days: (\d+)\}", dependabot)
    assert len(per_ecosystem) == len(ecosystems), "every Dependabot ecosystem needs a cooldown"
    pyproject = tomllib.loads(read("pyproject.toml"))
    return {
        "Makefile COOLDOWN": days(one(r"^COOLDOWN := (.+)$", read("Makefile"), "Makefile")),
        "pyproject exclude-newer": days(pyproject["tool"]["uv"]["exclude-newer"]),
        "dependabot default-days": int(one(r"default-days: (\d+)", dependabot, "dependabot")),
        "ci.yml UV_EXCLUDE_NEWER": days(
            one(r'UV_EXCLUDE_NEWER: "([^"]+)"', read(".github/workflows/ci.yml"), "ci.yml")
        ),
        "scan.sh default": days(one(r"\$\{UV_EXCLUDE_NEWER:-([^}]+)\}", read("scripts/scan.sh"), "scan.sh")),
    }


def test_one_cooldown_everywhere() -> None:
    found = cooldowns()
    assert len(set(found.values())) == 1, found


def test_dependabot_watches_every_pinned_ecosystem() -> None:
    dependabot = read(".github/dependabot.yml")
    watched = set(re.findall(r"^\s*- package-ecosystem: ([\w-]+)", dependabot, re.MULTILINE))
    assert {"github-actions", "uv", "pre-commit"} <= watched


def test_pre_commit_is_one_version_locally_and_in_ci() -> None:
    files = ["Makefile", ".github/workflows/ci.yml"]
    versions = {f: one(r"\bpre-commit@(\d+(?:\.\d+)+)", read(f), f) for f in files}
    assert len(set(versions.values())) == 1, versions


def test_ci_runs_the_local_scan_script() -> None:
    # The semgrep and pip-audit versions live only in scripts/scan.sh, so a local
    # `make scan` and CI always run the same scanners.
    ci = read(".github/workflows/ci.yml")
    assert "run: bash scripts/scan.sh" in ci
    assert not re.search(r"\b(?:semgrep|pip-audit)@", ci)


def test_zizmor_in_ci_matches_the_hook() -> None:
    hook = one(
        rf"zizmor-pre-commit\n\s+rev: {SHA}\s+# frozen: v([\d.]+)",
        read(".pre-commit-config.yaml"),
        "hooks",
    )
    ci = one(r"\bzizmor@([\d.]+)", read(".github/workflows/ci.yml"), "ci.yml")
    assert hook == ci


def test_the_ruff_hook_matches_the_locked_ruff() -> None:
    # CI's test job runs the locked ruff; the hook runs its own. Two versions can format
    # the same file two ways, and then the hook and CI fight.
    hook = one(
        rf"ruff-pre-commit\n\s+rev: {SHA}\s+# frozen: v([\d.]+)",
        read(".pre-commit-config.yaml"),
        "hooks",
    )
    lock = tomllib.loads(read("uv.lock"))
    locked = next(p["version"] for p in lock["package"] if p["name"] == "ruff")
    assert hook == locked


@pytest.mark.parametrize("workflow", WORKFLOWS, ids=lambda p: p.name)
def test_every_action_is_pinned_to_a_full_sha(workflow: Path) -> None:
    lines = [ln.strip() for ln in workflow.read_text(encoding="utf-8").splitlines()]
    uses = [ln for ln in lines if re.match(r"(- )?uses:", ln)]
    assert uses, f"{workflow.name} uses no actions?"
    pinned = re.compile(rf"(- )?uses: [\w.-]+/[\w./-]+@{SHA} # v\d+(\.\d+)*$")
    assert [u for u in uses if not pinned.match(u)] == []


def test_every_hook_is_pinned_to_a_full_sha() -> None:
    config = read(".pre-commit-config.yaml")
    revs = re.findall(r"^\s+rev: (.+)$", config, re.MULTILINE)
    remote = re.findall(r"^\s+- repo: https://", config, re.MULTILINE)
    assert len(revs) == len(remote) > 0
    bad = [r for r in revs if not re.fullmatch(rf"{SHA}\s+# frozen: v[\w.-]+", r)]
    assert bad == []


def test_uv_is_one_exact_version_in_ci() -> None:
    for workflow in WORKFLOWS:
        text = workflow.read_text(encoding="utf-8")
        steps = text.count("astral-sh/setup-uv@")
        versions = re.findall(r"astral-sh/setup-uv@\S+.*\n\s+with:\n\s+version: \"([^\"]+)\"", text)
        assert len(versions) == steps, f"{workflow.name}: a setup-uv step has no version"
        for version in versions:
            assert re.fullmatch(r"\d+\.\d+\.\d+", version), version
        assert len(set(versions)) <= 1, versions


# ---------- the page tells the truth about the pipeline ----------

# What each gate on the page claims, and the line of config that makes it true.
LINT_HOOKS = ("zizmor", "actionlint", "yamllint", "ruff-check", "shellcheck", "site-check")
GATE_PROOF = {
    "secrets": [(".pre-commit-config.yaml", "- id: gitleaks  # staged changes, on every commit")],
    "lint": [(".pre-commit-config.yaml", f"- id: {hook}") for hook in LINT_HOOKS],
    "check": [(".pre-commit-config.yaml", "entry: uv run --frozen roadmap build")],
    "history": [(".github/workflows/ci.yml", "gitleaks-history --hook-stage manual")],
    "ci-check": [
        (".github/workflows/ci.yml", "run: uv run --frozen roadmap check"),
        (".github/workflows/ci.yml", "run: uv run --frozen pytest"),
    ],
    "sast": [
        (".github/workflows/ci.yml", "run: bash scripts/scan.sh"),
        ("scripts/scan.sh", "semgrep@"),
        ("scripts/scan.sh", "pip-audit@"),
    ],
}
ZONE = {"pre-commit": "local", "CI": "ci"}


def test_every_simulator_gate_is_backed_by_config() -> None:
    gates = tomllib.loads(read("showcase.toml"))["simulator"]["gates"]
    assert {g["id"] for g in gates} == set(GATE_PROOF), "a new gate needs a line in GATE_PROOF"
    missing = [(g["id"], f, line) for g in gates for f, line in GATE_PROOF[g["id"]] if line not in read(f)]
    assert missing == []
    assert all(ZONE[g["where"]] == g["zone"] for g in gates)


def test_local_gates_run_before_ci_gates() -> None:
    zones = [g["zone"] for g in tomllib.loads(read("showcase.toml"))["simulator"]["gates"]]
    assert zones == sorted(zones, key=["local", "ci"].index)
