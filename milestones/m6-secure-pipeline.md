# M6 Secure pipeline

**Build:** Mission Control → Learning lab (Git hosting and CI with Forgejo on dev)
**Proof:** A pipeline that blocks a pull request adding a known-vulnerable dependency, and a container image that is signed and ships with an SBOM anyone can verify
**Cert gate:** none
**In plain words:** Make the build system check your code and its ingredients for known problems on every change, and stamp what it produces so nobody can swap it later.

## Why (first principles)
Attackers increasingly skip your code and go after the build: a poisoned dependency, a leaked CI token, an image swapped after it was tested. A secure pipeline checks code, dependencies and configuration on every change, runs with as little access as possible, and signs what it builds so anyone can check where it came from. Scanners only find what someone taught them to look for, so exploit a bug by hand once, then turn it into a rule. And ship an image that holds only the app and runs with as few rights as possible.

## Reps
- [ ] M6-R1 · Write a small FastAPI app with tests in `homelab-lab`, and pin one dependency to a version with a known CVE on purpose · done when: the app runs locally and you can name the CVE and what it allows
- [ ] M6-R2 · Run Forgejo Actions on a runner VM of its own, never with the host's Docker socket mounted · done when: an ADR says what a malicious job on that runner could still reach
- [ ] M6-R3 · Add gates that fail the build on high findings: Semgrep for code, Trivy for dependencies and the image, gitleaks for secrets · done when: the planted CVE fails the pipeline and the upgrade makes it pass
- [ ] M6-R4 · Generate an SBOM with Syft for every image · done when: you can answer "do we ship library X, and which version?" from the SBOM alone
- [ ] M6-R5 · Sign the image with cosign and verify the signature before every deploy · done when: an unsigned or modified image is refused
- [ ] M6-R6 · Harden the pipeline itself: actions pinned by commit SHA, tokens with the least access, zizmor on the workflow files · done when: zizmor reports nothing you have not explained in writing
- [ ] M6-R7 · Mirror the app to a public GitHub repo with the same gates · done when: its README shows the passing pipeline and links the SBOM
- [ ] M6-R8 · Add an OWASP ZAP baseline scan of the running app to the pipeline · done when: a missing security header fails the scan and adding it makes the scan pass
- [ ] M6-R9 · Find web bugs by hand, then teach CI to catch them: solve the Apprentice SQL injection and access control labs in the [PortSwigger Web Security Academy](https://portswigger.net/web-security/all-labs) with Burp Suite Community Edition, exploit the same two bugs in Juice Shop or DVWA in the lab, then plant the SQL injection in your M6 app and write a Semgrep rule for it · done when: your notes show the request that worked against each bug, and your rule fails CI on the planted bug and passes once a parameterized query fixes it
- [ ] M6-R10 · Write the M6 app's Dockerfile yourself and harden it: a multi-stage build, a non-root `USER`, the base image pinned by digest and no secrets in any layer · done when: the app runs with `--read-only --cap-drop ALL`, `docker top` shows it running as a non-root user, and `trivy config` reports nothing on the Dockerfile you have not explained in writing

## Break it
- Add a fake secret to CI, then open a pull request that tries to print it in the log. Masking should hide it. Then write down why masking alone is not a control.
- Change one byte of the image after signing and run the verification. It must fail.
- From a fork, open a pull request that edits the workflow. Your secrets must not be available to it.
- Rewrite your planted query three ways: an f-string, `%` formatting, and a string built in a helper function. Which ones does your Semgrep rule miss? Fix the rule, or write down what it still misses and why.
- Copy a fake `.env` into the image in one step and delete it in the next. Is it gone? `docker save` the image, unpack the layers and look. Then find the way to hand a build a secret without baking it into a layer.

## Explain it
- `sast-sca-dast` · What does each kind of scan find, what does each miss, and where in the pipeline does it belong?
- `sbom-and-signing` · What does an SBOM prove, what does a signature prove, and what does neither prove?
- `ci-supply-chain` · Name three ways into a pipeline that never touch your code, and the control for each.
- `sql-injection` · Why does a parameterized query stop SQL injection when escaping and input filters keep failing?
- `container-hardening` · What does each of these stop: a non-root user, a read-only filesystem, dropped capabilities, a digest pin? What can an attacker who gets into the container still do?

## Interview story
"How do you secure a CI/CD pipeline?" A gate that blocked a real CVE before merge, images signed at build and verified at deploy, an SBOM for every build, and the pipeline's own attack surface (runner isolation, pinned actions, scoped tokens) reviewed like application code. "How do you stop SQL injection?" The one you exploited by hand, the Semgrep rule that now blocks it in CI, and the parameterized query that fixed it.

## Exit criteria
- [ ] Pipeline blocks the planted vulnerable dependency and passes after the upgrade
- [ ] Every image has an SBOM and a signature verified before deploy
- [ ] Runner isolation ADR merged; zizmor clean or every finding explained
- [ ] Public mirror with passing gates
- [ ] ZAP baseline scan in the pipeline, failing then passing
- [ ] SQL injection exploited by hand, then caught by your own Semgrep rule in CI and fixed with a parameterized query
- [ ] The app image runs as a non-root user with a read-only filesystem and no capabilities; `trivy config` clean or every finding explained
- [ ] Five concept explainers written and reviewed
- [ ] A ledger row for every proof
