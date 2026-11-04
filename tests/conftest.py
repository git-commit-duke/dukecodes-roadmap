"""Shared fixtures. Every test that changes files works on a copy of the real repo.

`roadmap check` scans this folder for leaks, so private addresses, MACs and internal
hostnames are built from pieces here, never written as literals.
"""

from __future__ import annotations

import re
import shutil
from collections.abc import Sequence
from datetime import date
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
# The newest date in the real data (certs.md Checked, ledger.csv). Bump it when the data gets a newer one.
TODAY = date(2026, 11, 4)
COPY_IGNORE = shutil.ignore_patterns(
    ".git", ".venv", "__pycache__", ".mypy_cache", ".ruff_cache", ".pytest_cache", "htmlcov",
    ".coverage*", "coverage.xml", "dist", "build",
)  # fmt: skip


def dotted(*parts: int) -> str:
    """dotted(10, 0, 0, 5) -> an IPv4 address, without a literal one in the source."""
    return ".".join(str(p) for p in parts)


def private_ip(last: int = 5, net: tuple[int, int, int] = (10, 0, 0)) -> str:
    return dotted(*net, last)


def mac(last: str = "ff") -> str:
    return ":".join(["aa", "bb", "cc", "dd", "ee", last])


def ula() -> str:
    return "f" + "d12:3456:789a::1"


def tailnet_host(name: str = "nas") -> str:
    return f"{name}.tail1234" + ".ts" + ".net"


def lan_host(name: str = "pve") -> str:
    return f"{name}.home" + ".arpa"


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A throwaway copy of this repo: sources, generated files and tests."""
    dest = tmp_path / "repo"
    shutil.copytree(REPO, dest, ignore=COPY_IGNORE, symlinks=True)
    return dest


def write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def replace_in(path: Path, old: str, new: str, count: int = 1) -> None:
    text = path.read_text(encoding="utf-8")
    assert old in text, f"{old!r} not in {path.name}"
    path.write_text(text.replace(old, new, count), encoding="utf-8")


def milestone_file(root: Path, mid: str) -> Path:
    (path,) = (root / "milestones").glob(f"{mid.lower()}-*.md")
    return path


def tick_rep(root: Path, rep: str) -> None:
    replace_in(milestone_file(root, rep.split("-")[0]), f"- [ ] {rep} ·", f"- [x] {rep} ·")


def tick_exits(root: Path, mid: str) -> None:
    """Tick every exit criterion of a milestone."""
    path = milestone_file(root, mid)
    head, sep, tail = path.read_text(encoding="utf-8").partition("## Exit criteria")
    assert sep
    path.write_text(head + sep + tail.replace("- [ ] ", "- [x] "), encoding="utf-8")


def add_proof(root: Path, *rows: str) -> None:
    with (root / "ledger.csv").open("a", encoding="utf-8", newline="") as f:
        for row in rows:
            f.write(row + "\n")


def messages(problems: Sequence[object]) -> str:
    return "\n".join(str(p) for p in problems)


def has(problems: Sequence[object], pattern: str) -> bool:
    return re.search(pattern, messages(problems)) is not None
