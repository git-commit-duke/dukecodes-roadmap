"""Load the whole roadmap and check it is consistent, honest and safe to publish.

Three kinds of rule live here:
- structure: every file parses and cross-references resolve
- integrity: progress is measured, not claimed (a tick needs a ledger row)
- publishing: nothing private (addresses, tailnet names) reaches the public page
"""

from __future__ import annotations

import codecs
import ipaddress
import re
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit

from .content import (
    LINK_RE,
    SCORE_END,
    SCORE_START,
    Cert,
    Explainer,
    Milestone,
    Phase,
    Problem,
    Proof,
    Showcase,
    Skill,
    Term,
    parse_certs,
    parse_explainer,
    parse_glossary,
    parse_ledger,
    parse_milestone,
    parse_phases,
    parse_showcase,
    parse_skills,
    rel,
)

SKIP_DIRS = {".git", ".venv", "node_modules", "__pycache__", ".pytest_cache", ".ruff_cache",
             ".mypy_cache", "htmlcov"}  # fmt: skip
# Markdown files whose links must resolve. Generated and third-party files are excluded.
LINKED_GLOBS = ("*.md", "milestones/*.md", "concepts/*.md", "templates/*.md", "docs/*.md",
                "docs/adr/*.md", "evidence/*.md", ".github/*.md")  # fmt: skip
TEXT_SUFFIXES = {".md", ".csv", ".toml", ".txt", ".json", ".yml", ".yaml", ".html", ".css",
                 ".js", ".py", ".sh", ".log", ".xml", ".svg", ".cfg", ".conf", ".ini", ""}  # fmt: skip


@dataclass
class Roadmap:
    root: Path
    showcase: Showcase | None = None
    milestones: list[Milestone] = field(default_factory=list)
    phases: list[Phase] = field(default_factory=list)
    proofs: list[Proof] = field(default_factory=list)
    certs: list[Cert] = field(default_factory=list)
    skills: list[Skill] = field(default_factory=list)
    terms: list[Term] = field(default_factory=list)
    explainers: dict[str, Explainer] = field(default_factory=dict)
    stats: dict[str, int] = field(default_factory=dict)

    def milestone(self, mid: str) -> Milestone | None:
        return next((m for m in self.milestones if m.id == mid), None)


def required(root: Path, name: str, problems: list[Problem]) -> Path | None:
    path = root / name
    if not path.is_file():
        problems.append(Problem(name, 1, "required file is missing"))
        return None
    return path


def load(root: Path, today: date | None = None) -> tuple[Roadmap, list[Problem]]:
    """Parse every source file and run every check. `today` is injectable for tests."""
    root = root.resolve()
    rm = Roadmap(root)
    problems: list[Problem] = []

    if path := required(root, "showcase.toml", problems):
        rm.showcase, ps = parse_showcase(path, root)
        problems += ps
    for path in sorted((root / "milestones").glob("*.md")):
        ms, ps = parse_milestone(path, root)
        problems += ps
        if ms:
            rm.milestones.append(ms)
    rm.milestones.sort(key=lambda m: m.num)
    if path := required(root, "roadmap.md", problems):
        rm.phases, ps = parse_phases(path, root)
        problems += ps
    if path := required(root, "ledger.csv", problems):
        rm.proofs, ps = parse_ledger(path, root)
        problems += ps
    if path := required(root, "certs.md", problems):
        rm.certs, ps = parse_certs(path, root)
        problems += ps
    if path := required(root, "skills-matrix.md", problems):
        rm.skills, ps = parse_skills(path, root)
        problems += ps
    if path := required(root, "glossary.md", problems):
        rm.terms, ps = parse_glossary(path, root)
        problems += ps
    for path in sorted((root / "concepts").glob("*.md")):
        if path.name == "README.md":
            continue
        ex, ps = parse_explainer(path, root)
        problems += ps
        if ex:
            rm.explainers[ex.slug] = ex

    today = today or datetime.now(UTC).date()
    problems += check_milestones(rm)
    problems += check_phases(rm)
    problems += check_ledger(rm, today)
    problems += check_integrity(rm)
    problems += check_certs(rm, today)
    problems += check_skills(rm)
    problems += check_explainers(rm)
    links, n_links = check_links(root)
    problems += links
    leaks, n_files = scan_leaks(root)
    problems += leaks
    rm.stats = {"links": n_links, "scanned": n_files}
    return rm, sorted(set(problems))


# ---------- structure ----------


