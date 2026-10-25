"""ds_tokens compiles the design system's tokens.json into tokens.css and refuses bad values."""

import copy
from pathlib import Path
from typing import Any

import pytest
from ds_tokens import TokenError, compile_tokens, main, theme_colours

MINI: dict[str, Any] = {
    "name": "Mini System",
    "version": 1,
    "color": {
        "themes": [{"id": "light", "name": "Light"}, {"id": "dark", "name": "Dark"}],
        "tokens": [
            {"name": "ink", "value": {"light": "#1D1F22", "dark": "#ecebe6"}},
            {"name": "accent", "value": "{ink}"},
            {
                "name": "glass",
                "value": {"light": "rgba(0,0,0,0.045)", "dark": "rgba(255,255,255,0.035)"},
            },
        ],
    },
    "type": {
        "fonts": [],
        "families": {"body": '"IBM Plex Sans", system-ui, sans-serif'},
        "groups": [
            {
                "name": "Text",
                "family": "body",
                "styles": [
                    {"name": "small", "fontSize": "13.5px", "lineHeight": 1.5, "fontWeight": 400},
                    {
                        "name": "eyebrow",
                        "fontSize": 11,
                        "lineHeight": 1.4,
                        "fontWeight": 500,
                        "letterSpacing": "0.12em",
                    },
                ],
            }
        ],
    },
    "spacing": {"tokens": [{"name": "space-1", "value": "4px"}, {"name": "space-1.5", "value": 6}]},
    "radius": {"tokens": [{"name": "radius-xl", "value": "14px"}]},
    "shadow": {
        "tokens": [
            {
                "name": "shadow-panel",
                "value": {
                    "light": "0 1px 2px rgba(0,0,0,0.06)",
                    "dark": "0 10px 30px -18px rgba(0,0,0,0.8)",
                },
            }
        ]
    },
}

HEADER = (
    "/* Mini System — generated from tokens.json by scripts/ds_tokens.py. "
    "Do not edit: run make site-tokens. */\n"
)
EXPECTED = (
    HEADER
    + """\
:root, [data-theme="light"] {
  --ink: #1d1f22;
  --accent: var(--ink);
  --glass: rgba(0,0,0,0.045);
  --shadow-panel: 0 1px 2px rgba(0,0,0,0.06);
}

[data-theme="dark"] {
  --ink: #ecebe6;
  --accent: var(--ink);
  --glass: rgba(255,255,255,0.035);
  --shadow-panel: 0 10px 30px -18px rgba(0,0,0,0.8);
}

:root {
  --space-1: 4px;
  --space-1\\.5: 6px;
  --radius-xl: 14px;
  --font-body: "IBM Plex Sans", system-ui, sans-serif;
}

.small {
  font-family: var(--font-body);
  font-size: 13.5px;
  line-height: 1.5;
  font-weight: 400;
}

.eyebrow {
  font-family: var(--font-body);
  font-size: 11px;
  line-height: 1.4;
  font-weight: 500;
  letter-spacing: 0.12em;
}
"""
)


def mini() -> dict[str, Any]:
    return copy.deepcopy(MINI)


def set_color(data: dict[str, Any], value: Any) -> dict[str, Any]:
    data["color"]["tokens"][0]["value"] = value
    return data


def test_compiles_the_documented_format() -> None:
    assert compile_tokens(mini()) == EXPECTED


@pytest.mark.parametrize(
    "bad",
    [
        "red",  # named colours are not allowed
        "#12345",  # wrong hex length
        "var(--x)",
        "url(https://example.com/x.png)",
        "color-mix(in srgb, red 10%, blue)",
        "#fff; } body { background: url(https://evil.example) ",  # CSS injection
        "rgb(1,2,3); color: red",
    ],
)
def test_rejects_unsafe_or_invalid_colours(bad: str) -> None:
    with pytest.raises(TokenError, match="color"):
        compile_tokens(set_color(mini(), {"light": bad, "dark": "#000000"}))


