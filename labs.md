# Security labs and projects

Every security lab on this roadmap in one place, the practice that teaches it, and the projects that ship it. A lab is a set of reps in a milestone, so its status comes from those ticks. You can't mark a lab done here, only by doing its reps. A skill you don't have yet becomes a lab, never a resume line.

`roadmap check` reads every table here: every rep must exist, every link must be https, every linked price needs the day it was checked, Start here must follow milestone order, a capstone must ship in a listed project, and a project marked `shipped` needs a ledger row (kind `project`) that names it.

## Start here

The top picks, in milestone order, since each milestone builds on the one before. All of them are free. Study for Security+ alongside: Professor Messer's free course is under Practice, and Clocks says when to sit the exam. The only exams to pay for in the next six months are Security+ and Terraform Associate, plus Splunk Core Certified User if you lean SOC (INFERENCE, see [Certs](certs.md)).

| Do this | Reps | Evidence it leaves |
|---------|------|--------------------|
| Microsoft Learn's free threat-modeling path, then your model drawn in OWASP Threat Dragon | M0-R6 | A threat model in the repo |
| Jeremy's IT Lab VLAN and ACL lessons in Packet Tracer, then Wireshark Learn | M1-R2, M1-R3, M1-R5 | Your zone matrix, and a capture where you point at the dropped packets |
| OverTheWire Bandit as a warm-up, then Lynis for the score and Molecule with ansible-lint for the role | M2-R1, M2-R4, M2-R5, M2-R6, M2-R7 | Bandit notes, the hardening index before and after, and a CI log where the second run shows `changed=0` |
| TFLint and a Trivy config scan in CI, tested on a flaw planted from TerraGoat | M3-R6 | A run that fails, the fix, and a run that passes |
| Microsoft's free AD DS Applied Skills training on a Windows Server 2025 evaluation, scored with PingCastle, then the 30-day Intune trial | M4-R7, M4-R8 | The build script, `gpresult /r`, PingCastle before and after, and the blocked sign-in in the log |
| Suricata in alert-only mode, then CrowdSec against an SSH brute force, then a Wazuh file integrity alert | M5-R2, M5-R9, M5-R13 | A Suricata alert for your own scan, a CrowdSec ban and its undo, and a Wazuh alert you set off on purpose |
| One Sigma rule compiled for Grafana and Splunk, the 60-day Splunk trial with BOTS v3, five phishing_pot samples and five KC7 cases | M5-R4, M5-R7, M5-R8, M5-R14 | One detection firing in both tools, five defanged write-ups, and your KQL in git |
| The DevSecOps-Intro labs and a ZAP baseline gate, with PortSwigger's Web Security Academy and Juice Shop alongside | M6-R1, M6-R3, M6-R4, M6-R5, M6-R8, M6-R10 | A pipeline run that fails, the fix, the run that passes, and your notes on each PortSwigger lab |
| kube-bench, Kyverno and Falco on k3s, practised first in Killercoda's CKS scenarios | M7-R2, M7-R4, M7-R5, M7-R6, M7-R7 | kube-bench before and after, and a Falco alert in Grafana |
| An Atomic Red Team test mapped in ATT&CK Navigator, then a VulnHub machine broken into while your detections watch | M8-R6, M8-R7 | A coverage layer, a blameless postmortem and a CTF write-up |
| The AWS Free plan through "Sign up for AWS (advanced)", Prowler before and after, and flAWS for the attacker's side | M9-R1, M9-R4 | Prowler reports before and after, root MFA on and no root access keys |

## Labs

**Resource** links an outside course or guide when the lab follows one, with what it costs and the day the link and price were checked. `—` means the milestone's reps are the guide.

