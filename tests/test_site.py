"""The page builder: safe tokens, deterministic page data, a preview that carries every file."""

from __future__ import annotations

import json
import re
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import pytest
from conftest import REPO, TODAY, add_proof, replace_in, tick_rep, write

from dukecodes_roadmap.checks import Roadmap, load
from dukecodes_roadmap.content import SCORE_END, SCORE_START, Check, Milestone, Rep
from dukecodes_roadmap.site import (
    DATA_OUT,
    PAGE,
    PAGE_FILES,
    VIEWPORT_SIDES,
    Links,
    artifact_page,
    build_model,
    hover_rule,
    inline,
    money,
    page_files,
    render_json,
    scoreboard,
    statuses,
    update_readme,
)

GH = "https://github.com/o/r"
INTUNE_TRIAL = "https://learn.microsoft.com/en-us/intune/intune-service/fundamentals/free-trial-sign-up"


@pytest.fixture
def links(tmp_path: Path) -> Links:
    write(tmp_path / "docs" / "a.md", "# A\n")
    return Links(tmp_path, GH, "main")


def model_of(root: Path) -> tuple[Roadmap, dict[str, Any]]:
    rm, ps = load(root, TODAY)
    assert ps == []
    return rm, build_model(rm)


# ---------- inline markdown -> tokens ----------


def test_inline_tokens(links: Links, tmp_path: Path) -> None:
    text = "Run `make check`, then **ship** it. See [docs](docs/a.md#top) or [x](https://x.example)."
    toks = inline(text, links, tmp_path)
    assert toks == [
        ["t", "Run "],
        ["c", "make check"],
        ["t", ", then "],
        ["b", "ship"],
        ["t", " it. See "],
        ["a", "docs", f"{GH}/blob/main/docs/a.md#top"],
        ["t", " or "],
        ["a", "x", "https://x.example"],
        ["t", "."],
    ]


@pytest.mark.parametrize(
    "target",
    ["javascript:alert", "JavaScript:alert", "data:text/html,x", "mailto:a@example.com", "/etc/passwd",
     "../../outside.md", "#local", "http://example.com", "https:"],
)  # fmt: skip
def test_unsafe_links_become_plain_text(links: Links, tmp_path: Path, target: str) -> None:
    assert inline(f"a [click]({target}) b", links, tmp_path) == [["t", "a click b"]]


def test_directories_link_to_tree(links: Links, tmp_path: Path) -> None:
    assert links.resolve("docs", tmp_path) == f"{GH}/tree/main/docs"
    assert links.resolve("docs/a.md", tmp_path / "docs" / "..") == f"{GH}/blob/main/docs/a.md"


# ---------- small helpers ----------


def ms(mid: str, reps: int, exits: list[bool]) -> Milestone:
    return Milestone(
        id=mid, num=int(mid[1]), title=mid, path="", build="", chapters=(), proof="", cert="", careful=None,
        plain="", why="", story="", break_it=(), concepts=(),
        reps=tuple(Rep(f"{mid}-R{i}", "", "", i <= reps, 1) for i in range(1, 3)),
        exit=tuple(Check("", d, 1) for d in exits),
    )  # fmt: skip


def test_statuses() -> None:
    got = statuses([ms("M0", 2, [True]), ms("M1", 1, [False]), ms("M2", 0, [False]), ms("M3", 0, [False])])
    assert got == {"M0": "done", "M1": "active", "M2": "queued", "M3": "queued"}
    assert statuses([ms("M0", 0, [False]), ms("M1", 0, [False])]) == {"M0": "next", "M1": "queued"}


def test_money() -> None:
    assert money(Decimal("2240.50")) == "$2,240.50"
    assert money(Decimal(445)) == "$445"


@pytest.mark.parametrize(
    ("term", "rule"),
    [("age", (False, True)), ("CI", (True, True)), ("SY0-701", (True, True)), ("Proxmox", (True, False)),
     ("mTLS", (True, False)), ("nmap", (True, False))],
)  # fmt: skip
def test_hover_rule(term: str, rule: tuple[bool, bool]) -> None:
    assert hover_rule(term) == rule


# ---------- page data and preview ----------


def test_page_data_is_deterministic_json() -> None:
    _, model = model_of(REPO)
    text = render_json(model)
    assert text == render_json(model_of(REPO)[1])
    assert text.endswith("\n") and json.loads(text) == model
    assert "·" in text  # kept as UTF-8, not escaped


