# M4 Identity & secrets

**Build:** Mission Control → Remote access · Learning lab
**Proof:** A Tailscale access policy in git with tests that run on every pull request, and secrets that only exist in git as ciphertext
**Cert gate:** none
**Careful:** Build the hand-made WireGuard tunnel between two lab VMs only, never on a node you reach over the tailnet: a wrong `AllowedIPs` can route your own SSH session into the tunnel. The undo is `wg-quick down wg0`.
**In plain words:** Control who can reach what by identity rather than by network location, and keep passwords and keys encrypted everywhere.

## Why (first principles)
Most breaches use valid credentials. Access based on identity (which person, on which device, to which port) beats access based on network location. Secrets are credentials at rest: if one exists in plaintext anywhere it can be copied, it will eventually leak.

## Reps
- [ ] M4-R1 · Put the tailnet policy in git so it matches the live policy (after you decide the three pending changes) · done when: the file in git and the live policy are identical
- [ ] M4-R2 · Add tests to the policy: cases that must be allowed and cases that must be denied · done when: widening a grant makes a test fail
- [ ] M4-R3 · Run the policy through CI: test on pull requests, apply on main, using an OAuth client scoped to the policy only and stored as a GitHub secret · done when: a merged pull request shows up in Tailscale's configuration log
- [ ] M4-R4 · Encrypt one real secret file with SOPS and age · done when: git holds only ciphertext and your age key is backed up offline
- [ ] M4-R5 · Write a secrets inventory with names only, never values · done when: each secret lists where it lives, who can read it and how to rotate it
- [ ] M4-R6 · Rotate one secret end to end · done when: the old value is revoked and proven dead
- [ ] M4-R7 · Build an Active Directory lab: a Windows Server VM on Proxmox running AD DS, two OUs, three GPOs (password policy, USB storage block, desktop lockdown) and one domain-joined client, all provisioned by a PowerShell script in git · done when: a rebuild from the script alone gives the same domain, and `gpresult /r` on the client shows all three GPOs
- [ ] M4-R8 · Manage a device from the cloud: an Entra ID trial or developer tenant with one enrolled VM in Intune, a compliance policy, and Conditional Access that requires MFA · done when: a sign-in from the non-compliant VM is blocked and the sign-in log shows which policy blocked it
- [ ] M4-R9 · Build a WireGuard tunnel by hand between two lab VMs, so you see what Tailscale automates: a key pair per VM from `wg genkey`, a config per side, `wg-quick up`, and the private keys kept out of git · done when: `wg show` lists a recent handshake on both ends and a ping crosses the tunnel, and after you replace one VM's keys the tunnel stays down until the other VM has the new public key

## Break it
- From a device the policy should not allow, try to reach a node. It must be refused.
- Scan the full history of every repo with gitleaks. Zero findings, or you rotate what it finds.
- On the domain-joined client, try to override a GPO as a standard user. The next policy refresh must put it back.

## Explain it
- `authn-vs-authz` · Identity, authentication and authorization: where does Tailscale do each?
- `wireguard-and-tailscale` · What does a WireGuard key pair prove, and what does the coordination server know?
- `envelope-encryption` · How does SOPS encrypt a file with age, and what happens if you lose the key?

## Interview story
"How do you manage access and secrets?" Access policy as code with tests, so a too-wide grant fails review; secrets encrypted in git, inventoried, and one rotated end to end as proof the process works.

## Exit criteria
- [ ] Policy in git with allow and deny tests, applied through CI
- [ ] At least one secret encrypted with SOPS and age, key backed up offline
- [ ] Secrets inventory merged and one secret rotated
- [ ] AD lab rebuilt from its script, with three GPOs applied to a domain-joined client
- [ ] Intune compliance and Conditional Access block a non-compliant sign-in
- [ ] A WireGuard tunnel built by hand between two lab VMs, and one key pair replaced
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
