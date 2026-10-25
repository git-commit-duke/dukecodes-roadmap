"""Check the project page before it ships: its content, its lockdown, its vendored files.

GitHub Pages cannot send security headers, so everything the browser enforces has to
live in the files themselves. This script keeps them honest:

1. site/project.json matches the page's content schema (version 2). Unknown keys are
   typos, routes must point at real steps and sections, links must be https. A page
   with no project.json (another repo that reuses this checker with its own data) skips
   this step only; every other check still runs.
2. Every HTML page keeps the exact Content-Security-Policy below, before any script or
   stylesheet, with no inline script, style or event handler. It loads only its own
   files, plus one Google Fonts stylesheet.
3. Vendored files (site/ds/, site/vendor/) match the sha256 in site/ds.lock.json, nothing
   unlisted sits beside them, and tokens.css is exactly what ds_tokens.py builds.
4. Page scripts use no HTML or code sinks (innerHTML, eval, string timers...), build no
   RegExp from data, and fetch only relative files. Trusted Types blocks most of these at
   runtime; this blocks them at commit time. No CSS file loads anything (fonts come
   from the one stylesheet link); SVGs carry no script.
5. Colours and names. Every pair in site/contrast.json reaches WCAG AA in every theme
   (4.5:1, or 3:1 where a pair says "min": 3), every text colour app.css sets has a
   pair, and every design-system token and dk- class the page uses still exists. A sync
   that renames, removes or recolours something fails here, not on a visitor's screen.

Standard library only, so the Pages workflow can run it with a bare python3.

Usage:  python scripts/check_site.py            check everything, print "site OK"
        python scripts/check_site.py --relock   after a deliberate sync, rewrite the hashes
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import re
import sys
import urllib.parse
from collections.abc import Callable, Iterator, Mapping
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import ds_tokens

LOCK = "site/ds.lock.json"
VENDORED_DIRS = ("site/ds", "site/vendor")
IGNORED_FILES = {".DS_Store", "Thumbs.db"}

# The page's browser lockdown. Changing it is a security decision: do it here, in the
# same pull request as index.html, and say why in the PR.
REQUIRED_CSP: dict[str, list[str]] = {
    "default-src": ["'none'"],
    "script-src": ["'self'"],
    "style-src": ["'self'", "https://fonts.googleapis.com"],
    "font-src": ["https://fonts.gstatic.com"],
    "img-src": ["'self'"],
    "connect-src": ["'self'"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
    "require-trusted-types-for": ["'script'"],
    "trusted-types": ["'none'"],
    "upgrade-insecure-requests": [],
}

# Route targets that are fixed by app.js (keep the two lists in step).
HOME_SECTIONS = {"console", "pipeline", "break", "why", "path"}
REFERENCE_SECTIONS = {"labels", "flashcards", "glossary", "versions", "layout"}

RISKS = ("safe", "caution", "destructive", "danger")
LABELS = ("FACT", "INFERENCE", "COMMUNITY", "PROPOSAL", "ASSUMPTION")
CONFIDENCE = ("HIGH", "MED", "LOW")

ID = re.compile(r"^[a-z][a-z0-9-]{0,31}$")
STAGE_ID = re.compile(r"^[a-z]{2,12}$")
STEP_ID = re.compile(r"^([a-z]{2,12})-(\d{2})$")
BRANCH = re.compile(r"^[a-z0-9][a-z0-9/._-]{0,40}$")
PIPE_STAGE = re.compile(r"^[a-z][a-z0-9-]{0,11}$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ROUTE = re.compile(r"^/(?:(home|runbook|gates|reference)(?:/([a-z0-9][a-z0-9-]*))?)?$")
CONTROL = re.compile(r"[\x00-\x1f\x7f]")
CONTROL_EXCEPT_NEWLINE = re.compile(r"[\x00-\x09\x0b-\x1f\x7f]")

Spec = Callable[[Any, str, "_Report"], None]


class _Report:
    def __init__(self) -> None:
        self.problems: list[str] = []
        self.routes: list[tuple[str, str]] = []

    def add(self, path: str, message: str) -> None:
        self.problems.append(f"{path or 'project.json'}: {message}")


def _join(path: str, key: str) -> str:
    return f"{path}.{key}" if path else key


# --- content schema building blocks -------------------------------------------


def _text(kind: str, limit: int = 600) -> Spec:
    """plain: shown as-is. rich: `code` spans allowed. raw: tool output. code: commands."""

    def check(value: Any, path: str, report: _Report) -> None:
        if not isinstance(value, str) or not value.strip():
            report.add(path, "must be non-empty text")
            return
        if len(value) > limit:
            report.add(path, f"is {len(value)} characters; keep it under {limit}")
        bad = CONTROL_EXCEPT_NEWLINE if kind == "code" else CONTROL
        if bad.search(value):
            report.add(path, "contains a control character (newlines only in code)")
        if kind != "code" and value != value.strip():
            report.add(path, "has leading or trailing spaces")
        if kind == "plain" and "`" in value:
            report.add(path, "plain text only: no backticks (this field is shown as-is)")
        if kind == "rich":
            if value.count("`") % 2:
                report.add(path, "unbalanced backtick: every `code` span needs two")
            elif "``" in value:
                report.add(path, "empty `code` span")

    return check


PLAIN = _text("plain")
RICH = _text("rich", 900)
RAW = _text("raw", 400)
CODE = _text("code", 2000)


def _one_of(*allowed: str | int) -> Spec:
    def check(value: Any, path: str, report: _Report) -> None:
        if isinstance(value, bool) or value not in allowed:
            names = ", ".join(str(a) for a in allowed)
            report.add(path, f"{value!r} is not one of {names}")

    return check


def _pattern(regex: re.Pattern[str], hint: str) -> Spec:
    def check(value: Any, path: str, report: _Report) -> None:
        if not isinstance(value, str) or not regex.match(value):
            report.add(path, f"{value!r} must look like {hint}")

    return check


def _date(value: Any, path: str, report: _Report) -> None:
    try:
        ok = isinstance(value, str) and bool(DATE.match(value))
        ok = ok and bool(datetime.date.fromisoformat(value))
    except ValueError:
        ok = False
    if not ok:
        report.add(path, f"{value!r} must be a date like 2026-10-24")


def _boolean(value: Any, path: str, report: _Report) -> None:
    if not isinstance(value, bool):
        report.add(path, "must be true or false")


def is_https(value: Any) -> bool:
    if not isinstance(value, str) or CONTROL.search(value) or " " in value or "\\" in value:
        return False
    parts = urllib.parse.urlsplit(value)
    return parts.scheme == "https" and bool(parts.hostname) and "@" not in parts.netloc


def _https(value: Any, path: str, report: _Report) -> None:
    if not is_https(value):
        report.add(path, f"{value!r} must be an https:// link")


def _route(value: Any, path: str, report: _Report) -> None:
    if isinstance(value, str) and value.startswith("https://"):
        _https(value, path, report)
    elif isinstance(value, str) and ROUTE.match(value):
        report.routes.append((path, value))
    else:
        report.add(path, f"{value!r} must be a page route like /runbook/get-01, or https://")


def _obj(required: Mapping[str, Spec], optional: Mapping[str, Spec] | None = None) -> Spec:
    extra = optional or {}

    def check(value: Any, path: str, report: _Report) -> None:
        if not isinstance(value, dict):
            report.add(path, "must be an object")
            return
        for key in value:
            if key not in required and key not in extra:
                report.add(_join(path, str(key)), "unknown key (typo?)")
        for key, spec in required.items():
            if key in value:
                spec(value[key], _join(path, key), report)
            else:
                report.add(path, f"missing key {key!r}")
        for key, spec in extra.items():
            if key in value:
                spec(value[key], _join(path, key), report)

    return check


def _list(item: Spec, low: int = 1, high: int = 100) -> Spec:
    def check(value: Any, path: str, report: _Report) -> None:
        if not isinstance(value, list):
            report.add(path, "must be a list")
            return
        if not low <= len(value) <= high:
            report.add(path, f"needs {low} to {high} items, has {len(value)}")
        for i, entry in enumerate(value):
            item(entry, f"{path}[{i}]", report)

    return check


def _either(key: str, when: Spec, otherwise: Spec) -> Spec:
    """Pick a shape by whether the object has `key` (e.g. a command vs. a sentence)."""

    def check(value: Any, path: str, report: _Report) -> None:
        (when if isinstance(value, dict) and key in value else otherwise)(value, path, report)

    return check


def _all(*specs: Spec) -> Spec:
    def check(value: Any, path: str, report: _Report) -> None:
        before = len(report.problems)
        specs[0](value, path, report)
        if len(report.problems) == before:  # cross-field rules need a valid shape
            for spec in specs[1:]:
                spec(value, path, report)

    return check


def _unique(field: str, what: str) -> Spec:
    def check(value: Any, path: str, report: _Report) -> None:
        seen: set[Any] = set()
        for i, entry in enumerate(value):
            key = entry.get(field) if isinstance(entry, dict) else None
            if key in seen:
                report.add(f"{path}[{i}].{field}", f"duplicate {what} {key!r}")
            seen.add(key)

    return check


# --- the schema ---------------------------------------------------------------


def _scenario_rules(value: Any, path: str, report: _Report) -> None:
    stages, fail, lines = value["stages"], value["fail"], value["lines"]
    if len(set(stages)) != len(stages):
        report.add(f"{path}.stages", "stage names repeat")
    if not lines[0].startswith("$ "):
        report.add(f"{path}.lines[0]", "the first line is the command and starts with '$ '")
    if fail is None:
        want = len(stages) + 1
        if "why" in value:
            report.add(f"{path}.why", "only a blocked run (fail set) shows a fix")
    elif not 0 <= fail < len(stages):
        report.add(f"{path}.fail", f"{fail} is not a stage index (0 to {len(stages) - 1})")
        return
    else:
        want = fail + 2
        if "why" not in value:
            report.add(path, "missing key 'why': a blocked run always says how to fix it")
    if len(lines) != want:
        report.add(
            f"{path}.lines",
            f"needs {want} lines (the command, then one per stage it reached), has {len(lines)}",
        )


def _int_or_null(value: Any, path: str, report: _Report) -> None:
    if value is not None and (isinstance(value, bool) or not isinstance(value, int)):
        report.add(path, f"{value!r} must be a stage index or null")


def _id_or_null(value: Any, path: str, report: _Report) -> None:
    if value is not None:
        _pattern(ID, "a gate id or null")(value, path, report)


CTA = _obj({"label": PLAIN, "to": _route}, {"variant": _one_of("default", "primary", "amber")})
SCENARIO = _all(
    _obj(
        {
            "name": _pattern(BRANCH, "a branch name like feat/add-client"),
            "stages": _list(_pattern(PIPE_STAGE, "a short stage name like lint"), 1, 8),
            "fail": _int_or_null,
            "lines": _list(RAW, 2, 12),
        },
        {"why": PLAIN},
    ),
    _scenario_rules,
)
GATE = _obj({"id": _pattern(ID, "an id like secrets"), "l": PLAIN, "t": PLAIN})
ATTACK = _obj(
    {
        "id": _pattern(ID, "an id like token"),
        "l": PLAIN,
        "g": _id_or_null,
        "why": PLAIN,
        "fix": PLAIN,
    }
)
BENTO = _obj(
    {"span": _one_of(2, 3, 4, 6), "title": PLAIN, "body": RICH},
    {
        "eyebrow": PLAIN,
        "stat": PLAIN,
        "tone": _one_of("amber", "teal", "green", "violet"),
        "link": _obj({"label": PLAIN, "to": _route}),
    },
)
PATH_STEP = _obj({"when": PLAIN, "title": PLAIN, "body": RICH}, {"to": _route})
REPLAY_LINE = _either("cmd", _obj({"cmd": RAW}), _obj({"out": RAW}))
DO_ITEM = _either("code", _obj({"code": CODE}, {"where": PLAIN}), _obj({"text": RICH}))
STEP = _obj(
    {
        "id": _pattern(STEP_ID, "<stage>-<two digits>, like get-01"),
        "title": PLAIN,
        "on": PLAIN,
        "risk": _one_of(*RISKS),
        "label": _one_of(*LABELS),
        "conf": _one_of(*CONFIDENCE),
        "time": PLAIN,
        "why": RICH,
        "do": _list(DO_ITEM, 1, 12),
        "check": _obj({"text": RICH}, {"replay": _list(REPLAY_LINE, 1, 30), "prompt": PLAIN}),
        "undo": _obj({"text": RICH}, {"code": CODE, "where": PLAIN}),
    },
    {
        "callouts": _list(
            _obj(
                {"kind": _one_of("warn", "gate", "adapt", "unverified"), "text": RICH},
                {"label": PLAIN},
            ),
            1,
            6,
        ),
        "sources": _list(_obj({"title": PLAIN, "url": _https}), 1, 8),
    },
)
STAGE = _obj(
    {
        "id": _pattern(STAGE_ID, "a short lowercase word like setup"),
        "title": PLAIN,
        "summary": RICH,
        "steps": _list(STEP, 1, 30),
    },
    {"optional": _boolean},
)
GATE_ROW = _obj(
    {
        "id": _pattern(ID, "an id like secrets"),
        "gate": PLAIN,
        "tool": PLAIN,
        "runs": RICH,
        "catches": RICH,
        "config": PLAIN,
    }
)
HEADED = {"title": PLAIN, "sub": RICH}

PROJECT = _obj(
    {
        "schema": _one_of(2),
        "title": PLAIN,
        "brand": _obj({"left": PLAIN, "right": PLAIN}),
        "hero": _obj(
            {
                "eyebrow": PLAIN,
                "headline": _obj({"before": PLAIN, "accent": PLAIN}, {"after": PLAIN}),
                "lede": RICH,
                "ctas": _list(CTA, 1, 3),
                "stats": _list(_obj({"value": PLAIN, "label": PLAIN}), 2, 4),
            }
        ),
        "console": _obj(
            {
                "title": PLAIN,
                "note": RICH,
                "passLine": RAW,
                "scenarios": _all(_list(SCENARIO, 1, 8), _unique("name", "scenario name")),
            }
        ),
        "pipeline": _obj(HEADED),
        "simulator": _obj(
            {
                "title": PLAIN,
                "sub": RICH,
                "gates": _all(_list(GATE, 1, 8), _unique("id", "gate id")),
                "attacks": _all(_list(ATTACK, 1, 12), _unique("id", "attack id")),
            },
            {"note": RICH},
        ),
        "why": _obj({**HEADED, "cards": _list(BENTO, 1, 12)}),
        "path": _obj({**HEADED, "steps": _list(PATH_STEP, 1, 8)}),
        "final": _obj({"eyebrow": PLAIN, "title": PLAIN, "body": RICH, "ctas": _list(CTA, 1, 3)}),
        "runbook": _obj(HEADED),
        "stages": _all(_list(STAGE, 1, 12), _unique("id", "stage id")),
        "gates": _obj({**HEADED, "rows": _all(_list(GATE_ROW, 1, 30), _unique("id", "gate id"))}),
        "reference": _obj(HEADED),
        "flashcards": _list(_obj({"q": PLAIN, "a": PLAIN}, {"tag": PLAIN}), 1, 60),
        "glossary": _all(
            _list(_obj({"term": PLAIN, "def": PLAIN, "match": _list(PLAIN, 1, 8)}), 1, 120),
            _unique("term", "glossary term"),
        ),
        "versions": _obj(
            {
                "asOf": _date,
                "rows": _list(
                    _obj(
                        {
                            "tool": PLAIN,
                            "version": PLAIN,
                            "released": _date,
                            "pin": _one_of("sha", "version", "sha256"),
                            "where": PLAIN,
                            "source": _https,
                        }
                    ),
                    1,
                    80,
                ),
            }
        ),
        "layout": _list(_obj({"path": PLAIN, "what": RICH}), 1, 80),
        "footer": RICH,
    },
    {"repo": _https},
)


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _dicts(value: Any) -> Iterator[tuple[int, dict[str, Any]]]:
    if isinstance(value, list):
        for i, entry in enumerate(value):
            if isinstance(entry, dict):
                yield i, entry


def _cross_checks(data: dict[str, Any], report: _Report) -> None:
    """Rules that span sections: ids, gate references, routes, glossary matches."""
    stage_ids: set[Any] = set()
    step_ids: set[Any] = set()
    for s, stage in _dicts(data.get("stages")):
        stage_ids.add(stage.get("id"))
        for n, step in _dicts(stage.get("steps")):
            sid, where = step.get("id"), f"stages[{s}].steps[{n}].id"
            if sid in step_ids:
                report.add(where, f"duplicate step id {sid!r}")
            step_ids.add(sid)
            if isinstance(sid, str) and not sid.startswith(f"{stage.get('id')}-"):
                report.add(where, f"{sid!r} must start with its stage id '{stage.get('id')}-'")

    simulator = _as_dict(data.get("simulator"))
    gate_ids = {g.get("id") for _, g in _dicts(simulator.get("gates"))}
    for i, attack in _dicts(simulator.get("attacks")):
        gate = attack.get("g")
        if gate is not None and gate not in gate_ids:
            known = ", ".join(sorted(str(g) for g in gate_ids))
            report.add(f"simulator.attacks[{i}].g", f"{gate!r} is not a gate id ({known})")

    gates = _as_dict(data.get("gates"))
    targets: dict[str, set[Any]] = {
        "home": HOME_SECTIONS,
        "runbook": stage_ids | step_ids,
        "gates": {row.get("id") for _, row in _dicts(gates.get("rows"))},
        "reference": REFERENCE_SECTIONS,
    }
    for path, route in report.routes:
        match = ROUTE.match(route)
        view, name = (match.group(1), match.group(2)) if match else (None, None)
        if view and name and name not in targets[view]:
            report.add(path, f"{route!r} points at nothing: no {view} section or step {name!r}")

    seen: dict[str, str] = {}
    for i, entry in _dicts(data.get("glossary")):
        for word in entry.get("match") or []:
            if not isinstance(word, str):
                continue
            key = word if any(c.isupper() for c in word) else word.lower()
            if key in seen:
                report.add(f"glossary[{i}].match", f"{word!r} already links to {seen[key]!r}")
            seen[key] = str(entry.get("term"))


def check_project(data: Any) -> list[str]:
    """Validate site/project.json (already parsed). Returns problems; empty means OK."""
    report = _Report()
    PROJECT(data, "", report)
    if isinstance(data, dict):
        _cross_checks(data, report)
    return report.problems


# --- HTML lockdown ------------------------------------------------------------


def is_fonts_sheet(url: str) -> bool:
    """The one outside file a page may load: a Google Fonts css2 stylesheet over https.

    REQUIRED_CSP allows it (style-src fonts.googleapis.com, font-src fonts.gstatic.com).
    Exact host and path, so look-alikes such as fonts.googleapis.com.evil.example fail.
    """
    parts = urllib.parse.urlsplit(url)
    return (
        parts.scheme == "https"
        and parts.netloc == "fonts.googleapis.com"
        and parts.path == "/css2"
        and bool(parts.query)
        and not parts.fragment
    )


class _PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.problems: list[str] = []
        self.csp: list[tuple[int, str]] = []
        self.first_resource: int | None = None
        self.local: list[str] = []
        self.count = 0

    def _resource(self) -> None:
        if self.first_resource is None:
            self.first_resource = self.count

    def _ref(self, tag: str, url: str) -> None:
        """A file the page loads: only its own, by a relative path inside site/."""
        parts = urllib.parse.urlsplit(url)
        if parts.scheme or parts.netloc or url.startswith(("/", "\\")) or ".." in url.split("/"):
            self.problems.append(f"<{tag}> loads {url}: the page may only load its own files")
        else:
            self.local.append(parts.path)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.count += 1
        values = {name: value or "" for name, value in attrs}
        for name, value in values.items():
            if name.startswith("on"):
                self.problems.append(f"<{tag} {name}>: inline event handler; attach it in app.js")
            if name == "style":
                self.problems.append(f"<{tag}> style attribute: CSP blocks it; use app.css")
            if value.strip().lower().startswith("javascript:"):
                self.problems.append(f"<{tag} {name}>: javascript: URL")
        if tag == "meta" and values.get("http-equiv", "").lower() == "content-security-policy":
            self.csp.append((self.count, values.get("content", "")))
        elif tag == "base":
            self.problems.append("<base> can re-point every relative URL; remove it")
        elif tag in {"iframe", "object", "embed", "frame", "form"}:
            self.problems.append(f"<{tag}> is not allowed on this page")
        elif tag == "style":
            self._resource()
            self.problems.append("<style> block: CSP blocks inline styles; use app.css")
        elif tag == "script":
            self._resource()
            if "src" in values:
                self._ref(tag, values["src"])
            else:
                self.problems.append("inline <script>: CSP blocks it; put the code in a .js file")
        elif tag == "link":
            rel = values.get("rel", "").strip().lower()
            if rel == "stylesheet":
                self._resource()
            if "href" in values and not (rel == "stylesheet" and is_fonts_sheet(values["href"])):
                self._ref(tag, values["href"])
        elif tag in {"img", "source", "video", "audio", "track"} and "src" in values:
            self._ref(tag, values["src"])


def parse_csp(policy: str) -> dict[str, list[str]]:
    directives: dict[str, list[str]] = {}
    for part in policy.split(";"):
        words = part.split()
        if words:
            directives.setdefault(words[0].lower(), []).extend(words[1:])
    return directives


def check_index_html(text: str, site_dir: Path | None = None) -> list[str]:
    """Check one HTML page's lockdown. With site_dir, also check every local file exists."""
    page = _PageParser()
    page.feed(text)
    page.close()
    problems = list(page.problems)
    if not page.csp:
        problems.append("no Content-Security-Policy meta tag: add the one in scripts/check_site.py")
    elif len(page.csp) > 1:
        problems.append("more than one Content-Security-Policy meta tag; keep exactly one")
    else:
        order, policy = page.csp[0]
        got = parse_csp(policy)
        for name in sorted(set(REQUIRED_CSP) | set(got)):
            want = REQUIRED_CSP.get(name)
            if want is None:
                problems.append(f"Content-Security-Policy {name}: not in REQUIRED_CSP")
            elif name not in got:
                problems.append(f"Content-Security-Policy {name}: missing")
            elif sorted(got[name]) != sorted(want):
                shown = " ".join(got[name]) or "(empty)"
                problems.append(
                    f"Content-Security-Policy {name}: expected {' '.join(want) or '(empty)'}, "
                    f"got {shown}"
                )
        if page.first_resource is not None and order > page.first_resource:
            problems.append(
                "the Content-Security-Policy meta must come before any script or stylesheet"
            )
    if site_dir is not None:
        for ref in page.local:
            if not (site_dir / ref).is_file():
                problems.append(f"{ref} does not exist in {site_dir.name}/")
    return problems


