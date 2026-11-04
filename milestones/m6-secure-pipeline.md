# M6 Secure pipeline

**Build:** Mission Control → Learning lab (Git hosting and CI with Forgejo on dev)
**Proof:** A pipeline that blocks a pull request adding a known-vulnerable dependency, and a container image that is signed and ships with an SBOM anyone can verify
**Cert gate:** none
**In plain words:** Make the build system check your code and its ingredients for known problems on every change, and stamp what it produces so nobody can swap it later.

## Why (first principles)
Attackers increasingly skip your code and go after the build: a poisoned dependency, a leaked CI token, an image swapped after it was tested. A secure pipeline checks code, dependencies and configuration on every change, runs with as little access as possible, and signs what it builds so anyone can check where it came from.

## Reps
- [ ] M6-R1 · Write a small FastAPI app with tests in `homelab-lab`, and pin one dependency to a version with a known CVE on purpose · done when: the app runs locally and you can name the CVE and what it allows
- [ ] M6-R2 · Run Forgejo Actions on a runner VM of its own, never with the host's Docker socket mounted · done when: an ADR says what a malicious job on that runner could still reach
- [ ] M6-R3 · Add gates that fail the build on high findings: Semgrep for code, Trivy for dependencies and the image, gitleaks for secrets · done when: the planted CVE fails the pipeline and the upgrade makes it pass
- [ ] M6-R4 · Generate an SBOM with Syft for every image · done when: you can answer "do we ship library X, and which version?" from the SBOM alone
- [ ] M6-R5 · Sign the image with cosign and verify the signature before every deploy · done when: an unsigned or modified image is refused
- [ ] M6-R6 · Harden the pipeline itself: actions pinned by commit SHA, tokens with the least access, zizmor on the workflow files · done when: zizmor reports nothing you have not explained in writing
- [ ] M6-R7 · Mirror the app to a public GitHub repo with the same gates · done when: its README shows the passing pipeline and links the SBOM
- [ ] M6-R8 · Add a ZAP baseline scan of the running app to the pipeline · done when: a missing security header fails the scan and adding it makes the scan pass
- [ ] M6-R9 · Put the CrowdSec WAF in front of the M6 app through a web server whose bouncer supports it, with the OWASP CRS rules blocking in-band (CrowdSec Academy: Securing your applications with the CrowdSec WAF) · done when: a SQL injection request gets a 403 and shows in `cscli alerts list`, while a normal request still gets a 200

## Break it
- Add a fake secret to CI, then open a pull request that tries to print it in the log. Masking should hide it. Then write down why masking alone is not a control.
- Change one byte of the image after signing and run the verification. It must fail.
- From a fork, open a pull request that edits the workflow. Your secrets must not be available to it.
- Send the same SQL injection URL-encoded twice, or split across two parameters. Does the WAF still block it? Write down what got through.

## Explain it
- `sast-sca-dast` · What does each kind of scan find, what does each miss, and where in the pipeline does it belong?
- `sbom-and-signing` · What does an SBOM prove, what does a signature prove, and what does neither prove?
- `ci-supply-chain` · Name three ways into a pipeline that never touch your code, and the control for each.

## Interview story
"How do you secure a CI/CD pipeline?" A gate that blocked a real CVE before merge, images signed at build and verified at deploy, an SBOM for every build, and the pipeline's own attack surface (runner isolation, pinned actions, scoped tokens) reviewed like application code.

## Exit criteria
- [ ] Pipeline blocks the planted vulnerable dependency and passes after the upgrade
- [ ] Every image has an SBOM and a signature verified before deploy
- [ ] Runner isolation ADR merged; zizmor clean or every finding explained
- [ ] Public mirror with passing gates
- [ ] ZAP baseline scan in the pipeline, failing then passing
- [ ] The CrowdSec WAF blocks a test attack and lets normal requests through
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
