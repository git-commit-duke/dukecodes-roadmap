# M9 Cloud mirror

**Build:** Beyond Mission Control (an AWS account you create)
**Proof:** A Terraform baseline for a new AWS account, a Prowler report before and after, and the M6 app deployed through a GitHub OIDC role with no stored keys
**Cert gate:** AWS Solutions Architect – Associate (AWS Security – Specialty later)
**Careful:** Cloud costs real money. Set the budget alarm before anything else, and tear everything down when you finish. Sign up with "Sign up for AWS (advanced)": the newer sign-up creates no root user, so M9-R1 can't be done in it. Identity Center (M9-R2) needs an AWS Organization, and creating one ends the free plan and its credits at once, so do M9-R2 after you have used the credits you need. Some things bill by the hour even when idle: an EKS cluster at $0.10 an hour, a NAT gateway at $0.045 an hour plus data, a public IPv4 address at $0.005 an hour and a KMS key at $1 a month (AWS pricing pages, checked 2026-11-04). CloudGoat and the Cloud Resume Challenge can create them, so destroy everything after each session and check the console.
**In plain words:** Rebuild the same security habits in the cloud, where most of these jobs are, and prove the account is locked down with a scanner.

## Why (first principles)
Most DevSecOps jobs run on a cloud provider. The ideas carry over from the lab (identity, segmentation, logging, least privilege), but the shared responsibility model moves the line: the provider secures the hardware and the platform, you secure everything you configure. Most cloud breaches are configuration mistakes, so you prove the configuration.

## Reps
- [ ] M9-R1 · Create an AWS account and lock the root user: MFA on, no access keys, a budget alarm set low · done when: root is for emergencies only and the alarm has emailed you once as a test
- [ ] M9-R2 · Set up IAM Identity Center for your daily login · done when: day-to-day work uses neither root nor a long-lived access key
- [ ] M9-R3 · Write Terraform for the baseline in `homelab-cloud`: CloudTrail in every region, account-level S3 Block Public Access, and a GitHub OIDC role for deploys · done when: `terraform plan` is clean and CI applies it
- [ ] M9-R4 · Run Prowler before and after the baseline · done when: a before/after table explains every remaining high finding
- [ ] M9-R5 · Deploy the signed M6 image through the OIDC role · done when: the pipeline runs with no AWS keys stored anywhere
- [ ] M9-R6 · Tear it all down and check the bill · done when: `terraform destroy` is clean and the cost is in the ledger

## Break it
- Try to make an S3 bucket public. Block Public Access must refuse.
- Try to assume the deploy role from another repo or branch. The role's trust policy must refuse.

## Explain it
- `shared-responsibility` · What does AWS secure, what do you secure, and where do people draw the line wrong?
- `iam-policy-evaluation` · When several policies apply, how does AWS decide allow or deny?
- `oidc-federation` · How does a CI job get cloud access without a stored key, and what stops another repo doing the same?

## Interview story
"How would you secure a new AWS account?" A Terraform baseline applied from CI, Prowler numbers before and after, a deploy role only your main branch can assume, and a bill that proves you cleaned up.

## Exit criteria
- [ ] Root locked, Identity Center in daily use, budget alarm tested
- [ ] Baseline applied from CI with Terraform
- [ ] Prowler before/after table with every remaining high finding explained
- [ ] M6 image deployed through OIDC with no stored keys, then torn down
- [ ] Three concept explainers written and reviewed
- [ ] A ledger row for every proof
