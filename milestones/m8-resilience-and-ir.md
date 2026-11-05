# M8 Resilience & IR

**Build:** Mission Control → Backups · Maintenance & incidents
**Proof:** A timed restore drill measured against written targets, an incident runbook, and a postmortem of an attack you simulated in the lab
**Cert gate:** none
**Careful:** Run attack simulations only on lab VMs you own, never on the home network. A VulnHub VM comes from a stranger, so import it only into the isolated lab. Connect to Hack The Box's VPN only from a lab VM, never your own laptop, and publish write-ups only for retired machines, as its rules require.
**In plain words:** Prove you can get everything back after a disaster, and practise what to do if you get hacked, before it happens for real.

## Why (first principles)
A backup you have never restored is a hope, not a control. Ransomware goes after backups first, so two questions matter: can an attacker on one machine delete the backups, and how long does a full recovery really take? Incident response works the same way: under stress you do what you have practised, so you practise.

## Reps
- [ ] M8-R1 · Write an RPO/RTO table for each service: how much data you can afford to lose and how long it can be down · done when: every target has a reason, not only a number
- [ ] M8-R2 · Restore a VM from Proxmox Backup Server onto a different node and time it · done when: the measured time sits in the ledger next to its target
- [ ] M8-R3 · Restore from the second copy (the USB disk or the offsite copy) with the main backup server switched off · done when: the restore works without it
- [ ] M8-R4 · Check whether the backup credential on a node can delete or overwrite backups · done when: an ADR records the answer and, if yes, the fix
- [ ] M8-R5 · Write an incident runbook from the Maintenance & incidents chapter: detect, contain, eradicate, recover, learn · done when: someone else could follow it from page one
- [ ] M8-R6 · Run one Atomic Red Team test in the DevSec lab, then write a blameless postmortem with [the template](../templates/incident-report.md) · done when: it says whether M5 detected the test, how fast, and what you changed
- [ ] M8-R7 · Break into a deliberately vulnerable capture-the-flag (CTF) machine from a lab attack VM: a VulnHub VM imported into the isolated lab, where your M5 detections can watch, or a retired Hack The Box machine over its VPN · done when: a write-up maps each step to an ATT&CK technique and, for a lab VM, says which steps M5 caught and which it missed

## Break it
- Tabletop: a node shows signs of compromise at 2 a.m. Walk the runbook out loud and time each decision.
- Delete a test file, then restore it from last night's backup. How far back could you really go?
- After M8-R7, ask whether Suricata saw the attack at all. Trace the path the packets took from the attack VM to the target, and check whether your sensor sits on it.

## Explain it
- `rpo-rto-and-3-2-1` · What do RPO and RTO mean, and why does a 3-2-1 backup need one copy that is offline or cannot be changed?
- `incident-lifecycle` · Walk through detect, contain, eradicate, recover and learn. Which step do people skip, and what does that cost?
- `mitre-attack` · How does MITRE ATT&CK describe an attack, and how do you use it to find gaps in your detections?

## Interview story
"Tell me about a time something went wrong." A restore drill with measured times against written targets, what you found when you checked whether the backup credential could delete backups, and a postmortem of a simulated attack mapped to ATT&CK.

## Exit criteria
- [ ] RPO/RTO table merged with measured restore times
- [ ] Restore from the second copy proven without the main backup server
- [ ] Backup credential checked and an ADR merged
- [ ] Incident runbook and one postmortem merged
- [ ] One vulnerable machine broken into and written up, each step mapped to ATT&CK
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
