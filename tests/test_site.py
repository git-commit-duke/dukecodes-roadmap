"""The page builder: safe tokens, a CSP that matches the inline code, deterministic output."""

from __future__ import annotations

import json
import re
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from conftest import REPO, TODAY, add_proof, replace_in, tick_rep, write

from dukecodes_roadmap.checks import Roadmap, load
from dukecodes_roadmap.content import SCORE_END, SCORE_START, Check, Milestone, Rep
from dukecodes_roadmap.site import (
    BODY_FILE,
    JS_FILES,
    Assets,
    Links,
    build_model,
    check_inline,
    hover_rule,
    inline,
    money,
    render_fragment,
    render_page,
    safe_json,
    scoreboard,
    sha256_b64,
    statuses,
    update_readme,
)

GH = "https://github.com/o/r"


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


# ---------- HTML safety ----------


def test_safe_json_cannot_close_its_script() -> None:
    data = {"x": "</script><script>alert(1)</script><!-- & \u2028\u2029"}
    s = safe_json(data)
    assert not re.search("[<>&\u2028\u2029]", s)
    assert json.loads(s) == data


def test_csp_hashes_match_the_inline_code() -> None:
    _, model = model_of(REPO)
    page = render_page(model, Assets.read(REPO))
    policy = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', page)
    assert policy is not None
    directives = {k: v for k, _, v in (d.strip().partition(" ") for d in policy.group(1).split(";"))}
    styles = re.findall(r"<style>(.*?)</style>", page, re.S)
    scripts = re.findall(r"<script>(.*?)</script>", page, re.S)
    assert len(styles) == 1 and len(scripts) == 1
    assert directives["script-src"] == f"'{sha256_b64(scripts[0])}'"
    assert directives["style-src"] == f"'{sha256_b64(styles[0])}' https://fonts.googleapis.com"
    assert directives["default-src"] == "'none'"
    assert directives["require-trusted-types-for"] == "'script'" and directives["trusted-types"] == "'none'"
    # One code script and one data block: nothing else can run.
    assert len(re.findall(r"<script\b", page)) == 2
    assert '<script type="application/json" id="data">' in page


FORBIDDEN_JS = [
    r"\.innerHTML\b", r"\.outerHTML\b", r"insertAdjacentHTML", r"document\.write", r"\beval\s*\(",
    r"\bnew\s+Function\b", r"\.srcdoc\b", r"\.cssText\b", r"setAttribute\(\s*[\"']style",
    r"createContextualFragment", r"\bDOMParser\b", r"setHTMLUnsafe", r"setTimeout\(\s*[\"'`]",
]  # fmt: skip


def test_renderer_uses_no_html_string_sinks() -> None:
    js = "\n".join((REPO / f).read_text(encoding="utf-8") for f in JS_FILES)
    found = [p for p in FORBIDDEN_JS if re.search(p, js)]
    assert found == []


def test_body_has_no_inline_code_or_styles() -> None:
    body = (REPO / BODY_FILE).read_text(encoding="utf-8")
    assert not re.search(r"<script\b|\son[a-z]+\s*=|\sstyle\s*=", body, re.I)


@pytest.mark.parametrize(
    ("kind", "text"),
    [
        ("script", "x = '</script>'"),
        ("script", "x = '</SCRIPT '"),
        ("script", "a <!-- b"),
        ("style", "}</style>"),
    ],
)
def test_inline_code_cannot_end_its_element(kind: str, text: str) -> None:
    with pytest.raises(ValueError, match="would end it early"):
        check_inline(kind, text)


def test_assets_refuse_a_closing_script_tag(repo: Path) -> None:
    js = repo / JS_FILES[0]
    js.write_text(js.read_text(encoding="utf-8") + "\nconst s = '</script>';\n", encoding="utf-8")
    with pytest.raises(ValueError, match="inline script"):
        Assets.read(repo)


def test_fragment_is_bare() -> None:
    _, model = model_of(REPO)
    frag = render_fragment(model, Assets.read(REPO))
    assert not re.search(r"<!doctype|<html\b|<head\b|<body\b", frag, re.I)
    assert frag.startswith("<title>") and 'name="claude:viewport-fit-sides" content="cover"' in frag


def test_output_is_deterministic() -> None:
    a = render_page(model_of(REPO)[1], Assets.read(REPO))
    b = render_page(model_of(REPO)[1], Assets.read(REPO))
    assert a == b


# ---------- model ----------


def test_build_model_needs_a_showcase(repo: Path) -> None:
    (repo / "showcase.toml").unlink()
    rm, _ = load(repo, TODAY)
    with pytest.raises(ValueError, match="without problems"):
        build_model(rm)


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
