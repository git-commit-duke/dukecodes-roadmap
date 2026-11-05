"""The docs, the checker and the page name the same labels, statuses, areas and scores.

certs.md and skills-matrix.md tell readers what a label or a score means, `roadmap check`
accepts only those words, and site/app.js shows them on the page. Three copies drift
unless something compares them. Same idea as the template's tests/test_style.py.
"""

from __future__ import annotations

import re
from pathlib import Path

from dukecodes_roadmap.content import CERT_LABELS, CERT_STATUSES, PRACTICE_AREAS

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "site" / "app.js").read_text(encoding="utf-8")


def js_object_keys(name: str) -> set[str]:
    """Keys of a one-line `const NAME = { key: ... };` in app.js."""
    body = APP.split(f"const {name} = {{", 1)[1].split("};", 1)[0]
    return set(re.findall(r"(\w+):", body))


def legend(doc: str, field: str) -> list[str]:
    """The backticked words in the sentence after **Field** in a doc's legend (certs.md's **Status**)."""
    text = (ROOT / doc).read_text(encoding="utf-8")
    sentence = re.split(r"\.(?:\s|$)", text.split(f"**{field}**", 1)[1], maxsplit=1)[0]
    return re.findall(r"`([A-Za-z]+)`", sentence)


def test_cert_statuses_match_between_docs_checker_and_page() -> None:
    assert tuple(legend("certs.md", "Status")) == CERT_STATUSES
    assert js_object_keys("CERT") <= set(CERT_STATUSES)


def test_cert_labels_match_between_docs_checker_and_page() -> None:
    assert tuple(legend("certs.md", "Label")) == CERT_LABELS
    assert js_object_keys("LABEL") == set(CERT_LABELS)


def test_skill_scale_on_the_page_matches_the_matrix() -> None:
    matrix = (ROOT / "skills-matrix.md").read_text(encoding="utf-8")
    line = next(ln for ln in matrix.splitlines() if ln.startswith("**Score:**"))
    documented = dict(re.findall(r"`([?\d])` ([^·]+?)(?:\s·|\.$)", line))
    body = APP.split("const SCALE = [", 1)[1].split("];", 1)[0]
    shown = dict(re.findall(r"\['([?\d])', '([^']+)'\]", body))
    assert list(documented) == ["?", "0", "1", "2", "3"]
    assert shown == documented


def test_practice_areas_match_between_docs_checker_and_page() -> None:
    assert tuple(legend("labs.md", "Area")) == PRACTICE_AREAS
    assert js_object_keys("AREA") == set(PRACTICE_AREAS)


def test_every_section_the_page_draws_can_be_linked() -> None:
    """A section id missing from LAB_PARTS or CERT_PARTS renders, but no link or search result reaches it."""
    for name, prefix in (("LAB_PARTS", "labs"), ("CERT_PARTS", "certs")):
        listed = re.findall(r"'([a-z-]+)'", APP.split(f"const {name} = [", 1)[1].split("];", 1)[0])
        assert len(listed) == len(set(listed))
        assert set(re.findall(rf"'({prefix}-[a-z]+)'", APP)) == set(listed)
