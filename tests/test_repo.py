"""The real repo, as committed: it passes its own checks and its generated files are fresh."""

from __future__ import annotations

from conftest import REPO

from dukecodes_roadmap.checks import load
from dukecodes_roadmap.cli import outputs


def test_repo_passes_its_own_checks() -> None:
    _, problems = load(REPO)
    assert [str(p) for p in problems] == []


def test_generated_files_are_fresh() -> None:
    built = outputs(REPO)
    assert built is not None
    files, _, _ = built
    stale = [name for name, text in files.items() if (REPO / name).read_text(encoding="utf-8") != text]
    assert stale == [], "run `make build` and commit the result"