def check_milestones(rm: Roadmap) -> list[Problem]:
    problems: list[Problem] = []
    nums = [m.num for m in rm.milestones]
    if nums != list(range(len(nums))):
        problems.append(Problem("milestones", 1, f"milestones must be M0 to M{len(nums) - 1} with no gaps"))
    known = set(rm.showcase.chapters) if rm.showcase else set()
    slugs: dict[str, str] = {}
    for m in rm.milestones:
        for ch in m.chapters:
            if known and ch not in known:
                problems.append(Problem(m.path, 3, f"unknown Mission Control chapter '{ch}'"))
        for c in m.concepts:
            if c.slug in slugs:
                problems.append(Problem(m.path, c.line, f"concept '{c.slug}' is already in {slugs[c.slug]}"))
            slugs[c.slug] = m.id
    return problems


def check_phases(rm: Roadmap) -> list[Problem]:
    problems: list[Problem] = []
    seen: dict[str, int] = {}
    for i, ph in enumerate(rm.phases, start=1):
        if ph.num != i:
            problems.append(Problem("roadmap.md", ph.line, f"phase {ph.num} out of order: expected {i}"))
        for mid in ph.milestones:
            if mid in seen:
                problems.append(Problem("roadmap.md", ph.line, f"{mid} is already in phase {seen[mid]}"))
            seen[mid] = ph.num
            if not rm.milestone(mid):
                problems.append(Problem("roadmap.md", ph.line, f"no milestone file for {mid}"))
    for m in rm.milestones:
        if m.id not in seen:
            problems.append(Problem("roadmap.md", 1, f"{m.id} is not in any phase"))
    return problems


def check_target(root: Path, base: Path, target: str, where: str, line: int) -> Problem | None:
    """Check one link or evidence target. Returns a Problem, or None when it is fine."""
    if target.startswith("#"):
        return None
    u = urlsplit(target)
    if u.scheme == "https":
        return None if u.netloc else Problem(where, line, f"broken URL '{target}'")
    if u.scheme:
        return Problem(where, line, f"'{target}': only https links and repo paths are allowed")
    path_part = target.split("#", 1)[0]
    if not path_part or "\\" in path_part or path_part.startswith("/"):
        return Problem(where, line, f"'{target}' must be a relative path inside the repo")
    # Walk the path one part at a time: a symlink anywhere on the way could lead outside
    # the repo or to a secret, so it is refused even if it resolves somewhere harmless.
    cur = base
    for part in Path(path_part).parts:
        cur = cur.parent if part == ".." else cur / part
        if cur.is_symlink():
            return Problem(where, line, f"'{target}' goes through a symlink")
    resolved = (base / path_part).resolve()
    try:
        inner = resolved.relative_to(root)
    except ValueError:
        return Problem(where, line, f"'{target}' points outside the repo")
    if not resolved.exists():
        return Problem(where, line, f"'{target}' does not exist")
    if inner.parts and inner.parts[0] == ".git":
        return Problem(where, line, f"'{target}' points into .git")
    return None


def check_ledger(rm: Roadmap, today: date) -> list[Problem]:
    problems: list[Problem] = []
    seen: set[tuple[str, str | None, str]] = set()
    latest = today + timedelta(days=1)  # one day of slack for time zones
    for pr in rm.proofs:
        if pr.date > latest:
            problems.append(Problem("ledger.csv", pr.line, f"date {pr.date} is in the future"))
        ms = rm.milestone(pr.milestone)
        if ms is None:
            problems.append(Problem("ledger.csv", pr.line, f"no milestone {pr.milestone}"))
        elif pr.rep and pr.rep not in {r.id for r in ms.reps}:
            problems.append(Problem("ledger.csv", pr.line, f"{pr.rep} is not a rep of {pr.milestone}"))
        key = (pr.milestone, pr.rep, pr.claim.casefold())
        if key in seen:
            problems.append(Problem("ledger.csv", pr.line, "duplicate proof"))
        seen.add(key)
        bad = check_target(rm.root, rm.root, pr.evidence, "ledger.csv", pr.line)
        if bad:
            problems.append(bad)
    return problems


# ---------- integrity: progress is measured, not claimed ----------


