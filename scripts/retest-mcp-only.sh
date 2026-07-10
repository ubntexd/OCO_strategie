#!/bin/bash
# Fix CRLF token + retest MCP only (no token rotation)
set -e
cd /home/dev/dev/OCO_strategie
export PATH="/home/dev/.npm-global/bin:/usr/bin:/bin:$PATH"

TOKEN=$(grep '^RESTART_SECRET=' .env.shared | cut -d= -f2- | tr -d '\r\n')
sed -i "s/^RESTART_SECRET=.*/RESTART_SECRET=$TOKEN/" .env.shared
printf '%s' "$TOKEN" > /tmp/bottrader_mcp_token.txt
chmod 600 /tmp/bottrader_mcp_token.txt
mkdir -p logs
printf '%s' "$TOKEN" > logs/mcp-token.txt

docker compose --profile ops up -d --force-recreate mcp_bridge claude_worker
sleep 8

FINAL_TOKEN="$TOKEN"
BASE_URL="http://127.0.0.1:5011"
PASS=0; FAIL=0

run_test() {
  local name="$1" method="$2" endpoint="$3" body="$4" expect="$5"
  local RESP
  if [ "$method" = "GET" ]; then
    RESP=$(curl -s -H "x-mcp-token: $FINAL_TOKEN" "$BASE_URL$endpoint" 2>/dev/null)
  else
    RESP=$(curl -s -X POST -H "Content-Type: application/json" -H "x-mcp-token: $FINAL_TOKEN" -d "$body" "$BASE_URL$endpoint" 2>/dev/null)
  fi
  if echo "$RESP" | grep -q "$expect"; then
    echo "  PASS — $name"; PASS=$((PASS+1))
  else
    echo "  FAIL — $name — ${RESP:0:100}"; FAIL=$((FAIL+1))
  fi
}

run_test "health" GET "/health" "" "ok"
run_test "list_dir" POST "/tools/list_dir" '{"path":"."}' "package.json"
run_test "read package.json" POST "/tools/read_file" '{"path":"package.json"}' "oco-strategie"
run_test "run_tests" POST "/tools/run_tests" '{}' "pass"

echo "TOTAL: $PASS pass / $FAIL fail"
[ "$FAIL" -eq 0 ] && MCP_STATUS=SUCCESS || MCP_STATUS=PARTIAL

SECRET="$FINAL_TOKEN"
curl -s -m 90 -X POST http://127.0.0.1:4099/execute \
  -H "Content-Type: application/json" \
  -H "x-worker-token: $SECRET" \
  -d "{\"instruction\":\"MCP Desktop final: $MCP_STATUS, mcp_tests $PASS pass. Bridge :5011. Verdict GO ou NO_GO en 1 ligne.\",\"async\":false}" \
  > logs/claude-worker-proof.json 2>/dev/null || true

echo "TOKEN=$TOKEN"
echo "STATUS=$MCP_STATUS"
