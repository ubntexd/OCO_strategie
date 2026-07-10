#!/bin/bash
set -e
cd /home/dev/dev/OCO_strategie
mkdir -p mcp mcp-bridge scripts docs tmp_mcp_sync
cp -f tmp_mcp_sync/filesystem-server.js tmp_mcp_sync/http-bridge.js mcp/ 2>/dev/null || true
cp -rf tmp_mcp_sync/mcp-bridge/* mcp-bridge/ 2>/dev/null || cp -f tmp_mcp_sync/Dockerfile mcp-bridge/ 2>/dev/null || true
cp -f tmp_mcp_sync/docker-compose.yml . 2>/dev/null || true
cp -f tmp_mcp_sync/bot.js src/ 2>/dev/null || true
cp -f tmp_mcp_sync/backtest.js dashboard/api/ 2>/dev/null || true
cp -f tmp_mcp_sync/wf3_stop_global.json n8n/workflows/ 2>/dev/null || true
cp -f tmp_mcp_sync/tunnel-mcp.sh tmp_mcp_sync/tunnel-mcp.bat tmp_mcp_sync/setup-mcp-desktop.sh scripts/ 2>/dev/null || true
cp -f tmp_mcp_sync/CLAUDE_DESKTOP_CONFIG.json tmp_mcp_sync/CONNEXION_CLAUDE_DESKTOP.md docs/ 2>/dev/null || true
cp -f tmp_mcp_sync/backtest.test.js tests/unit/ 2>/dev/null || true
chmod +x scripts/setup-mcp-desktop.sh scripts/tunnel-mcp.sh mcp/filesystem-server.js mcp/http-bridge.js
bash scripts/setup-mcp-desktop.sh
