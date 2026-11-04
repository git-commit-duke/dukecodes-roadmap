# M5 Detection

**Build:** Mission Control → Monitoring & power · Phase 2: OPNsense router + VLANs
**Proof:** A Suricata alert for your own M1 scan, visible in Grafana, a custom detection you triggered on purpose, and an incident write-up
**Cert gate:** CompTIA Security+
**Careful:** A bouncer blocks addresses at the firewall, yours included. Before you turn one on, allowlist the address you manage the VM from, and keep `cscli decisions delete -i <address>` ready as the undo.
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

## Break it
- Stop the log shipper on one node. Do you get an alert that its logs stopped? If not, build one: silence is a classic gap.
- Send a lab mailbox a message with a spoofed From address. Does your header analysis catch it from the DMARC result alone?
- Run the brute force before you change any CrowdSec setting. If no alert fires, use `cscli explain` on the log to find which stage dropped the event and why. Change only what the lab needs.

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
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
