---
paths: ["src/**/*.py", "tests/**/*.py", "pyproject.toml"]
---
# Python
Desktop only: cloud threads don't load path rules. CLAUDE.md repeats the lines that must hold everywhere.
- uv only: `uv add`, `uv run`. Commit `uv.lock`. No `pip install` into the system.
- Type hints on public functions. Parse input at the edge (`ipaddress`, `pathlib`, pydantic), trust it inside.
- No `shell=True`, no `eval`/`pickle` on untrusted data, `yaml.safe_load` only.
- Every bug fix ships with a test that failed before the fix.
