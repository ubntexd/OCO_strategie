#!/bin/bash
# Enchaîne B.4 → B.7 avec pipeline automatique + preuves
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
    --agent coworker-1 \
    --module B \
    --task "$task" \
    --message "$task implémenté CD" \
    --files-changed "[\"$task\",\"$testfile\"]" \
    --doc-ref "$ref" \
    --next-task "$next"
}

run_task "src/atr.js" "CD §4.6" "src/regime.js"
run_task "src/regime.js" "CD §4.7" "src/correlation.js"
run_task "src/correlation.js" "CD §4.8" "src/protection.js"
run_task "src/protection.js" "CD §4.12" "MODULE_A"

echo ""
echo "========== MODULE B TERMINÉ =========="
