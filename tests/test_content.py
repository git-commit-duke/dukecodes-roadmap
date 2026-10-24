"""Parsers: each reads what it can and reports every problem, never raising on bad content."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from conftest import REPO, has, write

from dukecodes_roadmap.content import (
    chapters_of,
    link_parts,
    parse_certs,
    parse_date,
    parse_explainer,
    parse_glossary,
    parse_ledger,
    parse_milestone,
    parse_phases,
    parse_showcase,
    parse_skills,
    parse_table,
    slugify,
    split_row,
)

# ---------- small helpers ----------


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("2026-10-24", date(2026, 10, 24)),
        ("2026-02-30", None),  # not a real day
        ("2026-1-5", None),
        ("20261024", None),  # ISO basic format: fromisoformat takes it, the ledger doesn't
        ("2026-W43-1", None),
        ("", None),
    ],
)
def test_parse_date_is_strict(text: str, expected: date | None) -> None:
    assert parse_date(text) == expected


def test_split_row() -> None:
    assert split_row("| a | b |") == ["a", "b"]
    assert split_row("a | b") is None
    assert split_row("|") is None


def test_link_parts() -> None:
    assert link_parts("[CKA](https://example.com/cka)") == ("CKA", "https://example.com/cka")
    assert link_parts("plain") == ("plain", None)


def test_slugify_and_chapters() -> None:
    assert slugify("Identity & Secrets") == "identity-and-secrets"
    assert chapters_of("Mission Control → Rack & power · Backups (restore drill)") == (
        "Rack & power",
        "Backups",
    )
    assert chapters_of("The Proxmox docs") == ()


def test_parse_table_problems(tmp_path: Path) -> None:
    header = ["A", "B"]
    _, ps = parse_table([(1, "no table here")], header, "x.md")
    assert has(ps, "expected a markdown table")
    _, ps = parse_table([], header, "x.md")
    assert has(ps, "expected a markdown table")
    _, ps = parse_table([(1, "| A | C |"), (2, "|---|---|")], header, "x.md")
    assert has(ps, r"table header must be: \| A \| B \|")
    _, ps = parse_table([(1, "| A | B |"), (2, "| x | y |")], header, "x.md")
    assert has(ps, "separator")
    rows, ps = parse_table(
        [(1, "| A | B |"), (2, "|---|:---:|"), (3, "| 1 |"), (4, "| 1 | 2 |")], header, "x.md"
    )
    assert rows == [(4, ["1", "2"])]
    assert has(ps, "x.md:3: row must have 2 cells")


# ---------- milestones ----------

GOOD = """# M0 Foundations

**Build:** Mission Control → Start here: reality check · Rack & power (10-inch)
**Proof:** A repo with a threat model
**Cert gate:** none
**Careful:** Don't wipe the wrong disk
**In plain words:** Set up one safe way to manage everything.

## Why (first principles)
Every control rests on an admin identity
an attacker can't borrow.

## Reps
- [ ] M0-R1 · Rate yourself · done when: every row has a score
- [x] M0-R2 · Sign commits · done when: GitHub shows Verified

## Break it
- Commit a fake key.

## Explain it
- `threat-modeling` · What is a trust boundary?

## Interview story
"Tell me about a control." Walk through it.

