#!/bin/bash
# Enchaîne Module C C.1 → C.4 avec pipeline automatique + preuves
set -e
cd /home/dev/dev/OCO_strategie
RUN=./scripts/run-pipeline.sh

run_task() {
  local task=$1
  local ref=$2
  local next=$3
  local testfile
  case "$task" in
    n8n/workflows) testfile="tests/unit/n8n-workflows.test.js" ;;
    mcp/server.js) testfile="tests/unit/mcp.test.js" ;;
    dashboard/server.js) testfile="tests/unit/dashboard.test.js" ;;
    dashboard/api/backtest.js) testfile="tests/unit/backtest.test.js" ;;
    *) testfile="${task//src\//tests\/unit/}"; testfile="${testfile/.js/.test.js}" ;;
  esac
  echo ""
  echo "========== PIPELINE $task =========="
  $RUN \
    --agent coworker-3 \
    --module C \
    --task "$task" \
    --message "$task implémenté CD" \
    --files-changed "[\"$task\",\"$testfile\"]" \
    --doc-ref "$ref" \
    --next-task "$next"
}

run_task "n8n/workflows" "CD §8.7" "dashboard/server.js"
run_task "dashboard/server.js" "CD §6" "mcp/server.js"
run_task "mcp/server.js" "CD §6.3" "dashboard/api/backtest.js"
run_task "dashboard/api/backtest.js" "CD §6" "PIPELINE_VALIDATION"

echo ""
echo "========== MODULE C TERMINÉ =========="
