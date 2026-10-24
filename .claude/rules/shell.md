---
paths: ["**/*.sh", "Makefile"]
---
# Shell
- `set -euo pipefail`. Quote every expansion. shellcheck clean.
- Never `curl | sh`. Download, read, checksum, then run.
- Scripts that change infra print what they will do and need an explicit flag (`--apply`). Default is dry run.