## Exit criteria
- [ ] Skills baseline rated
- [x] Threat model merged
"""


def ms_file(tmp_path: Path, text: str, name: str = "m0-foundations.md") -> Path:
    return write(tmp_path / "milestones" / name, text)


def test_parse_good_milestone(tmp_path: Path) -> None:
    ms, ps = parse_milestone(ms_file(tmp_path, GOOD), tmp_path)
    assert ps == []
    assert ms is not None
    assert (ms.id, ms.num, ms.title, ms.path) == ("M0", 0, "Foundations", "milestones/m0-foundations.md")
    assert ms.chapters == ("Start here: reality check", "Rack & power")
    assert ms.careful == "Don't wipe the wrong disk"
    assert ms.why == "Every control rests on an admin identity an attacker can't borrow."
    assert [(r.id, r.done, r.done_when) for r in ms.reps] == [
        ("M0-R1", False, "every row has a score"),
        ("M0-R2", True, "GitHub shows Verified"),
    ]
    assert [c.slug for c in ms.concepts] == ["threat-modeling"]
    assert ms.break_it == ("Commit a fake key.",)
    assert (ms.ticked, ms.total, ms.done) == (2, 4, False)


def test_milestone_done_needs_every_exit_criterion(tmp_path: Path) -> None:
    ms, _ = parse_milestone(ms_file(tmp_path, GOOD.replace("- [ ] Skills", "- [X] Skills")), tmp_path)
    assert ms is not None and ms.done


@pytest.mark.parametrize(
    ("old", "new", "message"),
    [
        ("**Cert gate:** none\n", "", r"missing \*\*Cert gate:\*\* line"),
        ("**Proof:** A repo", "**Proof:** A repo\n**Proof:** again", r"duplicate \*\*Proof:\*\* line"),
        ("**Proof:**", "**Evidence:**", r"expected one of \*\*Build"),
        ("Rate yourself ·", "Rate yourself", "rep must look like"),
        ("M0-R2", "M1-R2", "M1-R2 belongs to M1, not M0"),
        ("M0-R2", "M0-R3", "M0-R3 out of order: expected M0-R2"),
        ("- Commit a fake key.", "Commit a fake key.", "Break it items must be '- ' bullets"),
        ("- `threat-modeling` ·", "- threat-modeling ·", "concept must look like"),
        ("- `threat-modeling` ·", "- `threat--modeling` ·", "concept must look like"),
        ("- `threat-modeling` ·", "- `threat-modeling-` ·", "concept must look like"),
        ("- `threat-modeling` ·", "- `Threat-Modeling` ·", "concept must look like"),
        ("done when: every row has a score", "done when:   ", "rep must look like"),
        ("- [ ] Skills baseline rated", "- Skills baseline rated", "exit criteria must be"),
        ("Every control rests on an admin identity\nan attacker can't borrow.", "", "'Why .*' is empty"),
        ('"Tell me about a control." Walk through it.', "", "'Interview story' is empty"),
    ],
)
def test_milestone_problems(tmp_path: Path, old: str, new: str, message: str) -> None:
    assert old in GOOD
    _, ps = parse_milestone(ms_file(tmp_path, GOOD.replace(old, new)), tmp_path)
    assert has(ps, message), ps


@pytest.mark.parametrize(
    ("section", "message"),
    [("Reps", "no reps"), ("Explain it", "no concepts"), ("Exit criteria", "no exit criteria")],
)
def test_milestone_empty_sections(tmp_path: Path, section: str, message: str) -> None:
    head, _, tail = GOOD.partition(f"## {section}\n")
    rest = tail.split("\n## ", 1)
    text = head + f"## {section}\n\n" + ("## " + rest[1] if len(rest) > 1 else "")
    _, ps = parse_milestone(ms_file(tmp_path, text), tmp_path)
    assert has(ps, message), ps


def test_milestone_fatal_problems(tmp_path: Path) -> None:
    ms, ps = parse_milestone(ms_file(tmp_path, ""), tmp_path)
    assert ms is None and has(ps, "empty file")
    ms, ps = parse_milestone(ms_file(tmp_path, "# Foundations\n"), tmp_path)
    assert ms is None and has(ps, "first line must be")
    swapped = (
        GOOD.replace("## Reps", "## TEMP").replace("## Break it", "## Reps").replace("## TEMP", "## Break it")
    )
    ms, ps = parse_milestone(ms_file(tmp_path, swapped), tmp_path)
    assert ms is None and has(ps, "sections must be, in order")


def test_milestone_file_name_follows_title(tmp_path: Path) -> None:
    _, ps = parse_milestone(ms_file(tmp_path, GOOD, "m0-start.md"), tmp_path)
    assert has(ps, "file name must be m0-foundations.md")


def test_every_real_milestone_parses() -> None:
    files = sorted((REPO / "milestones").glob("*.md"))
    assert len(files) == 10
    for path in files:
        ms, ps = parse_milestone(path, REPO)
        assert ms is not None and ps == [], (path.name, ps)


# ---------- ledger ----------

HEADER = "date,milestone,rep,kind,claim,evidence,verify\n"
ROW = "2026-10-20,M0,M0-R1,lab,Rated every skill,skills-matrix.md,open the file\n"


def ledger(tmp_path: Path, text: str) -> Path:
    return write(tmp_path / "ledger.csv", text)


def test_parse_ledger_rows(tmp_path: Path) -> None:
    proofs, ps = parse_ledger(ledger(tmp_path, HEADER + ROW + "\n" + ROW.replace(",M0-R1,", ",,")), tmp_path)
    assert ps == []
    assert [(p.date, p.milestone, p.rep, p.kind) for p in proofs] == [
        (date(2026, 10, 20), "M0", "M0-R1", "lab"),
        (date(2026, 10, 20), "M0", None, "lab"),
    ]


def test_ledger_header(tmp_path: Path) -> None:
    _, ps = parse_ledger(ledger(tmp_path, ""), tmp_path)
    assert has(ps, "missing header")
    _, ps = parse_ledger(ledger(tmp_path, "date,claim\n"), tmp_path)
    assert has(ps, "header must be exactly")


@pytest.mark.parametrize(
    "cell",
    ["=HYPERLINK(1)", "+1", "-1", "@SUM(A1)", " =1", "\tx", '"two\nlines"', '"car\rriage"'],
)
def test_ledger_refuses_spreadsheet_formulas(tmp_path: Path, cell: str) -> None:
    row = f"2026-10-20,M0,M0-R1,lab,{cell},skills-matrix.md,open it\n"
    proofs, ps = parse_ledger(ledger(tmp_path, HEADER + row), tmp_path)
    assert proofs == [] and has(ps, "formula injection"), ps


@pytest.mark.parametrize(
    ("row", "message"),
    [
        ("2026-10-20,M0,lab\n", "row must have 7 columns"),
        (ROW.replace("2026-10-20", "20/10/2026"), "must be YYYY-MM-DD"),
        (ROW.replace(",M0,", ",M10,"), "must be M0 to M9"),
        (ROW.replace(",lab,", ",vibes,"), "kind 'vibes' must be one of"),
        (ROW.replace("Rated every skill", ""), "claim is empty"),
        (ROW.replace("open the file", " "), "verify is empty"),
    ],
)
def test_ledger_row_problems(tmp_path: Path, row: str, message: str) -> None:
    proofs, ps = parse_ledger(ledger(tmp_path, HEADER + row), tmp_path)
    assert proofs == [] and has(ps, message), ps


# ---------- certs ----------

CERTS_HEAD = """# Certs

