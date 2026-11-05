"""Whole-repo checks: structure, integrity (a tick needs proof) and publishing (nothing private)."""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

import pytest
from conftest import (
    TODAY,
    add_proof,
    dotted,
    has,
    lan_host,
    mac,
    milestone_file,
    private_ip,
    replace_in,
    tailnet_host,
    tick_exits,
    tick_rep,
    ula,
    write,
)

from dukecodes_roadmap.checks import check_target, find_leaks, leak_findings, load

PROOF = "2026-10-20,M0,M0-R1,lab,Rated every skill,skills-matrix.md,open the file"


def problems(root: Path) -> list[str]:
    _, ps = load(root, TODAY)
    return [str(p) for p in ps]


def test_repo_copy_is_clean(repo: Path) -> None:
    rm, ps = load(repo, TODAY)
    assert ps == []
    assert len(rm.milestones) == 10 and len(rm.phases) == 5
    assert rm.stats["links"] > 20 and rm.stats["scanned"] > 50
    assert rm.milestone("M3") is not None and rm.milestone("M42") is None


# ---------- integrity: progress is measured, not claimed ----------


def test_tick_without_proof_fails(repo: Path) -> None:
    tick_rep(repo, "M0-R1")
    assert has(problems(repo), "M0-R1 is ticked but has no ledger row")


def test_tick_with_proof_passes(repo: Path) -> None:
    tick_rep(repo, "M0-R1")
    add_proof(repo, PROOF)
    assert problems(repo) == []


def test_proof_for_a_different_rep_does_not_count(repo: Path) -> None:
    tick_rep(repo, "M0-R1")
    add_proof(repo, PROOF.replace("M0-R1", "M0-R2"))
    assert has(problems(repo), "M0-R1 is ticked but has no ledger row")


def test_exit_criteria_need_a_ledger_row(repo: Path) -> None:
    tick_exits(repo, "M0")
    assert has(problems(repo), "M0 exit criteria ticked with no ledger row")
    add_proof(repo, PROOF.replace(",M0-R1,", ",,"))
    assert problems(repo) == []


# ---------- ledger ----------


def test_future_dates_are_refused(repo: Path) -> None:
    slack = (TODAY + timedelta(days=1)).isoformat()  # one day of slack for time zones
    future = (TODAY + timedelta(days=2)).isoformat()
    add_proof(repo, PROOF.replace("2026-10-20", slack))
    assert problems(repo) == []
    add_proof(repo, PROOF.replace("2026-10-20", future).replace("Rated", "Re-rated"))
    assert has(problems(repo), f"date {future} is in the future")


def test_ledger_cross_references(repo: Path) -> None:
    add_proof(repo, PROOF.replace("M0-R1", "M0-R99"), PROOF, PROOF.replace("Rated every", "rated EVERY"))
    ps = problems(repo)
    assert has(ps, "M0-R99 is not a rep of M0")
    assert has(ps, "ledger.csv:4: duplicate proof")


@pytest.mark.parametrize(
    ("evidence", "message"),
    [
        ("http://example.com/scan", "only https links and repo paths are allowed"),
        ("javascript:alert(1)", "only https links and repo paths are allowed"),
        ("file:///etc/passwd", "only https links and repo paths are allowed"),
        ("https://", "broken URL"),
        ("/etc/passwd", "must be a relative path inside the repo"),
        ("evidence\\scan.txt", "must be a relative path inside the repo"),
        ("../outside.txt", "points outside the repo"),
        ("evidence/missing.txt", "does not exist"),
        (".git/config", "points into .git"),
    ],
)
def test_bad_evidence_targets(repo: Path, evidence: str, message: str) -> None:
    write(repo / ".git" / "config", "[core]\n")
    write(repo.parent / "outside.txt", "not in the repo\n")
    add_proof(repo, PROOF.replace("skills-matrix.md", evidence).replace(",M0-R1,", ",,"))
    assert has(problems(repo), message)


@pytest.mark.parametrize(
    "evidence", ["https://example.com/badge", "evidence/README.md#rules", "#ledger", "docs"]
)
def test_good_evidence_targets(repo: Path, evidence: str) -> None:
    assert check_target(repo, repo, evidence, "ledger.csv", 2) is None


def test_symlinks_are_refused_anywhere_on_the_path(repo: Path) -> None:
    os.symlink(repo / "README.md", repo / "evidence" / "link.md")
    os.symlink(repo / "docs", repo / "evidence" / "docs-link")
    for target in ("evidence/link.md", "evidence/docs-link/STYLE.md"):
        bad = check_target(repo, repo, target, "ledger.csv", 2)
        assert bad is not None and "goes through a symlink" in bad.message


