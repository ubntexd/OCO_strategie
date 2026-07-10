#!/bin/bash
# Enchaîne Module A A.1 → A.4 avec pipeline automatique + preuves
set -e
cd /home/dev/dev/OCO_strategie
RUN=./scripts/run-pipeline.sh

run_task() {
  local task=$1
  local ref=$2
  local next=$3
  local testfile=${task//src\//tests\/unit/}
  testfile=${testfile/.js/.test.js}
  echo ""
  echo "========== PIPELINE $task =========="
  $RUN \
    --agent coworker-2 \
    --module A \
    --task "$task" \
    --message "$task implémenté CD" \
    --files-changed "[\"$task\",\"$testfile\"]" \
    --doc-ref "$ref" \
    --next-task "$next"
}

run_task "src/health.js" "CD §4.4" "src/order.js"
run_task "src/order.js" "CD §4.10" "src/monitor.js"
run_task "src/monitor.js" "CD §4.11" "src/signal.js"
run_task "src/signal.js" "CD §4.9" "src/bot.js"
run_task "src/bot.js" "CD §4.13" "MODULE_C"

echo ""
echo "========== MODULE A TERMINÉ =========="