## Ladder

| Cert | Code | After | Price (USD) | Format | Valid | Status | Label | Checked | Note |
|------|------|-------|-------------|--------|-------|--------|-------|---------|------|
"""
CERT = (
    "| [CKA](https://example.com/cka) | CKA | M7 | $445 | 2 h | 2 years "
    "| planned | FACT | 2026-10-24 | note |\n"
)


def certs(tmp_path: Path, rows: str) -> Path:
    return write(tmp_path / "certs.md", CERTS_HEAD + rows)


def test_parse_certs(tmp_path: Path) -> None:
    rows = CERT + CERT.replace("$445", "$70.50").replace("CKA", "TA") + CERT.replace("$445", "free")
    cs, ps = parse_certs(certs(tmp_path, rows), tmp_path)
    assert ps == []
    assert [c.price_usd for c in cs] == [Decimal(445), Decimal("70.50"), None]
    assert cs[0].url == "https://example.com/cka" and cs[0].checked == date(2026, 10, 24)


@pytest.mark.parametrize(
    ("old", "new", "message"),
    [
        ("$445", "445 USD", "price '445 USD' must look like"),
        ("planned", "dreaming", "status 'dreaming' must be one of"),
        ("FACT", "MAYBE", "label 'MAYBE' must be one of"),
        ("2026-10-24", "24/10/2026", "checked date '24/10/2026' must be YYYY-MM-DD"),
        ("[CKA](https://example.com/cka)", "CKA", "a FACT row needs an official link and a Checked date"),
    ],
)
def test_cert_problems(tmp_path: Path, old: str, new: str, message: str) -> None:
    _, ps = parse_certs(certs(tmp_path, CERT.replace(old, new, 1)), tmp_path)
    assert has(ps, message), ps


def test_certs_need_ladder(tmp_path: Path) -> None:
    _, ps = parse_certs(write(tmp_path / "certs.md", "# Certs\n"), tmp_path)
    assert has(ps, "missing '## Ladder' section")


# ---------- skills ----------

SKILLS_HEAD = (
    "# Skills\n\n## Matrix\n\n| Skill | Domain | Milestone | Score | Evidence |\n|---|---|---|---|---|\n"
)


def test_parse_skills(tmp_path: Path) -> None:
    rows = "| Git | Foundations | M0 | ? | |\n| DNS | Networking | M1 | 2 | ledger.csv |\n"
    skills, ps = parse_skills(write(tmp_path / "s.md", SKILLS_HEAD + rows), tmp_path)
    assert ps == [] and [s.score for s in skills] == [None, 2]


@pytest.mark.parametrize(
    ("rows", "message"),
    [
        ("| Git | F | M0 | ? | |\n| git | F | M0 | ? | |\n", "duplicate skill 'git'"),
        ("| Git | F | M10 | ? | |\n", "milestone 'M10' must be M0 to M9"),
        ("| Git | F | M0 | 5 | |\n", "score '5' must be"),
        ("| Git | F | M0 | 3 | |\n", "'Git' is rated 3: add evidence or lower it"),
    ],
)
def test_skill_problems(tmp_path: Path, rows: str, message: str) -> None:
    _, ps = parse_skills(write(tmp_path / "s.md", SKILLS_HEAD + rows), tmp_path)
    assert has(ps, message), ps


def test_skills_need_matrix(tmp_path: Path) -> None:
    _, ps = parse_skills(write(tmp_path / "s.md", "# Skills\n"), tmp_path)
    assert has(ps, "missing '## Matrix' section")


# ---------- glossary ----------


def test_parse_glossary(tmp_path: Path) -> None:
    text = "## Terms\n\n- **ADR**: A note.\n- **age**: A tool.\n- **Zero trust**: Verify.\n"
    terms, ps = parse_glossary(write(tmp_path / "g.md", text), tmp_path)
    assert ps == [] and [t.term for t in terms] == ["ADR", "age", "Zero trust"]


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ("- **B**: b.\n- **A**: a.\n", "'A' is out of alphabetical order"),
        ("- **A**: a.\n- **a**: again.\n", "duplicate term 'a'"),
        ("- A: a.\n", "term must look like"),
    ],
)
def test_glossary_problems(tmp_path: Path, body: str, message: str) -> None:
    _, ps = parse_glossary(write(tmp_path / "g.md", "## Terms\n" + body), tmp_path)
    assert has(ps, message), ps


def test_glossary_needs_terms(tmp_path: Path) -> None:
    _, ps = parse_glossary(write(tmp_path / "g.md", "# Glossary\n"), tmp_path)
    assert has(ps, "missing '## Terms' section")


# ---------- explainers ----------


def test_parse_explainer(tmp_path: Path) -> None:
    path = write(
        tmp_path / "concepts" / "threat-modeling.md",
        "# Threat modeling\n\n**Reviewed:** 2026-10-20 · a peer\n",
    )
    ex, ps = parse_explainer(path, tmp_path)
    assert ps == [] and ex is not None
    assert (ex.slug, ex.title, ex.reviewed) == ("threat-modeling", "Threat modeling", date(2026, 10, 20))
    ex, ps = parse_explainer(write(path, "# T\n\n**Reviewed:** 2026-02-30\n"), tmp_path)
    assert ex is not None and ex.reviewed is None and has(ps, "Reviewed date must be a real")
    ex, ps = parse_explainer(write(path, "no title\n"), tmp_path)
    assert ex is None and has(ps, "first line must be")


# ---------- phases ----------

PHASES_HEAD = "## Phases and cert gates\n\n| Phase | Milestones | Cert gate |\n|---|---|---|\n"


def test_parse_phases(tmp_path: Path) -> None:
    text = PHASES_HEAD + "| 1 Foundation | M0, M1 | none |\n| Two | M2 | x |\n| 3 Ship | M3, X4 | y |\n"
    phases, ps = parse_phases(write(tmp_path / "roadmap.md", text), tmp_path)
    assert [(p.num, p.title, p.milestones) for p in phases] == [(1, "Foundation", ("M0", "M1"))]
    assert has(ps, "phase 'Two' must look like") and has(ps, "milestones 'M3, X4' must look like")
    _, ps = parse_phases(write(tmp_path / "roadmap.md", "# Roadmap\n"), tmp_path)
    assert has(ps, "missing '## Phases and cert gates' section")


# ---------- showcase.toml ----------

SITE = """[site]
title = "t"
owner = "o"
repo = "https://github.com/a/b"
branch = "main"
eyebrow = "e"
badge = "b"
headline = ["one", "two"]
lede = "l"
description = "d"
footer = "f"