# ---------- structure ----------


def test_missing_milestone_breaks_every_reference(repo: Path) -> None:
    milestone_file(repo, "M5").unlink()
    add_proof(repo, PROOF.replace(",M0,M0-R1,", ",M5,,"))
    ps = problems(repo)
    assert has(ps, "ledger.csv:2: no milestone M5")
    assert has(ps, "milestones must be M0 to M8 with no gaps")
    assert has(ps, "roadmap.md:.*no milestone file for M5")
    assert has(ps, "skills-matrix.md:.*no milestone M5")
    assert has(ps, "certs.md:.*no milestone M5")
    assert has(ps, "labs.md:.*no milestone M5")


def test_phase_table_rules(repo: Path) -> None:
    replace_in(repo / "roadmap.md", "| 1 Foundation | M0, M1, M2 |", "| 1 Foundation | M0, M1, M1 |")
    replace_in(repo / "roadmap.md", "| 2 Automate |", "| 3 Automate |")
    ps = problems(repo)
    assert has(ps, "M1 is already in phase 1")
    assert has(ps, "M2 is not in any phase")
    assert has(ps, "phase 3 out of order: expected 2")


def test_chapters_must_exist_in_mission_control(repo: Path) -> None:
    replace_in(
        milestone_file(repo, "M0"), "Mission Control → Start here", "Mission Control → Nowhere · Start here"
    )
    assert has(problems(repo), "unknown Mission Control chapter 'Nowhere'")


def test_concepts_are_unique_across_milestones(repo: Path) -> None:
    replace_in(milestone_file(repo, "M1"), "## Explain it\n", "## Explain it\n- `threat-modeling` · Again?\n")
    assert has(problems(repo), "concept 'threat-modeling' is already in M0")


def test_explainers_must_belong_to_a_milestone(repo: Path) -> None:
    write(repo / "concepts" / "not-a-concept.md", "# Not a concept\n")
    write(
        repo / "concepts" / "threat-modeling.md", "# Threat modeling\n\n**Reviewed:** 2026-10-20 · a peer\n"
    )
    ps = problems(repo)
    assert ps == [
        "concepts/not-a-concept.md:1: 'not-a-concept' is not a concept in any milestone's Explain it list"
    ]


@pytest.mark.parametrize(
    "name", ["showcase.toml", "certs.md", "ledger.csv", "roadmap.md", "glossary.md", "labs.md"]
)
def test_required_files(repo: Path, name: str) -> None:
    (repo / name).unlink()
    assert has(problems(repo), f"{name}:1: required file is missing")


# ---------- certs ----------


def test_cert_rules(repo: Path) -> None:
    future = (TODAY + timedelta(days=6)).isoformat()
    replace_in(
        repo / "certs.md",
        "| planned | FACT | 2026-10-24 | Tests Terraform",
        f"| passed | FACT | {future} | Tests Terraform",
    )
    replace_in(
        repo / "certs.md",
        "(https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/)",
        "(http://example.com/cka)",
    )
    ps = problems(repo)
    assert has(ps, f"checked date {future} is in the future")
    assert has(ps, "'Terraform Associate' is passed: add a ledger row")
    assert has(ps, "certs.md:.*cert links must be https")


def test_passed_cert_with_badge_row(repo: Path) -> None:
    replace_in(
        repo / "certs.md",
        "| planned | FACT | 2026-10-24 | Tests Terraform",
        "| passed | FACT | 2026-10-24 | Tests Terraform",
    )
    add_proof(
        repo, "2026-10-21,M3,,cert,Passed Terraform Associate (004),https://example.com/badge,open the badge"
    )
    assert problems(repo) == []


# ---------- labs and projects ----------

WAF_ROW = "crowdsec-waf) | free | 2026-11-04 |"
WAF_URL = "(https://academy.crowdsec.net/course/crowdsec-waf)"
PROWLER = "| Prowler | — | — | — |"
SPLUNK = "| SIEM detection in Splunk | M5-R8 |"
PHISH = "| Phishing analysis | M5-R7 |"
STATE = "| homelab-state | M1 |"
CLOUD = "from the M9 reps | planned |"
ROADMAP = "[dukecodes-roadmap](https://github.com"