def test_app_fetches_the_file_build_writes() -> None:
    js = (REPO / "site" / "app.js").read_text(encoding="utf-8")
    assert f"fetch('{Path(DATA_OUT).name}'" in js


class _Refs(HTMLParser):
    """Every local file a page loads: script src, link href."""

    def __init__(self) -> None:
        super().__init__()
        self.files: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        ref = values.get("src") if tag == "script" else values.get("href") if tag == "link" else None
        if ref and "://" not in ref:
            self.files.append(f"site/{ref}")


def test_the_preview_carries_every_file_the_page_loads() -> None:
    refs = _Refs()
    refs.feed((REPO / PAGE).read_text(encoding="utf-8"))
    files = page_files(REPO)
    assert files[0] == PAGE and DATA_OUT in files and set(PAGE_FILES) <= set(files)
    assert refs.files and [f for f in refs.files if f not in files] == []
    assert len(files) == len(set(files))


def test_artifact_page_keeps_only_what_a_fragment_may_hold() -> None:
    frag = artifact_page((REPO / PAGE).read_text(encoding="utf-8"))
    assert not re.search(r"<!doctype|<html\b|</?head\b|</?body\b|<meta\s+(charset|http-equiv)", frag, re.I)
    assert 'name="viewport"' not in frag
    lines = frag.splitlines()
    assert lines[lines.index(VIEWPORT_SIDES) - 1].startswith("<title>")
    assert '<script src="app.js" defer></script>' in frag and '<div id="root">' in frag


# ---------- model ----------


def test_build_model_needs_a_showcase(repo: Path) -> None:
    (repo / "showcase.toml").unlink()
    rm, _ = load(repo, TODAY)
    with pytest.raises(ValueError, match="without problems"):
        build_model(rm)


def test_showcase_sections_are_optional(repo: Path) -> None:
    toml = repo / "showcase.toml"
    text = toml.read_text(encoding="utf-8")
    toml.write_text(text[: text.index("\n[lab]\n")] + "\n", encoding="utf-8")
    _, model = model_of(repo)
    assert model["lab"] is None and model["simulator"] is None and model["final"] is None


def test_model_basics() -> None:
    _, model = model_of(REPO)
    assert model["current"] == "M0"
    assert model["next"]["kind"] == "rep" and model["next"]["id"] == "M0-R1"
    assert len(model["milestones"]) == 10 and model["milestones"][0]["status"] == "next"
    active = [c for c in model["certs"] if c["status"] not in ("optional", "later", "skipped")]
    assert model["certTotal"]["count"] == len(active)
    assert "CompTIA Security+" in model["certTotal"]["soft"]  # its price isn't on the official page
    assert [c[0] for c in model["checks"]][-1] == "leak scan"


def test_progress_flows_from_ticks_and_proofs(repo: Path) -> None:
    for i in range(1, 9):
        tick_rep(repo, f"M0-R{i}")
        add_proof(repo, f"2026-10-2{i % 3},M0,M0-R{i},lab,Proof {i},skills-matrix.md,open it")
    write(repo / "concepts" / "threat-modeling.md", "# Threat modeling\n\n**Reviewed:** 2026-10-20 · peer\n")
    write(repo / "concepts" / "digital-signatures.md", "# Signatures\n")
    replace_in(repo / "skills-matrix.md", "| Foundations | M0 | ? |", "| Foundations | M0 | 1 |")
    _, model = model_of(repo)
    m0 = model["milestones"][0]
    assert m0["status"] == "active" and m0["progress"] == [8, 13]
    assert model["next"]["kind"] == "exit" and model["next"]["doneWhen"] == []
    assert model["stats"]["reps"][0] == 8 and model["stats"]["proofs"] == 8
    assert model["stats"]["explainers"][:2] == [2, 1]
    assert [c["status"] for c in m0["concepts"]] == ["reviewed", "written", "todo"]
    assert m0["concepts"][0]["url"].endswith("/blob/main/concepts/threat-modeling.md")
    # Newest proof first; each rep points at its own row.
    dates = [p["date"] for p in model["ledger"]]
    assert dates == sorted(dates, reverse=True)
    assert all(model["ledger"][r["proofs"][0]]["rep"] == r["id"] for r in m0["reps"])
    foundations = next(d for d in model["domains"] if d["name"] == "Foundations")
    assert foundations["avg"] == 1 and foundations["rated"] == 1


# ---------- README scoreboard ----------