def test_alias_to_a_missing_token_fails() -> None:
    data = mini()
    data["color"]["tokens"][1]["value"] = "{nope}"
    with pytest.raises(TokenError, match="alias"):
        compile_tokens(data)


def test_alias_cycle_fails() -> None:
    data = mini()
    data["color"]["tokens"][0]["value"] = "{accent}"
    with pytest.raises(TokenError, match="alias"):
        compile_tokens(data)


@pytest.mark.parametrize("name", ["--ink", "has space", "a" * 65, "x}y", ""])
def test_rejects_bad_token_names(name: str) -> None:
    data = mini()
    data["spacing"]["tokens"][0]["name"] = name
    with pytest.raises(TokenError, match="name"):
        compile_tokens(data)


def test_duplicate_names_across_families_fail() -> None:
    data = mini()
    data["radius"]["tokens"][0]["name"] = "space-1"
    with pytest.raises(TokenError, match="duplicate"):
        compile_tokens(data)


@pytest.mark.parametrize("value", ["4 px", "calc(1px + 2px)", "4px;", "1e3px"])
def test_rejects_bad_lengths(value: str) -> None:
    data = mini()
    data["spacing"]["tokens"][0]["value"] = value
    with pytest.raises(TokenError, match="length"):
        compile_tokens(data)


@pytest.mark.parametrize("family", ['"Plex"; color: red', "url(x)", '"unbalanced'])
def test_rejects_unsafe_font_families(family: str) -> None:
    data = mini()
    data["type"]["families"]["body"] = family
    with pytest.raises(TokenError, match="famil"):
        compile_tokens(data)


@pytest.mark.parametrize("shadow", ["0 0 4px var(--amber)", "0 0 4px url(x)", "0 0 1px red; x: y"])
def test_rejects_unsafe_shadows(shadow: str) -> None:
    data = mini()
    data["shadow"]["tokens"][0]["value"] = shadow
    with pytest.raises(TokenError, match="shadow"):
        compile_tokens(data)


def test_header_name_cannot_close_the_comment() -> None:
    data = mini()
    data["name"] = "x */ body{display:none} /*"
    with pytest.raises(TokenError, match="name"):
        compile_tokens(data)


def test_unknown_style_family_fails() -> None:
    data = mini()
    data["type"]["groups"][0]["styles"][0]["family"] = "mono"
    with pytest.raises(TokenError, match="family"):
        compile_tokens(data)


def test_main_writes_then_check_passes_and_detects_drift(tmp_path: Path) -> None:
    import json

    src, out = tmp_path / "tokens.json", tmp_path / "tokens.css"
    src.write_text(json.dumps(MINI), encoding="utf-8")
    assert main([str(src), str(out)]) == 0
    assert out.read_text(encoding="utf-8") == EXPECTED
    assert main([str(src), str(out), "--check"]) == 0
    out.write_text(EXPECTED + "/* hand edit */\n", encoding="utf-8")
    assert main([str(src), str(out), "--check"]) == 1


def test_main_reports_bad_tokens_without_a_traceback(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    import json

    src, out = tmp_path / "tokens.json", tmp_path / "tokens.css"
    src.write_text(json.dumps(set_color(mini(), "red")), encoding="utf-8")
    assert main([str(src), str(out)]) == 1
    assert "color" in capsys.readouterr().err
    assert not out.exists()


def test_theme_colours_follow_aliases_in_each_theme() -> None:
    colours = theme_colours(MINI)
    assert colours["light"]["accent"] == "#1d1f22"
    assert colours["dark"]["accent"] == "#ecebe6"
    assert colours["dark"]["glass"] == "rgba(255,255,255,0.035)"


def test_theme_colours_refuse_what_compile_refuses() -> None:
    data = copy.deepcopy(MINI)
    data["color"]["tokens"][1]["value"] = "{nope}"
    with pytest.raises(TokenError):
        theme_colours(data)