def check_integrity(rm: Roadmap) -> list[Problem]:
    problems: list[Problem] = []
    proved = {(p.milestone, p.rep) for p in rm.proofs}
    by_ms = {p.milestone for p in rm.proofs}
    for m in rm.milestones:
        for r in m.reps:
            if r.done and (m.id, r.id) not in proved:
                problems.append(
                    Problem(
                        m.path,
                        r.line,
                        f"{r.id} is ticked but has no ledger row: add the proof to ledger.csv or untick it",
                    )
                )
        if any(c.done for c in m.exit) and m.id not in by_ms:
            line = next(c.line for c in m.exit if c.done)
            problems.append(Problem(m.path, line, f"{m.id} exit criteria ticked with no ledger row"))
    return problems


def check_certs(rm: Roadmap, today: date) -> list[Problem]:
    problems: list[Problem] = []
    ids = {m.id for m in rm.milestones}
    cert_proofs = [p for p in rm.proofs if p.kind == "cert"]
    for c in rm.certs:
        if c.checked and c.checked > today + timedelta(days=1):
            problems.append(Problem("certs.md", c.line, f"checked date {c.checked} is in the future"))
        if re.fullmatch(r"M\d", c.after) and c.after not in ids:
            problems.append(Problem("certs.md", c.line, f"no milestone {c.after}"))
        if c.url and not c.url.startswith("https://"):
            problems.append(Problem("certs.md", c.line, "cert links must be https"))
        if c.status == "passed" and not any(
            c.name.casefold() in p.claim.casefold() or (c.code != "—" and c.code in p.claim)
            for p in cert_proofs
        ):
            problems.append(
                Problem(
                    "certs.md",
                    c.line,
                    f"'{c.name}' is passed: add a ledger row (kind cert) naming it, with the badge link",
                )
            )
    return problems


def check_skills(rm: Roadmap) -> list[Problem]:
    ids = {m.id for m in rm.milestones}
    return [
        Problem("skills-matrix.md", s.line, f"no milestone {s.milestone}")
        for s in rm.skills
        if s.milestone not in ids
    ]


def check_explainers(rm: Roadmap) -> list[Problem]:
    slugs = {c.slug for m in rm.milestones for c in m.concepts}
    return [
        Problem(ex.path, 1, f"'{ex.slug}' is not a concept in any milestone's Explain it list")
        for ex in rm.explainers.values()
        if ex.slug not in slugs
    ]


# ---------- links ----------

FENCE_RE = re.compile(r"^\s*(```|~~~)")
CODE_SPAN_RE = re.compile(r"`[^`]*`")


def check_links(root: Path) -> tuple[list[Problem], int]:
    problems: list[Problem] = []
    count = 0
    files = sorted({p for g in LINKED_GLOBS for p in root.glob(g) if p.is_file()})
    for path in files:
        where = rel(path, root)
        fenced = generated = False
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            # The README scoreboard is generated from milestone paths that load() already checked.
            # Skipping it keeps the count stable, so one `roadmap build` gives a fresh page.
            if line.strip() in (SCORE_START, SCORE_END):
                generated = line.strip() == SCORE_START
                continue
            if FENCE_RE.match(line):
                fenced = not fenced
                continue
            if fenced or generated:
                continue
            for m in LINK_RE.finditer(CODE_SPAN_RE.sub("", line)):
                count += 1
                bad = check_target(root, path.parent, m.group(2), where, n)
                if bad:
                    problems.append(bad)
    return problems, count


# ---------- publishing: nothing private ----------

# An IPv4 address not glued to more dotted numbers (so "1.2.3.4.5" is a version, not an
# address), but allowed to end a sentence or carry a port: "at 192.0.2.7." or "192.0.2.7:22".
IPV4_RE = re.compile(r"(?<!\d)(?<!\d\.)(\d{1,3}(?:\.\d{1,3}){3})(?!\d|\.\d)")
IPV6_ULA_RE = re.compile(r"(?<![0-9A-Fa-f:])(f[cd][0-9A-Fa-f]{2}:[0-9A-Fa-f:]{2,})", re.IGNORECASE)
MAC_RE = re.compile(r"(?<![0-9A-Fa-f:-])((?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})(?![0-9A-Fa-f:-])")
HOST_RE = re.compile(r"\b[\w-]+(?:\.[\w-]+)*\.(?:ts\.net|home\.arpa)\b", re.IGNORECASE)
CIDR_RE = re.compile(r"/\d{1,3}(?!\d)")
# Private, carrier-grade NAT (Tailscale) and link-local ranges. Built from integers so this
# file never contains a literal private address and passes its own scan.
PRIVATE_V4 = tuple(
    ipaddress.IPv4Network((net, prefix))
    for net, prefix in (
        (0x0A000000, 8),  # 10/8
        (0xAC100000, 12),  # 172.16/12
        (0xC0A80000, 16),  # 192.168/16
        (0x64400000, 10),  # 100.64/10, CGNAT: Tailscale addresses live here
        (0xA9FE0000, 16),  # 169.254/16
    )
)
ULA_V6 = ipaddress.IPv6Network((0xFC << 120, 7))
# The ranges themselves are public (RFC 1918, 6598, 3927, 4193), so an explainer may name one
# in its canonical form, such as the whole 10/8 block. Any other private address is a leak.
CANONICAL = {str(net) for net in (*PRIVATE_V4, ULA_V6)}
DOC_MAC_PREFIX = "00:00:5e:00:53:"  # RFC 7042 documentation range
LEAK_SKIP_FILES = {"uv.lock"}
LEAK_LABEL = {"ipv4": "private address", "ipv6": "private address", "mac": "MAC address",
              "host": "internal hostname"}  # fmt: skip


