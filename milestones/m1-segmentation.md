# M1 Segmentation

**Build:** Mission Control → Network edge · Learning lab (the DevSec lab behind OPNsense)
**Proof:** A network diagram and zone matrix in git, plus scan and packet-capture evidence that the DevSec lab cannot reach the home network
**Cert gate:** none
**Careful:** Scan only from the lab, and only toward networks you own.
**In plain words:** Split the network into zones so a hacked device can only reach what it is allowed to, then prove it by attacking yourself.

## Why (first principles)
A flat network lets one compromised device talk to everything. Segmentation shrinks the blast radius: a hacked smart plug or a lab VM should reach only what a rule explicitly allows. A diagram is a claim; a failed connection attempt from the attacker's side is the proof.

## Reps
- [ ] M1-R1 · Draw today's network as code (a Mermaid diagram in `homelab-iac/docs/network.md`) · done when: it renders on GitHub and matches the Network edge chapter
- [ ] M1-R2 · Write the zone matrix for the proposed Phase 2 VLANs (10 mgmt, 20 services, 30 LAN, 40 IoT, 50 storage, 60 lab transit, 99 guest) · done when: default is deny and every allowed flow has a one-line reason
- [ ] M1-R3 · Build the DevSec lab behind OPNsense from the Learning lab chapter · done when: a lab VM gets an address from the lab range and nothing else
- [ ] M1-R4 · Scan the home network from a lab VM with nmap (host discovery, then top ports) · done when: the saved output in `evidence/` shows nothing reachable
- [ ] M1-R5 · Capture the scan with tcpdump on the OPNsense lab interface · done when: you can point at the blocked packets and say which rule dropped them
- [ ] M1-R6 · Commit sanitized config exports of the Slate 7, SG108E and OPNsense to `homelab-state` · done when: gitleaks finds nothing and no password or Wi-Fi key appears in the files

## Break it
- Try three escape routes from the lab: a direct IP to a home device, DNS queries to the home resolver, and IPv6 if it is enabled anywhere. Each must fail; record each result.
- Check the reverse direction: which home devices can open connections into the lab? Only your admin device should, if your design says so.

## Explain it
- `vlans-and-routing` · How does a packet on one VLAN reach another, and which device decides?
- `stateful-firewalls` · Why does a reply get through when an unsolicited packet does not?
- `dns-resolution` · Walk one lookup from the lab VM to the answer. Where could an attacker interfere?

## Interview story
"How would you segment a network, and how do you know it works?" Zones with default deny, each allowed flow justified, then proof from the attacker's side: nmap from the lab, the dropped packets in a capture, and the IPv6 route you remembered to test.

## Exit criteria
- [ ] Network diagram and zone matrix merged
- [ ] Lab isolation proven: nmap evidence plus packet capture, three escape routes failed
- [ ] Sanitized device configs in git with a clean secret scan
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