| Lab | Reps | Tools | Resource | Cost | Checked |
|-----|------|-------|----------|------|---------|
| Secure repo baseline: signed commits and a secret-scanning hook | M0-R4, M0-R5 | SSH commit signing, pre-commit, gitleaks | — | — | — |
| Threat model with STRIDE | M0-R6 | STRIDE | [Microsoft Learn: Threat Modeling Security Fundamentals](https://learn.microsoft.com/en-us/training/paths/tm-threat-modeling-fundamentals/) | free | 2026-11-02 |
| Segment the network and prove it | M1-R2, M1-R3, M1-R4, M1-R5 | OPNsense, nmap, tcpdump | — | — | — |
| Filter the lab's DNS with AdGuard Home | M1-R7 | AdGuard Home, OPNsense | [AdGuard Home](https://github.com/AdguardTeam/AdGuardHome) | free | 2026-10-30 |
| Command-line warm-up with OverTheWire Bandit | M2-R7 | SSH, Linux command line | [OverTheWire: Bandit](https://overthewire.org/wargames/bandit/) | free | 2026-10-26 |
| Harden hosts and measure the change | M2-R1, M2-R3, M2-R4, M2-R6 | Lynis, Ansible | — | — | — |
| Least-privilege Terraform with a scan gate | M3-R2, M3-R5, M3-R6 | Terraform, tflint, Trivy | — | — | — |
| Access policy as code, with tests | M4-R1, M4-R2, M4-R3 | Tailscale, GitHub Actions | — | — | — |
| Build a WireGuard tunnel by hand | M4-R9 | WireGuard, wg-quick | [WireGuard: Quick Start](https://www.wireguard.com/quickstart/) | free | 2026-10-24 |
| Secrets in git as ciphertext only | M4-R4, M4-R5, M4-R6 | SOPS, age | — | — | — |
| Active Directory and Group Policy | M4-R7 | Windows Server, AD DS, Group Policy, PowerShell | [Microsoft Applied Skills: Administer Active Directory Domain Services](https://learn.microsoft.com/en-us/credentials/applied-skills/administer-active-directory-domain-services/) | free | 2026-10-21 |
| Device management and Conditional Access | M4-R8 | Entra ID, Intune, Conditional Access, MFA | [Microsoft Learn: Require device compliance with Conditional Access](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-compliance) | free | 2026-10-27 |
| Catch your own scan with an IDS | M5-R2, M5-R3, M5-R6 | Suricata, Grafana | — | — | — |
| Drop attacks inline with Suricata in IPS mode | M5-R11 | Suricata, OPNsense | [OPNsense docs: Intrusion Prevention System](https://docs.opnsense.org/manual/ips.html) | free | 2026-11-02 |
| Endpoint monitoring and file integrity with Wazuh | M5-R13 | Wazuh server and agents | [Wazuh: Quickstart](https://documentation.wazuh.com/current/quickstart.html) | free | 2026-11-04 |
| Central logs and a detection of your own | M5-R1, M5-R4, M5-R5 | Grafana | — | — | — |
| Phishing analysis | M5-R7 | email headers, SPF, DKIM, DMARC | [phishing_pot: a public corpus of real phishing emails](https://github.com/rf-peixoto/phishing_pot) | free | 2026-11-04 |
| SIEM detection in Splunk | M5-R8 | Splunk Enterprise trial, SPL | [Splunk free training courses](https://www.splunk.com/en_us/training/free-courses/overview.html) | free | 2026-11-04 |
| Search logs in KQL with KC7 cases | M5-R14 | KQL | [KC7: free cybersecurity cases](https://kc7cyber.com/) | free | 2026-11-04 |
| Block an SSH brute force with CrowdSec | M5-R9 | CrowdSec Security Engine, nftables firewall bouncer | [CrowdSec Academy: CrowdSec Fundamentals](https://academy.crowdsec.net/course/crowdsec-fundamentals) | free | 2026-11-04 |
| Ban at the network edge with CrowdSec on OPNsense | M5-R12 | os-crowdsec plugin, CrowdSec firewall bouncer | [CrowdSec docs: OPNsense plugin](https://docs.crowdsec.net/docs/getting_started/install_crowdsec_opnsense) | free | 2026-10-12 |
| Write a CrowdSec parser and scenario | M5-R10 | CrowdSec, cscli hubtest | [CrowdSec Academy: Writing Parsers and Scenarios](https://academy.crowdsec.net/course/writing-parsers-and-scenarios) | free | 2026-11-04 |
| Security gates in the pipeline | M6-R1, M6-R3 | Semgrep, Trivy, gitleaks, Forgejo Actions | [DevSecOps-Intro: hands-on labs on OWASP Juice Shop](https://github.com/inno-devops-labs/DevSecOps-Intro) | free | 2026-11-04 |
| SBOMs and signed images | M6-R4, M6-R5 | Syft, cosign | [OpenSSF: Securing Your Software Supply Chain with Sigstore (LFS182)](https://openssf.org/training/securing-your-software-supply-chain-with-sigstore-course/) | free | 2026-11-04 |
| Harden the CI pipeline itself | M6-R2, M6-R6 | Forgejo runner, zizmor, SHA pins | — | — | — |
| Dynamic scanning with ZAP | M6-R8 | ZAP | [ZAP docs: Baseline Scan](https://www.zaproxy.org/docs/docker/baseline-scan/) | free | 2026-11-03 |
| Block web attacks with the CrowdSec WAF | M6-R9 | CrowdSec WAF, OWASP CRS | [CrowdSec Academy: Securing your applications with the CrowdSec WAF](https://academy.crowdsec.net/course/crowdsec-waf) | free | 2026-11-04 |
| Find web bugs by hand, then catch one in CI | M6-R10 | Burp Suite Community, Juice Shop, Semgrep | [PortSwigger Web Security Academy](https://portswigger.net/web-security) | free | 2026-11-04 |
| Harden the app's container image | M6-R11 | Docker, Trivy | — | — | — |
| Test the API against the OWASP API Security Top 10 | M6-R12 | pytest, Burp Suite Community | [OWASP Top 10 API Security Risks – 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | free | 2026-09-10 |
| Kubernetes benchmark before and after | M7-R2, M7-R7 | kube-bench | — | — | — |
| Kubernetes RBAC and admission policy | M7-R3, M7-R4 | RBAC, Pod Security Admission, Kyverno | — | — | — |
| Default-deny networking in Kubernetes | M7-R5 | NetworkPolicy | [Killer Shell CKS scenarios on Killercoda](https://killercoda.com/killer-shell-cks) | free | 2026-11-04 |
| Runtime detection with Falco | M7-R6 | Falco, Grafana | [Killer Shell CKS scenarios on Killercoda](https://killercoda.com/killer-shell-cks) | free | 2026-11-04 |
| Restore drills and a backup credential review | M8-R2, M8-R3, M8-R4 | Proxmox Backup Server | — | — | — |
| Simulate an attack, then write the postmortem | M8-R5, M8-R6 | Atomic Red Team, MITRE ATT&CK | [Atomic Red Team](https://github.com/redcanaryco/atomic-red-team) | free | 2026-11-04 |
| Break into a vulnerable machine, then check your detections | M8-R7 | VulnHub or Hack The Box, nmap, MITRE ATT&CK | [VulnHub](https://www.vulnhub.com/) | free | 2026-10-14 |
| AWS account baseline | M9-R1, M9-R2, M9-R3 | IAM Identity Center, CloudTrail, Terraform | [AWS docs: Compare sign-up options](https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html) | free | 2026-10-31 |
| Cloud posture scan with Prowler | M9-R4 | Prowler | — | — | — |
| Deploy with no stored cloud keys | M9-R5 | GitHub OIDC, AWS IAM | — | — | — |

## Practice

More ways to learn each rep: courses, practice ranges and the tools themselves. **Area** is one of `foundations`, `identity`, `appsec`, `detection`, `containers`, `cloud` or `ctf`. **Value** is job value from 1 to 5 (INFERENCE): 5 is named in most target job ads and closes a resume gap, 3 is a supporting skill, 1 is skip unless curious. **Time** is a guess unless it says stated. **Label** says how sure the Cost is (`FACT`, `COMMUNITY` or `UNVERIFIED`, as in [Certs](certs.md)), and a note marks any weaker claim inline. Subscriptions renew on their own, so buy one month when a lab needs it. Never point a tool at anything you don't own.

Also checked and ranked lower: TCM Academy's free Linux 100 and Practical Help Desk, Linux Journey, LFS101, CyLab Security Academy (picoCTF's new name) and CISA Learning.

| Resource | Area | Reps | Cost | Time | Value | Label | Checked | Note |
|----------|------|------|------|------|-------|-------|---------|------|
| [Professor Messer: Security+ SY0-701 course](https://www.professormesser.com/security-plus/sy0-701/sy0-701-video/sy0-701-comptia-security-plus-course/) | foundations | — | free | 60 to 90 h with practice | 5 | FACT | 2026-11-04 | The free Security+ course: about 15 h of video. Notes and practice exams cost extra. No SY0-801 course yet. |
| [Molecule](https://docs.ansible.com/projects/molecule/) | foundations | M2-R4, M2-R5 | free | 8 to 12 h | 5 | FACT | 2026-11-04 | Test the hardening role with [ansible-lint](https://ansible.readthedocs.io/projects/lint/) in CI: converge twice, the second run shows `changed=0`, and a bad task fails lint. |
| [Lynis](https://cisofy.com/lynis/) | foundations | M2-R1, M2-R6 | free | 2 to 4 h | 4 | FACT | 2026-11-04 | Open source (GPL). The hardening index before and after is your evidence. |
| [Linux Upskill Challenge](https://linuxupskillchallenge.org/) | foundations | M1-R4, M2-R3 | free | 1 to 2 h a day for a month | 4 | FACT | 2026-11-04 | No sign-up; it restarts the first Monday of each month. Day 9 is nmap. Do its hardening by hand before you write the role. |
| [Jeremy's IT Lab: CCNA course](https://www.youtube.com/playlist?list=PLxbwE86jKRgMpuZuLBivzlM8s2Dk5lXBQ) | foundations | M1-R2, M1-R3 | free | about 58 h of video | 4 | FACT | 2026-11-04 | Do the VLAN and ACL labs in [Packet Tracer](https://www.netacad.com/cisco-packet-tracer), free with a NetAcad login. The running time is COMMUNITY. |
| [Wireshark Learn](https://www.wireshark.org/learn) | foundations | M1-R5 | free | 10 to 15 h | 4 | FACT | 2026-11-04 | Practise on the [sample captures](https://wiki.wireshark.org/SampleCaptures) before your own. |
| [Automate the Boring Stuff with Python](https://automatetheboringstuff.com/) | foundations | M6-R1 | free | 30 to 50 h | 4 | FACT | 2026-11-04 | Free to read online, like [The Linux Command Line](https://linuxcommand.org/tlcl.php). The Python behind the M6 app and the phishing triage toolkit. |
| [Windows Server 2025 evaluation](https://www.microsoft.com/en-us/evalcenter/evaluate-windows-server-2025) | identity | M4-R7 | free | 10 to 15 h to build | 5 | FACT | 2026-11-04 | 180 days; activate it online within 10 days. The client is the [Windows 11 Enterprise evaluation](https://www.microsoft.com/en-us/evalcenter/evaluate-windows-11-enterprise) (90 days). On Proxmox use OVMF with Secure Boot keys pre-enrolled, a v2.0 TPM and an EFI disk made with current firmware: the 2011 Secure Boot certificates expired in June 2026. |
| [PingCastle](https://www.pingcastle.com/editions/) | identity | M4-R7 | free | 1 to 2 h | 5 | FACT | 2026-11-04 | Score the domain before and after. The Community edition is free for personal use only; Semperis Purple Knight is a free alternative. Windows LAPS is built in now. |
| [Intune free trial](https://learn.microsoft.com/en-us/intune/intune-service/fundamentals/free-trial-sign-up) | identity | M4-R8 | free | 10 to 15 h | 5 | FACT | 2026-11-04 | 30 days with Entra ID P1, and a card to verify. Sign-in logs are kept 30 days and a lapsed licence leaves policies you can't edit: screenshot, export and cancel before day 30. The Microsoft 365 developer sandbox is limited to Visual Studio subscribers and some partners. |
| [BloodHound Community Edition](https://github.com/SpecterOps/BloodHound) | identity | M4-R7, M8-R6 | free | 4 to 6 h | 4 | FACT | 2026-11-04 | Fill the lab domain with [BadBlood](https://github.com/davidprowe/BadBlood), then compare attack paths before and after your fixes. BadBlood needs Domain Admin and Schema Admin and can't be undone: run it only on the M4-R7 lab domain, from a snapshot. |
| [OWASP Juice Shop](https://github.com/juice-shop/juice-shop) | appsec | M6-R8, M6-R10 | free | 10 h and up | 5 | FACT | 2026-11-04 | Vulnerable on purpose: run it only on the isolated lab segment. |
| [TryHackMe: DevSecOps path](https://tryhackme.com/path/outline/devsecops) | appsec | M3-R6, M6-R3, M6-R6, M6-R11 | €16.99/month | about 27 h (stated) | 4 | FACT | 2026-11-04 | Five modules, from pipelines to IaC and containers. Its rooms need Premium: €16.99 a month, or €10.50 a month billed yearly. Whether all of it needs MAX (€29.11 a month) and the US prices: not verified. |
| [OpenSSF: Developing Secure Software (LFD121)](https://training.linuxfoundation.org/training/developing-secure-software-lfd121/) | appsec | M0-R6, M6-R1 | free | 14 to 20 h (stated) | 4 | FACT | 2026-11-04 | Ends in a certificate and a badge. |
| [Sigstore: CI quickstart](https://docs.sigstore.dev/quickstart/quickstart-ci/) | appsec | M6-R5, M6-R7 | free | 2 to 3 h | 4 | FACT | 2026-11-04 | Keyless signing with GitHub's OIDC token fits the public mirror. Forgejo isn't a documented Fulcio issuer, so plan a cosign key pair there (INFERENCE). cosign v3 changed the default bundle format. |
| [OpenSSF Scorecard](https://github.com/ossf/scorecard) | appsec | M6-R6, M6-R7 | free | 4 to 6 h | 4 | FACT | 2026-11-04 | On the public mirror, with GitHub code scanning, secret scanning with push protection and the [OpenSSF Best Practices badge](https://www.bestpractices.dev/en), all free on public repos. StepSecurity Harden-Runner's free tier covers public repos on GitHub-hosted runners only. |
| [OWASP Threat Dragon](https://owasp.org/www-project-threat-dragon/) | appsec | M0-R6 | free | 3 h | 4 | FACT | 2026-11-04 | Draw the M0 threat model as a diagram. The Elevation of Privilege card game helps you find threats. |
| [ZAP: baseline scan action](https://github.com/zaproxy/action-baseline) | appsec | M6-R7, M6-R8 | free | 4 to 6 h | 4 | FACT | 2026-11-04 | Pin it by SHA and turn off issue writing. It scans passively: gate one rule with a rules file (10021 is the missing X-Content-Type-Options header). Read the exit-code docs, since `-l FAIL` alone doesn't fail the build. The ZAP image has no Node.js, so Node-based actions won't run inside it on Forgejo. |
| [Semgrep Academy](https://academy.semgrep.dev/) | appsec | M6-R3, M6-R10 | free | not stated | 3 | FACT | 2026-11-04 | Learn to write the custom rule M6-R10 asks for. |
| [CICD-Goat](https://github.com/cider-security-research/cicd-goat) | appsec | M6-R2, M6-R6 | free | 10 to 15 h | 3 | FACT | 2026-11-04 | Attacks on the OWASP Top 10 CI/CD risks. No commits since July 2024. |
| [APIsec University](https://www.apisecuniversity.com/) | appsec | M6-R12 | free | not stated | 3 | FACT | 2026-11-04 | Free API security courses; its exams start at $125. |
| [Sigma CLI](https://github.com/SigmaHQ/sigma-cli) | detection | M5-R4, M5-R5, M5-R8 | free | 4 to 8 h | 5 | FACT | 2026-11-04 | Write a detection once and compile it with the [Loki](https://github.com/grafana/pySigma-backend-loki) and [Splunk](https://github.com/SigmaHQ/pySigma-backend-splunk) backends: detection as code (INFERENCE). |
| [Splunk Enterprise trial](https://www.splunk.com/en_us/download/splunk-enterprise.html) | detection | M5-R8 | free | 25 to 35 h | 5 | FACT | 2026-11-04 | 60 days at 500 MB a day, then Splunk Free: no login and no alerts. |
| [Sysmon](https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon) | detection | M5-R1 | free | 7 to 11 h | 5 | FACT | 2026-11-04 | Configure it with [sysmon-modular](https://github.com/olafhartong/sysmon-modular) and ship it with [Grafana Alloy](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.windowsevent/), since Promtail reached end of life on 2026-03-02. The Sysmon built into Windows 11 and Server 2025 can't run next to the standalone one. |
| [MITRE ATT&CK Navigator](https://mitre-attack.github.io/attack-navigator/) | detection | M5-R3, M8-R6 | free | 4 to 6 h | 5 | FACT | 2026-10-27 | ATT&CK v20.0 came out on 2026-10-13; DeTT&CT supports only v18. The Atomic test for T1046 (nmap) scans 127.0.0.1 unless you change it. |
| [CyberChef](https://github.com/gchq/CyberChef) | detection | M5-R7 | free | 2 to 4 h | 4 | FACT | 2026-11-04 | Run it locally to decode phishing payloads. [MXToolbox's header analyzer](https://mxtoolbox.com/EmailHeaders.aspx) gets the headers only. Search VirusTotal and urlscan.io for a reputation; never visit a sample's link. |
| [TryHackMe: SOC Level 1](https://tryhackme.com/path/outline/soclevel1) | detection | M5-R6, M5-R7 | €16.99/month | 50 to 80 h | 4 | FACT | 2026-11-04 | In Premium: €16.99 a month, or €10.50 a month billed yearly; US prices not verified. SOC Level 2 and the other advanced paths need MAX. |
| [Kusto Detective Agency](https://detective.kusto.io/) | detection | M5-R14 | free | 10 to 15 h | 4 | FACT | 2026-10-01 | KQL puzzles on a free Azure Data Explorer cluster, no card needed. |
| [Splunk BOTS v3](https://github.com/splunk/botsv3) | detection | M5-R6, M5-R8 | free | 10 to 20 h | 4 | FACT | 2026-11-04 | A 320 MB attack dataset (CC0) to hunt in during the Splunk trial. |
| [Blue Team Labs Online](https://blueteamlabs.online/) | detection | M5-R6, M5-R7 | free | varies | 3 | FACT | 2026-11-04 | Free investigations; PRO is £15 a month. |
| [CyberDefenders](https://cyberdefenders.org/) | detection | M5-R6 | free | 10 to 20 h | 3 | FACT | 2026-10-20 | Free blue-team labs; CyberRange at $25 a month adds Sentinel labs. |
| [malware-traffic-analysis.net exercises](https://www.malware-traffic-analysis.net/training-exercises.html) | detection | M5-R2, M5-R3 | free | 2 to 4 h each | 3 | FACT | 2026-10-26 | The captures hold live malware: open them only in an isolated lab VM. |
| [Security Onion 3](https://docs.securityonion.net/en/3/main/hardware/) | detection | M5-R2 | free | 8 to 12 h | 2 | FACT | 2026-10-16 | A full network security monitoring stack, but a standalone install wants 24 GB of RAM. |
| [kube-bench](https://github.com/aquasecurity/kube-bench) | containers | M7-R2, M7-R7 | free | 2 to 3 h | 5 | FACT | 2026-11-04 | The CIS benchmark, run before and after your fixes. |
| [Falco](https://falco.org/) | containers | M7-R6 | free | 4 to 6 h | 5 | FACT | 2026-11-04 | Runtime alerts, sent into the M5 pipeline. |
| [Kyverno Playground](https://playground.kyverno.io/) | containers | M7-R4 | free | 6 to 8 h | 4 | FACT | 2026-11-04 | Try each policy in the browser before the cluster; the docs are at [kyverno.io](https://kyverno.io/). |
| [Kubernetes Goat](https://madhuakula.com/kubernetes-goat/) | containers | M7-R3, M7-R5 | free | 6 to 10 h | 3 | FACT | 2026-11-04 | Vulnerable on purpose: run it on the lab cluster only. |
| [Kubernetes the Hard Way](https://github.com/kelseyhightower/kubernetes-the-hard-way) | containers | M7-R1 | free | 8 to 12 h | 3 | FACT | 2026-10-28 | Builds a cluster by hand on four small VMs, so you learn what each control-plane part does. It runs Kubernetes v1.32, five versions behind the CKA and CKS (v1.37): learn the internals from it, not the exam syntax. |
| [Prowler](https://github.com/prowler-cloud/prowler) | cloud | M9-R4 | free | 3 h | 5 | FACT | 2026-11-04 | Open source (Apache-2.0); it also scans Kubernetes and IaC. |
| [TerraGoat](https://github.com/bridgecrewio/terragoat) | cloud | M3-R6 | free | 4 to 6 h | 5 | FACT | 2026-11-04 | Plant its flaws to test the M3 gate, with [KaiMonkey](https://github.com/tenable/KaiMonkey) as a second set. Scan them with [Trivy](https://github.com/aquasecurity/trivy), [Checkov](https://github.com/bridgecrewio/checkov) and [TFLint](https://github.com/terraform-linters/tflint); never apply them. |
| [Cloud Resume Challenge (AWS)](https://cloudresumechallenge.dev/docs/the-challenge/aws/) | cloud | M9-R5 | free | 40 to 60 h | 5 | FACT | 2026-11-04 | A domain costs about $10. Add the [supply-chain extension](https://cloudresumechallenge.dev/docs/extensions/supply-chain/), and destroy what you build after each session. |
| [Wiz: The Big IAM Challenge](https://bigiamchallenge.com/) | cloud | M7-R3, M9-R3 | free | 2 to 8 h | 4 | FACT | 2026-11-04 | Then [EKS Cluster Games](https://eksclustergames.com/) and [K8s LAN Party](https://k8slanparty.com/). flAWS and flAWS2 serve plain HTTP, so they aren't linked here. |
| [CloudGoat](https://github.com/RhinoSecurityLabs/cloudgoat) | cloud | — | free | 1 to 3 h a scenario | 4 | FACT | 2026-11-04 | Its scenarios bill your account: destroy each one, then read its CloudTrail record. |
| [AWS Workshops](https://workshops.aws/) | cloud | M9-R2, M9-R3 | free | 6 h for IAM Core (stated) | 4 | FACT | 2026-11-04 | The workshops run in your own account and bill it. |
| [Pwned Labs](https://pwnedlabs.io/) | cloud | — | free | varies | 3 | FACT | 2026-11-04 | Free cloud attack labs; Pro is $20 a month and renews on its own. |
| [Hack The Box Labs](https://help.hackthebox.com/en/articles/7257535-htb-labs-subscriptions) | ctf | M8-R7 | free | varies | 4 | FACT | 2026-10-26 | The free plan plays active machines only. Retired machines, the M8-R7 option, need VIP+ ($25 a month or $223 a year); PRO ($49 a month) adds Pro Labs. Connect only from the lab attack VM. HTB bought LetsDefend, whose annual plans ended on 2026-10-15. |
| [Vulnlab on Hack The Box](https://help.hackthebox.com/en/articles/11582861-vulnlab-x-hack-the-box) | ctf | M8-R7 | $25/month | varies | 3 | FACT | 2026-10-22 | Its 42 machines need VIP+; the chains and red team labs need PRO ($49 a month). |
| [SANS Holiday Hack Challenge](https://www.sans.org/cyber-ranges/holiday-hack-challenge) | ctf | — | free | varies | 3 | FACT | 2026-11-04 | A free portfolio piece: the 2026 write-ups are due 2027-01-05. The start date is not verified. |

## Capstones

Each capstone joins several labs into one piece of work an interviewer can open. They are listed by job value; the first three tell the strongest DevSecOps story (INFERENCE). **Ships in** names the project from the table below that will hold it.

| Capstone | Reps | Ships in | What you ship | Interview question |
|----------|------|----------|---------------|--------------------|
| Secure delivery pipeline | M0-R6, M6-R1, M6-R2, M6-R3, M6-R4, M6-R5, M6-R6, M6-R7, M6-R8, M6-R10, M6-R11, M6-R12 | homelab-lab | The M6 app and its public mirror: a pull request blocked by the planted CVE and then passing, an SBOM, a cosign check before deploy, a ZAP scan that fails then passes, your own Semgrep rule and a clean zizmor run | How do you secure a CI/CD pipeline? |
| Purple-team detection lab | M4-R7, M5-R1, M5-R4, M5-R6, M5-R8, M8-R6, M8-R7 | homelab-lab | Detections in SPL with a Sigma copy, an Atomic test for each, an ATT&CK coverage layer, a CTF machine with what your detections saw, and the postmortem | Tell me about a detection you built. |
| Locked-down AWS account | M9-R1, M9-R2, M9-R3, M9-R4, M9-R5, M9-R6 | homelab-cloud | Terraform applied from CI, Prowler before and after, a deploy through OIDC with no stored keys, and the final bill | How would you secure a new AWS account? |
| Layered edge defense | M5-R2, M5-R9, M5-R11, M5-R12, M5-R13, M6-R9 | homelab-lab | OPNsense with Suricata dropping inline, a CrowdSec ban at the edge, the WAF blocking SQL injection, Wazuh agents reporting, and each undo written down | How would you defend a small network? |
| Hybrid identity lab | M4-R7, M4-R8 | homelab-iac | Active Directory built by a PowerShell script, three GPOs, PingCastle before and after, and Intune compliance with Conditional Access blocking a sign-in | How do you manage endpoints and access? |
| Hardened k3s platform | M7-R1, M7-R2, M7-R3, M7-R4, M7-R5, M7-R6, M7-R7 | homelab-lab | kube-bench before and after, Kyverno policies with tests, default-deny proven from inside the cluster, and a Falco alert in Grafana | How would you secure a Kubernetes cluster? |
| Phishing triage toolkit | M5-R7, M6-R3 | phishing-triage-toolkit | A Python CLI that reads an `.eml` as text, pulls out the SPF, DKIM and DMARC results and the IOCs, defangs them and writes a report skeleton, built through your own secure pipeline | Walk me through how you triage a reported phish. |

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
| phishing-triage-toolkit | M5, M6 | A small Python CLI that turns a reported phishing email into a defanged report skeleton (the phishing triage capstone) | Reads mail as text only and never follows a link; defangs every IOC; tests and the M6 pipeline's gates on every change | planned |

## Clocks

Deadlines and trial lengths that decide when to do a lab. A date is when it happens; a length counts from the day you start, so build and snapshot the VM before you sign up. The page counts the days left. Delete a row once it has passed.

| When | What | Reps | Do this | Label | Checked |
|------|------|------|---------|-------|---------|
| 2026-12-31 | Unused codes from [ISC2's One Million Certified in Cybersecurity](https://www.isc2.org/landing/1mcc) expire; the free program has closed | — | Use a code only if you already hold one; otherwise skip ISC2 CC (see Certs) | FACT | 2026-11-04 |
| 2027-01-05 | Write-ups for the [SANS Holiday Hack Challenge 2026](https://www.sans.org/cyber-ranges/holiday-hack-challenge) are due | — | A free portfolio piece; the start date is not verified | FACT | 2026-11-04 |
| 2027-03-31 | [Microsoft Sentinel leaves the Azure portal](https://learn.microsoft.com/en-us/azure/sentinel/move-to-defender) and lives only in the Defender portal | M5-R14 | Learn Sentinel and KQL in the Defender portal | FACT | 2026-10-23 |
| 2027-06-11 | [Security+ SY0-701](https://www.comptia.org/en-us/certifications/security/) retires (English) | — | Sit it by about March 2027, leaving room for one retake (INFERENCE) | FACT | 2026-11-04 |
| 30 days | The [Intune free trial](https://learn.microsoft.com/en-us/intune/intune-service/fundamentals/free-trial-sign-up), from sign-up | M4-R8 | Build and snapshot the VM first; export everything and cancel before day 30 | FACT | 2026-11-04 |
| 60 days | The [Splunk Enterprise trial](https://docs.splunk.com/Documentation/Splunk/latest/Admin/MoreaboutSplunkFree), then Splunk Free with no login and no alerts | M5-R8 | Finish M5-R8 inside the trial, then delete the VM or keep it unreachable from the LAN | FACT | 2026-10-29 |
| 90 days | The [Windows 11 Enterprise evaluation](https://www.microsoft.com/en-us/evalcenter/evaluate-windows-11-enterprise) | M4-R7 | The build script rebuilds the client | FACT | 2026-11-04 |
| 180 days | The [Windows Server 2025 evaluation](https://www.microsoft.com/en-us/evalcenter/evaluate-windows-server-2025); activate it online within 10 days | M4-R7 | Rebuild from the script when it runs out | FACT | 2026-11-04 |
| 6 months | The [AWS Free plan](https://aws.amazon.com/free/free-tier-faqs/); creating an AWS Organization ends it at once | M9-R1, M9-R2 | Spend the credits on paid experiments before M9-R2. After 6 months the account is suspended, and its data is deleted 90 days later unless you upgrade | FACT | 2026-11-04 |

## Choices to make

- **M9-R2 and the AWS credits.** Identity Center needs an AWS Organization, which ends the free plan and its credits at once. Either do M9-R2 as written after spending the credits on experiments that cost money, such as CloudGoat or a short EKS test, or stay on the free plan with an MFA-protected IAM user that has no access keys, and change the rep. Recommended: the first, since Identity Center is the pattern employers use (INFERENCE).
- **Splunk after day 60.** Delete the VM, or keep Splunk Free behind an OPNsense block rule, which is a gated Runbook step with its undo. Recommended: delete it and keep the SPL in git (INFERENCE).
- **Paid practice.** One platform for one month at a time, since they all renew on their own: TryHackMe Premium for SOC Level 1 or the DevSecOps path, Hack The Box VIP+ for retired machines and Vulnlab, Killercoda PLUS ($9.99 a month) in the weeks before CKS. HTB Academy's Silver Annual ($550 a year) pays off only if you want its CJCA voucher.
