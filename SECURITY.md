# Security

Report a vulnerability privately with GitHub's **Report a vulnerability** button (Security tab), not in a public issue.

If a secret reaches git history: revoke or rotate it first, then remove it. Removing it alone isn't enough, because every clone keeps the old commits.

## What this repo defends

| Risk | Control |
|------|---------|
| A secret committed by mistake | gitleaks on every commit (pre-commit) and over the full history in CI |
| Private network details published | `roadmap check` fails on private, carrier-grade NAT and ULA addresses, MAC addresses and internal hostnames. `roadmap redact` fixes them |
| Fake progress | A ticked rep needs a ledger row; evidence must exist inside the repo; a passed cert needs a ledger row |
| A hijacked GitHub Action or package | Actions pinned by full commit SHA and checked by zizmor; uv and Dependabot only adopt releases at least 7 days old |
| Script injection on the showcase page | No third-party scripts; a hash-pinned Content-Security-Policy; Trusted Types; every element built with `textContent`; only `https` and repo links |
| Spreadsheet formula injection from `ledger.csv` | Cells starting with `=`, `+`, `-` or `@` are refused |
| An AI assistant overstepping | `.claude/settings.json` blocks reading secrets, force-pushes and changes to real infrastructure |

Decisions and trade-offs: [ADR 3](docs/adr/0003-showcase-page.md) and [ADR 4](docs/adr/0004-public-content.md).
