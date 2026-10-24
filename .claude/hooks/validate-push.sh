#!/usr/bin/env bash
# PreToolUse(Bash): block pushes to main/master, warn on other publish commands.
# Exit 2 = block (stderr shown to Claude). Exit 0 = allow.
set -euo pipefail
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
case "$cmd" in
  *"git push"*)
    if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])(origin[[:space:]]+)?(main|master)([[:space:]]|$)|HEAD:(main|master)|--force|-f([[:space:]]|$)'; then
      echo "Blocked: push to main/master or force push. Open a PR from a branch instead." >&2
      exit 2
    fi
    # count positional args after "git push" (flags dropped); 2+ means an explicit refspec
    read -r -a words <<< "${cmd#*git push}"
    pos=0; for w in "${words[@]}"; do [[ "$w" == -* ]] || pos=$((pos+1)); done
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [[ "$branch" == "main" || "$branch" == "master" ]] && (( pos < 2 )); then
      echo "Blocked: 'git push' without a branch while on $branch. Push a feature branch." >&2
      exit 2
    fi ;;
  *"gh release"*|*"git tag"*)
    echo "Note: publishing command ($cmd). Confirm this is intended." >&2 ;;
esac
exit 0
