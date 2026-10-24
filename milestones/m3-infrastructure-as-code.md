# M3 Infrastructure as code

**Build:** Mission Control → Services (the Debian 13 VM template)
**Proof:** A Terraform module that builds a Debian 13 VM on Proxmox, a CI scan that fails on a planted misconfiguration, and a full rebuild from git
**Cert gate:** Terraform Associate (004)
**In plain words:** Create servers from code instead of clicking, so every change can be reviewed and scanned before it happens.

## Why (first principles)
Infrastructure made by clicking can't be reviewed, diffed or rebuilt. Once it is code, every change goes through the same pull request, scan and review as application code. That is where security scanning gets its leverage: a misconfiguration is caught as a failed check instead of found in production.

## Reps
- [ ] M3-R1 · Learn the Terraform loop on a local-only provider first · done when: you can explain write, plan, apply and state without notes
- [ ] M3-R2 · Create a dedicated Proxmox API token for Terraform, limited to one resource pool and never the seclab pool · done when: its permissions are recorded in an ADR and the secret lives outside git
- [ ] M3-R3 · Choose a Proxmox provider: compare the community providers' docs, maintenance and auth options · done when: an ADR records the choice (check the providers live, not old blog posts)
- [ ] M3-R4 · Write a module for one Debian 13 VM from the Mission Control template, with cloud-init and your SSH key · done when: `terraform plan` is clean and you apply it
- [ ] M3-R5 · Decide where state lives and how it is protected, since state can hold secrets · done when: an ADR is merged and `*.tfstate` is gitignored
- [ ] M3-R6 · Add fmt, validate, tflint and a Trivy config scan to CI · done when: a planted bad setting (password login in cloud-init, or an open firewall) fails the pipeline
- [ ] M3-R7 · Destroy the VM and rebuild it from git alone · done when: the rebuild time is recorded in the ledger

## Break it
- Change the VM's memory in the Proxmox web UI, then run `terraform plan`. You should see the drift.
- On a throwaway branch, commit a fake token in a `.tfvars` file. The secret scan must stop it.

## Explain it
- `infrastructure-state` · What does Terraform state hold, why is it sensitive, and what is drift?
- `iac-misconfigurations` · Name three misconfigurations a scanner catches and one it can't.
- `api-token-scoping` · Why give each tool its own token instead of your admin login?

## Interview story
"How do you keep infrastructure changes safe?" Code review plus automated policy: a planted open-firewall rule failed CI before it reached a server, the token can touch one pool only, and the VM rebuilds from git in minutes.

## Exit criteria
- [ ] Module builds a Debian 13 VM; plan is clean
- [ ] CI fails on a planted misconfiguration and passes after the fix
- [ ] ADRs for the token scope, provider choice and state storage merged
- [ ] VM destroyed and rebuilt from git, time recorded
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
