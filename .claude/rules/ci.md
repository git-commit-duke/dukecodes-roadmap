---
paths: [".github/**"]
---
# GitHub Actions
- Pin every action by full commit SHA with a `# vX.Y.Z` comment. Verify the SHA matches the release tag.
- Workflow default `permissions: contents: read`. Grant more per job, only what that job needs.
- `actions/checkout` with `persist-credentials: false`.
- Never interpolate `${{ github.event.* }}` into `run:`. Pass through `env:` and quote.
- No `pull_request_target` unless reviewed in an ADR.
- zizmor and actionlint must pass.
