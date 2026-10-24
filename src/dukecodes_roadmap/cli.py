"""`roadmap`: check, build and explain the roadmap from the command line."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

from .checks import load, text_encoding
from .redact import redact
from .site import Assets, build_model, render_fragment, render_page, scoreboard, update_readme

SITE_OUT = "site/index.html"
README = "README.md"


def _plain(tokens: list[list[str]]) -> str:
    return "".join(t[1] for t in tokens)


def cmd_check(root: Path) -> int:
    rm, problems = load(root)
    for p in problems:
        print(p)
    if problems:
        print(f"roadmap check: {len(problems)} problem(s)", file=sys.stderr)
        return 1
    reps = sum(len(m.reps) for m in rm.milestones)
    print(f"roadmap check: ok · {len(rm.milestones)} milestones · {reps} reps · "
          f"{len(rm.proofs)} proofs")  # fmt: skip
    return 0


def outputs(root: Path) -> tuple[dict[str, str], dict[str, Any], Assets] | None:
    rm, problems = load(root)
    if problems:
        for p in problems:
            print(p)
        print(f"roadmap build: fix {len(problems)} problem(s) first", file=sys.stderr)
        return None
    try:
        assets = Assets.read(root)
    except (OSError, ValueError) as e:
        print(f"roadmap build: {e}", file=sys.stderr)
        return None
    model = build_model(rm)
    readme_path = root / README
    readme = update_readme(readme_path.read_text(encoding="utf-8"), scoreboard(model, rm))
    files = {SITE_OUT: render_page(model, assets)}
    if readme is None:
        print("README.md has no scoreboard markers; skipped", file=sys.stderr)
    else:
        files[README] = readme
    return files, model, assets


def cmd_build(root: Path, check: bool, artifact: Path | None) -> int:
    built = outputs(root)
    if built is None:
        return 1
    files, model, assets = built
    stale = []
    for name, text in files.items():
        path = root / name
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == text:
            continue
        stale.append(name)
        if not check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
            print(f"wrote {name}")
    if artifact is not None:
        artifact.write_text(render_fragment(model, assets), encoding="utf-8")
        print(f"wrote {artifact}")
    if check and stale:
        print(f"stale: {', '.join(stale)}. Run `make build` and commit the result.", file=sys.stderr)
        return 1
    if not stale:
        print("roadmap build: up to date")
    return 0


def cmd_status(root: Path) -> int:
    built = outputs(root)
    if built is None:
        return 1
    _, model, _ = built
    s = model["stats"]
    cur = next((m for m in model["milestones"] if m["id"] == model["current"]), None)
    if cur is None:
        print("Every milestone is done. Time to apply.")
        return 0
    print(f"Now:  {cur['id']} {cur['title']} ({cur['status']}) · "
          f"{cur['progress'][0]}/{cur['progress'][1]} ticked")  # fmt: skip
    nxt = model["next"]
    if nxt:
        print(f"Next: {nxt['id']} · {_plain(nxt['text'])}")
        if nxt["doneWhen"]:
            print(f"      done when: {_plain(nxt['doneWhen'])}")
    print(f"Proofs {s['proofs']} · reps {s['reps'][0]}/{s['reps'][1]} · explainers "
          f"{s['explainers'][0]}/{s['explainers'][2]} · certs {s['certs'][0]}/{s['certs'][1]}")  # fmt: skip
    return 0


def cmd_redact(files: list[Path], apply: bool) -> int:
    changed = 0
    for path in files:
        try:
            # Bytes in and out, so the encoding and Windows line endings of pasted output survive.
            data = path.read_bytes()
            enc = text_encoding(data)
            new, pairs = redact(data.decode(enc))
        except (OSError, ValueError) as e:
            print(f"{path}: {e}", file=sys.stderr)
            return 1
        if not pairs:
            print(f"{path}: nothing to redact")
            continue
        changed += 1
        for old, rep in pairs:
            print(f"{path}: {old} -> {rep}")
        if apply:
            path.write_bytes(new.encode(enc))
    if changed and not apply:
        print("dry run: nothing written. Re-run with --apply to rewrite the files.")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="roadmap", description="Check and build the DevSecOps roadmap.")
    ap.add_argument("--root", type=Path, default=Path.cwd(), help="repo root (default: here)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check", help="validate every file; CI runs this")
    b = sub.add_parser("build", help="rebuild site/index.html and the README scoreboard")
    b.add_argument("--check", action="store_true", help="write nothing; fail if outputs are stale")
    b.add_argument("--artifact", type=Path, help="also write the page as an Artifact fragment")
    sub.add_parser("status", help="show the current milestone and the next rep")
    r = sub.add_parser("redact", help="swap private addresses for documentation examples")
    r.add_argument("files", nargs="+", type=Path)
    r.add_argument("--apply", action="store_true", help="rewrite the files (default: dry run)")
    args = ap.parse_args(argv)
    root = args.root.resolve()
    if args.cmd == "check":
        return cmd_check(root)
    if args.cmd == "build":
        return cmd_build(root, args.check, args.artifact)
    if args.cmd == "status":
        return cmd_status(root)
    return cmd_redact(args.files, args.apply)