def test_lab_status_comes_from_rep_ticks(repo: Path) -> None:
    tick_rep(repo, "M5-R9")
    add_proof(repo, "2026-10-21,M5,M5-R9,lab,CrowdSec banned the brute force,skills-matrix.md,open it")
    tick_rep(repo, "M5-R2")
    add_proof(repo, "2026-10-21,M5,M5-R2,lab,Suricata loads its rules,skills-matrix.md,open it")
    add_proof(repo, "2026-10-22,M1,,project,dukecodes-roadmap page published,skills-matrix.md,open it")
    _, model = model_of(repo)
    labs = {lab["name"]: lab for lab in model["labs"]}
    crowdsec = labs["Block an SSH brute force with CrowdSec"]
    assert crowdsec["status"] == "done" and crowdsec["progress"] == [1, 1]
    assert crowdsec["resource"]["url"].startswith("https://academy.crowdsec.net/")
    assert crowdsec["cost"] == "free" and crowdsec["checked"] == "2026-11-04"
    ids = labs["Catch your own scan with an IDS"]
    assert ids["status"] == "active" and ids["progress"] == [1, 3] and ids["milestones"] == ["M5"]
    restore = labs["Restore drills and a backup credential review"]
    assert restore["status"] == "planned" and restore["resource"] is None and restore["cost"] == ""
    assert model["stats"]["labs"] == [1, len(model["labs"])]
    projects = {pj["name"]: pj for pj in model["projects"]}
    assert projects["dukecodes-roadmap"]["all"] and projects["dukecodes-roadmap"]["proofs"] == [0]
    assert projects["homelab-lab"]["milestones"] == ["M5", "M6", "M7", "M8"]
    assert projects["dukecodes-homelab"]["url"] == "" and projects["homelab-lab"]["proofs"] == []
    assert model["stats"]["projects"] == [0, len(model["projects"])]


def test_labs_page_sections_reach_the_page(repo: Path) -> None:
    tick_rep(repo, "M4-R7")
    add_proof(repo, "2026-10-21,M4,M4-R7,lab,AD and three GPOs from one script,skills-matrix.md,open it")
    _, model = model_of(repo)
    start = model["labPath"]
    firsts = [step["milestones"][0] for step in start]
    assert start and firsts == sorted(firsts) and all(step["evidence"] for step in start)
    lynis = next(pr for pr in model["practice"] if pr["name"] == "Lynis")
    assert lynis["url"] == "https://cisofy.com/lynis/" and lynis["area"] == "foundations"
    assert lynis["reps"] == ["M2-R1", "M2-R6"] and lynis["value"] == 4 and lynis["checked"] == "2026-11-04"
    assert model["stats"]["practice"] == len(model["practice"])
    # A capstone is active once some of its reps are ticked, done when all are.
    hybrid = next(cp for cp in model["capstones"] if cp["name"] == "Hybrid identity lab")
    assert (
        hybrid["status"] == "active" and hybrid["progress"] == [1, 2] and hybrid["shipsIn"] == "homelab-iac"
    )
    assert model["stats"]["capstones"] == [0, len(model["capstones"])]
    # Dates first and in order, then the lengths, which carry no date for the page to count down to.
    dated = [ck["on"] for ck in model["clocks"] if ck["on"]]
    assert dated == sorted(dated) and model["clocks"][len(dated)]["on"] == ""
    assert all(ck["what"] and ck["todo"] for ck in model["clocks"])
    assert all(model[key] for key in ("labChoices", "certChoices", "certSkipped"))
    assert ["a", "Intune free trial", INTUNE_TRIAL] in next(
        ck["what"] for ck in model["clocks"] if ck["when"] == "30 days"
    )


def test_scoreboard_and_readme() -> None:
    rm, model = model_of(REPO)
    board = scoreboard(model, rm)
    assert board.startswith(SCORE_START) and board.endswith(SCORE_END)
    assert board.count("\n| M") == 10 and "▶ up next" in board
    text = f"intro\n{SCORE_START}\nold\n{SCORE_END}\noutro\n"
    assert update_readme(text, board) == f"intro\n{board}\noutro\n"
    assert update_readme("no markers", board) is None
    assert update_readme(f"{SCORE_END}\n{SCORE_START}", board) is None


def test_scoreboard_escapes_pipes(repo: Path) -> None:
    m0 = next((repo / "milestones").glob("m0-*.md"))
    replace_in(m0, "**Proof:** A `homelab-iac` repo", "**Proof:** A | B repo")
    rm, model = model_of(repo)
    assert "A \\| B repo" in scoreboard(model, rm)
