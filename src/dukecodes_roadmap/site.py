"""Turn a checked Roadmap into the showcase page and the README scoreboard.

Output is deterministic: the same files always give byte-identical HTML, so CI can
fail when someone forgets to rebuild.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from .checks import Roadmap
from .content import SCORE_END, SCORE_START, Milestone

FONTS = (
    "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;"
    "12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:"
    "wght@400;500;700&display=swap"
)
CSS_FILES = ("site/assets/mc-tokens.css", "site/assets/mc-components.css", "site/src/roadmap.css")
# Joined in order into one inline script, so one CSP hash covers them all.
JS_FILES = ("site/src/roadmap.js",)
BODY_FILE = "site/src/body.html"
FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox='0 0 32 32'%3E"
    "%3Crect x='3' y='3' width='26' height='26' rx='6' fill='%231d1f22'/%3E"
    "%3Crect x='8' y='8' width='16' height='4' rx='1' fill='%23ffa53d'/%3E"
    "%3Crect x='8' y='14' width='16' height='4' rx='1' fill='%233fd1bf'/%3E"
    "%3Crect x='8' y='20' width='16' height='4' rx='1' fill='%238d9198'/%3E%3C/svg%3E"
)
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


# ---------- HTML ----------


def sha256_b64(text: str) -> str:
    return "sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode()


def safe_json(data: Any) -> str:
    """JSON that can sit inside <script type="application/json"> without closing it."""
    s = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    for ch, esc in (("<", "\\u003c"), (">", "\\u003e"), ("&", "\\u0026"),
                    ("\u2028", "\\u2028"), ("\u2029", "\\u2029")):  # fmt: skip
        s = s.replace(ch, esc)
    return s


def csp(style: str, script: str) -> str:
    return "; ".join([
        "default-src 'none'",
        f"script-src '{sha256_b64(script)}'",
        f"style-src '{sha256_b64(style)}' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "img-src data:",
        "base-uri 'none'",
        "form-action 'none'",
        "require-trusted-types-for 'script'",
        "trusted-types 'none'",
    ])  # fmt: skip


def esc_attr(s: str) -> str:
    return (s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
            .replace(">", "&gt;"))  # fmt: skip


# The browser ends an inline element at the first matching closing tag, whatever the code
# around it meant, and "<!--" changes how it looks for the end of a script. Refuse them
# instead of escaping, so the hashed text is exactly the source text.
UNSAFE_INLINE = {"style": ("</style",), "script": ("</script", "<!--")}


def check_inline(kind: str, text: str) -> None:
    low = text.lower()
    for bad in UNSAFE_INLINE[kind]:
        if bad in low:
            raise ValueError(f"inline {kind} contains '{bad}', which would end it early")


@dataclass(frozen=True)
class Assets:
    css: str
    js: str
    body: str

    @classmethod
    def read(cls, root: Path) -> Assets:
        css = "\n".join((root / f).read_text(encoding="utf-8").strip() for f in CSS_FILES) + "\n"
        js = "\n".join((root / f).read_text(encoding="utf-8").strip() for f in JS_FILES) + "\n"
        body = (root / BODY_FILE).read_text(encoding="utf-8").strip()
        check_inline("style", css)
        check_inline("script", js)
        return cls(css, js, body)


def render_page(model: dict[str, Any], assets: Assets) -> str:
    """The full standalone page, with a hash-pinned Content-Security-Policy."""
    site = model["site"]
    title = esc_attr(site["title"])
    head = "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        f'<meta http-equiv="Content-Security-Policy" content="{csp(assets.css, assets.js)}">',
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
        '<meta name="referrer" content="no-referrer">',
        '<meta name="color-scheme" content="light dark">',
        f"<title>{title}</title>",
        f'<meta name="description" content="{esc_attr(_plain(site["lede"]))}">',
        f'<link rel="icon" href="{FAVICON}">',
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        # No SRI hash: Google Fonts sends different CSS to each browser. The CSP limits styles to
        # fonts.googleapis.com and fonts to fonts.gstatic.com instead.
        f'<link rel="stylesheet" href="{FONTS}">',
        f"<style>{assets.css}</style>",
        "</head>",
        "<body>",
    ])  # fmt: skip
    return f"{head}\n{_body(model, assets)}\n</body>\n</html>\n"


def render_fragment(model: dict[str, Any], assets: Assets) -> str:
    """The same page as an Artifact fragment: no doctype, html, head or body tags."""
    title = esc_attr(model["site"]["title"])
    return "\n".join([
        f"<title>{title}</title>",
        '<meta name="claude:viewport-fit-sides" content="cover">',
        f'<link rel="stylesheet" href="{FONTS}">',
        f"<style>{assets.css}</style>",
        _body(model, assets),
        "",
    ])  # fmt: skip


def _body(model: dict[str, Any], assets: Assets) -> str:
    return (
        f"{assets.body}\n"
        f'<script type="application/json" id="data">{safe_json(model)}</script>\n'
        f"<script>{assets.js}</script>"
    )


def _plain(tokens: list[Token]) -> str:
    return "".join(t[1] for t in tokens)


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
