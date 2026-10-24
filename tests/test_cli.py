"""`roadmap` command line: exit codes and what each command writes."""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

import pytest
from conftest import add_proof, private_ip, replace_in, tick_exits, tick_rep, write

from dukecodes_roadmap.cli import main


def run(repo: Path, *args: str) -> int:
    return main(["--root", str(repo), *args])


def test_check_ok(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run(repo, "check") == 0
    assert "roadmap check: ok · 10 milestones" in capsys.readouterr().out


def test_check_reports_every_problem(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    tick_rep(repo, "M0-R1")
    write(repo / "evidence" / "m1-scan.txt", f"{private_ip()}\n")
    assert run(repo, "check") == 1
    out = capsys.readouterr()
    assert "M0-R1 is ticked but has no ledger row" in out.out and "evidence/m1-scan.txt:1" in out.out
    assert "2 problem(s)" in out.err


def test_build_check_fresh_then_stale_then_rebuilt(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run(repo, "build", "--check") == 0
    replace_in(repo / "showcase.toml", 'badge = "LIVE"', 'badge = "BETA"')
    before = (repo / "site" / "index.html").read_text(encoding="utf-8")
    assert run(repo, "build", "--check") == 1
    assert "stale: site/index.html" in capsys.readouterr().err
    assert (repo / "site" / "index.html").read_text(encoding="utf-8") == before  # --check writes nothing
    assert run(repo, "build") == 0
    assert "wrote site/index.html" in capsys.readouterr().out
    assert run(repo, "build", "--check") == 0
    assert "up to date" in capsys.readouterr().out


def test_build_refuses_a_broken_roadmap(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    tick_rep(repo, "M0-R1")
    assert run(repo, "build") == 1
    assert "fix 1 problem(s) first" in capsys.readouterr().err


def test_build_refuses_unsafe_inline_code(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    with (repo / "site" / "src" / "roadmap.css").open("a", encoding="utf-8") as f:
        f.write("\n/* </style> */\n")
    assert run(repo, "build") == 1
    assert "inline style contains '</style'" in capsys.readouterr().err


def test_build_writes_an_artifact_fragment(repo: Path, tmp_path: Path) -> None:
    out = tmp_path / "fragment.html"
    assert run(repo, "build", "--artifact", str(out)) == 0
    assert out.read_text(encoding="utf-8").startswith("<title>")


def test_build_without_readme_markers(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    write(repo / "README.md", "# Roadmap\n")
    assert run(repo, "build") == 0
    assert "no scoreboard markers" in capsys.readouterr().err
    assert (repo / "README.md").read_text(encoding="utf-8") == "# Roadmap\n"


def test_status_names_the_next_rep(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run(repo, "status") == 0
    out = capsys.readouterr().out
    assert out.startswith("Now:  M0 Foundations (next) · 0/13 ticked")
    assert "Next: M0-R1 · Rate yourself" in out and "done when: every row has a score" in out


def test_status_after_the_reps_points_at_exit_criteria(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    for i in range(1, 9):
        tick_rep(repo, f"M0-R{i}")
        add_proof(repo, f"2026-10-20,M0,M0-R{i},lab,Proof {i},skills-matrix.md,open it")
    assert run(repo, "status") == 0
    out = capsys.readouterr().out
    assert "Next: Exit · Skills baseline rated" in out and "done when" not in out


def test_status_when_everything_is_done(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    for n in range(10):
        tick_exits(repo, f"M{n}")
        add_proof(repo, f"2026-10-20,M{n},,review,Closed M{n},roadmap.md,read it")
    assert run(repo, "status") == 0
    assert capsys.readouterr().out.strip() == "Every milestone is done. Time to apply."


def test_status_on_a_broken_roadmap(repo: Path) -> None:
    (repo / "ledger.csv").unlink()
    assert run(repo, "status") == 1


def test_redact_dry_run_then_apply(repo: Path, capsys: pytest.CaptureFixture[str]) -> None:
    ip = private_ip(7)
    scan = write(repo / "evidence" / "m1-scan.txt", f"open 22/tcp on {ip}\r\n")
    clean = write(repo / "evidence" / "notes.txt", "nothing here\n")
    assert run(repo, "redact", str(scan), str(clean)) == 0
    out = capsys.readouterr().out
    assert f"{ip} -> 192.0.2.7" in out and "nothing to redact" in out and "dry run" in out
    assert ip in scan.read_text(encoding="utf-8")
    assert run(repo, "redact", "--apply", str(scan)) == 0
    assert scan.read_bytes() == b"open 22/tcp on 192.0.2.7\r\n"  # line endings kept
    assert run(repo, "check") == 0


def test_redact_keeps_utf16(repo: Path) -> None:
    scan = repo / "evidence" / "ps.txt"
    scan.write_bytes(f"IPv4 Address: {private_ip()}\r\n".encode("utf-16"))
    assert run(repo, "redact", "--apply", str(scan)) == 0
    assert scan.read_bytes().decode("utf-16") == "IPv4 Address: 192.0.2.5\r\n"


@pytest.mark.parametrize("content", [None, b"caf\xe9\n"])
def test_redact_errors(repo: Path, capsys: pytest.CaptureFixture[str], content: bytes | None) -> None:
    path = repo / "evidence" / "bad.txt"
    if content is not None:
        path.write_bytes(content)
    assert run(repo, "redact", str(path)) == 1
    assert "bad.txt" in capsys.readouterr().err


def test_redact_too_many_addresses(repo: Path) -> None:
    lines = [private_ip(last, (10, 0, n)) for n in range(4) for last in range(1, 255)]
    path = write(repo / "evidence" / "huge.txt", "\n".join(lines))
    assert run(repo, "redact", str(path)) == 1


def test_python_dash_m(repo: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["roadmap", "--root", str(repo), "check"])
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_module("dukecodes_roadmap", run_name="__main__")
    assert exit_info.value.code == 0
