#!/usr/bin/env bash
# Remove a skill do Fluxoorg do Claude Code e do Codex.
# Apaga apenas pastas cujo SKILL.md se chama "fluxoorg". Use --all para remover também
# ~/Fluxoorg/fluxoorg.html (os fluxos que você salvou nessa pasta ficam).
#   curl -fsSL https://raw.githubusercontent.com/carlos-dataengineer/fluxoorg/main/uninstall.sh | bash
set -euo pipefail
ALL="${FLUXOORG_UNINSTALL_ALL:-0}"
[ "${1:-}" = "--all" ] && ALL=1
for t in "$HOME/.claude/skills/fluxoorg" "${CODEX_HOME:-$HOME/.codex}/skills/fluxoorg" "$HOME/.agents/skills/fluxoorg"; do
  if [ -f "$t/SKILL.md" ] && grep -Eq '^name:[[:space:]]*fluxoorg[[:space:]]*$' "$t/SKILL.md"; then
    rm -rf "$t"; echo "  removido: $t"
  fi
done
APP="$HOME/Fluxoorg/fluxoorg.html"
if [ "$ALL" = "1" ] && [ -f "$APP" ]; then
  rm -f "$APP"; rmdir "$HOME/Fluxoorg" 2>/dev/null || true; echo "  removido: $APP"
elif [ -f "$APP" ]; then
  echo "  mantido: $APP (use --all para remover)"
fi
echo "  Fluxoorg desinstalado."
