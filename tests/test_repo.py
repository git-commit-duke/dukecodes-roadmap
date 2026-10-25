"""The real repo, as committed: it passes its own checks and its generated files are fresh."""

from __future__ import annotations

from conftest import REPO

from dukecodes_roadmap.checks import TEXT_SUFFIXES, load
from dukecodes_roadmap.cli import outputs


def test_repo_passes_its_own_checks() -> None:
    _, problems = load(REPO)
    assert [str(p) for p in problems] == []


def test_generated_files_are_fresh() -> None:
    built = outputs(REPO)
    assert built is not None
    files, _ = built
    stale = [name for name, text in files.items() if (REPO / name).read_text(encoding="utf-8") != text]
    assert stale == [], "run `make build` and commit the result"


def test_every_file_the_page_ships_is_leak_scanned() -> None:
    # The page is published as-is, so a file type the scan skips is a file nobody checked.
    shipped = [p for p in (REPO / "site").rglob("*") if p.is_file()]
    unscanned = [str(p.relative_to(REPO)) for p in shipped if p.suffix.lower() not in TEXT_SUFFIXES]
    assert shipped and unscanned == []
