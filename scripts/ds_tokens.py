"""Compile the dukecodes design system tokens.json into tokens.css.

The design system page compiles tokens.css itself but does not serve it, so this
script rebuilds it from the vendored tokens.json, following the system's own
format rules (artifact-type/reference/format.md, "tokens.css as compiled"):

    :root, [data-theme="<first>"] { colours and shadows }
    [data-theme="<other>"]        { that theme's values, aliases re-declared }
    :root                         { spacing, radius, other families, --font-<key> }
    .<style>                      { one class per type style }
    @font-face                    { one per font }

It fails closed: any value it cannot prove safe stops the build, where the design
system page would silently drop it. Nothing from tokens.json reaches the CSS
without passing a strict pattern, so a bad sync cannot inject CSS.

Usage:  python scripts/ds_tokens.py site/ds/tokens.json site/ds/tokens.css [--check]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
THEME_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
SYSTEM_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$")
HEX = re.compile(r"^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
COLOR_FN = re.compile(r"^(rgba?|hsla?|oklch|oklab|lab|lch|color)\(([^()]*)\)$")
COLOR_ARG = re.compile(r"^(?:[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:%|deg|rad|grad|turn)?|none)$")
COLOR_SPACES = {
    "srgb",
    "srgb-linear",
    "display-p3",
    "a98-rgb",
    "prophoto-rgb",
    "rec2020",
    "xyz",
    "xyz-d50",
    "xyz-d65",
}
ALIAS = re.compile(r"^\{([A-Za-z0-9][A-Za-z0-9_.-]{0,63})\}$")
LENGTH = re.compile(r"^(?:0|[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%))$")
SHADOW = re.compile(r"^[A-Za-z0-9 #%(),./+-]{1,400}$")
OTHER_VALUE = re.compile(r"^[A-Za-z0-9 #%(),./+_-]{1,200}$")
FONT_FILE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_./-]{0,200}$")
FONT_FAMILY_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _-]{0,99}$")
FONT_WEIGHT_RANGE = re.compile(r"^\d{1,4}(?: \d{1,4})?$")
MAX_ALIAS_DEPTH = 16
KNOWN_KEYS = {"name", "version", "color", "type", "spacing", "radius", "shadow"}


class TokenError(ValueError):
    """tokens.json holds a value that cannot be compiled safely."""


def _name(value: Any, where: str) -> str:
    # The design system strips a leading -- or . ; we refuse it so the source stays clean.
    if not isinstance(value, str) or not NAME.match(value):
        raise TokenError(f"{where}: bad name {value!r} (letters, digits, _ . - only, max 64)")
    return value


def _prop(name: str) -> str:
    return "--" + name.replace(".", "\\.")


def _length(value: Any, where: str) -> str:
    if isinstance(value, bool):
        raise TokenError(f"{where}: bad length {value!r}")
    if isinstance(value, int | float):
        return f"{value:g}px" if value else "0"
    if isinstance(value, str) and LENGTH.match(value):
        return value
    raise TokenError(f"{where}: bad length {value!r} (use 12px, 0.75rem, 1em, 50% or a number)")


def _color(value: Any, where: str) -> str:
    """A literal colour, lowercased. Aliases are handled by the caller."""
    if not isinstance(value, str):
        raise TokenError(f"{where}: bad color {value!r}")
    if HEX.match(value):
        return value.lower()
    m = COLOR_FN.match(value)
    if m:
        fn, inner = m.group(1), m.group(2)
        args = [a for a in re.split(r"[\s,/]+", inner.strip()) if a]
        if fn == "color" and args and args[0] in COLOR_SPACES:
            args = args[1:]
        if args and all(COLOR_ARG.match(a) for a in args):
            return value
    raise TokenError(
        f"{where}: bad color {value!r} (hex, or rgb()/hsl()/oklch()/... with plain numbers, "
        "or an alias like {other-token}; no var(), url(), color-mix() or named colours)"
    )


def _per_theme(value: Any, themes: Sequence[str], where: str) -> dict[str, Any]:
    """Map a token value to {theme: raw}. A plain value belongs to the first theme."""
    if isinstance(value, Mapping):
        unknown = set(value) - set(themes)
        if unknown:
            raise TokenError(f"{where}: unknown theme(s) {sorted(unknown)}")
        if themes[0] not in value:
            raise TokenError(f"{where}: no value for the first theme {themes[0]!r}")
        return {t: value[t] for t in themes if t in value}
    return {themes[0]: value}


def _themes(color: Mapping[str, Any]) -> list[str]:
    raw = color.get("themes")
    if not isinstance(raw, list) or not raw or len(raw) > 8:
        raise TokenError("color.themes: need 1 to 8 themes")
    ids = []
    for i, t in enumerate(raw):
        tid = t.get("id") if isinstance(t, Mapping) else None
        if not isinstance(tid, str) or not THEME_ID.match(tid):
            raise TokenError(f"color.themes[{i}]: bad theme id {tid!r}")
        ids.append(tid)
    if len(set(ids)) != len(ids):
        raise TokenError("color.themes: duplicate theme id")
    return ids


def _resolve_aliases(colors: dict[str, dict[str, Any]], themes: Sequence[str]) -> None:
    """Check every {alias} points at a colour token, with no cycles or deep chains."""

    def target(raw: Any) -> str | None:
        m = ALIAS.match(raw) if isinstance(raw, str) else None
        return m.group(1) if m else None

    for name, values in colors.items():
        for theme, raw in values.items():
            seen, cur, depth = {name}, target(raw), 0
            while cur is not None:
                depth += 1
                if cur not in colors:
                    raise TokenError(f"color {name} ({theme}): alias to missing token {cur!r}")
                if cur in seen or depth > MAX_ALIAS_DEPTH:
                    raise TokenError(f"color {name} ({theme}): alias cycle or chain over 16 deep")
                seen.add(cur)
                nxt = colors[cur].get(theme, colors[cur][themes[0]])
                cur = target(nxt)


def _family_stack(value: Any, where: str) -> str:
    if (
        not isinstance(value, str)
        or not value.strip()
        or len(value) > 200
        or any(c in value for c in ";{}<>\\()")
        or value.count('"') % 2
        or value.count("'") % 2
    ):
        raise TokenError(f"{where}: bad font family stack {value!r}")
    return value


def _weight(value: Any, where: str) -> str:
    if value in ("normal", "bold"):
        return "400" if value == "normal" else "700"
    if isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 1000:
        return str(value)
    if (
        isinstance(value, str)
        and FONT_WEIGHT_RANGE.match(value)
        and all(1 <= int(p) <= 1000 for p in value.split())
    ):
        return value
    raise TokenError(f"{where}: bad fontWeight {value!r}")


def _line_height(value: Any, where: str) -> str:
    if isinstance(value, int | float) and not isinstance(value, bool) and 0 < value < 10:
        return f"{value:g}"
    if isinstance(value, str):
        return _length(value, where)
    raise TokenError(f"{where}: bad lineHeight {value!r}")


def _token_list(family: Any, where: str) -> list[Mapping[str, Any]]:
    tokens = family.get("tokens") if isinstance(family, Mapping) else None
    if not isinstance(tokens, list):
        raise TokenError(f"{where}: expected {{'tokens': [...]}}")
    for i, t in enumerate(tokens):
        if not isinstance(t, Mapping) or "name" not in t or "value" not in t:
            raise TokenError(f"{where}.tokens[{i}]: each token needs a name and a value")
    return tokens


def theme_colours(data: Mapping[str, Any]) -> dict[str, dict[str, str]]:
    """Every colour token's value in every theme, as {theme: {name: colour}}.

    Aliases are followed inside each theme, and a theme with no value of its own takes the
    first theme's, the same way tokens.css resolves them. Raises TokenError on anything
    compile_tokens would refuse.
    """
    color = data.get("color")
    if not isinstance(color, Mapping):
        raise TokenError("color: missing")
    themes = _themes(color)
    raw: dict[str, dict[str, Any]] = {}
    for i, t in enumerate(_token_list(color, "color")):
        name = _name(t["name"], f"color.tokens[{i}]")
        raw[name] = _per_theme(t["value"], themes, f"color {name}")
    _resolve_aliases(raw, themes)
    out: dict[str, dict[str, str]] = {}
    for theme in themes:
        out[theme] = {}
        for name in raw:
            value = raw[name].get(theme, raw[name][themes[0]])
            m = ALIAS.match(value) if isinstance(value, str) else None
            while m:  # _resolve_aliases proved the chain ends
                value = raw[m.group(1)].get(theme, raw[m.group(1)][themes[0]])
                m = ALIAS.match(value) if isinstance(value, str) else None
            out[theme][name] = _color(value, f"color {name} ({theme})")
    return out


def compile_tokens(data: Mapping[str, Any]) -> str:
    """Return tokens.css for a tokens.json document. Raises TokenError on anything unsafe."""
    sys_name = data.get("name")
    if not isinstance(sys_name, str) or not SYSTEM_NAME.match(sys_name):
        raise TokenError(f"name: bad system name {sys_name!r}")
    color = data.get("color")
    if not isinstance(color, Mapping):
        raise TokenError("color: missing")
    themes = _themes(color)
    taken: set[str] = set()

    def claim(name: str, where: str) -> None:
        if name in taken:
            raise TokenError(f"{where}: duplicate token name {name!r}")
        taken.add(name)

    colors: dict[str, dict[str, Any]] = {}
    for i, t in enumerate(_token_list(color, "color")):
        name = _name(t["name"], f"color.tokens[{i}]")
        claim(name, f"color.tokens[{i}]")
        colors[name] = _per_theme(t["value"], themes, f"color {name}")
    if len(colors) > 600:
        raise TokenError("color: more than 600 tokens")
    _resolve_aliases(colors, themes)

    def color_css(name: str, raw: Any) -> str:
        m = ALIAS.match(raw) if isinstance(raw, str) else None
        return f"var({_prop(m.group(1))})" if m else _color(raw, f"color {name}")

    shadows: dict[str, dict[str, Any]] = {}
    if "shadow" in data:
        for i, t in enumerate(_token_list(data["shadow"], "shadow")):
            name = _name(t["name"], f"shadow.tokens[{i}]")
            claim(name, f"shadow.tokens[{i}]")
            values = _per_theme(t["value"], themes, f"shadow {name}")
            for theme, raw in values.items():
                if (
                    not isinstance(raw, str)
                    or not SHADOW.match(raw)
                    or "var(" in raw
                    or "url(" in raw
                    or raw.count("(") != raw.count(")")
                ):
                    raise TokenError(f"shadow {name} ({theme}): bad shadow {raw!r}")
            shadows[name] = values

    scalars: list[tuple[str, str]] = []
    for fam in ("spacing", "radius"):
        if fam in data:
            for i, t in enumerate(_token_list(data[fam], fam)):
                name = _name(t["name"], f"{fam}.tokens[{i}]")
                claim(name, f"{fam}.tokens[{i}]")
                scalars.append((name, _length(t["value"], f"{fam} {name}")))
    others = [k for k in data if k not in KNOWN_KEYS]
    if len(others) > 12:
        raise TokenError("more than 12 extra token families")
    for fam in others:
        for i, t in enumerate(_token_list(data[fam], fam)):
            name = _name(t["name"], f"{fam}.tokens[{i}]")
            claim(name, f"{fam}.tokens[{i}]")
            v = t["value"]
            v = f"{v:g}" if isinstance(v, int | float) and not isinstance(v, bool) else v
            if (
                not isinstance(v, str)
                or not OTHER_VALUE.match(v)
                or "var(" in v
                or "url(" in v
                or v.count("(") != v.count(")")
            ):
                raise TokenError(f"{fam} {name}: bad value {t['value']!r}")
            scalars.append((name, v))

    typ = data.get("type", {})
    if not isinstance(typ, Mapping):
        raise TokenError("type: expected an object")
    families = typ.get("families", {})
    if not isinstance(families, Mapping) or len(families) > 12:
        raise TokenError("type.families: expected at most 12 families")
    fam_css: list[tuple[str, str]] = []
    for key, stack in families.items():
        if not isinstance(key, str) or not NAME.match(key):
            raise TokenError(f"type.families: bad family key {key!r}")
        fam_css.append((key.lower(), _family_stack(stack, f"type.families.{key}")))
    fam_keys = {k for k, _ in fam_css}

    classes: list[str] = []
    style_names: set[str] = set()
    groups = typ.get("groups", [])
    if not isinstance(groups, list) or len(groups) > 12:
        raise TokenError("type.groups: expected at most 12 groups")
    for gi, group in enumerate(groups):
        if not isinstance(group, Mapping):
            raise TokenError(f"type.groups[{gi}]: expected an object")
        styles = group.get("styles", [])
        if not isinstance(styles, list):
            raise TokenError(f"type.groups[{gi}].styles: expected a list")
        for si, s in enumerate(styles):
            where = f"type.groups[{gi}].styles[{si}]"
            if not isinstance(s, Mapping):
                raise TokenError(f"{where}: expected an object")
            sname = _name(s.get("name"), where)
            if sname in style_names:
                raise TokenError(f"{where}: duplicate style name {sname!r}")
            style_names.add(sname)
            fam = s.get("family", group.get("family"))
            if not isinstance(fam, str) or fam.lower() not in fam_keys:
                raise TokenError(f"{where}: unknown font family {fam!r}")
            lines = [
                f"  font-family: var(--font-{fam.lower()});",
                f"  font-size: {_length(s.get('fontSize'), where + '.fontSize')};",
            ]
            if "lineHeight" in s:
                lines.append(f"  line-height: {_line_height(s['lineHeight'], where)};")
            if "fontWeight" in s:
                lines.append(f"  font-weight: {_weight(s['fontWeight'], where)};")
            if "fontStyle" in s:
                if s["fontStyle"] not in ("normal", "italic"):
                    raise TokenError(f"{where}: bad fontStyle {s['fontStyle']!r}")
                lines.append(f"  font-style: {s['fontStyle']};")
            if "letterSpacing" in s:
                lines.append(f"  letter-spacing: {_length(s['letterSpacing'], where)};")
            if "opticalSize" in s:
                o = s["opticalSize"]
                if isinstance(o, bool) or not isinstance(o, int | float) or not 0 < o < 1000:
                    raise TokenError(f"{where}: bad opticalSize {o!r}")
                lines.append(f"  font-variation-settings: 'opsz' {o:g};")
            classes.append("." + sname.replace(".", "\\.") + " {\n" + "\n".join(lines) + "\n}")
    if len(style_names) > 80:
        raise TokenError("type: more than 80 styles")

    faces: list[str] = []
    fonts = typ.get("fonts", [])
    if not isinstance(fonts, list):
        raise TokenError("type.fonts: expected a list")
    for fi, f in enumerate(fonts):
        where = f"type.fonts[{fi}]"
        if not isinstance(f, Mapping):
            raise TokenError(f"{where}: expected an object")
        family, file = f.get("family"), f.get("file")
        if not isinstance(family, str) or not FONT_FAMILY_NAME.match(family):
            raise TokenError(f"{where}: bad family {family!r}")
        if not isinstance(file, str) or not FONT_FILE.match(file) or ".." in file:
            raise TokenError(f"{where}: bad file {file!r}")
        path = file if "/" in file else f"fonts/{file}"
        style = f.get("style", "normal")
        if style not in ("normal", "italic", "oblique"):
            raise TokenError(f"{where}: bad style {style!r}")
        weight = _weight(f.get("weight", 400), where)
        faces.append(
            "@font-face {\n"
            f'  font-family: "{family}";\n'
            f'  src: url("{path}");\n'
            f"  font-weight: {weight};\n"
            f"  font-style: {style};\n"
            "  font-display: swap;\n"
            "}"
        )

    first = themes[0]
    blocks: list[str] = []
    head = [f"{_prop(n)}: {color_css(n, v[first])};" for n, v in colors.items()]
    head += [f"{_prop(n)}: {v[first]};" for n, v in shadows.items()]
    blocks.append(f':root, [data-theme="{first}"] {{\n' + "".join(f"  {x}\n" for x in head) + "}")
    for theme in themes[1:]:
        body = []
        for n, v in colors.items():
            raw = v.get(theme)
            if raw is None and isinstance(v[first], str) and ALIAS.match(v[first]):
                raw = v[first]  # aliases are re-declared so they resolve inside this theme
            if raw is not None:
                body.append(f"{_prop(n)}: {color_css(n, raw)};")
        body += [f"{_prop(n)}: {v[theme]};" for n, v in shadows.items() if theme in v]
        blocks.append(f'[data-theme="{theme}"] {{\n' + "".join(f"  {x}\n" for x in body) + "}")
    root = [f"{_prop(n)}: {v};" for n, v in scalars] + [f"--font-{k}: {v};" for k, v in fam_css]
    blocks.append(":root {\n" + "".join(f"  {x}\n" for x in root) + "}")
    blocks += classes + faces
    header = (
        f"/* {sys_name} — generated from tokens.json by scripts/ds_tokens.py. "
        "Do not edit: run make site-tokens. */\n"
    )
    return header + "\n\n".join(blocks) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    ap.add_argument("tokens_json", type=Path)
    ap.add_argument("tokens_css", type=Path)
    ap.add_argument("--check", action="store_true", help="fail if tokens_css is out of date")
    args = ap.parse_args(argv)
    try:
        css = compile_tokens(json.loads(args.tokens_json.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError, TokenError) as e:
        print(f"ds_tokens: {e}", file=sys.stderr)
        return 1
    if args.check:
        try:
            current = args.tokens_css.read_text(encoding="utf-8")
        except OSError:
            current = None
        if current != css:
            print(
                f"ds_tokens: {args.tokens_css} is out of date. Run: make site-tokens",
                file=sys.stderr,
            )
            return 1
        return 0
    args.tokens_css.write_text(css, encoding="utf-8")
    print(f"wrote {args.tokens_css}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
