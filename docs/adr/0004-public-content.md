# 4. What may be published, and whose work counts

Status: accepted
Date: 2026-10-24

## Context
This repo may go public as a portfolio and as a free resource for career changers. It describes a real home network, and an AI assistant helps build it.

## Decision
- **Publish roles, not identifiers.** Nodes are named by role (ops, media, dev, core, sec). No real IP addresses, MAC addresses, hostnames, serial numbers, tailnet names or keys. Examples use the documentation ranges `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` and `2001:db8::/32`.
- **Enforce it.** `roadmap check` scans every text file for private and carrier-grade NAT addresses (Tailscale uses those), private IPv6, MAC addresses and `*.ts.net` or `home.arpa` names. `roadmap redact` rewrites them consistently.
- **The ledger records Duke's own work.** An AI assistant may explain, quiz, review and build tooling such as this checker. It doesn't do reps, write explainers, or add ledger rows on Duke's behalf.
- **Private links stay private.** Mission Control and other Claude artifacts are private; the page names chapters but doesn't link them.

## Pros
- Safe to make public at any point without an audit first.
- The evidence means something: an interviewer can trust that a ledger row is Duke's work.

## Cons
- Raw output needs redacting before commit, a small extra step.
- Private RFC 1918 addresses are low risk on their own; this rule is stricter than it has to be, on purpose.

## Alternatives considered
- Keep the repo private forever: safe, but loses the showcase and the public resource.
