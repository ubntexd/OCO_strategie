#!/bin/bash
cd /home/dev/dev/OCO_strategie
source .env.shared
curl -s -m 120 -X POST "http://127.0.0.1:4099/execute" \
  -H "Content-Type: application/json" \
  -H "x-worker-token: ${RESTART_SECRET}" \
  -d '{"instruction":"Reply only with the word pong","async":false}'