# --- vendored files -----------------------------------------------------------


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _locked_files(lock: Any) -> dict[str, dict[str, Any]]:
    """Every vendored file the lock lists, keyed by repo path."""
    files: dict[str, dict[str, Any]] = {}
    groups = [lock.get("designSystem", {})] + list((lock.get("vendor") or {}).values())
    for group in groups:
        for rel, entry in (group.get("files") or {}).items():
            files[rel] = entry
    return files


def _read_lock(root: Path) -> dict[str, Any]:
    lock = json.loads((root / LOCK).read_text(encoding="utf-8"))
    if not isinstance(lock, dict) or lock.get("lockVersion") != 1:
        raise ValueError("unknown lockVersion (expected 1)")
    return lock


def check_lock(root: Path) -> list[str]:
    """Check vendored files against site/ds.lock.json and rebuild generated ones."""
    try:
        lock = _read_lock(root)
        files = _locked_files(lock)
        generated: dict[str, Any] = lock.get("generated") or {}
    except (OSError, ValueError, AttributeError) as err:
        return [f"{LOCK}: cannot read it: {err}"]
    problems: list[str] = []
    for rel, entry in sorted(files.items()):
        path = root / rel
        if not path.is_file():
            problems.append(f"{rel}: listed in {LOCK} but missing")
        elif _sha256(path) != entry.get("sha256"):
            problems.append(
                f"{rel}: sha256 does not match {LOCK}. Vendored files are never edited by hand: "
                "re-sync them (docs/runbooks/sync-design-system.md)"
            )
    for folder in VENDORED_DIRS:
        for path in sorted((root / folder).rglob("*")):
            rel = path.relative_to(root).as_posix()
            unlisted = rel not in files and rel not in generated
            if path.is_file() and path.name not in IGNORED_FILES and unlisted:
                problems.append(f"{rel}: not listed in {LOCK}; lock it on a sync or delete it")
    for rel, how in sorted(generated.items()):
        if not isinstance(how, dict) or how.get("by") != "scripts/ds_tokens.py":
            problems.append(f"{rel}: the lock names no generator this check can rebuild")
            continue
        try:
            want = ds_tokens.compile_tokens(
                json.loads((root / how["from"]).read_text(encoding="utf-8"))
            )
            have = (root / rel).read_text(encoding="utf-8")
        except (OSError, ValueError, KeyError) as err:
            problems.append(f"{rel}: cannot rebuild it: {err}")
            continue
        if have != want:
            problems.append(f"{rel}: out of date with {how['from']}; run make site-tokens")
    return problems