[mission_control]
chapters = ["A"]
"""
SIM = """
[simulator]
title = "s"
[[simulator.gates]]
id = "g"
name = "n"
where = "w"
zone = "local"
doing = "d"
ok = "k"
[[simulator.scenarios]]
title = "t"
summary = "s"
cmd = "c"
lesson = "l"
"""


def showcase(tmp_path: Path, text: str) -> Path:
    return write(tmp_path / "showcase.toml", text)


def test_real_showcase_parses() -> None:
    sc, ps = parse_showcase(REPO / "showcase.toml", REPO)
    assert ps == [] and sc is not None
    assert sc.repo.startswith("https://github.com/") and sc.branch == "main"
    assert "Install Proxmox" in sc.chapters and sc.site("owner") == "Duke"


def test_minimal_showcase_parses(tmp_path: Path) -> None:
    sc, ps = parse_showcase(showcase(tmp_path, SITE + SIM), tmp_path)
    assert ps == [] and sc is not None and sc.chapters == ("A",)


@pytest.mark.parametrize(
    ("text", "message"),
    [
        ("[site\n", "invalid TOML"),
        ("title = 'x'\n", r"missing \[site\] table"),
        (SITE.replace('title = "t"\n', ""), r"\[site\] needs 'title' \(str\)"),
        (SITE.replace('["one", "two"]', '["a", "b", "c"]'), "headline must be two strings"),
        (SITE.replace("https://github.com/a/b", "https://gitlab.com/a/b"), "repo must be https://github.com"),
        (SITE.replace('[mission_control]\nchapters = ["A"]\n', ""), r"missing \[mission_control\] chapters"),
        ("simulator = 1\n" + SITE, r"\[simulator\] must be a table"),
        (SITE + "[simulator]\ntitle = 's'\n", r"needs \[\[simulator.gates\]\]"),
        (SITE + SIM.replace('ok = "k"\n', ""), "each gate needs id"),
        (SITE + SIM.replace('zone = "local"', 'zone = "cloud"'), "gate 'g' zone must be local or ci"),
        (SITE + SIM.replace('lesson = "l"\n', ""), "each scenario needs title"),
        (SITE + SIM + 'blockAt = "nope"\n', "blockAt must name a gate and have a finding"),
        (SITE + SIM + 'blockAt = "g"\n', "blockAt must name a gate and have a finding"),
        (SITE + SIM + 'skip = ["nope"]\n', "skip 'nope' is not a gate"),
        (SITE + "[lab]\ntitle = 'x'\n", r"\[lab\] needs a nodes list"),
        (SITE + "[[loop]]\ntitle = 'x'\n", r"each \[\[loop\]\] needs a 'text' string"),
        (SITE + "[[start]]\ntext = 'x'\nhref = 'javascript:alert(1)'\n", "must be '#view' or https://"),
        (
            SITE + "[final]\ncta = [{ text = 'x', href = 'http://example.com' }]\n",
            "must be '#view' or https://",
        ),
    ],
)
def test_showcase_problems(tmp_path: Path, text: str, message: str) -> None:
    sc, ps = parse_showcase(showcase(tmp_path, text), tmp_path)
    assert sc is None and has(ps, message), ps
