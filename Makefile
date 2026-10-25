.DEFAULT_GOAL := help
SHELL := bash
.SHELLFLAGS := -euo pipefail -c

# Release cooldown for tools run with uvx (uvx ignores pyproject.toml settings).
# Keep it equal to [tool.uv] exclude-newer and .github/dependabot.yml; tests/test_policy.py checks.
COOLDOWN := 7 days
UVX := UV_EXCLUDE_NEWER="$(COOLDOWN)" uvx
PRE_COMMIT := $(UVX) pre-commit@4.7.0

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'

setup: ## Install the tools and the git hooks
	uv sync --locked
	$(PRE_COMMIT) install --install-hooks

status: ## Show the current milestone and the next rep
	uv run --frozen roadmap status

build: ## Rebuild the page data (site/roadmap.json) and the README scoreboard
	uv run --frozen roadmap build

preview: build ## Serve the page on this machine only: http://127.0.0.1:8000
	uv run --frozen python -m http.server 8000 --bind 127.0.0.1 --directory site

lint: ## Run every pre-commit hook on all files (the main-branch guard only runs on commit)
	SKIP=no-commit-to-branch $(PRE_COMMIT) run --all-files --show-diff-on-failure

typecheck: ## Type-check src, tests and scripts (mypy strict)
	uv run --frozen mypy

test: ## Tests with coverage
	uv run --frozen pytest --cov

site-check: ## Check the page: lock hashes, CSP, script sinks, contrast
	uv run --frozen python scripts/check_site.py

site-tokens: ## Rebuild site/ds/tokens.css from site/ds/tokens.json
	uv run --frozen python scripts/ds_tokens.py site/ds/tokens.json site/ds/tokens.css

secrets-history: ## Scan every commit in the git history for secrets (gitleaks)
	$(PRE_COMMIT) run --hook-stage manual gitleaks-history --all-files

check: lint typecheck test secrets-history ## Everything CI runs, except the network scans
	uv run --frozen roadmap check
	uv run --frozen roadmap build --check

scan: ## Code and dependency scans (needs network)
	UV_EXCLUDE_NEWER="$(COOLDOWN)" bash scripts/scan.sh

.PHONY: help setup status build preview lint typecheck test site-check site-tokens secrets-history check scan
