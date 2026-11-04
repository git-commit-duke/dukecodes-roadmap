# How this roadmap works

The goal: be job-ready for a DevSecOps or security-engineering role, proven by work someone else can check. Hours spent don't count. Labs done, projects shipped with security built in, tools used correctly, concepts explained from first principles and certs earned do.

No tech background is assumed. Every milestone has an **In plain words** line, and the [glossary](glossary.md) defines every term.

## The loop

Every milestone runs the same five steps.

1. **Build.** Do the matching chapter of Mission Control, my homelab build runbook. The chapter names sit on each milestone's **Build** line, so you can map them to your own lab.
2. **Reps.** Small exercises, each with a "done when" test. A rep is done when its test passes, not when it feels done.
3. **Break it.** Attack your own work. A control you have never seen fail is a guess.
4. **Explain it.** Write each concept from first principles in under 500 words, with [the concept template](templates/concept.md). If you can't explain it simply, you don't know it yet.
5. **Prove it.** Log every proof in the [evidence ledger](ledger.csv): what you claim, where the evidence is, and how someone can check it again.

## Definition of done

A milestone is done when every exit criterion in its file is ticked, and:

- the code lives in a git repo with signed commits and a clean secret scan
- there is one before-and-after measurement (a scan score, a failing then passing test, a blocked attack)
- a README or decision record explains *why* in under 500 words
- it has been rebuilt once from the repo alone
- every claim has a row in the ledger

`roadmap check` enforces the last rule: a ticked rep with no ledger row fails CI. Progress here is measured, not claimed.

## Phases and cert gates

Five phases, each closed by a cert that confirms skills you already have. Book a cert only after its milestones are done; then the exam checks work you've done, instead of being the work. Prices, formats and sources are in [certs.md](certs.md).

| Phase | Milestones | Cert gate |
|-------|------------|-----------|
| 1 Foundation | M0, M1, M2 | LFCS (optional) |
| 2 Automate | M3, M4 | Terraform Associate |
| 3 Detect and ship | M5, M6 | CompTIA Security+ |
| 4 Platform | M7, M8 | CKA, then CKS |
| 5 Cloud | M9 | AWS Solutions Architect – Associate |

Why this order (INFERENCE): Security+ clears HR filters for junior security roles. CKA and CKS are hands-on and map straight onto M7. Cloud comes last because the homelab teaches the same patterns for free first.

## Where the work lives

Repo names follow the project rule `homelab-<role>`.

| Repo | Holds | Milestones |
|------|-------|------------|
| `dukecodes-roadmap` (this one) | Plan, ledger, explainers, skills, showcase page | all |
| `homelab-iac` | Threat model, decision records, network diagram, Ansible, Terraform, access policy | M0 to M4 |
| `homelab-state` | Sanitized config snapshots | M1 |
| `homelab-lab` | Detections, the pipeline app, Kubernetes policies, incident write-ups | M5 to M8 |
| `homelab-cloud` | AWS baseline | M9 |

## Rules

- **Your own work only.** A ledger row records something you did. An AI helper can explain, quiz and review; it doesn't do your reps.
- **Label every claim.** FACT (checked, with a date or link), INFERENCE (reasoned from facts), ASSUMPTION (a guess to confirm). [Style guide](docs/STYLE.md).
- **Nothing private goes public.** No real IP addresses, hostnames, serial numbers, tailnet names or keys. Use the documentation ranges `192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24`. `roadmap check` scans for private addresses, and `roadmap redact` swaps them for you.
- **Attack only what you own.** Scans and attack simulations run from the DevSec lab, toward lab machines.

## Open questions

The pacing rests on these ASSUMPTIONS. Answers change the order and the timeline.

- Hours per week: the plan assumes 8 to 10, about 4 to 6 weeks per milestone.
- Starting level in Linux, networking and code: decides whether LFCS stays in.
- Target cloud: AWS assumed. Switch M9 to Azure if local job ads ask for it.
- Cert budget per year, and whether an employer or voucher can cover it.
- Target role: DevSecOps engineer, cloud security or application security. Shifts weight between M6, M7 and M9. Plan the first job on the way too (M0-R10): only 1.9% of 5,197 AppSec job postings were open to junior candidates (FACT, [Pixee, 2026-05-26](https://www.pixee.ai/blog/state-of-appsec-hiring-2026)), so a bridge role is the likelier first step (INFERENCE).
- Security+ version: SY0-701 retires on 2027-06-11 (English) and SY0-801 launches around 2026-11-17. See [certs.md](certs.md).