LAB_CASES = [
    (SPLUNK, SPLUNK.replace("M5-R8", "M5-R80"), "M5-R80 is not a rep of M5"),
    (PHISH, PHISH.replace("M5-R7", "M5 R7"), "reps 'M5 R7' must look like"),
    (PHISH, PHISH.replace("M5-R7", "M5-R7, M5-R7"), "lists a rep twice"),
    (PHISH, "| Threat model with STRIDE | M5-R7 |", "duplicate lab 'Threat model"),
    ("| M5-R7 | email headers, SPF, DKIM, DMARC |", "| M5-R7 | |", "'Phishing analysis' needs its tools"),
    (PROWLER, "| Prowler | Prowler docs | — | — |", "resource 'Prowler docs' must be a"),
    (PROWLER, "| Prowler | — | 49 dollars | — |", "cost '49 dollars' must look like"),
    (PROWLER, "| Prowler | — | — | 2026-11-01 |", "a Checked date needs a linked resource"),
    ("crowdsec-fundamentals) | free |", "crowdsec-fundamentals) | — |", "a linked resource needs its cost"),
    (WAF_ROW, "crowdsec-waf) | free | — |", "a linked resource needs the date you checked it"),
    (WAF_ROW, "crowdsec-waf) | free | 4 Nov |", "checked date '4 Nov' must be YYYY-MM-DD"),
    (WAF_URL, WAF_URL.replace("https:", "http:"), "lab links must be https"),
]
PROJECT_CASES = [
    (STATE, STATE.replace("M1", "M1, M1"), "lists a milestone twice"),
    (STATE, STATE.replace("M1", "M10"), "milestones 'M10' must look like 'M5, M6' or be all"),
    (ROADMAP, ROADMAP.replace("https:", "http:"), "project links must be https"),
    (CLOUD, "from the M9 reps | done |", "status 'done' must be one of: planned, building, shipped"),
    ("| M9 | The AWS baseline as Terraform |", "| M9 | |", "'homelab-cloud' needs what it is"),
    ("## Projects", "## Things", "labs.md:1: missing '## Projects' section"),
]


@pytest.mark.parametrize(("old", "new", "message"), LAB_CASES + PROJECT_CASES)
def test_lab_and_project_rules(repo: Path, old: str, new: str, message: str) -> None:
    replace_in(repo / "labs.md", old, new)
    assert has(problems(repo), message)


def test_lab_costs_and_dates_that_pass(repo: Path) -> None:
    replace_in(repo / "labs.md", PROWLER, "| Prowler | — | $16/month | — |")
    replace_in(repo / "labs.md", "| Phishing analysis | M5-R7 |", "| Phishing analysis | M5-R7, M7-R7 |")
    assert problems(repo) == []


def test_lab_checked_date_cannot_be_in_the_future(repo: Path) -> None:
    slack = (TODAY + timedelta(days=1)).isoformat()  # one day of slack for time zones
    future = (TODAY + timedelta(days=2)).isoformat()
    replace_in(repo / "labs.md", WAF_ROW, f"crowdsec-waf) | free | {slack} |")
    assert problems(repo) == []
    replace_in(repo / "labs.md", f"crowdsec-waf) | free | {slack} |", f"crowdsec-waf) | free | {future} |")
    assert has(problems(repo), f"labs.md:.*checked date {future} is in the future")


def test_shipped_project_needs_a_ledger_row(repo: Path) -> None:
    replace_in(repo / "labs.md", CLOUD, "from the M9 reps | shipped |")
    assert has(problems(repo), "'homelab-cloud' is shipped: add a ledger row")
    add_proof(repo, "2026-10-21,M9,,lab,Built homelab-cloud,https://example.com/homelab-cloud,open the repo")
    assert has(problems(repo), "'homelab-cloud' is shipped")  # a lab row is not a project row
    add_proof(
        repo, "2026-10-21,M9,,project,Shipped homelab-cloud,https://example.com/homelab-cloud,open the repo"
    )
    assert problems(repo) == []


# ---------- links ----------


def test_broken_links_are_found_outside_code(repo: Path) -> None:
    style = repo / "docs" / "STYLE.md"
    lines = style.read_text(encoding="utf-8").count("\n")
    with style.open("a", encoding="utf-8") as f:
        f.write("\nSee [this](missing.md).\n```\n[ignored](nope.md)\n```\nAlso `[ignored](nope.md)`.\n")
    ps = problems(repo)
    assert has(ps, f"docs/STYLE.md:{lines + 2}: 'missing.md' does not exist")
    assert not has(ps, "nope.md")


