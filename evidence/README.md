# Evidence

Proof files that ledger rows point at: scan output, reports, screenshots, lab reports.

## Rules

- **Name files** `m<n>-<what>.<ext>`, such as `m1-nmap-from-lab.txt`. Point-in-time notes start with the date: `2026-11-02-weekly-review.md`.
- **Redact before you commit.** No real IP addresses, MAC addresses, hostnames, serial numbers or tailnet names. Run `uv run roadmap redact <file>` to see what would change, then add `--apply`. It swaps addresses for documentation ranges such as `192.0.2.0/24`.
- **No secrets, ever.** Not even revoked ones. gitleaks blocks the commit, but don't rely on it.
- **Keep it small.** Trim scan output to the lines that prove the claim. Files over 500 KB are refused.
- **One ledger row per proof.** Add it to `ledger.csv` in the same commit: `date,milestone,rep,kind,claim,evidence,verify`.

`roadmap check` scans this folder for private addresses and fails CI if it finds one.
