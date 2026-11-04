---
paths: ["**/*.sh", "Makefile"]
---
# Shell
Desktop only: cloud threads skip path-scoped rules like this one. CLAUDE.md repeats the lines that must hold everywhere.
- `set -euo pipefail`. Quote every expansion. shellcheck clean.
- Never `curl | sh`. Download, read, checksum, then run.
- Scripts that change infra print what they will do and need an explicit flag (`--apply`). Default is dry run.