@dataclass(frozen=True)
class Leak:
    start: int
    end: int
    kind: str  # a LEAK_LABEL key
    token: str

    def __str__(self) -> str:
        return f"{LEAK_LABEL[self.kind]} {self.token}"


def _canonical(text: str, token: str, end: int) -> bool:
    """True when `token` starts a whole private block written as CIDR, such as fc00::/7."""
    m = CIDR_RE.match(text, end)
    return m is not None and f"{token}{m.group(0)}" in CANONICAL


def _ula(token: str) -> str | None:
    """The ULA address in a regex hit, minus a colon that ends a sentence. None if it isn't one."""
    for cand in (token, token.rstrip(":")):
        try:
            if ipaddress.IPv6Address(cand) in ULA_V6:
                return cand
        except ValueError:
            continue
    return None


def find_leaks(text: str) -> list[Leak]:
    """Every private address, MAC address and internal hostname in `text`, in order.

    The leak scan and `roadmap redact` both use this, so redacted output always passes the scan.
    """
    found: list[Leak] = []
    for m in IPV4_RE.finditer(text):
        try:
            ip = ipaddress.IPv4Address(m.group(1))
        except ValueError:
            continue
        if any(ip in net for net in PRIVATE_V4) and not _canonical(text, m.group(1), m.end(1)):
            found.append(Leak(m.start(1), m.end(1), "ipv4", m.group(1)))
    for m in IPV6_ULA_RE.finditer(text):
        addr = _ula(m.group(1))
        if addr and not _canonical(text, addr, m.start(1) + len(addr)):
            found.append(Leak(m.start(1), m.start(1) + len(addr), "ipv6", addr))
    for m in MAC_RE.finditer(text):
        if not m.group(1).lower().replace("-", ":").startswith(DOC_MAC_PREFIX):
            found.append(Leak(m.start(1), m.end(1), "mac", m.group(1)))
    found += [Leak(m.start(), m.end(), "host", m.group(0)) for m in HOST_RE.finditer(text)]
    return sorted(found, key=lambda lk: (lk.start, -lk.end))


def leak_findings(text: str) -> list[tuple[int, str]]:
    """(line, what) for every leak. No pattern crosses a line break, so lines scan alone."""
    return [(n, str(lk)) for n, line in enumerate(text.splitlines(), start=1) for lk in find_leaks(line)]


def published_files(root: Path) -> list[Path]:
    out = []
    for path in root.rglob("*"):
        parts = path.relative_to(root).parts
        if any(p in SKIP_DIRS for p in parts) or not path.is_file() or path.is_symlink():
            continue
        if path.name in LEAK_SKIP_FILES or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        out.append(path)
    return sorted(out)


def text_encoding(data: bytes) -> str:
    """UTF-16 when the file starts with its byte-order mark, otherwise UTF-8.

    Windows PowerShell 5 writes `>` output as UTF-16, so pasted scan output often is.
    """
    return "utf-16" if data.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)) else "utf-8"


def scan_leaks(root: Path) -> tuple[list[Problem], int]:
    problems: list[Problem] = []
    files = published_files(root)
    for path in files:
        data = path.read_bytes()
        # Undecodable bytes become U+FFFD instead of skipping the file: a Latin-1 file can leak too.
        text = data.decode(text_encoding(data), errors="replace")
        for n, what in leak_findings(text):
            problems.append(
                Problem(
                    rel(path, root),
                    n,
                    f"{what}: don't publish it. Run `roadmap redact "
                    f"{rel(path, root)}` or use 192.0.2.0/24 examples",
                )
            )
    return problems, len(files)
