#!/bin/bash
# Exécute pipeline-task avec env VPS
set -e
cd /home/dev/dev/OCO_strategie
set -a
. ./.env.shared
set +a
export POSTGRES_URL="postgresql://bot:${POSTGRES_PASSWORD}@127.0.0.1:5435/bot_trading"
exec node scripts/pipeline-task.js "$@"