def relock(root: Path) -> list[str]:
    """Rewrite the sha256 of every file already in the lock. Never adds files."""
    lock = _read_lock(root)
    changed = []
    for rel, entry in _locked_files(lock).items():
        digest = _sha256(root / rel)
        if entry.get("sha256") != digest:
            entry["sha256"] = digest
            changed.append(f"relocked {rel}")
    (root / LOCK).write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    return changed


# --- scripts, styles, images --------------------------------------------------

SINKS = [
    (re.compile(r"\.(?:inner|outer)HTML\s*\+?=(?!=)"), "innerHTML/outerHTML assignment"),
    (re.compile(r"\binsertAdjacentHTML\s*\("), "insertAdjacentHTML"),
    (re.compile(r"\bdocument\s*\.\s*write(?:ln)?\s*\("), "document.write"),
    (re.compile(r"(?<![\w$.])eval\s*\("), "eval"),
    (re.compile(r"\bnew\s+Function\s*\(|(?<![\w$.])Function\s*\("), "new Function"),
    (re.compile(r"\bdangerouslySetInnerHTML\b"), "dangerouslySetInnerHTML"),
    (re.compile(r"\bset(?:Timeout|Interval)\s*\(\s*['\"`]"), "a string passed to a timer"),
    (re.compile(r"\b(?:createContextualFragment|parseFromString)\s*\("), "HTML parsing"),
    (re.compile(r"\b(?:setHTMLUnsafe|parseHTMLUnsafe)\s*\("), "setHTMLUnsafe"),
    (re.compile(r"\.srcdoc\s*=(?!=)|\bsrcdoc\s*:|['\"]srcdoc['\"]", re.IGNORECASE), "srcdoc"),
    (re.compile(r"javascript:", re.IGNORECASE), "a javascript: URL"),
    (re.compile(r"\bsetAttribute\s*\(\s*['\"](?:on\w+|style)['\"]", re.IGNORECASE), "setAttribute"),
    (re.compile(r"(?<![\w$.])import\s*\(|\bimportScripts\s*\("), "dynamic import"),
    (re.compile(r"\bnew\s+(?:Shared)?Worker\s*\("), "a worker"),
]
FETCH = re.compile(r"\bfetch\s*\(")
FETCH_LOCAL = re.compile(r"""\s*(['"])(?![a-zA-Z][a-zA-Z0-9+.-]*:|/)[A-Za-z0-9_./-]+\1""")
# A pattern built from data can be made slow (ReDoS) or match the wrong thing. Semgrep's
# default rules flag it too; this catches it before a push. Literal patterns only.
REGEXP = re.compile(r"\bRegExp\s*\(")
REGEXP_LITERAL = re.compile(
    r"""\s*(?:'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|/(?:\\.|[^/\\\n])+/[a-z]*)\s*[,)]"""
)


