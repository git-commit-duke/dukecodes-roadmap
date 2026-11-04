"""Parse the roadmap's source files into typed records.

Parsers never raise on bad content. Each returns what it could read plus a list of
Problems, so `roadmap check` reports every issue in one run.
"""

from __future__ import annotations

import csv
import io
import re
import tomllib
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

# ---------- shared ----------


# README block that `roadmap build` rewrites. Shared by the builder and the link check.
SCORE_START = "<!-- scoreboard:start -->"
SCORE_END = "<!-- scoreboard:end -->"


@dataclass(frozen=True, order=True)
class Problem:
    path: str
    line: int
    message: str

    def __str__(self) -> str:
        return f"{self.path}:{self.line}: {self.message}"


DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MILESTONE_ID_RE = re.compile(r"^M\d$")
LINK_RE = re.compile(r"!?\[([^\]]*)\]\(([^)\s]+)\)")
# Cells starting with these run as formulas when a CSV is opened in a spreadsheet.
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def parse_date(text: str) -> date | None:
    """Strict YYYY-MM-DD. `date.fromisoformat` alone also accepts other ISO forms."""
    if not DATE_RE.match(text):
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def rel(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def numbered(text: str) -> list[tuple[int, str]]:
    return list(enumerate(text.splitlines(), start=1))


def sections(lines: list[tuple[int, str]]) -> dict[str, list[tuple[int, str]]]:
    """Group lines under their `## ` heading. Lines before the first heading are under ''."""
    out: dict[str, list[tuple[int, str]]] = {"": []}
    current = ""
    for n, line in lines:
        if line.startswith("## "):
            current = line[3:].strip()
            out.setdefault(current, [])
            continue
        out[current].append((n, line))
    return out


def heading_line(lines: list[tuple[int, str]], title: str) -> int:
    for n, line in lines:
        if line == f"## {title}":
            return n
    return 1


# ---------- markdown tables ----------


def split_row(line: str) -> list[str] | None:
    s = line.strip()
    if not (s.startswith("|") and s.endswith("|")) or len(s) < 2:
        return None
    return [c.strip() for c in s[1:-1].split("|")]


SEPARATOR_RE = re.compile(r"^:?-{3,}:?$")


def parse_table(
    lines: list[tuple[int, str]], header: list[str], path: str
) -> tuple[list[tuple[int, list[str]]], list[Problem]]:
    """Read the first markdown table in `lines` and check its header is exactly `header`."""
    problems: list[Problem] = []
    rows: list[tuple[int, list[str]]] = []
    table = [(n, line) for n, line in lines if line.strip().startswith("|")]
    if len(table) < 2:
        n = lines[0][0] if lines else 1
        return rows, [Problem(path, n, "expected a markdown table")]
    (hn, hline), (sn, sline) = table[0], table[1]
    got = split_row(hline)
    if got != header:
        problems.append(Problem(path, hn, f"table header must be: | {' | '.join(header)} |"))
        return rows, problems
    sep = split_row(sline)
    if sep is None or len(sep) != len(header) or not all(SEPARATOR_RE.match(c) for c in sep):
        problems.append(Problem(path, sn, "second table line must be the --- separator"))
        return rows, problems
    for n, line in table[2:]:
        cells = split_row(line)
        if cells is None or len(cells) != len(header):
            problems.append(Problem(path, n, f"row must have {len(header)} cells"))
            continue
        rows.append((n, cells))
    return rows, problems


def link_parts(cell: str) -> tuple[str, str | None]:
    """`[text](url)` -> (text, url). Anything else -> (cell, None)."""
    m = re.fullmatch(r"\[([^\]]+)\]\(([^)\s]+)\)", cell)
    if m:
        return m.group(1), m.group(2)
    return cell, None


# ---------- milestones ----------

TITLE_RE = re.compile(r"^# M(\d) (.+)$")
META_RE = re.compile(r"^\*\*([A-Za-z ]+):\*\* (.+)$")
META_KEYS = {
    "Build": "build",
    "Proof": "proof",
    "Cert gate": "cert",
    "Careful": "careful",
    "In plain words": "plain",
}
REQUIRED_META = ("Build", "Proof", "Cert gate", "In plain words")
SECTION_ORDER = (
    "Why (first principles)",
    "Reps",
    "Break it",
    "Explain it",
    "Interview story",
    "Exit criteria",
)
REP_RE = re.compile(r"^- \[([ xX])\] (M(\d)-R(\d+)) · (.+)$")
DONE_WHEN = " · done when: "  # split with str.partition, which can't backtrack
CHECK_RE = re.compile(r"^- \[([ xX])\] (.+)$")
CONCEPT_RE = re.compile(r"^- `([a-z0-9-]+)` · (.+)$")  # kebab-case is checked in code, not a nested regex
BULLET_RE = re.compile(r"^- (.+)$")
MC_PREFIX = "Mission Control → "


@dataclass(frozen=True)
class Rep:
    id: str
    text: str
    done_when: str
    done: bool
    line: int


@dataclass(frozen=True)
class Check:
    text: str
    done: bool
    line: int


@dataclass(frozen=True)
class ConceptRef:
    slug: str
    question: str
    milestone: str
    line: int


@dataclass(frozen=True)
class Milestone:
    id: str
    num: int
    title: str
    path: str
    build: str
    chapters: tuple[str, ...]
    proof: str
    cert: str
    careful: str | None
    plain: str
    why: str
    reps: tuple[Rep, ...]
    break_it: tuple[str, ...]
    concepts: tuple[ConceptRef, ...]
    story: str
    exit: tuple[Check, ...]

    @property
    def done(self) -> bool:
        return bool(self.exit) and all(c.done for c in self.exit)

    @property
    def ticked(self) -> int:
        return sum(r.done for r in self.reps) + sum(c.done for c in self.exit)

    @property
    def total(self) -> int:
        return len(self.reps) + len(self.exit)


def slugify(title: str) -> str:
    s = title.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def chapters_of(build: str) -> tuple[str, ...]:
    """'Mission Control → A · B (detail)' -> ('A', 'B'). Other Build lines name no chapter."""
    if not build.startswith(MC_PREFIX):
        return ()
    parts = build[len(MC_PREFIX) :].split(" · ")
    return tuple(re.sub(r"\s*\(.*\)$", "", p).strip() for p in parts if p.strip())


def _paragraph(lines: list[tuple[int, str]]) -> str:
    return " ".join(line.strip() for _, line in lines if line.strip())


def parse_milestone(path: Path, root: Path) -> tuple[Milestone | None, list[Problem]]:
    p = rel(path, root)
    lines = numbered(path.read_text(encoding="utf-8"))
    problems: list[Problem] = []
    if not lines:
        return None, [Problem(p, 1, "empty file")]
    m = TITLE_RE.match(lines[0][1])
    if not m:
        return None, [Problem(p, 1, "first line must be '# M<n> <Title>'")]
    num, title = int(m.group(1)), m.group(2).strip()
    mid = f"M{num}"
    expected = f"m{num}-{slugify(title)}.md"
    if path.name != expected:
        problems.append(Problem(p, 1, f"file name must be {expected} for this title"))

    secs = sections(lines[1:])
    meta: dict[str, str] = {}
    for n, line in secs[""]:
        if not line.strip():
            continue
        mm = META_RE.match(line)
        if not mm or mm.group(1) not in META_KEYS:
            problems.append(Problem(p, n, f"expected one of **{'**, **'.join(META_KEYS)}:** lines"))
            continue
        key = META_KEYS[mm.group(1)]
        if key in meta:
            problems.append(Problem(p, n, f"duplicate **{mm.group(1)}:** line"))
        meta[key] = mm.group(2).strip()
    for k in REQUIRED_META:
        if META_KEYS[k] not in meta:
            problems.append(Problem(p, 1, f"missing **{k}:** line"))

    found = [s for s in secs if s]
    if tuple(found) != SECTION_ORDER:
        problems.append(
            Problem(
                p,
                1,
                f"sections must be, in order: {', '.join(SECTION_ORDER)}; found: "
                f"{', '.join(found) or 'none'}",
            )
        )
        return None, problems

    reps: list[Rep] = []
    for n, line in secs["Reps"]:
        if not line.strip():
            continue
        rm = REP_RE.match(line)
        text, sep, done_when = rm.group(5).partition(DONE_WHEN) if rm else ("", "", "")
        if not (rm and sep and text.strip() and done_when.strip()):
            problems.append(
                Problem(p, n, f"rep must look like '- [ ] {mid}-R1 · what to do · done when: test'")
            )
            continue
        rid = rm.group(2)
        if int(rm.group(3)) != num:
            problems.append(Problem(p, n, f"{rid} belongs to M{rm.group(3)}, not {mid}"))
        if int(rm.group(4)) != len(reps) + 1:
            problems.append(Problem(p, n, f"{rid} out of order: expected {mid}-R{len(reps) + 1}"))
        reps.append(Rep(rid, text.strip(), done_when.strip(), rm.group(1) != " ", n))
    if not reps:
        problems.append(Problem(p, heading_line(lines, "Reps"), "no reps"))

    break_it: list[str] = []
    for n, line in secs["Break it"]:
        if not line.strip():
            continue
        bm = BULLET_RE.match(line)
        if not bm:
            problems.append(Problem(p, n, "Break it items must be '- ' bullets"))
            continue
        break_it.append(bm.group(1).strip())

    concepts: list[ConceptRef] = []
    for n, line in secs["Explain it"]:
        if not line.strip():
            continue
        cm = CONCEPT_RE.match(line)
        if not cm or "--" in cm.group(1) or cm.group(1).strip("-") != cm.group(1):
            problems.append(Problem(p, n, "concept must look like '- `kebab-slug` · question?'"))
            continue
        concepts.append(ConceptRef(cm.group(1), cm.group(2).strip(), mid, n))
    if not concepts:
        problems.append(Problem(p, heading_line(lines, "Explain it"), "no concepts"))

    exits: list[Check] = []
    for n, line in secs["Exit criteria"]:
        if not line.strip():
            continue
        em = CHECK_RE.match(line)
        if not em:
            problems.append(Problem(p, n, "exit criteria must be '- [ ] ' checkboxes"))
            continue
        exits.append(Check(em.group(2).strip(), em.group(1) != " ", n))
    if not exits:
        problems.append(Problem(p, heading_line(lines, "Exit criteria"), "no exit criteria"))

    why = _paragraph(secs["Why (first principles)"])
    story = _paragraph(secs["Interview story"])
    for name, value in (("Why (first principles)", why), ("Interview story", story)):
        if not value:
            problems.append(Problem(p, heading_line(lines, name), f"'{name}' is empty"))

    build = meta.get("build", "")
    ms = Milestone(
        id=mid,
        num=num,
        title=title,
        path=p,
        build=build,
        chapters=chapters_of(build),
        proof=meta.get("proof", ""),
        cert=meta.get("cert", ""),
        careful=meta.get("careful"),
        plain=meta.get("plain", ""),
        why=why,
        reps=tuple(reps),
        break_it=tuple(break_it),
        concepts=tuple(concepts),
        story=story,
        exit=tuple(exits),
    )
    return ms, problems


# ---------- evidence ledger ----------

LEDGER_HEADER = ["date", "milestone", "rep", "kind", "claim", "evidence", "verify"]
KINDS = ("lab", "project", "concept", "cert", "incident", "decision", "drill", "review")


@dataclass(frozen=True)
class Proof:
    date: date
    milestone: str
    rep: str | None
    kind: str
    claim: str
    evidence: str
    verify: str
    line: int


def parse_ledger(path: Path, root: Path) -> tuple[list[Proof], list[Problem]]:
    p = rel(path, root)
    problems: list[Problem] = []
    proofs: list[Proof] = []
    reader = csv.reader(io.StringIO(path.read_text(encoding="utf-8"), newline=""))
    try:
        header = next(reader)
    except StopIteration:
        return proofs, [Problem(p, 1, f"missing header: {','.join(LEDGER_HEADER)}")]
    if header != LEDGER_HEADER:
        return proofs, [Problem(p, 1, f"header must be exactly: {','.join(LEDGER_HEADER)}")]
    for row in reader:
        n = reader.line_num
        if not row:
            continue
        if len(row) != len(LEDGER_HEADER):
            problems.append(Problem(p, n, f"row must have {len(LEDGER_HEADER)} columns"))
            continue
        bad = [
            c
            for c in row
            if c.startswith(FORMULA_PREFIXES)
            or c.lstrip().startswith(FORMULA_PREFIXES[:4])
            or "\n" in c
            or "\r" in c
        ]
        if bad:
            problems.append(
                Problem(
                    p, n, "a cell starts with = + - @ or holds a line break (spreadsheet formula injection)"
                )
            )
            continue
        d_s, mid, rep, kind, claim, evidence, verify = (c.strip() for c in row)
        d = parse_date(d_s)
        if d is None:
            problems.append(Problem(p, n, f"date '{d_s}' must be YYYY-MM-DD"))
            continue
        if not MILESTONE_ID_RE.match(mid):
            problems.append(Problem(p, n, f"milestone '{mid}' must be M0 to M9"))
            continue
        if kind not in KINDS:
            problems.append(Problem(p, n, f"kind '{kind}' must be one of: {', '.join(KINDS)}"))
            continue
        for name, value in (("claim", claim), ("evidence", evidence), ("verify", verify)):
            if not value:
                problems.append(Problem(p, n, f"{name} is empty"))
        if not (claim and evidence and verify):
            continue
        proofs.append(Proof(d, mid, rep or None, kind, claim, evidence, verify, n))
    return proofs, problems


# ---------- certs ----------

CERT_HEADER = [
    "Cert", "Code", "After", "Price (USD)", "Format", "Valid",
    "Status", "Label", "Checked", "Note",
]  # fmt: skip
CERT_STATUSES = (
    "planned", "optional", "later", "studying", "booked", "passed", "expired", "skipped",
)  # fmt: skip
CERT_LABELS = ("FACT", "COMMUNITY", "UNVERIFIED")
PRICE_RE = re.compile(r"^\$(\d{1,5}(?:\.\d{2})?)$")


@dataclass(frozen=True)
class Cert:
    name: str
    url: str | None
    code: str
    after: str
    price: str
    price_usd: Decimal | None
    format: str
    valid: str
    status: str
    label: str
    checked: date | None
    note: str
    line: int


def parse_certs(path: Path, root: Path) -> tuple[list[Cert], list[Problem]]:
    p = rel(path, root)
    secs = sections(numbered(path.read_text(encoding="utf-8")))
    if "Ladder" not in secs:
        return [], [Problem(p, 1, "missing '## Ladder' section")]
    rows, problems = parse_table(secs["Ladder"], CERT_HEADER, p)
    certs: list[Cert] = []
    for n, c in rows:
        name, url = link_parts(c[0])
        price_usd: Decimal | None = None
        pm = PRICE_RE.match(c[3])
        if pm:
            try:
                price_usd = Decimal(pm.group(1))
            except InvalidOperation:  # pragma: no cover - the regex already guards this
                price_usd = None
        elif c[3] not in ("—", "free"):
            problems.append(Problem(p, n, f"price '{c[3]}' must look like $70.50, — or free"))
        if c[6] not in CERT_STATUSES:
            problems.append(Problem(p, n, f"status '{c[6]}' must be one of: {', '.join(CERT_STATUSES)}"))
        if c[7] not in CERT_LABELS:
            problems.append(Problem(p, n, f"label '{c[7]}' must be one of: {', '.join(CERT_LABELS)}"))
        checked = parse_date(c[8]) if c[8] else None
        if c[8] and checked is None:
            problems.append(Problem(p, n, f"checked date '{c[8]}' must be YYYY-MM-DD"))
        if c[7] == "FACT" and not (url and checked):
            problems.append(Problem(p, n, "a FACT row needs an official link and a Checked date"))
        certs.append(Cert(name, url, c[1], c[2], c[3], price_usd, c[4], c[5], c[6], c[7], checked, c[9], n))
    return certs, problems


# ---------- skills ----------

SKILL_HEADER = ["Skill", "Domain", "Milestone", "Score", "Evidence"]


@dataclass(frozen=True)
class Skill:
    name: str
    domain: str
    milestone: str
    score: int | None
    evidence: str
    line: int


def parse_skills(path: Path, root: Path) -> tuple[list[Skill], list[Problem]]:
    p = rel(path, root)
    secs = sections(numbered(path.read_text(encoding="utf-8")))
    if "Matrix" not in secs:
        return [], [Problem(p, 1, "missing '## Matrix' section")]
    rows, problems = parse_table(secs["Matrix"], SKILL_HEADER, p)
    skills: list[Skill] = []
    seen: set[str] = set()
    for n, c in rows:
        name, domain, mid, score_s, evidence = c
        if name.lower() in seen:
            problems.append(Problem(p, n, f"duplicate skill '{name}'"))
        seen.add(name.lower())
        if not MILESTONE_ID_RE.match(mid):
            problems.append(Problem(p, n, f"milestone '{mid}' must be M0 to M9"))
        score: int | None = None
        if score_s in ("0", "1", "2", "3"):
            score = int(score_s)
        elif score_s != "?":
            problems.append(Problem(p, n, f"score '{score_s}' must be ?, 0, 1, 2 or 3"))
        if score is not None and score >= 2 and not evidence:
            problems.append(Problem(p, n, f"'{name}' is rated {score}: add evidence or lower it"))
        skills.append(Skill(name, domain, mid, score, evidence, n))
    return skills, problems


# ---------- labs and projects ----------

LAB_HEADER = ["Lab", "Reps", "Tools", "Resource", "Cost", "Checked"]
PROJECT_HEADER = ["Project", "Milestones", "What it is", "Security built in", "Status"]
PROJECT_STATUSES = ("planned", "building", "shipped")
REP_ID_RE = re.compile(r"^M\d-R\d+$")
COST_RE = re.compile(r"^(?:free|\$\d{1,5}(?:\.\d{2})?(?:/(?:month|year))?)$")
NONE = "—"


@dataclass(frozen=True)
class Lab:
    name: str
    reps: tuple[str, ...]
    tools: str
    resource: str
    url: str | None
    cost: str
    checked: date | None
    line: int


@dataclass(frozen=True)
class Project:
    name: str
    url: str | None
    milestones: tuple[str, ...]  # empty: every milestone ("all")
    what: str
    security: str
    status: str
    line: int


def _ids(cell: str) -> list[str]:
    return [x.strip() for x in cell.split(",")]


def _parse_lab(p: str, n: int, c: list[str], problems: list[Problem]) -> Lab:
    name, reps_s, tools, resource, cost, checked_s = c
    reps = _ids(reps_s)
    bad = [r for r in reps if not REP_ID_RE.match(r)]
    if bad:
        problems.append(Problem(p, n, f"reps '{reps_s}' must look like 'M5-R1, M5-R2'"))
    elif len(set(reps)) != len(reps):
        problems.append(Problem(p, n, f"reps '{reps_s}' lists a rep twice"))
    if not tools:
        problems.append(Problem(p, n, f"'{name}' needs its tools"))
    text, url = link_parts(resource)
    if url is None and resource != NONE:
        problems.append(Problem(p, n, f"resource '{resource}' must be a [name](https://...) link or —"))
    if url and not url.startswith("https://"):
        problems.append(Problem(p, n, "lab links must be https"))
    if cost != NONE and not COST_RE.match(cost):
        problems.append(Problem(p, n, f"cost '{cost}' must look like free, $49, $16/month or —"))
    if url and cost == NONE:
        problems.append(Problem(p, n, "a linked resource needs its cost: free or a price"))
    checked = parse_date(checked_s) if checked_s != NONE else None
    if checked_s != NONE and checked is None:
        problems.append(Problem(p, n, f"checked date '{checked_s}' must be YYYY-MM-DD or —"))
    if url and checked_s == NONE:
        problems.append(Problem(p, n, "a linked resource needs the date you checked it"))
    if url is None and checked is not None:
        problems.append(Problem(p, n, "a Checked date needs a linked resource"))
    return Lab(name, tuple(reps), tools, text, url, cost, checked, n)


def _parse_project(p: str, n: int, c: list[str], problems: list[Problem]) -> Project:
    cell, ms, what, security, status = c
    name, url = link_parts(cell)
    if url and not url.startswith("https://"):
        problems.append(Problem(p, n, "project links must be https"))
    ids = () if ms == "all" else tuple(_ids(ms))
    if not all(MILESTONE_ID_RE.match(x) for x in ids):
        problems.append(Problem(p, n, f"milestones '{ms}' must look like 'M5, M6' or be all"))
    elif len(set(ids)) != len(ids):
        problems.append(Problem(p, n, f"milestones '{ms}' lists a milestone twice"))
    if not (what and security):
        problems.append(Problem(p, n, f"'{name}' needs what it is and the security built in"))
    if status not in PROJECT_STATUSES:
        problems.append(Problem(p, n, f"status '{status}' must be one of: {', '.join(PROJECT_STATUSES)}"))
    return Project(name, url, ids, what, security, status, n)


def parse_labs(path: Path, root: Path) -> tuple[list[Lab], list[Project], list[Problem]]:
    """labs.md: a Labs table (reps grouped into labs) and a Projects table."""
    p = rel(path, root)
    secs = sections(numbered(path.read_text(encoding="utf-8")))
    labs: list[Lab] = []
    projects: list[Project] = []
    problems: list[Problem] = []
    for title, header in (("Labs", LAB_HEADER), ("Projects", PROJECT_HEADER)):
        if title not in secs:
            problems.append(Problem(p, 1, f"missing '## {title}' section"))
            continue
        rows, ps = parse_table(secs[title], header, p)
        problems += ps
        seen: set[str] = set()
        for n, c in rows:
            if not c[0]:
                problems.append(Problem(p, n, "every row needs a name"))
                continue
            item = _parse_lab(p, n, c, problems) if title == "Labs" else _parse_project(p, n, c, problems)
            key = item.name.casefold()
            if key in seen:
                problems.append(Problem(p, n, f"duplicate {title[:-1].lower()} '{item.name}'"))
            seen.add(key)
            if isinstance(item, Lab):
                labs.append(item)
            else:
                projects.append(item)
    return labs, projects, problems


# ---------- glossary ----------

TERM_RE = re.compile(r"^- \*\*(.+?)\*\*: (.+)$")


@dataclass(frozen=True)
class Term:
    term: str
    definition: str
    line: int


def parse_glossary(path: Path, root: Path) -> tuple[list[Term], list[Problem]]:
    p = rel(path, root)
    secs = sections(numbered(path.read_text(encoding="utf-8")))
    if "Terms" not in secs:
        return [], [Problem(p, 1, "missing '## Terms' section")]
    problems: list[Problem] = []
    terms: list[Term] = []
    seen: set[str] = set()
    for n, line in secs["Terms"]:
        if not line.strip():
            continue
        m = TERM_RE.match(line)
        if not m:
            problems.append(Problem(p, n, "term must look like '- **Term**: definition.'"))
            continue
        term, definition = m.group(1).strip(), m.group(2).strip()
        key = term.casefold()
        if key in seen:
            problems.append(Problem(p, n, f"duplicate term '{term}'"))
        if terms and key < terms[-1].term.casefold():
            problems.append(Problem(p, n, f"'{term}' is out of alphabetical order"))
        seen.add(key)
        terms.append(Term(term, definition, n))
    return terms, problems


# ---------- concept explainers ----------

REVIEWED_RE = re.compile(r"^\*\*Reviewed:\*\* (\d{4}-\d{2}-\d{2})\b(.*)$")


@dataclass(frozen=True)
class Explainer:
    slug: str
    title: str
    path: str
    reviewed: date | None


def parse_explainer(path: Path, root: Path) -> tuple[Explainer | None, list[Problem]]:
    p = rel(path, root)
    lines = numbered(path.read_text(encoding="utf-8"))
    if not lines or not lines[0][1].startswith("# "):
        return None, [Problem(p, 1, "first line must be '# <title>'")]
    reviewed: date | None = None
    problems: list[Problem] = []
    for n, line in lines:
        rm = REVIEWED_RE.match(line)
        if rm:
            reviewed = parse_date(rm.group(1))
            if reviewed is None:
                problems.append(Problem(p, n, "Reviewed date must be a real YYYY-MM-DD date"))
    return Explainer(path.stem, lines[0][1][2:].strip(), p, reviewed), problems


# ---------- phases (roadmap.md) ----------

PHASE_HEADER = ["Phase", "Milestones", "Cert gate"]
PHASE_SECTION = "Phases and cert gates"


@dataclass(frozen=True)
class Phase:
    num: int
    title: str
    milestones: tuple[str, ...]
    gate: str
    line: int


def parse_phases(path: Path, root: Path) -> tuple[list[Phase], list[Problem]]:
    p = rel(path, root)
    secs = sections(numbered(path.read_text(encoding="utf-8")))
    if PHASE_SECTION not in secs:
        return [], [Problem(p, 1, f"missing '## {PHASE_SECTION}' section")]
    rows, problems = parse_table(secs[PHASE_SECTION], PHASE_HEADER, p)
    phases: list[Phase] = []
    for n, (ph, ms, gate) in rows:
        m = re.fullmatch(r"(\d) (.+)", ph)
        if not m:
            problems.append(Problem(p, n, f"phase '{ph}' must look like '1 Foundation'"))
            continue
        ids = tuple(x.strip() for x in ms.split(","))
        if not all(MILESTONE_ID_RE.match(x) for x in ids):
            problems.append(Problem(p, n, f"milestones '{ms}' must look like 'M0, M1'"))
            continue
        phases.append(Phase(int(m.group(1)), m.group(2), ids, gate, n))
    return phases, problems


# ---------- showcase.toml ----------


@dataclass(frozen=True)
class Showcase:
    raw: dict[str, Any]

    def site(self, key: str) -> Any:
        return self.raw["site"][key]

    @property
    def repo(self) -> str:
        return str(self.raw["site"]["repo"])

    @property
    def branch(self) -> str:
        return str(self.raw["site"]["branch"])

    @property
    def chapters(self) -> tuple[str, ...]:
        return tuple(self.raw["mission_control"]["chapters"])


SITE_KEYS = {
    "title": str, "owner": str, "repo": str, "branch": str, "eyebrow": str,
    "badge": str, "headline": list, "lede": str, "description": str, "footer": str,
}  # fmt: skip


def parse_showcase(path: Path, root: Path) -> tuple[Showcase | None, list[Problem]]:
    p = rel(path, root)
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as e:
        return None, [Problem(p, getattr(e, "lineno", 1) or 1, f"invalid TOML: {e}")]
    problems: list[Problem] = []
    site = raw.get("site")
    if not isinstance(site, dict):
        return None, [Problem(p, 1, "missing [site] table")]
    for key, typ in SITE_KEYS.items():
        if not isinstance(site.get(key), typ):
            problems.append(Problem(p, 1, f"[site] needs '{key}' ({typ.__name__})"))
    headline = site.get("headline")
    if isinstance(headline, list) and (len(headline) != 2 or not all(isinstance(h, str) for h in headline)):
        problems.append(Problem(p, 1, "[site] headline must be two strings"))
    repo = site.get("repo")
    if isinstance(repo, str) and not re.fullmatch(r"https://github\.com/[\w.-]+/[\w.-]+", repo):
        problems.append(Problem(p, 1, "[site] repo must be https://github.com/<owner>/<name>"))
    mc = raw.get("mission_control")
    if not isinstance(mc, dict) or not isinstance(mc.get("chapters"), list):
        problems.append(Problem(p, 1, "missing [mission_control] chapters list"))
    sim = raw.get("simulator")
    if sim is not None:
        problems += _check_simulator(sim, p)
    lab = raw.get("lab")
    if lab is not None and not (isinstance(lab, dict) and isinstance(lab.get("nodes"), list)):
        problems.append(Problem(p, 1, "[lab] needs a nodes list"))
    for table, key in (("loop", "text"), ("start", "text")):
        items = raw.get(table, [])
        if not isinstance(items, list) or not all(isinstance(x, dict) and isinstance(x.get(key), str)
                                                  for x in items):  # fmt: skip
            problems.append(Problem(p, 1, f"each [[{table}]] needs a '{key}' string"))
    hrefs = [x.get("href") for x in raw.get("start", []) if isinstance(x, dict)]
    final = raw.get("final")
    if isinstance(final, dict):
        hrefs += [c.get("href") for c in final.get("cta", []) if isinstance(c, dict)]
    for h in hrefs:
        if not (isinstance(h, str) and (re.fullmatch(r"#[A-Za-z0-9._~-]+", h) or h.startswith("https://"))):
            problems.append(Problem(p, 1, f"link '{h}' must be '#view' or https://"))
    if problems:
        return None, problems
    return Showcase(raw), problems


def _check_simulator(sim: Any, p: str) -> list[Problem]:
    if not isinstance(sim, dict):
        return [Problem(p, 1, "[simulator] must be a table")]
    gates, scenarios = sim.get("gates"), sim.get("scenarios")
    if not isinstance(gates, list) or not isinstance(scenarios, list) or not gates or not scenarios:
        return [Problem(p, 1, "[simulator] needs [[simulator.gates]] and [[simulator.scenarios]]")]
    problems: list[Problem] = []
    ids: set[str] = set()
    for g in gates:
        if not all(isinstance(g.get(k), str) for k in ("id", "name", "where", "zone", "doing", "ok")):
            problems.append(Problem(p, 1, "each gate needs id, name, where, zone, doing and ok"))
            continue
        if g["zone"] not in ("local", "ci"):
            problems.append(Problem(p, 1, f"gate '{g['id']}' zone must be local or ci"))
        ids.add(g["id"])
    for s in scenarios:
        if not all(isinstance(s.get(k), str) for k in ("title", "summary", "cmd", "lesson")):
            problems.append(Problem(p, 1, "each scenario needs title, summary, cmd and lesson"))
            continue
        block = s.get("blockAt")
        if block is not None and (block not in ids or not isinstance(s.get("finding"), str)):
            problems.append(
                Problem(p, 1, f"scenario '{s['title']}': blockAt must name a gate and have a finding")
            )
        skip = s.get("skip", [])
        if not isinstance(skip, list):
            problems.append(Problem(p, 1, f"scenario '{s['title']}': skip must be a list of gate ids"))
            continue
        for sk in skip:
            if sk not in ids:
                problems.append(Problem(p, 1, f"scenario '{s['title']}': skip '{sk}' is not a gate"))
        if skip and not isinstance(s.get("skipWhy"), str):
            problems.append(Problem(p, 1, f"scenario '{s['title']}': skip needs a skipWhy string"))
        if block is not None and block in skip:
            # The page's simulator refuses this too: a gate that is skipped never runs, so it can't block.
            problems.append(
                Problem(p, 1, f"scenario '{s['title']}': gate '{block}' can't be skipped and block")
            )
    return problems
