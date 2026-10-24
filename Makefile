.DEFAULT_GOAL := help
SHELL := bash
.SHELLFLAGS := -euo pipefail -c
PRE_COMMIT := uvx pre-commit@4.6.2

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-14s %s\n", $$1, $$2}'

setup: ## Install the tools and the git hooks
	uv sync --frozen
	$(PRE_COMMIT) install --install-hooks

status: ## Show the current milestone and the next rep
	uv run --frozen roadmap status

build: ## Rebuild site/index.html and the README scoreboard
	uv run --frozen roadmap build

preview: build ## Serve the showcase page on http://localhost:8000 (this machine only)
	uv run --frozen python -m http.server 8000 --bind 127.0.0.1 --directory site

lint: ## Run every pre-commit hook on all files
	SKIP=no-commit-to-branch $(PRE_COMMIT) run --all-files --show-diff-on-failure

test: ## Types and tests with coverage
	uv run --frozen mypy
	uv run --frozen pytest --cov

check: lint test ## Everything CI runs, except the network scans
	uv run --frozen roadmap check
	uv run --frozen roadmap build --check

scan: ## Code and dependency scans (needs network)
	bash scripts/scan.sh

update-hooks: ## Bump hook revs. Adopt a release only once it is two weeks old.
	$(PRE_COMMIT) autoupdate

.PHONY: help setup status build preview lint test check scan update-hooks
