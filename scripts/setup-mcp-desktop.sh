#!/bin/bash
# Setup MCP Claude Desktop — 12 étapes automatiques
set -e
cd /home/dev/dev/OCO_strategie
export PATH="/home/dev/.npm-global/bin:/usr/bin:/bin:$PATH"

echo "=== ÉTAPE 1 — ENVIRONNEMENT ==="
whoami && hostname && pwd
node --version && npm --version
grep PRETTY_NAME /etc/os-release || true
which claude && claude --version 2>/dev/null || echo "claude CLI optional"

echo "=== ÉTAPE 2 — MCP FILESYSTEM ==="
npm install -g @modelcontextprotocol/server-filesystem --prefix "$HOME/.npm-global" 2>/dev/null || true

echo "=== ÉTAPE 6 — DÉMARRAGE MCP BRIDGE ==="
chmod +x scripts/tunnel-mcp.sh mcp/filesystem-server.js mcp/http-bridge.js 2>/dev/null || true
sed -i 's/TRADING_HOURS_START=00:00/TRADING_HOURS_START=08:00/' .env.shared 2>/dev/null || true
sed -i 's/TRADING_HOURS_END=23:59/TRADING_HOURS_END=22:00/' .env.shared 2>/dev/null || true

docker compose --profile ops up -d --build mcp_bridge 2>&1 | tail -6
sleep 6

if curl -sf http://127.0.0.1:5011/health | grep -q ok; then
  echo "✅ MCP HTTP Bridge port 5011 OK"
else
  echo "Fallback host bridge..."
  pkill -f 'mcp/http-bridge' 2>/dev/null || true
  nohup node mcp/http-bridge.js > logs/mcp-bridge-host.log 2>&1 &
  sleep 3
fi
curl -s http://127.0.0.1:5011/health

echo "=== ÉTAPE 8 — MCP-REMOTE ==="
npm install -g mcp-remote --prefix "$HOME/.npm-global" 2>/dev/null || true

echo "=== ÉTAPE 12 — TESTS ==="
npm test 2>&1 | tail -8

echo "=== FIN SETUP MCP DESKTOP ==="
