# Security labs and projects

Every security lab on this roadmap in one place, and the projects that ship them. A lab is a set of reps in a milestone, so its status comes from those ticks. You can't mark a lab done here, only by doing its reps. A skill you don't have yet becomes a lab, never a resume line.

`roadmap check` reads both tables: every rep must exist, every link must be https, and a project marked `shipped` needs a ledger row (kind `project`) that names it.

## Labs

**Resource** links an outside course or guide when the lab follows one, with what it costs and the day the link and price were checked. `—` means the milestone's reps are the guide.

| Lab | Reps | Tools | Resource | Cost | Checked |
|-----|------|-------|----------|------|---------|
| Secure repo baseline: signed commits and a secret-scanning hook | M0-R4, M0-R5 | SSH commit signing, pre-commit, gitleaks | — | — | — |
| Threat model with STRIDE | M0-R6 | STRIDE | — | — | — |
| Segment the network and prove it | M1-R2, M1-R3, M1-R4, M1-R5 | OPNsense, nmap, tcpdump | — | — | — |
| Harden hosts and measure the change | M2-R1, M2-R3, M2-R4, M2-R6 | Lynis, Ansible | — | — | — |
| Least-privilege Terraform with a scan gate | M3-R2, M3-R5, M3-R6 | Terraform, tflint, Trivy | — | — | — |
| Access policy as code, with tests | M4-R1, M4-R2, M4-R3 | Tailscale, GitHub Actions | — | — | — |
| Secrets in git as ciphertext only | M4-R4, M4-R5, M4-R6 | SOPS, age | — | — | — |
| Active Directory and Group Policy | M4-R7 | Windows Server, AD DS, Group Policy, PowerShell | — | — | — |
| Device management and Conditional Access | M4-R8 | Entra ID, Intune, Conditional Access, MFA | — | — | — |
| Catch your own scan with an IDS | M5-R2, M5-R3, M5-R6 | Suricata, Grafana | — | — | — |
| Central logs and a detection of your own | M5-R1, M5-R4, M5-R5 | Grafana | — | — | — |
| Phishing analysis | M5-R7 | email headers, SPF, DKIM, DMARC | — | — | — |
| SIEM detection in Splunk | M5-R8 | Splunk Free, SPL | — | — | — |
| Block an SSH brute force with CrowdSec | M5-R9 | CrowdSec Security Engine, nftables firewall bouncer | [CrowdSec Academy: CrowdSec Fundamentals](https://academy.crowdsec.net/course/crowdsec-fundamentals) | free | 2026-11-04 |
| Write a CrowdSec parser and scenario | M5-R10 | CrowdSec, cscli hubtest | [CrowdSec Academy: Writing Parsers and Scenarios](https://academy.crowdsec.net/course/writing-parsers-and-scenarios) | free | 2026-11-04 |
| Security gates in the pipeline | M6-R1, M6-R3 | Semgrep, Trivy, gitleaks, Forgejo Actions | — | — | — |
| SBOMs and signed images | M6-R4, M6-R5 | Syft, cosign | — | — | — |
| Harden the CI pipeline itself | M6-R2, M6-R6 | Forgejo runner, zizmor, SHA pins | — | — | — |
| Dynamic scanning with OWASP ZAP | M6-R8 | OWASP ZAP | — | — | — |
| Block web attacks with the CrowdSec WAF | M6-R9 | CrowdSec WAF, OWASP CRS | [CrowdSec Academy: Securing your applications with the CrowdSec WAF](https://academy.crowdsec.net/course/crowdsec-waf) | free | 2026-11-04 |
| Kubernetes benchmark before and after | M7-R2, M7-R7 | kube-bench | — | — | — |
| Kubernetes RBAC and admission policy | M7-R3, M7-R4 | RBAC, Pod Security Admission, Kyverno | — | — | — |
| Default-deny networking in Kubernetes | M7-R5 | NetworkPolicy | — | — | — |
| Runtime detection with Falco | M7-R6 | Falco, Grafana | — | — | — |
| Restore drills and a backup credential review | M8-R2, M8-R3, M8-R4 | Proxmox Backup Server | — | — | — |
| Simulate an attack, then write the postmortem | M8-R5, M8-R6 | Atomic Red Team, MITRE ATT&CK | — | — | — |
| AWS account baseline | M9-R1, M9-R2, M9-R3 | IAM Identity Center, CloudTrail, Terraform | — | — | — |
| Cloud posture scan with Prowler | M9-R4 | Prowler | — | — | — |
| Deploy with no stored cloud keys | M9-R5 | GitHub OIDC, AWS IAM | — | — | — |

## Projects

**Status:** `planned` not started · `building` work in progress · `shipped` done, with a ledger row as proof. A private repo has no link.

| Project | Milestones | What it is | Security built in | Status |
|---------|------------|------------|-------------------|--------|
| [dukecodes-roadmap](https://github.com/git-commit-duke/dukecodes-roadmap) | all | This roadmap as code: milestones, evidence ledger and this page, all generated from the repo | `roadmap check` fails a tick without proof and any private address or hostname; gitleaks on every commit and across the whole history in CI; actions pinned by commit SHA; a strict Content Security Policy with Trusted Types | building |
| [dukecodes-project-template](https://github.com/git-commit-duke/dukecodes-project-template) | M0 | The starting point for every new repo: checks, CI and a project page | gitleaks, Semgrep (fails when no rules load), Trivy, dependency review, actionlint and zizmor; actions and hooks pinned by SHA; new versions wait 7 days | building |
| dukecodes-homelab | M1, M2 | The homelab's record: design, decisions and a runbook of gated steps (private repo) | A secret scan before every commit and the same gitleaks check in CI; actions pinned by SHA with a 7-day update wait; no secrets stored; every change to a working setting is a gated step with its undo | building |
| Homelab audits | M1 | Outside-in audits of the homelab, run from a separate laptop (private repo) | Raw output never enters git; the AI helper reads only masked copies and runs two scans, each approved by hand; secret and identifier scans in CI | building |
| homelab-iac | M0, M1, M2, M3, M4 | Threat model, decision records, network diagram, Ansible, Terraform and access policy | Signed commits, a pre-commit secret scan, a Trivy config scan in CI and tests for the access policy, from the M0 to M4 reps | planned |
| homelab-state | M1 | Sanitized config snapshots of the router, switch and firewall | Exports are sanitized before they are committed, from M1-R6 | planned |
| homelab-lab | M5, M6, M7, M8 | Detections, the pipeline app, Kubernetes policies and incident write-ups | SAST, SCA, secret and DAST gates, signed images with SBOMs, a WAF and admission policies, from the M5 to M8 reps | planned |
| homelab-cloud | M9 | The AWS baseline as Terraform | No stored cloud keys (GitHub OIDC), CloudTrail in every region and S3 Block Public Access, from the M9 reps | planned |
