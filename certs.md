# Certs

Each cert comes right after the milestone that teaches it, so study time doubles as lab time. Re-check the price and exam version on the official page before you book: they change.

**Status** is one of `planned`, `optional`, `later`, `studying`, `booked`, `passed`, `expired` or `skipped`. A `passed` cert needs a ledger row with the badge link. **Label** is the weakest claim in the row: `FACT` (read on the official page on the Checked date), `COMMUNITY` (from forums or resellers, not the official page), `UNVERIFIED` (not checked).

## Ladder

| Cert | Code | After | Price (USD) | Format | Valid | Status | Label | Checked | Note |
|------|------|-------|-------------|--------|-------|--------|-------|---------|------|
| [Terraform Associate](https://developer.hashicorp.com/certifications/terraform-associate) | 004 | M3 | $70.50 | 1 h, multiple choice, online proctored | 2 years | planned | FACT | 2026-10-24 | Tests Terraform 1.12. No free retake. Cheapest quick win. |
| [CompTIA Security+](https://www.comptia.org/en-us/certifications/security/) | SY0-701 or SY0-801 | M5 | $439 | 90 min, up to 90 questions incl. performance-based, pass 750 of 900 | 3 years | studying | COMMUNITY | 2026-10-24 | Price and validity not shown on the official page: check the CompTIA store. SY0-701 retires 2027-06-11 (English). SY0-801 launches around 2026-11-17. |
| [LFCS](https://training.linuxfoundation.org/certification/linux-foundation-certified-sysadmin-lfcs/) | LFCS | M2 | $445 | 2 h, performance-based, command line | 2 years | optional | FACT | 2026-10-24 | No prerequisites. Skip it if your Linux is already strong. |
| [CKA](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/) | CKA | M7 | $445 | 2 h, performance-based, one retake, two Killer.sh simulator sessions | 2 years | planned | FACT | 2026-10-24 | Exam runs on Kubernetes v1.37. |
| [CKS](https://training.linuxfoundation.org/certification/certified-kubernetes-security-specialist/) | CKS | M7 | $445 | 2 h, performance-based, one retake, two Killer.sh simulator sessions | 2 years | planned | FACT | 2026-11-04 | Needs an active CKA first. Exam runs on Kubernetes v1.37. Taking CKA and CKS close together lines up both renewals. Killercoda PLUS ($9.99 a month) is worth a month before it. |
| [AWS Solutions Architect – Associate](https://aws.amazon.com/certification/certified-solutions-architect-associate/) | SAA-C03 | M9 | $150 | 130 min, 65 questions | 3 years | planned | FACT | 2026-10-24 | |
| [AWS Security – Specialty](https://aws.amazon.com/certification/certified-security-specialty/) | — | first job | $300 | 170 min, 65 questions | 3 years | later | FACT | 2026-10-24 | AWS aims it at people with 5 years in IT security and 2 years on AWS. Not a junior cert. |
| [Splunk Core Certified User](https://www.splunk.com/en_us/training/certification-track/splunk-core-certified-user.html) | SPLK-1001 | M5 | $130 | 60 min, 60 multiple-choice questions, Pearson VUE | not shown | optional | FACT | 2026-11-04 | Take it after M5-R8 if you lean SOC: it puts Splunk on the resume with proof behind it. |
| [Microsoft Security Operations Analyst](https://learn.microsoft.com/en-us/credentials/certifications/security-operations-analyst/) | SC-200 | M5 | $165 | 100 min, proctored, pass 700 | 1 year, free online renewal | optional | FACT | 2026-10-14 | For Sentinel and Defender shops; pairs with M5-R14. |
| [Microsoft Identity and Access Administrator](https://learn.microsoft.com/en-us/credentials/certifications/identity-and-access-administrator/) | SC-300 | M4 | $165 | 100 min | 1 year, free online renewal | optional | UNVERIFIED | 2026-10-30 | The page read showed no price; $165 is Microsoft's usual US associate price. Pairs with the M4-R8 lab and identity work such as Okta. |
| [Blue Team Level 1](https://www.securityblue.team/certifications/blue-team-level-1) | BTL1 | M5 | — | 24-hour practical exam, one free resit | — | optional | FACT | 2026-10-11 | £399, no US price shown. Includes 4 months of access and 23 labs. The vendor now trades as Centri. |
| [Burp Suite Certified Practitioner](https://portswigger.net/web-security/certification) | BSCP | M6 | $99 | practical, 4 h, two apps | 5 years | optional | FACT | 2026-11-04 | Needs an active Burp Suite Professional licence ($499 a year). Do the free Academy labs first and buy Pro for the month you sit it; whether a Burp Pro trial counts is not verified. |

## Skipped for now

- **CySA+** ($439, COMMUNITY): CompTIA recommends about 4 years as an analyst first.
- **PenTest+** ($439, COMMUNITY) and **Practical DevSecOps CDP** ($899): the free badges, a public repo and BSCP later give more per dollar.
- **AWS Cloud Practitioner** ($100), **SC-900** ($99) and **KCSA** ($250): SAA, SC-300 and CKS prove the same skills at a higher level.
- **ISC2 CC**: the free One Million Certified program has closed, and its codes must be used by 2026-12-31. The bundle is $199, and it overlaps Security+.
- **GIAC** ($999 a try): only if an employer pays.
- **Watch: CompTIA AutoOps+** (AT0-001, launched 2026-06-02): automation, IaC, CI/CD, Git and secrets. Price not verified.

## Choices to make

- **Security+ version.** SY0-701 has more study material today. SY0-801 is current for longer. Studying is under way, so pick the version before booking. Recommended (INFERENCE): stay on SY0-701 and sit it by about March 2027, since 60 to 90 hours at 8 to 10 a week is 6 to 11 weeks and March leaves room for one retake. Switch to SY0-801 only if you can't test before April 2027. A voucher works for either version, lasts 12 months and can't be refunded (FACT, CompTIA's voucher terms).
- **Which track after Security+.** DevSecOps: Terraform Associate, then SAA. SOC: Splunk Core Certified User, then BTL1 or SC-200. AppSec: BSCP. Identity: SC-300. Leading with DevSecOps fits the target roles (INFERENCE).
- **LFCS.** Take it only if the M2 reps feel hard.
