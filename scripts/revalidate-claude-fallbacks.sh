#!/bin/bash
# Re-valide via Claude API les tâches précédemment passées en rule_fallback
set -e
cd /home/dev/dev/OCO_strategie
RUN=./scripts/run-pipeline.sh

revalidate() {
  local agent=$1 module=$2 task=$3 ref=$4 next=$5 testfile
  testfile=${task//src\//tests\/unit/}
  testfile=${testfile/.js/.test.js}
  echo ""
  echo "========== RE-VALIDATION CLAUDE $task =========="
  $RUN \
    --agent "$agent" \
    --module "$module" \
    --task "$task" \
    --message "Re-validation Claude API obligatoire" \
    --files-changed "[\"$task\",\"$testfile\"]" \
    --doc-ref "$ref" \
    --next-task "$next"
}

revalidate coworker-1 B src/atr.js "CD §4.6" src/regime.js
revalidate coworker-1 B src/correlation.js "CD §4.8" src/protection.js
revalidate coworker-1 B src/journal.js "CD §4.5" src/atr.js

echo ""
echo "========== RE-VALIDATIONS TERMINÉES =========="