def test_scoreboard_links_are_not_rechecked(repo: Path) -> None:
    rm, _ = load(repo, TODAY)
    replace_in(repo / "README.md", "<!-- scoreboard:end -->", "[gone](gone.md)\n<!-- scoreboard:end -->")
    rm2, ps = load(repo, TODAY)
    assert ps == [] and rm2.stats["links"] == rm.stats["links"]


# ---------- publishing: nothing private ----------


@pytest.mark.parametrize(
    ("text", "what"),
    [
        (f"ssh root@{private_ip()}", f"private address {private_ip()}"),
        (f"node at {private_ip(9)}.", f"private address {private_ip(9)}"),  # ends a sentence
        (f"https://{private_ip(9)}:8006/", f"private address {private_ip(9)}"),
        (f"net {dotted(172, 20, 4, 0)}/24", f"private address {dotted(172, 20, 4, 0)}"),
        (dotted(192, 168, 1, 1), f"private address {dotted(192, 168, 1, 1)}"),
        (f"tailscale ip {dotted(100, 101, 2, 3)}", "private address"),  # CGNAT
        (dotted(169, 254, 1, 1), "private address"),
        (ula(), f"private address {ula()}"),
        (ula().replace("::1", "::") + "/48", "private address"),  # a prefix, not only a host
        (f"gateway {ula().replace('::1', '::9')}: up", f"private address {ula().replace('::1', '::9')}"),
        (f"ether {mac()}", f"MAC address {mac()}"),
        (mac().replace(":", "-"), "MAC address"),
        (f"ssh {tailnet_host()}", f"internal hostname {tailnet_host()}"),
        (f"https://{lan_host()}:8006", f"internal hostname {lan_host()}"),
    ],
)
def test_leaks_are_found(text: str, what: str) -> None:
    found = leak_findings(f"line one\n{text}\n")
    assert found and found[0][0] == 2 and found[0][1].startswith(what), found


@pytest.mark.parametrize(
    "text",
    [
        dotted(192, 0, 2, 10),  # RFC 5737 documentation range
        dotted(8, 8, 8, 8),
        dotted(10, 0, 0, 256),  # not an address
        dotted(1, 10, 0, 0, 5),  # a version string, not an address
        "00:00:5e:00:53:01",  # RFC 7042 documentation MAC
        "2001:db8::1",
        "host-1.tailnet.example",
        f"private ranges: {dotted(10, 0, 0, 0)}/8, {dotted(172, 16, 0, 0)}/12, {dotted(192, 168, 0, 0)}/16",
        "and fc00::/7",
        "f" + "d12:3456: is a hex dump, not an address",
    ],
)
def test_public_and_documentation_values_pass(text: str) -> None:
    assert find_leaks(text) == []


def test_canonical_range_exemption_is_exact() -> None:
    assert find_leaks(f"{dotted(10, 0, 0, 0)}/16") != []
    assert find_leaks(f"{dotted(10, 0, 0, 0)}/80") != []
    assert find_leaks(f"{dotted(192, 168, 0, 0)}/24") != []


def test_leak_scan_covers_published_files_only(repo: Path) -> None:
    leak = f"scan: {private_ip()}\n"
    write(repo / "evidence" / "m1-scan.txt", leak)
    write(repo / "evidence" / "m1-raw.png", leak)  # not a text type
    write(repo / ".venv" / "notes.txt", leak)
    write(repo / "node_modules" / "x.js", leak)
    os.symlink(repo / "evidence" / "m1-scan.txt", repo / "evidence" / "m1-link.txt")
    with (repo / "uv.lock").open("a", encoding="utf-8") as f:
        f.write(f"# {leak}")
    ps = problems(repo)
    assert len(ps) == 1 and ps[0].startswith("evidence/m1-scan.txt:1: private address")
    assert "roadmap redact evidence/m1-scan.txt" in ps[0]


def test_leak_scan_reads_any_encoding(repo: Path) -> None:
    leak = f"scan: {private_ip()}\n"
    (repo / "evidence" / "latin1.txt").write_bytes(b"caf\xe9 " + leak.encode())
    (repo / "evidence" / "powershell.txt").write_bytes(leak.encode("utf-16"))  # BOM + UTF-16LE
    ps = problems(repo)
    assert [p.split(":")[0] for p in ps] == ["evidence/latin1.txt", "evidence/powershell.txt"]
