# M2 Hardened hosts

**Build:** Mission Control → Prepare the mini PCs · Install Proxmox · Secure the nodes
**Proof:** An Ansible role that hardens all five nodes, runs cleanly twice in a row, and a Lynis score before and after
**Cert gate:** LFCS (optional)
**Careful:** Change one node first, with a keyboard and screen attached. A bad SSH change can lock you out.
**In plain words:** Lock down every server the same way using code, and measure how much safer it got.

## Why (first principles)
Servers are where attackers land. Hardening by hand drifts: five machines end up with five slightly different settings, and nobody remembers why. Hardening as code is repeatable and reviewable, and a before-and-after audit turns "I hardened it" into a number someone else can check.

## Reps
- [ ] M2-R1 · Run a baseline Lynis audit on one node before any change · done when: the hardening index and warnings are saved in `evidence/`
- [ ] M2-R2 · Write an Ansible inventory for the five nodes, with no secrets in it · done when: `ansible all -m ping` succeeds (you run it)
- [ ] M2-R3 · Turn the Secure the nodes chapter into a `base-hardening` role · done when: every step you applied by hand has a task
- [ ] M2-R4 · Run the role with `--check --diff`, then on one node, then on all · done when: a second run reports `changed=0`
- [ ] M2-R5 · Add ansible-lint to CI · done when: a deliberately bad task fails the pipeline
- [ ] M2-R6 · Re-run Lynis and compare · done when: a before/after table explains every remaining warning as "fix next" or "accepted, because…"
- [ ] M2-R7 · Warm up on the command line: play OverTheWire Bandit over SSH from level 0 to the last level, noting each new command and why it worked · done when: your notes cover every level in your own words and hold no level passwords or keys, which OverTheWire's rules forbid publishing

## Break it
- From another machine, try a password SSH login. It must fail.
- Run `ss -tlnp` on each node and justify every listening port. Anything you cannot justify gets turned off.

## Explain it
- `ssh-key-authentication` · What exactly does the server check during a public-key login, and why is that stronger than a password?
- `least-privilege-linux` · Users, groups, sudo and file permissions: what does least privilege mean on one Linux host?
- `idempotence` · Why must configuration management converge, and what does a non-empty second run tell you?

## Interview story
"How do you harden Linux servers at scale?" One role in git, a check-mode dry run first, idempotence as the test, and Lynis numbers before and after, with every remaining warning explained.

## Exit criteria
- [ ] Hardening role applied to all five nodes, second run `changed=0`
- [ ] Lynis before/after table with every remaining warning explained
- [ ] ansible-lint running in CI
- [ ] Bandit finished, with notes in your own words and no level passwords
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
