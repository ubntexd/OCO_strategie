#!/bin/bash
# PONT CURSOR ↔ CLAUDE CODE — ROHAN BotTrader v1.0
# Usage : ./scripts/claude-bridge.sh "instruction en français"

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/claude-bridge.log"
RESULT_FILE="$PROJECT_ROOT/logs/claude-bridge-result.json"

mkdir -p "$PROJECT_ROOT/logs"

if [ -f "$PROJECT_ROOT/.env.shared" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env.shared"
  set +a
fi

INSTRUCTION="${1:-}"
if [ -z "$INSTRUCTION" ]; then
  echo "Usage: $0 \"instruction en français\""
  exit 1
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERREUR : ANTHROPIC_API_KEY non définie"
  exit 1
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "[$TIMESTAMP] BRIDGE: $INSTRUCTION" >> "$LOG_FILE"

CONTEXT="Tu travailles sur le projet BotTrader v1.0 de ROHAN Innovation.
Repo : $PROJECT_ROOT
CDC : docs/CAHIER_DEVELOPPEMENT.md
Règles : zéro intervention humaine, zéro copier-coller.
Après chaque action : git add + git commit automatique.
Tests : npm test avant tout commit.
Si tests échouent : corriger et retester avant commit.

INSTRUCTION : $INSTRUCTION"

echo "$CONTEXT" | claude \
  --print \
  --dangerously-skip-permissions \
  > "$RESULT_FILE" 2>> "$LOG_FILE"

EXIT_CODE=$?
TIMESTAMP_END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "[$TIMESTAMP_END] BRIDGE OK" >> "$LOG_FILE"
  cat "$RESULT_FILE"
else
  echo "[$TIMESTAMP_END] BRIDGE FAIL exit=$EXIT_CODE" >> "$LOG_FILE"
  exit "$EXIT_CODE"
fi
