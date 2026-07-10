#!/bin/bash
# SESSION CLAUDE CODE PERMANENTE — ROHAN BotTrader v1.0
# Usage : ./scripts/claude-session.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f ".env.shared" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.shared"
  set +a
fi

echo "=== SESSION CLAUDE CODE — BotTrader v1.0 ==="
echo "Repo : $PROJECT_ROOT"
echo "API  : ${ANTHROPIC_API_KEY:0:15}..."
echo "Node : $(node --version)"
echo "Tests: $(npm test -- --passWithNoTests 2>&1 | tail -1)"
echo "Git  : $(git log --oneline -1 2>/dev/null || echo 'no commits')"
echo "============================================="
echo ""
echo "Claude Code est prêt. Tu peux lui parler directement en français."
echo ""

claude \
  --add-dir "$PROJECT_ROOT" \
  --dangerously-skip-permissions \
  --system "Tu travailles sur BotTrader v1.0 de ROHAN Innovation.
Repo : $PROJECT_ROOT.
CDC v1.1 disponible dans docs/.
Règles absolues :
- npm test avant tout commit (0 test en échec obligatoire)
- git commit après chaque livrable validé
- Zéro intervention humaine
- Respecter strictement le CDC/CD
- Logger avec winston, jamais console.log
- CommonJS uniquement (require)
Priorités actuelles :
1. git add -A && git commit (code non commité détecté)
2. TRADING_HOURS remettre 08:00-22:00
3. Fix bug logTradeOpen avant placeEntry
4. Fix WF3 — ajouter Stop ETH + SOL
5. Fix backtest.js — Sharpe annualisé √252 + Sortino"
