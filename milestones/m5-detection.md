# M5 Detection

**Build:** Mission Control → Monitoring & power · Phase 2: OPNsense router + VLANs
**Proof:** A Suricata alert for your own M1 scan, visible in Grafana, a custom detection you triggered on purpose, and an incident write-up
**Cert gate:** CompTIA Security+
**Careful:** A bouncer blocks addresses at the firewall, yours included. Before you turn one on, allowlist the address you manage the VM from, and keep `cscli decisions delete -i <address>` ready as the undo; on OPNsense, run it from the console, since a ban on your address also cuts you off from its web GUI. Suricata in IPS mode drops traffic inline: turn it on for the lab OPNsense only, switch off hardware offloading first (Interfaces ‣ Settings), and undo it by setting Capture mode back to PCAP live mode (IDS). The Wazuh installer prints the admin password and keeps every password in `wazuh-install-files.tar`: move them to your password manager, delete the file, and keep the dashboard on the lab network. Splunk Free has no login and no alerts, so anyone who can reach it is an admin: do M5-R8 inside the 60-day trial, then keep the VM unreachable from the LAN or delete it.
**In plain words:** Collect logs in one place, get alerted when something suspicious happens, and prove the alert fires by setting it off yourself.

## Why (first principles)
Prevention fails eventually; detection is how you find out. An alert you have never seen fire is a hope, not a control. The test is simple: cause the bad thing on purpose and check the alert arrives where you will see it.

## Reps
- [ ] M5-R1 · Ship logs from every node and OPNsense to core (Monitoring & power chapter) · done when: one query returns logs from every source
- [ ] M5-R2 · Run Suricata in alert-only mode on the lab-facing interface, on the lab OPNsense now or the Phase 2 router later · done when: rules load and a test alert appears
- [ ] M5-R3 · Re-run the M1 scan · done when: the alert in Grafana matches the scan's timestamp
- [ ] M5-R4 · Write one detection of your own, such as an SSH login from outside the management range · done when: you trigger it on purpose and it reaches your phone or inbox
- [ ] M5-R5 · Tune for one week · done when: every suppressed alert has a written reason
- [ ] M5-R6 · Write an incident report for the scan with [the template](../templates/incident-report.md) · done when: it is merged
- [ ] M5-R7 · Analyse five phishing samples from a public corpus, never live mail · done when: five write-ups each cover the headers, the SPF, DKIM and DMARC results, the IOCs and a verdict, with every link and address defanged
- [ ] M5-R8 · Load the same logs into Splunk Free and port the M5-R4 detection to SPL · done when: the SPL search fires on the same test event as the Grafana alert
- [ ] M5-R9 · Install the CrowdSec Security Engine and the nftables firewall bouncer on a Debian lab VM, then run an SSH brute force against it from another lab VM (CrowdSec Academy: CrowdSec Fundamentals) · done when: `cscli alerts list` shows the brute force, `cscli decisions list` shows the attacking VM banned, its next SSH attempt is dropped, and `cscli decisions delete` lets it back in
- [ ] M5-R10 · Write a CrowdSec parser and scenario of your own for a log the hub has no parser for, such as a script or service of your own (CrowdSec Academy: Writing Parsers and Scenarios) · done when: a `cscli hubtest` test for each passes, and causing the event for real raises an alert
- [ ] M5-R11 · Switch Suricata on the lab OPNsense from alert-only to IPS mode (Capture mode: Netmap (IPS)) on the lab interface, and set one rule that a harmless test request from a lab VM triggers to `drop` (OPNsense docs: Intrusion Prevention System) · done when: the request fails, the drop shows in the alert log, and the same request goes through again once Capture mode is back to IDS
- [ ] M5-R12 · Install the os-crowdsec plugin on the lab OPNsense: it brings the Security Engine and the firewall bouncer, so bans apply at the network edge for machines that don't run CrowdSec (CrowdSec docs: OPNsense plugin) · done when: during a 2-minute manual ban on a lab VM's address (`cscli decisions add -t ban -d 2m -i <address>`) that VM can't reach OPNsense, and it gets through again once the ban runs out
- [ ] M5-R13 · Run Wazuh on an Ubuntu 24.04 lab VM (the all-in-one quickstart wants 4 vCPU, 8 GiB of RAM and 50 GB of disk) with one Windows agent on an M4-R7 VM and one Linux agent, then set its file integrity monitoring to watch one folder in real time and change a file there on purpose (Wazuh: Quickstart) · done when: the file integrity alert shows in the Wazuh dashboard, and a note says what Wazuh caught and what it missed

## Break it
- Stop the log shipper on one node. Do you get an alert that its logs stopped? If not, build one: silence is a classic gap.
- Send a lab mailbox a message with a spoofed From address. Does your header analysis catch it from the DMARC result alone?
- Run the brute force before you change any CrowdSec setting. If no alert fires, use `cscli explain` on the log to find which stage dropped the event and why. Change only what the lab needs.
- During the manual ban on OPNsense, can the banned lab VM still reach the internet, or another VM on its own subnet? Explain each answer from where the bouncer sits.
- Change a file in a folder Wazuh scans only on its default 12-hour schedule. How long could an intruder's change go unseen, and why not watch every folder in real time?

## Explain it
- `ids-vs-ips` · Signature-based versus anomaly-based detection, and why start in alert-only mode?
- `log-pipelines` · From event to alert: where can logs be lost, delayed or forged?
- `detection-engineering` · What makes an alert actionable? True and false positives and negatives.

## Interview story
"Tell me about a detection you built." The scan you ran in M1, caught by Suricata, visible in Grafana within seconds; the custom SSH alert you fired on purpose; the brute force CrowdSec banned on its own; and the week of tuning that cut the noise.

## Exit criteria
- [ ] Logs from every source searchable in one place
- [ ] Suricata alert for your scan visible in Grafana
- [ ] One custom detection triggered on purpose and delivered to you
- [ ] Incident report merged
- [ ] Five phishing write-ups merged
- [ ] One detection working in both Grafana and Splunk
- [ ] CrowdSec bans a brute force from the lab, and a scenario of your own passes its test
- [ ] Suricata drops a test request in IPS mode, and CrowdSec on OPNsense cuts off a banned lab VM
- [ ] Wazuh agents on a Windows and a Linux VM report in, and a file integrity alert fired on purpose
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
