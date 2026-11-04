"""Turn a checked Roadmap into the showcase page's data and the README scoreboard.

The page itself (site/index.html, app.js, app.css) is plain files; `roadmap build` writes
only site/roadmap.json and the scoreboard. Output is deterministic: the same files always
give byte-identical results, so CI can fail when someone forgets to rebuild.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from .checks import Roadmap
from .content import NONE, SCORE_END, SCORE_START, Milestone

INACTIVE_CERTS = ("optional", "later", "skipped")

Token = list[str]

# ---------- inline markdown -> safe tokens ----------

TOKEN_RE = re.compile(r"`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)")


@dataclass(frozen=True)
class Links:
    """Turns links in a source file into absolute URLs for the page."""

    root: Path
    repo: str
    branch: str

    def resolve(self, target: str, base: Path) -> str | None:
        if target.startswith("#"):
            return None
        u = urlsplit(target)
        if u.scheme == "https" and u.netloc:
            return target
        if u.scheme or target.startswith("/"):
            return None  # javascript:, data:, mailto: and friends never become links
        path_part, _, frag = target.partition("#")
        dest = (base / path_part).resolve()
        try:
            inner = dest.relative_to(self.root).as_posix()
        except ValueError:
            return None
        kind = "tree" if dest.is_dir() else "blob"
        url = f"{self.repo}/{kind}/{self.branch}/{inner}"
        return f"{url}#{frag}" if frag else url


def inline(text: str, links: Links, base: Path) -> list[Token]:
    """Split `code`, **bold** and [links](url) into tokens. Everything else is plain text."""
    out: list[Token] = []

    def text_token(s: str) -> None:
        if not s:
            return
        if out and out[-1][0] == "t":
            out[-1] = ["t", out[-1][1] + s]
        else:
            out.append(["t", s])

    pos = 0
    for m in TOKEN_RE.finditer(text):
        text_token(text[pos : m.start()])
        if m.group(1) is not None:
            out.append(["c", m.group(1)])
        elif m.group(2) is not None:
            out.append(["b", m.group(2)])
        else:
            url = links.resolve(m.group(4), base)
            if url:
                out.append(["a", m.group(3), url])
            else:
                text_token(m.group(3))
        pos = m.end()
    text_token(text[pos:])
    return out


# ---------- model ----------


def statuses(milestones: list[Milestone]) -> dict[str, str]:
    """done, active (some ticks), next (first unfinished, nothing ticked yet) or queued."""
    out: dict[str, str] = {}
    current_seen = False
    for m in milestones:
        if m.done:
            out[m.id] = "done"
        elif m.ticked:
            out[m.id] = "active"
            current_seen = True
        elif not current_seen:
            out[m.id] = "next"
            current_seen = True
        else:
            out[m.id] = "queued"
    return out


def money(d: Decimal) -> str:
    return f"${d:,.2f}".replace(".00", "")


def hover_rule(term: str) -> tuple[bool, bool]:
    """(show hover hints, match case-sensitively) for a glossary term.

    Acronyms match exactly; words match in any case. Short lowercase tool names such as
    'age' get no hover hint: they collide with everyday words.
    """
    if term.islower() and len(term) < 4:
        return False, True
    letters = [c for c in term if c.isalpha()]
    return True, bool(letters) and all(c.isupper() for c in letters)


def build_model(rm: Roadmap) -> dict[str, Any]:
    sc = rm.showcase
    if sc is None:  # load() only returns a roadmap without a showcase together with problems
        raise ValueError("build_model needs a roadmap that loaded without problems")
    links = Links(rm.root, sc.repo, sc.branch)
    root = rm.root

    def toks(text: str, rel_path: str = "README.md") -> list[Token]:
        return inline(text, links, (root / rel_path).parent)

    status = statuses(rm.milestones)
    phase_of = {mid: ph.num for ph in rm.phases for mid in ph.milestones}
    ledger_sorted = sorted(enumerate(rm.proofs), key=lambda ip: (ip[1].date, ip[1].line), reverse=True)
    order = {orig: i for i, (orig, _) in enumerate(ledger_sorted)}

    ledger: list[dict[str, Any]] = []
    for _, pr in ledger_sorted:
        ev_url = links.resolve(pr.evidence, root)
        ledger.append({
            "date": pr.date.isoformat(), "milestone": pr.milestone, "rep": pr.rep or "",
            "kind": pr.kind, "claim": pr.claim,
            "evidence": {"text": pr.evidence, "url": ev_url or ""}, "verify": pr.verify,
        })  # fmt: skip

    milestones: list[dict[str, Any]] = []
    for m in rm.milestones:
        mp = m.path
        proof_idx = sorted(order[i] for i, p in enumerate(rm.proofs) if p.milestone == m.id)
        reps = []
        for r in m.reps:
            idx = sorted(order[i] for i, p in enumerate(rm.proofs) if p.milestone == m.id and p.rep == r.id)
            reps.append({"id": r.id, "text": toks(r.text, mp), "doneWhen": toks(r.done_when, mp),
                         "done": r.done, "proofs": idx})  # fmt: skip
        concepts = []
        for c in m.concepts:
            ex = rm.explainers.get(c.slug)
            st = "reviewed" if ex and ex.reviewed else "written" if ex else "todo"
            url = links.resolve(f"concepts/{c.slug}.md", root) if ex else ""
            concepts.append({"slug": c.slug, "q": toks(c.question, mp), "status": st, "url": url or ""})
        milestones.append({
            "id": m.id, "num": m.num, "title": m.title, "status": status[m.id],
            "phase": phase_of.get(m.id, 0), "url": links.resolve(mp, root) or "",
            "build": toks(m.build, mp), "chapters": list(m.chapters), "proof": toks(m.proof, mp),
            "cert": toks(m.cert, mp), "careful": toks(m.careful, mp) if m.careful else None,
            "plain": toks(m.plain, mp), "why": toks(m.why, mp), "story": toks(m.story, mp),
            "reps": reps, "breakIt": [toks(b, mp) for b in m.break_it], "concepts": concepts,
            "exit": [{"text": toks(c.text, mp), "done": c.done} for c in m.exit],
            "progress": [m.ticked, m.total], "proofs": proof_idx,
        })  # fmt: skip

    current = next((m for m in milestones if m["status"] != "done"), None)
    nxt: dict[str, Any] | None = None
    if current:
        rep = next((r for r in current["reps"] if not r["done"]), None)
        if rep:
            nxt = {"milestone": current["id"], "kind": "rep", "id": rep["id"], "text": rep["text"],
                   "doneWhen": rep["doneWhen"]}  # fmt: skip
        else:
            ex = next(c for c in current["exit"] if not c["done"])
            nxt = {"milestone": current["id"], "kind": "exit", "id": "Exit", "text": ex["text"],
                   "doneWhen": []}  # fmt: skip

    skills = [{"name": s.name, "domain": s.domain, "milestone": s.milestone, "score": s.score,
               "evidence": toks(s.evidence, "skills-matrix.md")} for s in rm.skills]  # fmt: skip
    domains: dict[str, list[int | None]] = {}
    for s in rm.skills:
        domains.setdefault(s.domain, []).append(s.score)
    domain_rows = []
    for name, scores in domains.items():
        rated = [x for x in scores if x is not None]
        avg = round(sum(rated) / len(rated), 2) if rated else None
        domain_rows.append({"name": name, "avg": avg, "rated": len(rated), "total": len(scores)})

    certs = [{
        "name": c.name, "url": c.url or "", "code": c.code, "after": c.after, "price": c.price,
        "format": c.format, "valid": c.valid, "status": c.status, "label": c.label,
        "checked": c.checked.isoformat() if c.checked else "", "note": toks(c.note, "certs.md"),
    } for c in rm.certs]  # fmt: skip
    core = [c for c in rm.certs if c.status not in INACTIVE_CERTS]
    core_sum = sum((c.price_usd for c in core if c.price_usd is not None), Decimal(0))
    soft = [c.name for c in core if c.label != "FACT"]

    glossary = []
    for t in rm.terms:
        hover, cs = hover_rule(t.term)
        glossary.append({"term": t.term, "def": toks(t.definition, "glossary.md"),
                         "hover": hover, "cs": cs})  # fmt: skip

    rep_done = {r.id: r.done for m in rm.milestones for r in m.reps}
    labs = []
    for lab in rm.labs:
        done = sum(rep_done.get(r, False) for r in lab.reps)
        total_reps = len(lab.reps)
        labs.append({
            "name": lab.name, "reps": list(lab.reps),
            "milestones": list(dict.fromkeys(r.split("-", 1)[0] for r in lab.reps)),
            "tools": lab.tools,
            "resource": {"text": lab.resource, "url": lab.url} if lab.url else None,
            "cost": "" if lab.cost == NONE else lab.cost,
            "checked": lab.checked.isoformat() if lab.checked else "",
            "status": "done" if total_reps and done == total_reps else "active" if done else "planned",
            "progress": [done, total_reps],
        })  # fmt: skip
    projects = []
    for pj in rm.projects:
        named = sorted(order[i] for i, p in enumerate(rm.proofs)
                       if p.kind == "project" and pj.name.casefold() in p.claim.casefold())  # fmt: skip
        projects.append({
            "name": pj.name, "url": pj.url or "", "milestones": list(pj.milestones),
            "all": not pj.milestones, "what": toks(pj.what, "labs.md"),
            "security": toks(pj.security, "labs.md"), "status": pj.status, "proofs": named,
        })  # fmt: skip

    n_reps = sum(len(m.reps) for m in rm.milestones)
    n_reps_done = sum(r.done for m in rm.milestones for r in m.reps)
    n_exit = sum(len(m.exit) for m in rm.milestones)
    n_exit_done = sum(c.done for m in rm.milestones for c in m.exit)
    n_concepts = sum(len(m.concepts) for m in rm.milestones)
    written = sum(1 for m in rm.milestones for c in m.concepts if c.slug in rm.explainers)
    reviewed = sum(1 for m in rm.milestones for c in m.concepts
                   if c.slug in rm.explainers and rm.explainers[c.slug].reviewed)  # fmt: skip
    ticks = n_reps_done + n_exit_done
    total = n_reps + n_exit
    checked = max((c.checked for c in rm.certs if c.checked), default=None)

    stats: dict[str, Any] = {
        "milestones": [sum(m.done for m in rm.milestones), len(rm.milestones)],
        "reps": [n_reps_done, n_reps], "exit": [n_exit_done, n_exit], "proofs": len(rm.proofs),
        "explainers": [written, reviewed, n_concepts],
        "certs": [sum(c.status == "passed" for c in core), len(core)],
        "skills": [sum(s.score is not None for s in rm.skills), len(rm.skills)],
        "labs": [sum(x["status"] == "done" for x in labs), len(labs)],
        "projects": [sum(x["status"] == "shipped" for x in projects), len(projects)],
        "percent": round(100 * ticks / total) if total else 0,
    }  # fmt: skip
    checks = [
        ["milestones", f"{len(rm.milestones)} files · {n_reps} reps · {n_concepts} concepts"],
        ["phases", f"{len(rm.phases)} phases · every milestone placed once"],
        ["ledger", f"{len(rm.proofs)} proofs · dates, paths and cells valid"],
        ["integrity", f"{ticks} ticks · every tick has proof"],
        ["certs", f"{len(rm.certs)} certs · checked {checked.isoformat() if checked else 'never'}"],
        ["skills", f"{len(rm.skills)} skills · {stats['skills'][0]} rated"],
        ["glossary", f"{len(rm.terms)} terms · alphabetical"],
        ["labs", f"{len(labs)} labs · {len(projects)} projects · every rep exists"],
        ["links", f"{rm.stats.get('links', 0)} links resolve"],
        ["leak scan", "no private addresses or hostnames"],
    ]

    site = sc.raw["site"]
    raw = sc.raw
    return {
        "site": {
            "title": site["title"], "owner": site["owner"], "eyebrow": site["eyebrow"],
            "badge": site["badge"], "headline": site["headline"], "lede": toks(site["lede"]),
            "footer": toks(site["footer"]), "repo": sc.repo, "branch": sc.branch,
        },
        "stats": stats,
        "current": current["id"] if current else None,
        "next": nxt,
        "phases": [{"num": p.num, "title": p.title, "gate": p.gate, "milestones": list(p.milestones)}
                   for p in rm.phases],
        "milestones": milestones,
        "ledger": ledger,
        "skills": skills,
        "domains": domain_rows,
        "certs": certs,
        "certTotal": {"core": money(core_sum), "count": len(core), "soft": soft},
        "glossary": glossary,
        "labs": labs,
        "projects": projects,
        "checks": checks,
        "loop": [{**x, "text": toks(x["text"])} for x in raw.get("loop", [])],
        "start": [{**x, "text": toks(x["text"])} for x in raw.get("start", [])],
        "lab": _tok_fields(raw.get("lab"), ("summary",), toks),
        "simulator": _simulator(raw.get("simulator"), toks),
        "final": _tok_fields(raw.get("final"), ("text",), toks),
    }  # fmt: skip


def _tok_fields(d: dict[str, Any] | None, keys: tuple[str, ...], toks: Any) -> dict[str, Any] | None:
    if d is None:
        return None
    return {k: (toks(v) if k in keys else v) for k, v in d.items()}


def _simulator(sim: dict[str, Any] | None, toks: Any) -> dict[str, Any] | None:
    if sim is None:
        return None
    out = _tok_fields(sim, ("intro",), toks) or {}
    out["scenarios"] = [{**s, "summary": toks(s["summary"]), "lesson": toks(s["lesson"])}
                        for s in sim["scenarios"]]  # fmt: skip
    return out


# ---------- page data ----------

DATA_OUT = "site/roadmap.json"
PAGE = "site/index.html"
# Files the page loads, besides index.html and the data. The preview copies exactly these.
PAGE_FILES = ("site/theme.js", "site/app.js", "site/app.css", "site/favicon.svg")
VENDORED = ("site/ds", "site/vendor")


def render_json(model: dict[str, Any]) -> str:
    """The page data. Deterministic: the same repo files always give the same bytes."""
    return json.dumps(model, ensure_ascii=False, indent=1) + "\n"


# The Artifact preview wraps the page in a document of its own and enforces its own policy,
# so its copy of index.html drops what only works in a real <head>: the doctype, the html,
# head and body tags, and the charset, CSP and viewport metas.
FRAGMENT_DROP = re.compile(
    r"\s*(?:<!doctype\b[^>]*>|</?(?:html|head|body)\b[^>]*>"
    r"|<meta\s+(?:charset|http-equiv|name=\"viewport\")[^>]*>)\s*",
    re.IGNORECASE,
)
# Tells the preview that the side gutters already clear a phone's notch: app.css pads them
# with max(gutter, env(safe-area-inset-*)), so the page may run edge to edge.
VIEWPORT_SIDES = '<meta name="claude:viewport-fit-sides" content="cover">'


def artifact_page(index_html: str) -> str:
    """site/index.html as an Artifact fragment: no doctype, html, head or body tags."""
    lines: list[str] = []
    for ln in index_html.splitlines():
        if FRAGMENT_DROP.fullmatch(ln):
            continue
        lines.append(ln)
        if ln.lstrip().lower().startswith("<title>"):
            lines.append(VIEWPORT_SIDES)
    return "\n".join(lines) + "\n"


def page_files(root: Path) -> list[str]:
    """Every file the page needs, as repo paths, index.html first."""
    out = [PAGE, *PAGE_FILES, DATA_OUT]
    for folder in VENDORED:
        out += sorted(p.relative_to(root).as_posix() for p in (root / folder).rglob("*") if p.is_file())
    return out


# ---------- README scoreboard ----------

STATUS_LABEL = {"done": "✅ done", "active": "🟧 in progress", "next": "▶ up next", "queued": "· queued"}


def scoreboard(model: dict[str, Any], rm: Roadmap) -> str:
    s = model["stats"]
    progress = (
        f"**Progress:** {s['milestones'][0]} of {s['milestones'][1]} milestones · "
        f"{s['reps'][0]} of {s['reps'][1]} reps · {s['proofs']} proofs logged · "
        f"{s['explainers'][0]} of {s['explainers'][2]} explainers · "
        f"{s['certs'][0]} of {s['certs'][1]} core certs"
    )
    lines = [
        SCORE_START,
        progress,
        "",
        "| | Milestone | Proof | Reps | Status |",
        "|---|---|---|---|---|",
    ]
    for m, src in zip(model["milestones"], rm.milestones, strict=True):
        reps_done = sum(r["done"] for r in m["reps"])
        proof = src.proof.replace("|", "\\|")
        lines.append(f"| {m['id']} | [{m['title']}]({src.path}) | {proof} | "
                     f"{reps_done}/{len(m['reps'])} | {STATUS_LABEL[m['status']]} |")  # fmt: skip
    lines += [
        "",
        "_Generated by `roadmap build` from the files in this repo. Don't edit between the markers._",
        SCORE_END,
    ]
    return "\n".join(lines)


def update_readme(text: str, board: str) -> str | None:
    """Replace the scoreboard block. None when the markers are missing."""
    start, end = text.find(SCORE_START), text.find(SCORE_END)
    if start == -1 or end == -1 or end < start:
        return None
    return text[:start] + board + text[end + len(SCORE_END) :]
