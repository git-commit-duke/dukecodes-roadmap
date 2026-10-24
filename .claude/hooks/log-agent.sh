#!/usr/bin/env bash
# SubagentStart/SubagentStop: append a one-line audit record. Never blocks.
set -uo pipefail
input=$(cat)
dir="${CLAUDE_PROJECT_DIR:-.}/.claude/audit"
mkdir -p "$dir"
printf '%s %s %s\n' "$(date -u +%FT%TZ)" \
  "$(printf '%s' "$input" | jq -r '.hook_event_name // "?"')" \
  "$(printf '%s' "$input" | jq -r '.agent_type // .subagent_type // "?"')" >> "$dir/agents.log"
exit 0