def _line(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def check_page_js(name: str, text: str) -> list[str]:
    """Flag HTML and code sinks, and any fetch that isn't a relative string literal."""
    problems = []
    for regex, what in SINKS:
        for match in regex.finditer(text):
            problems.append(f"{name}:{_line(text, match.start())}: {what} is banned on this page")
    for match in FETCH.finditer(text):
        if not FETCH_LOCAL.match(text, match.end()):
            problems.append(
                f"{name}:{_line(text, match.start())}: fetch() may only load a relative file "
                "named in a string literal, like fetch('project.json')"
            )
    for match in REGEXP.finditer(text):
        if not REGEXP_LITERAL.match(text, match.end()):
            problems.append(
                f"{name}:{_line(text, match.start())}: RegExp() may only take a literal "
                "pattern; build no pattern from page data"
            )
    return problems


CSS_IMPORT = re.compile(r"""@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]*)""", re.IGNORECASE)
CSS_URL = re.compile(r"""url\(\s*(['"]?)([^'")\s]*)""", re.IGNORECASE)
SVG_BAD = re.compile(
    r"<script|<foreignObject|\son[a-z]+\s*=|javascript:|href\s*=\s*['\"](?!#)", re.IGNORECASE
)


def check_css(name: str, text: str) -> list[str]:
    """CSS loads nothing. Fonts come from the one stylesheet link in index.html."""
    problems = []
    for regex, what in ((CSS_IMPORT, "@import pulls in"), (CSS_URL, "url() loads")):
        for match in regex.finditer(text):
            target = match.group(2)
            where = f"{name}:{_line(text, match.start())}"
            problems.append(f"{where}: {what} {target or 'a file'}; CSS may load nothing")
    return problems


# --- colours and names --------------------------------------------------------

CONTRAST = "site/contrast.json"
HEX_COLOUR = re.compile(r"#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})")
VAR_USE = re.compile(r"var\(\s*--([A-Za-z0-9_-]+)")
VAR_DECL = re.compile(r"(?<![\w-])--([A-Za-z0-9_-]+)\s*:|['\"]--([A-Za-z0-9_-]+)['\"]")
DS_NAME = re.compile(r"(?<![\w-])dk-[a-z0-9]+(?:-[a-z0-9]+)*")
TEXT_COLOUR = re.compile(r"(?<![\w-])color\s*:\s*var\(\s*--([A-Za-z0-9_-]+)")


def _rgb(value: str) -> tuple[float, float, float] | None:
    """An opaque hex colour as three 0-1 channels; None if it is see-through or not hex."""
    digits = value.lower()[1:]
    if not HEX_COLOUR.fullmatch(value.lower()):
        return None
    if len(digits) in (3, 4):
        digits = "".join(c * 2 for c in digits)
    if len(digits) == 8:
        if digits[6:] != "ff":
            return None
        digits = digits[:6]
    return (int(digits[0:2], 16) / 255, int(digits[2:4], 16) / 255, int(digits[4:6], 16) / 255)


def _luminance(rgb: tuple[float, float, float]) -> float:
    def linear(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (linear(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(a: str, b: str) -> float:
    """WCAG 2 contrast ratio of two opaque hex colours, from 1 to 21."""
    ra, rb = _rgb(a), _rgb(b)
    if ra is None or rb is None:
        raise ValueError(f"not an opaque hex colour: {a if ra is None else b}")
    hi, lo = sorted((_luminance(ra), _luminance(rb)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def _pair_list(contrast: Any, group: str) -> list[Any] | None:
    section = contrast.get(group) if isinstance(contrast, Mapping) else None
    pairs = section.get("pairs") if isinstance(section, Mapping) else None
    return pairs if isinstance(pairs, list) and pairs else None


def check_contrast(tokens: Mapping[str, Any], contrast: Any) -> list[str]:
    """Every pair in site/contrast.json reaches its floor in every theme.

    contrast.json holds {"designSystem": {"pairs": [...]}, "page": {"pairs": [...]}}; a
    pair is {"fg": token, "on": [tokens]} with an optional "min": 3 for large text,
    control borders and focus rings. designSystem.pairs is a verbatim copy of the QA
    kit's pairs.json; page.pairs covers every text colour app.css sets.
    """
    try:
        colours = ds_tokens.theme_colours(tokens)
    except ds_tokens.TokenError as err:
        return [f"{CONTRAST}: cannot read the design system's colours: {err}"]
    first = next(iter(colours.values()))
    problems: list[str] = []
    for group in ("designSystem", "page"):
        pairs = _pair_list(contrast, group)
        if pairs is None:
            problems.append(f"{CONTRAST}: {group}.pairs: expected a non-empty list of pairs")
            continue
        for i, pair in enumerate(pairs):
            where = f"{CONTRAST}: {group}.pairs[{i}]"
            fg = pair.get("fg") if isinstance(pair, Mapping) else None
            bgs = pair.get("on") if isinstance(pair, Mapping) else None
            floor = pair.get("min", 4.5) if isinstance(pair, Mapping) else None
            if (
                not isinstance(fg, str)
                or not isinstance(bgs, list)
                or not bgs
                or not all(isinstance(bg, str) for bg in bgs)
                or isinstance(floor, bool)
                or floor not in (3, 4.5)
            ):
                problems.append(
                    f'{where}: expected {{"fg": token, "on": [tokens]}}, "min" 3 or 4.5'
                )
                continue
            missing = [n for n in (fg, *bgs) if n not in first]
            problems += [
                f"{where}: {n} is not a colour token in site/ds/tokens.json" for n in missing
            ]
            if missing:
                continue
            for theme, values in colours.items():
                for bg in bgs:
                    try:
                        ratio = contrast_ratio(values[fg], values[bg])
                    except ValueError:
                        problems.append(
                            f"{where}: {fg} on {bg} ({theme}) can't be checked: "
                            "only opaque hex colours can"
                        )
                        continue
                    if ratio < floor:
                        problems.append(
                            f"{where}: {fg} on {bg} in {theme} is {ratio:.2f}:1; "
                            f"this text needs {floor}:1"
                        )
    return problems


def check_text_colours(css: str, contrast: Any) -> list[str]:
    """Every text colour app.css sets needs a pair in site/contrast.json page.pairs."""
    listed = {p.get("fg") for p in _pair_list(contrast, "page") or [] if isinstance(p, Mapping)}
    problems = []
    for match in TEXT_COLOUR.finditer(css):
        name = match.group(1)
        if name not in listed and not name.startswith("pg-"):
            problems.append(
                f"site/app.css:{_line(css, match.start())}: text colour var(--{name}) has no "
                f"pair in {CONTRAST}; add one with every background it sits on"
            )
    return problems


def check_page_names(site: Path) -> list[str]:
    """Every token and dk- class the page uses must still exist in the vendored system."""
    try:
        css = (site / "app.css").read_text(encoding="utf-8")
        js = (site / "app.js").read_text(encoding="utf-8")
        ds = "\n".join(
            (site / "ds" / name).read_text(encoding="utf-8")
            for name in ("tokens.css", "bundle.css", "bundle.js")
        )
    except OSError as err:
        return [f"site: cannot read the page or design-system files: {err}"]
    declared = {a or b for a, b in VAR_DECL.findall(ds + "\n" + css)}
    problems = []
    for match in VAR_USE.finditer(css):
        name = match.group(1)
        if not name.startswith("pg-") and name not in declared:
            problems.append(
                f"site/app.css:{_line(css, match.start())}: var(--{name}) is not in the "
                "design system (renamed or removed upstream?)"
            )
    known = set(DS_NAME.findall(ds))
    for rel, text in (("site/app.css", css), ("site/app.js", js)):
        for match in DS_NAME.finditer(text):
            if match.group(0) not in known:
                problems.append(
                    f"{rel}:{_line(text, match.start())}: {match.group(0)} is not in the "
                    "design system (renamed or removed upstream?)"
                )
    return problems


def check_site(root: Path) -> list[str]:
    """Run every check on root/site. Returns problems; empty means the page can ship."""
    site = root / "site"
    problems: list[str] = []
    if (site / "project.json").exists():
        try:
            data = json.loads((site / "project.json").read_text(encoding="utf-8"))
        except (OSError, ValueError) as err:
            problems.append(f"site/project.json: cannot read it: {err}")
        else:
            problems += [f"site/project.json: {p}" for p in check_project(data)]
    problems += check_lock(root)
    vendored = tuple(root / folder for folder in VENDORED_DIRS)
    for path in sorted(site.rglob("*")):
        rel = path.relative_to(root).as_posix()
        if not path.is_file() or (path.is_relative_to(vendored[1])):
            continue
        in_ds = path.is_relative_to(vendored[0])
        if path.suffix == ".html" and not in_ds:
            text = path.read_text(encoding="utf-8")
            problems += [f"{rel}: {p}" for p in check_index_html(text, path.parent)]
        elif path.suffix == ".js":
            problems += check_page_js(rel, path.read_text(encoding="utf-8"))
        elif path.suffix == ".css" and path.name != "tokens.css":
            problems += check_css(rel, path.read_text(encoding="utf-8"))
        elif path.suffix == ".svg" and SVG_BAD.search(path.read_text(encoding="utf-8")):
            problems.append(f"{rel}: SVG with script, event handlers or outside links")
    try:
        tokens = json.loads((site / "ds/tokens.json").read_text(encoding="utf-8"))
        contrast = json.loads((root / CONTRAST).read_text(encoding="utf-8"))
        css = (site / "app.css").read_text(encoding="utf-8")
    except (OSError, ValueError) as err:
        problems.append(f"{CONTRAST}: cannot check colours: {err}")
    else:
        problems += check_contrast(tokens, contrast)
        problems += check_text_colours(css, contrast)
    problems += check_page_names(site)
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument(
        "--relock",
        action="store_true",
        help="after a deliberate sync: rewrite the sha256 of every file already in the lock",
    )
    args = parser.parse_args(argv)
    if args.relock:
        for line in relock(args.root):
            print(line)
    problems = check_site(args.root)
    if not (args.root / "site/project.json").exists():
        print("site/project.json not found: content schema skipped")
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        print(f"site check failed: {len(problems)} problem(s)", file=sys.stderr)
        return 1
    print("site OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
