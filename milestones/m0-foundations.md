# M0 Foundations

**Build:** Mission Control → Start here: reality check · Before you start · Rack & power
**Proof:** A `homelab-iac` repo with a threat model, two decision records and a secret-scanning gate that provably blocks a planted key
**Cert gate:** none
**In plain words:** Set up one safe way to manage everything, write down what you are protecting and from whom, and make your code repository refuse secrets.

## Why (first principles)
Every later control rests on two things: an admin identity an attacker can't borrow, and a written model of what you defend and from whom. Without the model, security work is guesswork. Without signed, scanned commits, the repository that will hold your whole infrastructure becomes the easiest way in.

## Reps
- [ ] M0-R1 · Rate yourself in [skills-matrix.md](../skills-matrix.md) · done when: every row has a score from 0 to 3
- [ ] M0-R2 · Code-read this repo's [checker](../src/dukecodes_roadmap/checks.py) and [CI workflow](../.github/workflows/ci.yml) · done when: a lab report says in one line each what every CI step defends against
- [ ] M0-R3 · Create the private `homelab-iac` repo from `dukecodes-project-template` · done when: the first pull request is green
- [ ] M0-R4 · Sign your commits with an SSH key · done when: GitHub shows Verified on a commit
- [ ] M0-R5 · Install the pre-commit hooks · done when: `pre-commit run --all-files` passes
- [ ] M0-R6 · Write threat model v1 with [the template](../templates/threat-model.md) · done when: assets, trust boundaries and five threats are listed, each with a STRIDE letter and a mitigation or "accepted"
- [ ] M0-R7 · Write ADR-0001 "Why Proxmox" and ADR-0002 "Why Tailscale instead of port forwarding" · done when: both are merged
- [ ] M0-R8 · Inventory the hardware from the reality-check chapter · done when: `inventory.md` lists all five nodes and the network gear, with unknowns marked

## Break it
- On a throwaway branch, commit a fake key built from string pieces, never a real one. The local hook must block it. Then commit with `--no-verify` and push: CI must still fail. Delete the branch. You have just proved defense in depth: a local gate plus a server gate.
- Pick the threat in your model with the weakest mitigation and write the first three things an attacker would do.

## Explain it
- `threat-modeling` · What is a trust boundary, and why do threats cluster at one?
- `digital-signatures` · What does a commit signature prove, and what does it not prove?
- `secrets-in-git` · Why doesn't deleting a leaked key in a new commit fix the leak?

## Interview story
"Tell me about a control you built and how you know it works." Walk through the planted key: blocked by the local hook, bypassed with `--no-verify`, caught again by CI. Name the two layers and why you need both.

## Exit criteria
- [ ] Skills baseline rated
- [ ] `homelab-iac` repo has signed commits, green CI, and a planted fake key blocked both locally and in CI
- [ ] Threat model v1 and two ADRs merged
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
