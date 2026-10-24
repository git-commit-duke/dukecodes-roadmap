# M7 Kubernetes security

**Build:** Mission Control → Learning lab (Kubernetes with k3s on dev)
**Proof:** A kube-bench report before and after hardening, admission policies that reject a privileged pod, and a Falco alert for a shell opened inside a container
**Cert gate:** CKA, then CKS
**In plain words:** Run containers on a small Kubernetes cluster, set rules that refuse unsafe ones, and get an alert when someone opens a shell inside one.

## Why (first principles)
Kubernetes runs many workloads on shared machines, so one badly configured pod can become a foothold on the node underneath. Security comes in layers: who may call the API (RBAC), what a pod may ask for (admission policy), which pods may talk to each other (network policy), and what to watch while it runs (runtime detection). Each layer assumes the one before it can fail.

## Reps
- [ ] M7-R1 · Install k3s on the dev node from the Learning lab chapter · done when: `kubectl get nodes` shows Ready and you can explain what each control-plane part does
- [ ] M7-R2 · Run kube-bench and save the report · done when: the baseline is in `evidence/` and you have picked the five findings to fix first
- [ ] M7-R3 · Give each app its own namespace, service account and a Role with only what it needs · done when: `kubectl auth can-i` proves the account cannot read Secrets outside its namespace
- [ ] M7-R4 · Enforce Pod Security Admission at `restricted`, then add Kyverno policies: no privileged pods, no `latest` tags, only images you signed in M6 · done when: each bad pod is rejected with a clear message
- [ ] M7-R5 · Add a default-deny NetworkPolicy, then allow only the flows each app needs · done when: a test pod proves a blocked connection really fails
- [ ] M7-R6 · Run Falco and send its alerts into the M5 pipeline · done when: `kubectl exec` into a pod raises an alert you can see in Grafana
- [ ] M7-R7 · Re-run kube-bench · done when: a before/after table explains every remaining finding

## Break it
- Try to deploy a privileged pod, a pod that mounts the host's filesystem, and a pod with an unsigned image. All three must be rejected.
- Check that the cluster's network plugin enforces NetworkPolicy before you rely on it. A policy that is accepted but not enforced is worse than none, because you think you are protected.

## Explain it
- `container-isolation` · Namespaces and cgroups: what isolates a container, and why is a container not a virtual machine?
- `kubernetes-rbac` · Users, service accounts, Roles and bindings: how does the API server decide yes or no?
- `admission-control` · Where does an admission controller sit in a request, and what can it see and change?

## Interview story
"How would you secure a Kubernetes cluster?" Layers, each with proof: kube-bench numbers before and after, a privileged pod refused by policy, a default-deny network tested from inside the cluster, and a Falco alert for a shell you opened yourself.

## Exit criteria
- [ ] kube-bench before/after table with every remaining finding explained
- [ ] Privileged, `latest`-tagged and unsigned pods rejected by admission policy
- [ ] Default-deny NetworkPolicy tested, not assumed
- [ ] Falco alert for a shell in a container visible in Grafana
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
