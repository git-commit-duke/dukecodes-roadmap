# 2. Keep the roadmap as code, checked in CI

Status: accepted
Date: 2026-10-24

## Context
The roadmap tracks progress toward a job, and it will be shown to interviewers. Progress claims have to be believable to a stranger, and the plan has to survive months of edits by someone with limited time and attention.

## Decision
Every source is a plain file in git: milestones and tables in Markdown, the evidence ledger in CSV, page settings in TOML. A small Python tool (`roadmap`, standard library only) parses them and fails CI when:
- a file doesn't match its format
- a ticked rep has no ledger row, or a ledger row points at evidence that isn't in the repo
- a cert is marked passed with no ledger row naming it
- anything publishable contains a private address, MAC address or internal hostname

The README scoreboard and the showcase page are generated from the same files.

## Pros
- Git history is the audit log: every tick has a date, an author and a reviewable diff.
- Editable anywhere, including GitHub's web editor. No database, no server.
- No runtime dependencies, so nothing to patch and no supply chain beyond Python itself.

## Cons
- Strict formats: a typo fails CI. The error message names the file, line and fix.
- Generated files must be rebuilt and committed (`make build`). CI fails when they're stale.

## Alternatives considered
- A spreadsheet or Notion board: easy, but no review trail, and claims can't be checked against evidence.
- A static-site generator: more features, more dependencies, and still no integrity checks.
